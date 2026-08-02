import * as THREE from "three";
import { PostFX, type PostFXOptions } from "./PostFX";
import { ticker, type FrameInfo } from "@/lib/ticker";
import type { Capabilities } from "@/lib/capabilities";
import { CAMERA, PERF } from "@/lib/config";
import { createGovernor, type DegradeStep, type Governor } from "@/lib/perf";

export interface Pointer {
  /** Smoothed, normalised device coordinates in [-1, 1]. */
  x: number;
  y: number;
  /** Unsmoothed target, for effects that should feel immediate. */
  targetX: number;
  targetY: number;
  /** False until the visitor has actually moved a pointer. */
  engaged: boolean;
  /**
   * How far the visitor has pushed IN, 0 to 1.
   *
   * Deliberately not raw wheel delta. The scene reads an absolute position, not
   * a rate, so it can be released and returned from — and so that a trackpad's
   * hundred small deltas and a mouse wheel's three large ones arrive at the same
   * place instead of one of them overshooting to the end of the travel.
   */
  dolly: number;
}

export interface SceneContext {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  capabilities: Capabilities;
  width: number;
  height: number;
  renderer: THREE.WebGLRenderer;
}

export interface SceneHandle {
  update(frame: FrameInfo, pointer: Pointer): void;
  resize(width: number, height: number): void;
  dispose(): void;
  /**
   * Optional fullscreen pass run between the scene and the bloom chain, with
   * the scene's colour and depth bound to it. A scene that wants to build its
   * own atmosphere out of the depth buffer returns one; one that does not,
   * does not, and nothing else changes.
   */
  atmosphere?: THREE.ShaderMaterial;
  /**
   * Bloom strength the scene wants for the frame it has just updated, or
   * undefined to leave it alone.
   *
   * The scene REPORTS rather than sets: post-processing stays owned by the
   * Stage, which is the only place that knows whether bloom is enabled on this
   * device at all. Same shape as `atmosphere` above — an optional channel a
   * scene opts into, with nothing changing for one that does not.
   */
  bloomStrength?(): number | undefined;
  /**
   * One rung of the degradation ladder, applied or reversed. Returns false for
   * rungs this scene does not own, so the governor moves on rather than counting
   * a step nothing took.
   *
   * Split between the scene and the Stage because the knobs are: post-processing
   * belongs to the Stage, and the population belongs to the scene.
   */
  degrade?(step: DegradeStep): boolean;
  restore?(step: DegradeStep): boolean;
  /**
   * The camera layer holding whatever should leave motion trails.
   *
   * A scene that publishes one gets an extra half-resolution pass of just that
   * layer, accumulated across frames. A scene that does not gets no trail pass
   * at all — the feature costs nothing when unused.
   */
  trailLayer?: number;
}

export type SceneFactory = (ctx: SceneContext) => SceneHandle;

export interface StageOptions {
  container: HTMLElement;
  capabilities: Capabilities;
  factory: SceneFactory;
  post: PostFXOptions;
  cameraFov?: number;
  onFirstFrame?: (msSinceStart: number) => void;
}

const INTRO_FADE_SECONDS = 1.4;

export class Stage {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private post: PostFX;
  private handle: SceneHandle;
  private container: HTMLElement;
  private capabilities: Capabilities;

  private pointer: Pointer = {
    x: 0, y: 0, targetX: 0, targetY: 0, engaged: false, dolly: 0,
  };
  private dollyTarget = 0;
  private dollyBumped = false;
  private lastDollyAt = 0;
  private governor!: Governor;

  /** What each post-processing knob was set to before the ladder touched it. */
  private baseline = new Map<DegradeStep, number>();

  /**
   * One rung, applied or reversed.
   *
   * Post-processing rungs are handled here; anything else is offered to the
   * scene. Reversal restores the ORIGINAL value rather than a scaled-back
   * guess, so a device that recovers returns to exactly the picture it started
   * with instead of drifting somewhere nearby over a long session.
   */
  private applyQuality(step: DegradeStep, degrade: boolean): boolean {
    const post = (key: DegradeStep, current: number, reduced: number) => {
      if (degrade) {
        if (!this.baseline.has(key)) this.baseline.set(key, current);
        return reduced;
      }
      const original = this.baseline.get(key);
      this.baseline.delete(key);
      return original ?? current;
    };

    switch (step) {
      case "chromaticAberration": {
        const v = post(step, this.post.getAberration(), 0);
        this.post.setAberration(v);
        return true;
      }
      case "grain": {
        const v = post(step, this.post.getGrain(), 0);
        this.post.setGrain(v);
        return true;
      }
      case "trailLength": {
        // An extra full pass over 82,000 points, so it is a real saving — and
        // it sits third because the streak is what makes the river read as one
        // current rather than as a cloud of separate dots.
        const v = post(step, this.post.getTrails() ? 1 : 0, 0);
        this.post.setTrails(v > 0.5);
        return true;
      }
      case "bloomRadius": {
        // Mip DEPTH, not the radius uniform — the uniform is a weak lever and
        // the depth is what actually costs fill rate. See D-021.
        const v = post(step, this.post.getBloomMips(), 2);
        this.post.setBloomMips(v);
        return true;
      }
      default:
        return degrade
          ? (this.handle.degrade?.(step) ?? false)
          : (this.handle.restore?.(step) ?? false);
    }
  }
  private resizeObserver: ResizeObserver;
  private unsubscribe: (() => void) | null = null;
  private unsubscribeSeek: (() => void) | null = null;
  private disposed = false;

