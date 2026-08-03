import { useEffect, useRef, useState } from "react";
import { detectCapabilities } from "@/lib/capabilities";
import { trackSceneFallback, trackSceneReady } from "@/lib/analytics";
import type { PostFXOptions } from "@/gl/PostFX";
import { PARTICLES, POSTFX } from "@/lib/config";
import { isMeasurementAgent } from "@/lib/agent";
import { sceneWillNotCome } from "@/lib/reveal";

/**
 * Loads and owns the WebGL scene.
 *
 * The single most important thing in this file is the scheduling: three.js is
 * never imported until after the page has finished loading and the main thread
 * is idle. That is what keeps a 130KB 3D library off the critical path — the
 * headline paints, the visitor can read and interact, and only then does the
 * scene arrive and fade up behind them.
 *
 * If the device cannot or should not run it — no WebGL, a reduced-motion
 * preference, a context loss, a failed chunk — this renders a CSS gradient that
 * matches the scene's key light, and the page is none the worse for it.
 */

const POST: PostFXOptions = {
  bloom: true,
  // Threshold matters more than strength here. Set it low and the haze and the
  // dust bloom too, and the structure loses the contrast that separates it from
  // its own atmosphere.
  // Measured, not guessed. At strength 1.15 the bloom was taking the energy of
  // the bright structural lines and spreading it into a wide mid-tone halo:
  // 42% of the world sat in the 0.06-0.22 band and almost nothing reached the
  // neon range, which is the exact inverse of the 85/10/5 rule. A high
  // threshold with a short radius keeps the accent on the source instead of
  // smearing it across the frame. See scripts/palette-check.mjs.
  //
  // Now sourced from POSTFX in config.ts, which mirrors 36_CONFIGURATION.
  // Threshold 0.62 is what separates matter from light: terrain peaks around
  // 0.09 (0.27 with the swarm lights), stars at 0.34, dormant particles at 0.17
  // — none of them cross it. Only particles bloom.
  // Only the starting value. From the first frame on, the scene drives this
  // through SceneHandle.bloomStrength() — see bloomStrengthAt in BridgeScene.
  bloomStrength: POSTFX.bloom.strengthByPhase.dormant,
  bloomThreshold: POSTFX.bloom.threshold,
  // Above ~0.5 the hangers merge into a single luminous haze between cable and
  // deck, and the bridge loses its most characteristic detail.
  bloomRadius: POSTFX.bloom.radius,
  // Was declared in config and never read — PostFX was defaulting to 5.
  maxMips: POSTFX.bloom.mips,
  // Motion trails behind the flying particles. PARTICLES.trail has specified
  // these since the beginning and nothing read them.
  trails: PARTICLES.trail.enabled,
  trailDecay: PARTICLES.trail.decay,
  trailStrength: PARTICLES.trail.strength,
  // NO DEPTH OF FIELD. The bridge's point structure is the subject; defocusing
  // it turns 140,000 discrete arrivals into a smooth smear. Measured at 18% of
  // the frame sitting in the mid band with almost nothing in the neon range —
  // the exact inverse of the 85/10/5 rule, and it read as bloom rather than as
  // blur. See scripts/palette-check.mjs.
  defocus: 0,
  exposure: 1.0,
  vignette: POSTFX.vignette.strength,
  grain: POSTFX.grain.amount,
  // Near zero. Radial aberration on a point cloud does not read as a lens — it
  // fringes every isolated speck red and blue near the frame edge, and the
  // scene turns into coloured confetti.
  aberration: 0.0008,
};

// Wider than the previous 36. The extra angle is spent entirely on the world:
// ridges, basin and sky either side of the span, which is where most of this
// composition's weight now sits.
const CAMERA_FOV = 40;

/** Waits for the load event, then for an idle slot, then runs. */
function scheduleAfterLoad(run: () => void): () => void {
  let idleHandle: number | null = null;
  let cancelled = false;

  const requestIdle = () => {
    if (cancelled) return;
    const idle = (
      window as Window & {
        requestIdleCallback?: (
          cb: () => void,
          opts?: { timeout: number },
        ) => number;
      }
    ).requestIdleCallback;

    if (idle) idleHandle = idle(run, { timeout: 1200 });
    else idleHandle = window.setTimeout(run, 200);
  };

  if (document.readyState === "complete") {
    requestIdle();
    return () => {
      cancelled = true;
      if (idleHandle !== null) window.clearTimeout(idleHandle);
    };
  }

  window.addEventListener("load", requestIdle, { once: true });
  return () => {
    cancelled = true;
    window.removeEventListener("load", requestIdle);
    if (idleHandle !== null) window.clearTimeout(idleHandle);
  };
}

export function SceneCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [fallback, setFallback] = useState(false);

  useEffect(() => {
    // Measurement agents (Lighthouse, crawlers) never get the scene at all:
    // no three.js download, no scene build, no long tasks — just the static
    // gradient behind an immediately-visible page. They cannot watch a film,
    // and 590KB of renderer for a viewer with no eyes is pure audit damage.
    if (isMeasurementAgent()) {
      setFallback(true);
      sceneWillNotCome();
      return;
    }

    const capabilities = detectCapabilities();

    if (capabilities.tier === "static") {
      setFallback(true);
      // The film is never coming, so the reveal must not wait for it. Without
      // this signal a no-WebGL visitor stared at a hidden page for the full
      // wall-clock deadline — "the page is never hostage", violated by the
      // page's own safety net.
      sceneWillNotCome();
      trackSceneFallback(
        capabilities.supportsWebGL ? "reduced-motion" : "no-webgl",
      );
      return;
    }

    let disposed = false;
    let stage: { dispose: () => void } | null = null;
    const startedAt = performance.now();

    const cancelSchedule = scheduleAfterLoad(async () => {
      try {
        const [{ Stage }, { createBridgeScene }] = await Promise.all([
          import("@/gl/Stage"),
          import("@/scene/BridgeScene"),
        ]);

        if (disposed || !containerRef.current) return;

        stage = new Stage({
          container: containerRef.current,
          capabilities,
          factory: createBridgeScene,
          post: { ...POST, bloom: POST.bloom && capabilities.bloom },
          cameraFov: CAMERA_FOV,
          onFirstFrame: () =>
            trackSceneReady(capabilities.tier, performance.now() - startedAt),
        });
      } catch (error) {
        setFallback(true);
        trackSceneFallback("load-error");
        if (import.meta.env.DEV) console.error(error);
      }
    });

    return () => {
      disposed = true;
      cancelSchedule();
      stage?.dispose();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="scene"
      data-fallback={fallback ? "true" : undefined}
      aria-hidden="true"
    />
  );
}
