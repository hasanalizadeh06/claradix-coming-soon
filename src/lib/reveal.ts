/**
 * WHEN THE PAGE ARRIVES.
 *
 * The UI is not supposed to be there at the start. The bridge builds across an
 * empty valley, and only once it is finished does the page assemble itself on
 * top — logo, eyebrow, headline line by line, lead, form, socials, ring,
 * countdown, footer. Eleven elements, in that order, off the SCENE clock.
 *
 * It was previously off the page-load clock, with the delays written as bare
 * milliseconds at each call site. Everything was fully visible about 1.3 seconds
 * in, while the bridge still had ten seconds of building left to do — so the one
 * moment the whole animation exists to earn had already been spent before it
 * started.
 *
 * THE SAFETY NET IS THE HARD PART
 * -------------------------------
 * Gating readable text on a WebGL animation is a promise that the animation will
 * finish. It might not: no WebGL, a failed chunk, a context loss, a device so
 * slow the scene clock crawls, or a visitor who never triggers whatever starts
 * it. Any of those, taken literally, leaves a blank page forever.
 *
 * So this resolves on the FIRST of three signals, and two of them do not involve
 * the scene at all:
 *
 *   1. the scene clock reaches TIMELINE.uiRevealStart          — the intended path
 *   2. reduced motion is requested                             — immediately
 *   3. a wall-clock deadline passes                            — regardless
 *
 * (3) is not a fallback for failure alone. A slow device SHOULD show its text
 * early even while the scene is still building: the animation is the treat, the
 * page is the point.
 *
 * ONCE REVEALED, IT STAYS REVEALED
 * --------------------------------
 * The loop rewinds the bridge and rebuilds it. The UI does not go with it.
 * Removing text from under someone who is reading it — or worse, from under a
 * half-typed email address — is hostile in a way no animation earns back.
 */

import { useEffect, useState } from "react";
import { TIMELINE, UI_REVEAL } from "./config";
import { ticker } from "./ticker";

/**
 * How long to wait in wall-clock seconds before revealing regardless.
 *
 * Generous against the 12.4s scene target, so a healthy device always reveals
 * on the scene clock and this never fires. Short enough that a broken one is
 * readable well inside the window where a visitor is still deciding whether the
 * page is broken.
 */
const DEADLINE_SECONDS = 20;

function prefersReducedMotion(): boolean {
  return (
    typeof matchMedia !== "undefined" &&
    matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export function useUiReveal(): boolean {
  // Server-rendered markup must match the client's FIRST render exactly, and on
  // the server there is no clock and no media query. Both start false and the
  // effect below decides — which also means the prerendered HTML ships with the
  // UI hidden, and a visitor with JavaScript disabled would see nothing.
  // `.enter` therefore animates from opacity 0 to 1 with `forwards` rather than
  // being display-gated: no JS means no animation, and no animation means the
  // element sits at its natural opacity. Hidden is a state we can only enter
  // once we know we can leave it.
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    if (prefersReducedMotion()) {
      instantReveal = true;
      setRevealed(true);
      return;
    }

    // Already past the reveal at MOUNT time — a remount (HMR, hydration
    // replay, error recovery) on a page whose reveal already happened. The
    // entrance choreography plays ONCE per page life; replaying it here is
    // the "the texts loaded again" glitch. Settle instantly instead.
    if (ticker.now() >= TIMELINE.uiRevealStart) {
      instantReveal = true;
      setRevealed(true);
      return;
    }

    let raf = 0;
    const startedAt = performance.now();

    const poll = () => {
      const bySceneClock = ticker.now() >= TIMELINE.uiRevealStart;
      const byDeadline =
        (performance.now() - startedAt) / 1000 >= DEADLINE_SECONDS;

      if (bySceneClock || byDeadline) {
        setRevealed(true);
        return;
      }
      raf = requestAnimationFrame(poll);
    };

    raf = requestAnimationFrame(poll);
    return () => cancelAnimationFrame(raf);
  }, []);

  return revealed;
}

/**
 * True when the reveal condition was ALREADY met when the app mounted.
 *
 * Module state, deliberately: it describes the PAGE, not a component. When a
 * component tree remounts on a revealed page, every element renders in the
 * settled state — visible, no animation — instead of replaying its entrance.
 */
let instantReveal = false;

/** Offsets are authored in seconds; CSS wants milliseconds. */
const OFFSETS = new Map<string, number>(
  UI_REVEAL.sequence.map((step) => [step.id, Math.round(step.offset * 1000)]),
);

/**
 * The delay for one element of the sequence, in milliseconds.
 *
 * Throws on an unknown id rather than defaulting to zero. A typo that silently
 * reveals an element first is the exact failure this indirection exists to
 * prevent — the whole point of moving these out of the markup was that eleven
 * bare numbers scattered across a component tree cannot be read as an order.
 */
export function revealDelay(id: string): number {
  const ms = OFFSETS.get(id);
  if (ms === undefined) {
    throw new Error(
      `reveal: unknown id "${id}". Known: ${[...OFFSETS.keys()].join(", ")}`,
    );
  }
  return ms;
}

/**
 * Props for one element of the reveal.
 *
 * `data-reveal` carries the id into the DOM so `scripts/reveal-check.mjs` can
 * assert the rendered order against UI_REVEAL.sequence rather than against a
 * copy of it that has to be kept in step by hand.
 */
export function reveal(id: string, revealed: boolean, className?: string) {
  const state = revealed
    ? instantReveal
      ? "enter enter--settled"
      : "enter"
    : "enter enter--waiting";
  return {
    className: className ? `${className} ${state}` : state,
    "data-reveal": id,
    style: { ["--enter-delay" as string]: revealDelay(id) },
  };
}
