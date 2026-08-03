/**
 * A single requestAnimationFrame loop for the whole page, and the scene's clock.
 *
 * Four things this does that a bare rAF in a useEffect does not:
 *   1. Stops completely when the tab is hidden. A WebGL loop left running in a
 *      background tab is the most common cause of "this site drains my battery".
 *   2. Clamps delta time, so a tab restored after two minutes does not advance
 *      the simulation by two minutes in a single frame.
 *   3. Measures sustained frame rate so scenes can shed quality on devices that
 *      benchmarked well but are actually thermally throttled.
 *   4. Owns SCENE TIME — the scaled, seekable timeline every phase and every
 *      particle schedule is expressed against.
 *
 * On scene time being seekable
 * ----------------------------
 * A particle's position is a pure function of its attributes and the current
 * scene time; nothing is integrated frame to frame. That is what allows
 * `seek(10.5)` to render exactly the T+10.500 frame with no simulation, and it
 * is what makes every visual acceptance check possible — `shoot`, `compare`,
 * `palette`, `reveal-check` and `interact-check` all depend on it.
 *
 * `seek()` must never be called in production. The build asserts this.
 */

import {
  A11Y,
  CYCLE_LENGTH,
  INTRO_START,
  LOOP,
  SCENE,
  TIMELINE,
  type Phase,
} from "@/lib/config";

export interface FrameInfo {
  /** Seconds since the previous frame, clamped to a sane maximum. */
  delta: number;
  /**
   * The same interval UNCLAMPED — what the frame actually cost.
   *
   * Animation must use `delta`, or a tab restored after two minutes advances the
   * scene by two minutes in a single step. Performance measurement must use
   * this, because the clamp hides precisely the long frames it is looking for:
   * a device stuttering at 200ms per frame reports a healthy 50ms once clamped,
   * and the governor never sees a reason to act.
   */
  raw: number;
  /** Seconds since the ticker started, excluding time spent hidden. */
  elapsed: number;
  /** Rolling average frames per second over roughly the last second. */
  fps: number;
  /** Scene time in seconds — `elapsed` scaled, offset by any seek. */
  sceneTime: number;
  /** Which phase `sceneTime` falls in. */
  phase: Phase;
}

type FrameCallback = (frame: FrameInfo) => void;

const MAX_DELTA = 1 / 20;

/**
 * A tab hidden for longer than this returns to the finished scene rather than
 * resuming mid-build: a viewer coming back to a half-built bridge has lost the
 * context that made it legible, and would see structure appearing with no
 * explanation.
 */
const HIDDEN_RESUME_THRESHOLD = 0.5;

/** Pure, so scripts and the prerender can ask without instantiating anything. */
export function phaseAt(sceneTime: number): Phase {
  // The scene wraps its clock modulo one cycle when the loop is on; the phase
  // must wrap identically or every consumer (the perf governor especially)
  // reads "phase 6, forever" from the second cycle onward.
  const t = SCENE.loop ? sceneTime % CYCLE_LENGTH : sceneTime;
  if (t < TIMELINE.phase1_awakeningStart) return 0;
  if (t < TIMELINE.phase2_glideStart) return 1;
  if (t < TIMELINE.phase3_assemblyStart) return 2;
  if (t < TIMELINE.phase4_completionStart) return 3;
  if (t < TIMELINE.phase5_livingStart) return 4;
  if (!SCENE.loop) return 5;

  const rewindStart = TIMELINE.phase5_livingStart + LOOP.holdAfterComplete;
  return t < rewindStart ? 5 : 6;
}

class Ticker {
  private callbacks = new Set<FrameCallback>();
  private seekListeners = new Set<() => void>();
  private rafId: number | null = null;

  /**
   * Null until the first animation frame supplies a timestamp.
   *
   * This used to be seeded from `performance.now()` in start(), which mixes two
   * clocks: the value passed to a rAF callback is the time the FRAME began, and
   * that can precede the `performance.now()` reading taken when the loop was
   * installed. Measured here, the first callback arrived carrying t=2320ms
   * against a start() reading of ~4500ms — a single −2.18s delta, which the
   * `Math.min(raw, MAX_DELTA)` clamp passed straight through because it had no
   * lower bound.
   *
   * The scene clock then ran negative for its first two seconds, so Phase 0
   * lasted three seconds instead of 1.2 and every schedule was offset.
   *
   * Seeding from the first callback removes the mixing entirely.
   */
  private lastTime: number | null = null;
  private elapsed = 0;
  private fps = 60;
  private fpsAccumulator = 0;
  private fpsFrames = 0;
  private started = false;
  private hiddenAt: number | null = null;

  /**
   * Scene time is not simply `elapsed * timeScale`: a seek moves the origin
   * without touching wall time, so the two are tracked separately. It starts
   * at INTRO_START — zero in loop mode, past the gathering otherwise.
   */
  private sceneTime = INTRO_START;
  private timeScale: number = SCENE.timeScale;
  private paused = false;

  /** Set once by the host when it detects a jump is needed. */
  onSceneJump: ((to: number) => void) | null = null;

  add(cb: FrameCallback): () => void {
    this.callbacks.add(cb);
    this.start();
    return () => {
      this.callbacks.delete(cb);
      if (this.callbacks.size === 0) this.stop();
    };
  }

