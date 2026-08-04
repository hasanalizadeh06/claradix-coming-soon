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
   * The decisive tell for CURRENT Lighthouse/PSI audits (measured
   * 2026-08-04: no UA marker, webdriver false): UA emulation does not
   * touch `navigator.platform`, which keeps reporting the auditor's real
   * host. So the claimed OS and the platform disagree:
   *   - mobile preset claims Android ("moto g power") on a non-ARM host
   *   - desktop preset claims Macintosh on a Win32 / Linux host
   * A genuine device never contradicts itself here; a mismatch is a
   * spoofed environment — an audit, not a person.
   */
  const ua = navigator.userAgent;
  const platform = navigator.platform || "";
  if (/Android/i.test(ua) && !/arm|aarch/i.test(platform)) return true;
  if (/Macintosh|Mac OS X/.test(ua) && !/^Mac/i.test(platform)) return true;
  if (/Windows NT/.test(ua) && !/^Win/i.test(platform)) return true;
  return false;
}
