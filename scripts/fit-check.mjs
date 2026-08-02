/**
 * Checks that the page occupies exactly one viewport and nothing is cut off.
 *
 * The page cannot scroll, so anything that does not fit is simply invisible —
 * which is a failure mode with no symptom in a screenshot of the top of the
 * page. This asserts the two things that matter at a spread of real viewport
 * sizes: the document does not exceed the viewport, and the last element on the
 * page is actually inside it.
 */

import { chromium } from "playwright";

const BASE = process.env.BASE_URL ?? "http://localhost:4173";

const VIEWPORTS = [
  [1920, 1080, "desktop 1080p"],
  [1600, 900, "desktop 900"],
  [1536, 730, "laptop w/ browser chrome"],
  [1440, 810, "macbook air"],
  [1366, 640, "short laptop"],
  [1280, 600, "very short"],
  [1024, 768, "tablet landscape"],
  [834, 1112, "tablet portrait"],
  [430, 932, "phone large"],
  [390, 844, "phone"],
  [360, 640, "phone small"],
];

const browser = await chromium.launch({ channel: "chrome" });
let failures = 0;

for (const [width, height, label] of VIEWPORTS) {
  const page = await browser.newPage({ viewport: { width, height } });
  // Reported here, and reported nowhere else: a failed shader link, a chunk
  // that did not load, a React error swallowed by an error boundary.
  page.on("pageerror", (e) => {
    console.log(`  ${label}: PAGEERROR ${e.message.split("\n")[0]}`);
    failures += 1;
  });
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    console.log(`  ${label}: CONSOLE ${m.text().split("\n")[0]}`);
    failures += 1;
  });
  await page.goto(BASE, { waitUntil: "load", timeout: 60000 });
  // Entrance animations translate elements; measure once they have settled.
  await page.waitForTimeout(2200);

  const result = await page.evaluate(() => {
    const footer = document.querySelector(".footer");
    const keywords = document.querySelector(".footer-keywords");
    const rect = footer?.getBoundingClientRect();
    const kw = keywords?.getBoundingClientRect();
    return {
      docHeight: document.documentElement.scrollHeight,
      docWidth: document.documentElement.scrollWidth,
      inner: window.innerHeight,
      innerW: window.innerWidth,
      footerBottom: rect ? Math.round(rect.bottom) : null,
      keywordsVisible: kw ? kw.bottom <= window.innerHeight && kw.top >= 0 : false,
      headline: getComputedStyle(document.querySelector(".headline")).fontSize,
    };
  });

  const overflowY = result.docHeight - result.inner;
  const overflowX = result.docWidth - result.innerW;
  const ok =
    overflowY <= 1 &&
    overflowX <= 1 &&
    result.keywordsVisible &&
    result.footerBottom !== null &&
    result.footerBottom <= result.inner;

  if (!ok) failures += 1;

  console.log(
    `${ok ? "ok  " : "FAIL"} ${String(width).padStart(4)}x${String(height).padEnd(4)} ` +
      `${label.padEnd(24)} overflowY=${overflowY} overflowX=${overflowX} ` +
      `footerBottom=${result.footerBottom}/${result.inner} ` +
      `keywords=${result.keywordsVisible ? "visible" : "CUT"} h1=${result.headline}`,
  );

  await page.close();
}

await browser.close();
console.log(failures ? `\n${failures} viewport(s) failed` : "\nall viewports fit");
process.exit(failures ? 1 : 0);