  private fade = 0;
  private firstFrameReported = false;
  private startedAt = performance.now();
  private pixelRatio: number;

  // Adaptive degradation: a device can pass capability detection and still be
  // throttled. If we cannot hold a reasonable frame rate we give up resolution
  // before we give up smoothness.
  private slowFrameSeconds = 0;
  private degraded = false;

  constructor(options: StageOptions) {
    this.container = options.container;
    this.capabilities = options.capabilities;

    const { clientWidth, clientHeight } = options.container;
    const width = Math.max(1, clientWidth);
    const height = Math.max(1, clientHeight);

    this.renderer = new THREE.WebGLRenderer({
      antialias: false, // Bloom + grain hide edges; MSAA would cost more than it returns.
      alpha: false,
      powerPreference: "high-performance",
      stencil: false,
      depth: true,
    });
    // Colour management is handled explicitly in the composite pass.
    this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.renderer.setClearColor(0x000000, 1);

    this.pixelRatio = Math.min(
      window.devicePixelRatio || 1,
      options.capabilities.maxPixelRatio,
    );
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.setSize(width, height, false);

    const canvas = this.renderer.domElement;
    canvas.setAttribute("aria-hidden", "true");
    canvas.style.display = "block";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    options.container.appendChild(canvas);

    this.camera = new THREE.PerspectiveCamera(
      options.cameraFov ?? 45,
      width / height,
      0.1,
      400,
    );

    this.post = new PostFX(this.renderer, options.post);
    this.post.setSize(
      Math.floor(width * this.pixelRatio),
      Math.floor(height * this.pixelRatio),
    );

    this.handle = options.factory({
      scene: this.scene,
      camera: this.camera,
      capabilities: options.capabilities,
      width,
      height,
      renderer: this.renderer,
    });

    if (this.handle.atmosphere) this.post.setAtmospherePass(this.handle.atmosphere);

    /**
     * The knobs, split by ownership.
     *
     * Post-processing belongs to the Stage; the population and the lights belong
     * to the scene. Each returns false for a rung it does not own, and the
     * governor moves on rather than crediting itself with a step nothing took —
     * so a scene that implements none of them degrades through the post chain
     * alone instead of silently believing it has retreated.
     */
    this.governor = createGovernor({
      degrade: (step) => this.applyQuality(step, true),
      restore: (step) => this.applyQuality(step, false),
    });

    this.resizeObserver = new ResizeObserver(() => this.handleResize());
    this.resizeObserver.observe(options.container);

    window.addEventListener("pointermove", this.handlePointerMove, { passive: true });
    window.addEventListener("pointerdown", this.handlePointerDown, { passive: true });
    window.addEventListener("pointerup", this.handlePointerUp, { passive: true });
    window.addEventListener("pointercancel", this.handlePointerUp, { passive: true });
    window.addEventListener("pointerout", this.handlePointerOut, { passive: true });
    // On WINDOW, not on the container. The UI overlay sits above the canvas and
    // covers most of the left half, so a wheel event over the headline never
    // reached a container-scoped listener — push-in silently did nothing
    // wherever the visitor was most likely to have the cursor.
    window.addEventListener("wheel", this.handleWheel, { passive: false });
    this.renderer.domElement.addEventListener("webglcontextlost", this.handleContextLost);

    // The trail buffer is the one thing here that remembers previous frames.
    this.unsubscribeSeek = ticker.onSeek(() => this.post.clearTrails());

    const onFirstFrame = options.onFirstFrame;
    this.unsubscribe = ticker.add((frame) => {
      this.render(frame);
      if (!this.firstFrameReported) {
        this.firstFrameReported = true;
        onFirstFrame?.(performance.now() - this.startedAt);
      }
    });
  }

  private handleContextLost = (event: Event) => {
    // Losing the context is recoverable in principle, but a coming-soon page
    // does not justify the restore machinery. Bail out to the static poster.
    event.preventDefault();
    this.container.dataset.contextLost = "true";
    this.dispose();
  };