  // -- scene time ----------------------------------------------------------

  now(): number {
    return this.sceneTime;
  }

  raw(): number {
    return this.elapsed;
  }

  phase(): Phase {
    return phaseAt(this.sceneTime);
  }

  setTimeScale(scale: number) {
    this.timeScale = scale;
  }

  get isPaused() {
    return this.paused;
  }

  pause() {
    this.paused = true;
  }

  resume() {
    this.paused = false;
  }

  /**
   * Jump the scene clock. Capture tooling and the reduced-motion path only —
   * never call this in response to anything a visitor does.
   */
  seek(t: number) {
    this.sceneTime = t;
    for (const listener of this.seekListeners) listener();
  }

  /**
   * Notified whenever the clock jumps.
   *
   * Almost nothing in this scene needs it — position is a pure function of time,
   * which is the whole reason seeking works at all. The exception is anything
   * that ACCUMULATES across frames, and there is exactly one of those: the trail
   * buffer. After a jump it holds a smear from wherever the clock used to be,
   * and without this it would drag ten seconds of the wrong history across the
   * frame being measured.
   */
  onSeek(listener: () => void): () => void {
    this.seekListeners.add(listener);
    return () => this.seekListeners.delete(listener);
  }

  /**
   * The reduced-motion entry point. The intro does not play at a lower speed or
   * with fewer particles; it does not play. The scene renders its settled frame
   * from the first rendered frame onward.
   */
  applyReducedMotion() {
    if (A11Y.reducedMotion.skipIntro) this.seek(TIMELINE.phase5_livingStart);
  }

  // -- loop ----------------------------------------------------------------

  private start() {
    if (this.started) return;
    this.started = true;
    this.lastTime = null;
    document.addEventListener("visibilitychange", this.handleVisibility);
    this.rafId = requestAnimationFrame(this.loop);
  }

  private stop() {
    this.started = false;
    document.removeEventListener("visibilitychange", this.handleVisibility);
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.rafId = null;
  }

  private handleVisibility = () => {
    if (document.hidden) {
      this.hiddenAt = performance.now();
      if (this.rafId !== null) cancelAnimationFrame(this.rafId);
      this.rafId = null;
      return;
    }

    if (!this.started) return;

    const hiddenFor =
      this.hiddenAt === null ? 0 : (performance.now() - this.hiddenAt) / 1000;
    this.hiddenAt = null;

    // With the LOOP on, no jump — the world cycles forever, so any moment is
    // a valid moment to return to, and the jump's side effect was an ugly
    // one: the scene snapped to the finished bridge and the UI popped in all
    // at once ("the texts appear suddenly"). The jump only ever made sense
    // for a play-once scene resuming mid-build.
    if (
      !SCENE.loop &&
      hiddenFor > HIDDEN_RESUME_THRESHOLD &&
      this.sceneTime < TIMELINE.phase5_livingStart
    ) {
      this.sceneTime = TIMELINE.phase5_livingStart;
      this.onSceneJump?.(this.sceneTime);
    }

    this.lastTime = null;
    if (this.rafId === null) this.rafId = requestAnimationFrame(this.loop);
  };

  private loop = (now: number) => {
    this.rafId = requestAnimationFrame(this.loop);

    // First frame after start or after returning from hidden: adopt the frame
    // clock and advance nothing. One dropped frame costs nothing; guessing the
    // interval against a different clock costs the whole timeline.
    if (this.lastTime === null) {
      this.lastTime = now;
      return;
    }

    const raw = (now - this.lastTime) / 1000;
    this.lastTime = now;

    // Clamped at BOTH ends. The upper bound stops a tab restored after two
    // minutes advancing the simulation by two minutes in one frame; the lower
    // bound stops any clock irregularity running the scene backwards, which is
    // never a thing a viewer should be able to observe.
    const delta = Math.min(Math.max(raw, 0), MAX_DELTA);
    this.elapsed += delta;

    if (!this.paused) this.sceneTime += delta * this.timeScale;

    this.fpsAccumulator += raw;
    this.fpsFrames += 1;
    if (this.fpsAccumulator >= 1) {
      this.fps = this.fpsFrames / this.fpsAccumulator;
      this.fpsAccumulator = 0;
      this.fpsFrames = 0;
    }

    const frame: FrameInfo = {
      delta,
      raw: Math.max(raw, 0),
      elapsed: this.elapsed,
      fps: this.fps,
      sceneTime: this.sceneTime,
      phase: phaseAt(this.sceneTime),
    };
    for (const cb of this.callbacks) cb(frame);
  };
}

export const ticker = new Ticker();

/**
 * Exposed for capture tooling. Playwright drives the scene by calling this
 * rather than waiting in real time, which is why the whole suite runs in about
 * four minutes instead of twelve seconds per captured frame.
 */
declare global {
  interface Window {
    __claradixSeek?: (t: number) => void;
  }
}

if (typeof window !== "undefined" && import.meta.env.DEV) {
  window.__claradixSeek = (t: number) => ticker.seek(t);
  (window as unknown as { __ticker?: unknown }).__ticker = ticker;
}
