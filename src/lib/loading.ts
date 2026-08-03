/**
 * The loading gate (2026-08-04 production pass).
 *
 * The visitor must never see an empty canvas or a half-initialized world:
 * a full-screen loader stands in front of everything from the first
 * prerendered byte, and comes down only after the scene has rendered its
 * first real frame.
 *
 * The contract with the timeline: the scene CLOCK is held paused while the
 * loader stands (the world initializes, fades itself in and renders its
 * opening frame invisibly behind it), and is released only when the
 * loader's fade-out has finished — so the choreography begins exactly as
 * the visitor first sees the world, never before.
 *
 * Every path that means "the film is not coming" (no WebGL, measurement
 * agents, reduced motion, a failed chunk) must also call sceneReady():
 * the loader may never hold the page hostage. A wall-clock deadline backs
 * that up in the component itself.
 */

import { ticker } from "@/lib/ticker";

type Listener = () => void;

let ready = false;
const listeners = new Set<Listener>();

/** The scene rendered its first frame — or is never coming. Idempotent. */
export function sceneReady(): void {
  if (ready) return;
  ready = true;
  for (const l of listeners) l();
}

export function isSceneReady(): boolean {
  return ready;
}

export function onSceneReady(listener: Listener): () => void {
  if (ready) {
    listener();
    return () => {};
  }
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Hold the scene clock while the loader stands. */
export function holdTimeline(): void {
  ticker.pause();
}

/** The loader has fully faded — let the film begin. */
export function releaseTimeline(): void {
  ticker.resume();
}