  /**
   * A touch is a HOLD, a mouse is a HOVER.
   *
   * `pointermove` alone is a mouse-only assumption. On a touchscreen it fires
   * only while a finger is actually sliding, so pressing and holding — which is
   * the whole gesture — produced nothing at all: the scene was inert to the one
   * input most of its visitors have.
   *
   * The two devices also disengage on opposite signals. A mouse that stops
   * moving is still pointing at something, so it stays engaged; a finger that
   * lifts is no longer touching anything, so it must not. Treating them alike
   * either leaves the disturbance frozen on screen after the finger is gone, or
   * cancels it every time the mouse rests.
   */
  private touchHeld = false;

  private setPointerFrom(event: PointerEvent) {
    const rect = this.container.getBoundingClientRect();
    this.pointer.targetX = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.targetY = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
  }

  private handlePointerMove = (event: PointerEvent) => {
    // A finger sliding without having been registered as down (the browser can
    // deliver a move first) still counts as holding.
    if (event.pointerType !== "mouse" && !this.touchHeld) return;
    this.setPointerFrom(event);
    this.pointer.engaged = true;
  };

  private handlePointerDown = (event: PointerEvent) => {
    if (event.pointerType !== "mouse") this.touchHeld = true;
    this.setPointerFrom(event);
    this.pointer.engaged = true;
  };

  private handlePointerUp = (event: PointerEvent) => {
    if (event.pointerType === "mouse") return;
    this.touchHeld = false;
    // Not snapped to zero. The scene's own return spring is deliberately slow —
    // things that are effortful to restore have mass — and cutting the input
    // instead of releasing it would throw that away at the last moment.
    this.pointer.engaged = false;
  };

  /** The cursor has left the document entirely. Nothing is being pointed at. */
  private handlePointerOut = (event: PointerEvent) => {
    if (event.relatedTarget === null) this.pointer.engaged = false;
  };

  /**
   * Push-in. NOT page scroll — this page does not scroll, so the wheel is free.
   *
   * Normalised against a nominal notch rather than summed raw, because a
   * trackpad delivers deltas an order of magnitude smaller than a mouse wheel
   * and one flick of either should mean roughly the same thing. Passive is not
   * an option here: the gesture has to be prevented from scrolling the document
   * behind the canvas.
   */
  private handleWheel = (event: WheelEvent) => {
    if (!CAMERA.dolly.enabled) return;

    // Only swallow the gesture when there is nothing to scroll. On a short
    // viewport the subscribe form can push the page taller than the window, and
    // a landing page that refuses to scroll because it would rather move its
    // camera is a landing page nobody can use.
    const scrollable =
      document.documentElement.scrollHeight > window.innerHeight + 1;
    if (!scrollable) event.preventDefault();

    this.dollyTarget = Math.min(1, Math.max(0, this.dollyTarget + event.deltaY / 900));
    // Stamped in render(), not here. ticker.now() is the SCENE clock and the
    // auto-return compares against frame.elapsed, which is the wall clock — the
    // two are seekable independently, and mixing them is the same mistake that
    // once made the scene start at a negative time.
    this.dollyBumped = true;
  };

  private handleResize() {
    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
    this.post.setSize(
      Math.floor(width * this.pixelRatio),
      Math.floor(height * this.pixelRatio),
    );
    this.handle.resize(width, height);
  }

  private degrade() {
    if (this.degraded || this.pixelRatio <= 1) return;
    this.degraded = true;
    this.pixelRatio = Math.max(1, this.pixelRatio * 0.7);
    this.renderer.setPixelRatio(this.pixelRatio);
    this.handleResize();
  }

