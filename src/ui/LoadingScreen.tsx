import { useEffect, useRef, useState } from "react";
import { SITE } from "@/lib/config";
import { isSceneReady, onSceneReady, releaseTimeline } from "@/lib/loading";

/**
 * The first thing a visitor sees (2026-08-04 production pass): a deep
 * black card with the Claradix mark breathing in a soft emerald glow and
 * an elegant progress line — standing in front of the scene until the
 * world has rendered its first real frame.
 *
 * The progress is deliberately CHOREOGRAPHED, not measured: real asset
 * progress across a code-split three.js scene is a lie of plateaus and
 * jumps. The line eases toward 90% on a fixed cinematic curve and snaps
 * to 100 the moment the scene signals ready — which reads as honest
 * because the page genuinely opens at that instant.
 *
 * Two hard guarantees:
 *   - The loader can never hold the page hostage: a wall-clock deadline
 *     force-completes it even if every readiness signal is lost.
 *   - The scene clock stays paused underneath, and is released only when
 *     the fade-out FINISHES — the film begins exactly as it becomes
 *     visible (see lib/loading.ts).
 */

const FADE_MS = 750;
/** If nothing ever signals readiness, open anyway. The page is never hostage. */
const DEADLINE_MS = 9000;

export function LoadingScreen() {
  const [phase, setPhase] = useState<"loading" | "fading" | "gone">("loading");
  const [progress, setProgress] = useState(0);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    if (isSceneReady()) {
      setPhase("fading");
      return;
    }

    let raf = 0;
    const tick = (now: number) => {
      if (startRef.current === null) startRef.current = now;
      const t = (now - startRef.current) / 1000;
      // Ease toward 90% over ~2.6s — cinematic, never complete on its own.
      setProgress(Math.min(90, 90 * (1 - Math.exp(-t / 0.9))));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    const offReady = onSceneReady(() => setPhase("fading"));
    const deadline = window.setTimeout(() => setPhase("fading"), DEADLINE_MS);

    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(deadline);
      offReady();
    };
  }, []);

  useEffect(() => {
    if (phase !== "fading") return;
    setProgress(100);
    const done = window.setTimeout(() => {
      releaseTimeline();
      setPhase("gone");
    }, FADE_MS);
    return () => window.clearTimeout(done);
  }, [phase]);

  if (phase === "gone") return null;

  return (
    <div
      className={`loader${phase === "fading" ? " loader--fading" : ""}`}
      aria-hidden="true"
    >
      <div className="loader-glow" />
      <img
        className="loader-logo"
        src="/img/claradix-logo.png"
        alt={SITE.name}
        width={132}
        height={85}
        decoding="async"
      />
      <div className="loader-track">
        <div
          className="loader-bar"
          style={{ transform: `scaleX(${progress / 100})` }}
        />
      </div>
      <div className="loader-pct">{Math.round(progress)}%</div>
    </div>
  );
}
