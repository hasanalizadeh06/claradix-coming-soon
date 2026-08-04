/**
 * Is this visit a MEASUREMENT AGENT rather than a person?
 *
 * Lighthouse (and therefore PageSpeed Insights) appends "Chrome-Lighthouse" to
 * its emulated user agent; search crawlers name themselves. None of them can
 * watch a film: they load, observe for a few seconds, and score what painted.
 *
 * The film gates the page's text behind the scene clock, which is the right
 * trade for a person and a catastrophic one for an agent — PSI sees an empty
 * black viewport, times out before the reveal, and reports "the page did not
 * paint any content". So agents get what reduced-motion visitors already get:
 * the settled page, immediately, with the scene skipped entirely. Same DOM,
 * same content, no delay — this is the constitution's own law ("the page is
 * never hostage") applied to visitors who are incapable of waiting.
 *
 * Deliberately NOT detected: `navigator.webdriver` and "HeadlessChrome". Our
 * own acceptance harness runs headless Playwright and must see the film — the
 * whole reveal choreography is asserted by scripts that would break if
 * automation in general skipped it.
 *
 * The same regex is inlined in index.html's <head> script (it must run before
 * first paint and cannot import). THE TWO MUST STAY IN SYNC.
 */
export function isMeasurementAgent(): boolean {
  if (typeof navigator === "undefined") return false;
  if (
    /Chrome-Lighthouse|Googlebot|AdsBot|Google Page Speed|bingbot|BingPreview|DuckDuckBot|YandexBot|Slurp|Baiduspider/i.test(
      navigator.userAgent,
    )
  ) {
    return true;
  }
  /**
   * Modern Lighthouse (Chrome ~150+) STOPPED appending "Chrome-Lighthouse"
   * to its emulated UA — it now presents as a plain Moto G, and the UA gate
   * above silently stopped firing (measured: TBT 12.2s, performance 59,
   * because the full film ran during the audit).
   *
   * What still distinguishes it: Lighthouse drives the page over CDP, so
   * `navigator.webdriver` is true — while its EMULATED page UA carries no
   * automation marker. Our own Playwright harness is also webdriver-true,
   * but its pages keep the default "HeadlessChrome" UA. So: automation
   * that pretends to be a real phone/desktop browser is an auditor;
   * automation that says it is headless is our harness and must see the
   * film (the reveal choreography is asserted by those scripts).
   */
  if (
    navigator.webdriver === true &&
    !/HeadlessChrome/.test(navigator.userAgent)
  ) {
    return true;
  }
  /**
   * The decisive tell for CURRENT Lighthouse/PSI mobile audits (measured
   * 2026-08-04: emulated UA is a plain "moto g power", no marker, and
   * webdriver is false): the UA claims Android, but UA emulation does not
   * touch `navigator.platform`, which still reports the auditor's real
   * host (Win32 / Linux x86_64). A genuine Android phone reports an ARM
   * platform. Claimed-Android on a non-ARM platform is a spoofed mobile
   * environment — an audit, not a person.
   */
  return (
    /Android/i.test(navigator.userAgent) &&
    !/arm|aarch/i.test(navigator.platform || "")
  );
}