  private render(frame: FrameInfo) {
    if (this.disposed) return;

    // Critically damped-ish smoothing, framerate independent.
    const smoothing = 1 - Math.pow(0.0015, frame.delta);
    this.pointer.x += (this.pointer.targetX - this.pointer.x) * smoothing;
    this.pointer.y += (this.pointer.targetY - this.pointer.y) * smoothing;

    // The push-in releases itself. A landing page that stays where it was shoved
    // greets its next reader with a composition nobody chose — and the visitor
    // who did the shoving has no way of knowing there was a way back.
    if (this.dollyBumped) {
      this.dollyBumped = false;
      this.lastDollyAt = frame.elapsed;
    }
    if (
      CAMERA.dolly.enabled &&
      this.dollyTarget > 0 &&
      frame.elapsed - this.lastDollyAt > CAMERA.dolly.autoReturnAfter
    ) {
      this.dollyTarget = Math.max(
        0, this.dollyTarget - CAMERA.dolly.autoReturnRate * frame.delta,
      );
    }
    this.pointer.dolly +=
      (this.dollyTarget - this.pointer.dolly) * CAMERA.dolly.lerp;

    this.handle.update(frame, this.pointer);

    const bloom = this.handle.bloomStrength?.();
    if (bloom !== undefined) this.post.setBloomStrength(bloom);

    // Fed the RAW frame duration, not the ticker's clamped delta. The clamp
    // exists so a tab left in the background does not teleport the animation
    // when it wakes; feeding it here would hide exactly the long frames the
    // governor is looking for.
    this.governor.sample(frame.raw * 1000, frame.phase);

    if (this.fade < 1) {
      this.fade = Math.min(1, this.fade + frame.delta / INTRO_FADE_SECONDS);
      // Ease-out so the reveal decelerates into place instead of stopping dead.
      this.post.setFade(1 - Math.pow(1 - this.fade, 3));

      // Published so capture harnesses can wait for the scene to be at full
      // brightness rather than guessing at a duration. Waiting on the first
      // frame is not enough: the intro fade needs 1.4 seconds of accumulated
      // delta, and under a software rasteriser that is many frames — every
      // measurement taken before it completes is of a dimmed composite, which
      // is a plausible and entirely wrong picture of the scene's colour.
      if (import.meta.env.DEV && typeof window !== "undefined") {
        (window as unknown as { __fade?: number }).__fade = this.fade;
      }
    } else if (import.meta.env.DEV && typeof window !== "undefined") {
      (window as unknown as { __fade?: number }).__fade = 1;
    }

    this.post.render(this.scene, this.camera, frame.elapsed, this.handle.trailLayer);

    // What the driver was actually asked to draw. When an object is on screen
    // in the source and absent from the frame, this is the only place that
    // distinguishes "drawn and invisible" from "never drawn".
    if (import.meta.env.DEV && typeof window !== "undefined") {
      (window as unknown as { __renderInfo?: unknown }).__renderInfo = {
        ...this.renderer.info.render,
      };
      // The governor's state, and a way to drive it with synthetic frame times.
      //
      // Feeding the GOVERNOR rather than calling the knobs directly is the whole
      // point: a test that reaches past it proves the knobs turn, not that the
      // thing deciding when to turn them works. The ladder otherwise only runs
      // on hardware nobody developing this has, which is how it came to be
      // specified in full and wired to nothing.
      const dev = window as unknown as {
        __perf?: unknown;
        __perfStress?: (frameMs: number, windows: number, phase: number) => unknown;
      };
      dev.__perf = { ...this.governor.state(), pixelRatio: this.pixelRatio };
      dev.__perfStress = (frameMs, windows, phase) => {
        const total = PERF.sampleFrames * windows;
        for (let i = 0; i < total; i++) {
          this.governor.sample(frameMs, (phase as FrameInfo["phase"]) ?? 5);
        }
        return this.governor.state();
      };
    }

    /**
     * Resolution is the LAST resort, after the whole ladder is spent.
     *
     * This predates the governor and used to fire on its own after 2.5 slow
     * seconds — which meant the first thing a struggling device gave up was
     * sharpness, before it had given up so much as the film grain. Two
     * independent degradation systems with different opinions is worse than
     * either alone: they would take turns, and the visitor would watch the page
     * get blurrier AND lose its atmosphere for the price of one.
     *
     * Now it waits for the governor to run out of rungs. It is also one-way, and
     * that is deliberate: dropping resolution is invisible until you compare,
     * while restoring it mid-session is a sudden sharpening that reads as a
     * glitch.
     */
    if (frame.fps < PERF.floorFps + 10) {
      this.slowFrameSeconds += frame.delta;
      const ladderSpent = this.governor.level() >= PERF.degradation.length;
      if (this.slowFrameSeconds > 2.5 && ladderSpent) this.degrade();
    } else {
      this.slowFrameSeconds = 0;
    }
  }

  get tier() {
    return this.capabilities.tier;
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.unsubscribe?.();
    this.unsubscribeSeek?.();
    this.resizeObserver.disconnect();
    window.removeEventListener("pointermove", this.handlePointerMove);
    window.removeEventListener("pointerdown", this.handlePointerDown);
    window.removeEventListener("pointerup", this.handlePointerUp);
    window.removeEventListener("pointercancel", this.handlePointerUp);
    window.removeEventListener("pointerout", this.handlePointerOut);
    window.removeEventListener("wheel", this.handleWheel);
    this.renderer.domElement.removeEventListener(
      "webglcontextlost",
      this.handleContextLost,
    );

    this.handle.dispose();
    this.post.dispose();

    this.scene.traverse((object) => {
      const mesh = object as THREE.Mesh | THREE.Points | THREE.LineSegments;
      mesh.geometry?.dispose?.();
      const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(material)) material.forEach((m) => m.dispose());
      else material?.dispose();
    });

    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.renderer.domElement.remove();
  }
}
