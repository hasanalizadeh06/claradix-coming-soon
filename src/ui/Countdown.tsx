import { useEffect, useState } from "react";
import { LAUNCH_DATE, UI_REVEAL } from "@/lib/config";
import type { Copy } from "@/lib/copy";
import { reveal, revealDelay } from "@/lib/reveal";

/** From UI_REVEAL.sequence, not typed in again here. */
const UNIT_STAGGER_MS = Math.round(
  (UI_REVEAL.sequence.find((s) => s.id === "countdown-units")?.childStagger ??
    0) * 1000,
);

/**
 * Countdown, or an honest substitute.
 *
 * If VITE_LAUNCH_DATE is not set — or has already passed — this renders a build
 * status instead of a timer counting down to nothing. A visitor who returns to
 * find the countdown reset has learned the site lies, and they will apply that
 * lesson to everything else on it.
 */

interface Remaining {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

function remainingFrom(target: Date): Remaining | null {
  const ms = target.getTime() - Date.now();
  if (ms <= 0) return null;
  const totalSeconds = Math.floor(ms / 1000);
  return {
    days: Math.floor(totalSeconds / 86400),
    hours: Math.floor(totalSeconds / 3600) % 24,
    minutes: Math.floor(totalSeconds / 60) % 60,
    seconds: totalSeconds % 60,
  };
}

function pad(value: number) {
  return value.toString().padStart(2, "0");
}

export function Countdown({ copy, revealed }: { copy: Copy; revealed: boolean }) {
  const [remaining, setRemaining] = useState<Remaining | null>(() =>
    LAUNCH_DATE ? remainingFrom(LAUNCH_DATE) : null,
  );

  useEffect(() => {
    const target = LAUNCH_DATE;
    if (!target) return;
    // Recomputed from the wall clock every tick rather than decremented, so a
    // throttled background tab cannot cause drift.
    const id = window.setInterval(() => {
      setRemaining(remainingFrom(target));
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  if (!LAUNCH_DATE || !remaining) {
    return (
      <div className="build-status" role="status">
        <span className="build-status-label">{copy.buildStatus}</span>
        <span className="build-status-bar" aria-hidden="true">
          <span />
        </span>
      </div>
    );
  }

  const cells: Array<[number, string]> = [
    [remaining.days, copy.countdown[0]],
    [remaining.hours, copy.countdown[1]],
    [remaining.minutes, copy.countdown[2]],
    [remaining.seconds, copy.countdown[3]],
  ];

  return (
    <div
      className="countdown"
      role="timer"
      // Announcing every second would make a screen reader unusable. The label
      // carries the meaning; the ticking digits are decorative.
      aria-live="off"
      aria-label={`${remaining.days} ${copy.countdown[0]}, ${remaining.hours} ${copy.countdown[1]}, ${remaining.minutes} ${copy.countdown[2]}`}
    >
      {cells.map(([value, label], index) => (
        <div
          key={label}
          // The units land one after another, 70ms apart, AFTER the ring has
          // finished drawing itself. The ring is the container; numbers
          // appearing inside a container that is still being drawn read as the
          // two elements being unrelated.
          {...reveal("countdown-units", revealed, "countdown-cell")}
          style={{
            ["--enter-delay" as string]:
              revealDelay("countdown-units") + index * UNIT_STAGGER_MS,
          }}
        >
          {/* Prerendered at build time, corrected on the first tick. The
              mismatch is expected and not worth a console warning. */}
          <span className="countdown-value" suppressHydrationWarning>
            {pad(value)}
          </span>
          <span className="countdown-label">{label}</span>
        </div>
      ))}
      <span
        {...reveal("countdown-units", revealed, "countdown-date")}
        style={{
          ["--enter-delay" as string]:
            revealDelay("countdown-units") + cells.length * UNIT_STAGGER_MS,
        }}
      >
        {`${pad(LAUNCH_DATE.getDate())}.${pad(LAUNCH_DATE.getMonth() + 1)}.${LAUNCH_DATE.getFullYear()}`}
      </span>
    </div>
  );
}
