/**
 * THE DEGRADATION LADDER.
 *
 * A scene this heavy will not run everywhere, and the interesting question is
 * not whether it drops frames but what it gives up when it does. `PERF` has
 * always specified the answer — an ordered list, cheapest visual loss first —
 * and nothing read it. A weak device had no way to retreat: it simply stuttered
 * at full quality until the visitor left.
 *
 * ORDER IS THE WHOLE DESIGN
 * -------------------------
 * Ranked by visual cost per millisecond saved, and particle count is LAST
 * because the particles are the scene and everything above them is atmosphere.
 * A page that drops half its particles to keep its film grain has its priorities
 * exactly inverted.
 *
 *   aberration → grain → trails → swarm lights → bloom radius → terrain → count
 *
 * WHY IT IS ASYMMETRIC
 * --------------------
 * Downgrading takes one bad window. Upgrading takes three good ones in a row,
 * and a higher bar to clear. Oscillating between two tiers is far more visible
 * than simply running at the lower one — a scene that keeps changing its mind
 * reads as broken, while a scene that quietly settled reads as fine.
 *
 * WHEN IT IS ALLOWED TO ACT
 * -------------------------
 * Not before Phase 2. Phase 0 costs almost nothing and every device sails
 * through it, so measuring early hands a weak machine a high tier and then lets
 * it collapse exactly where the film needs the frames.
 *
 * And never during Phases 3–4. A particle count that changes mid-assembly is a
 * visible pop in the one sequence the whole page exists to show.
 */

import { PERF, type Phase } from "./config";

export type DegradeStep = (typeof PERF.degradation)[number];

export interface Governor {
  /** Called once per frame with the frame's duration in milliseconds. */
  sample(frameMs: number, phase: Phase): void;
  /** How many rungs down the ladder we currently are. */
  level(): number;
  /** For the capture harness, which cannot see a private field. */
  state(): { level: number; applied: DegradeStep[]; meanMs: number };
}

/**
 * Applies or reverses one rung. Returns false if this rung is not actionable
 * here, in which case the governor moves on to the next one rather than
 * counting a step it did not take.
 */
export interface QualityKnobs {
  degrade(step: DegradeStep): boolean;
  restore(step: DegradeStep): boolean;
}

export function createGovernor(knobs: QualityKnobs): Governor {
  const ladder = PERF.degradation;

  let applied: DegradeStep[] = [];
  let window: number[] = [];
  let goodWindows = 0;
  let meanMs = 0;

  /**
   * The best window seen recently, and when it was seen.
   *
   * A phone does not fall off a cliff; it slides. By the time the mean crosses
   * `downgradeMs` the visitor has already watched it get worse for half a
   * minute. Comparing against the best RECENT window catches the slide while it
   * is still a trend — which is the whole point of a thermal guard, and why it
   * is a ratio rather than another absolute threshold.
   */
  let best = Infinity;
  let bestAt = 0;
  let elapsed = 0;

  const stepDown = () => {
    for (const step of ladder) {
      if (applied.includes(step)) continue;
      if (!knobs.degrade(step)) continue;
      applied = [...applied, step];
      return true;
    }
    return false;
  };

  const stepUp = () => {
    for (let i = applied.length - 1; i >= 0; i--) {
      const step = applied[i];
      if (!knobs.restore(step)) continue;
      applied = applied.filter((_, n) => n !== i);
      return true;
    }
    return false;
  };

  return {
    sample(frameMs, phase) {
      elapsed += frameMs / 1000;

      // Measured from Phase 2, but the clock runs regardless — the thermal
      // guard's window has to mean sixty seconds of wall time, not sixty
      // seconds of the part we happened to be watching.
      if (phase < PERF.measureFromPhase) return;

      window.push(frameMs);
      if (window.length < PERF.sampleFrames) return;

      // MEDIAN, not mean. One 400ms stall while a texture uploads should not
      // cost the device a quality tier, and the mean cannot tell that stall
      // apart from ninety frames of genuinely being too slow.
      const sorted = [...window].sort((a, b) => a - b);
      meanMs = sorted[Math.floor(sorted.length / 2)];
      window = [];

      if (meanMs < best || elapsed - bestAt > PERF.thermalGuard.windowSeconds) {
        best = meanMs;
        bestAt = elapsed;
      }

      // Nothing may change mid-assembly, but the measurement still accumulates,
      // so the decision is ready the moment it becomes safe to act on.
      if (PERF.blockChangesDuringPhases.includes(phase)) return;

      const thermal = meanMs > best * PERF.thermalGuard.degradationThreshold;

      if (meanMs > PERF.downgradeMs || thermal) {
        goodWindows = 0;
        if (stepDown()) {
          // The device just changed. Everything measured before that describes
          // a scene that no longer exists.
          best = Infinity;
          bestAt = elapsed;
        }
        return;
      }

      if (meanMs < PERF.upgradeMs && applied.length > 0) {
        goodWindows += 1;
        if (goodWindows >= PERF.upgradeWindows) {
          goodWindows = 0;
          stepUp();
        }
        return;
      }

      goodWindows = 0;
    },

    level: () => applied.length,
    state: () => ({ level: applied.length, applied: [...applied], meanMs }),
  };
}
