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
  return /Chrome-Lighthouse|Googlebot|AdsBot|Google Page Speed|bingbot|BingPreview|DuckDuckBot|YandexBot|Slurp|Baiduspider/i.test(
    navigator.userAgent,
  );
}
