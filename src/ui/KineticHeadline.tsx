import { COPY } from "@/lib/copy";
import { reveal } from "@/lib/reveal";

/**
 * The headline, revealed one LINE at a time.
 *
 * It used to be one character at a time, and the reason for the change is in
 * UI_REVEAL.sequence: the choreography names `headline-line-1`, `-2`, `-3` with
 * their own offsets, which is a per-line instruction, not a per-character one.
 *
 * The distinction is about what a headline is for. Blocks are seen; lines are
 * read. A character sweep asks the eye to track a moving edge, which is the
 * opposite of reading — and it arrives here twelve seconds into an animation
 * that has just finished doing something far more interesting. The page should
 * be settling at this point, not starting a second performance.
 *
 * Words are still grouped, because the containing spans are inline-block and a
 * browser will happily break a line inside one — "Someth / ing new" — once there
 * is no longer any such thing as a word to it.
 *
 * Assistive technology reads the aria-label and never sees the spans.
 */
export function KineticHeadline({ revealed }: { revealed: boolean }) {
  const lines = COPY.headline;

  return (
    <h1 className="headline" aria-label={lines.join(" ")}>
      {lines.map((text, index) => (
        <span
          key={index}
          {...reveal(
            // The sequence defines three lines and the copy currently has two.
            // Clamping rather than throwing: a headline is content, and content
            // is allowed to change length without taking the page down with it.
            `headline-line-${Math.min(index + 1, 3)}`,
            revealed,
            index === 1 ? "headline-line headline-line--accent" : "headline-line",
          )}
          aria-hidden="true"
        >
          {text}
        </span>
      ))}
    </h1>
  );
}
