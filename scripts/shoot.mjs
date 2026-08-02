/**
 * Verification harness: loads the built page in headless Chromium, captures
 * console output (shader compile failures surface here) and writes a screenshot.
 *
 * Rendering is done by SwiftShader, so frame rate is irrelevant and the image
 * is only a correctness check — geometry, composition, colour. Judge the motion
 * in a real browser.
 */

import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = process.env.BASE_URL ?? "http://localhost:4173";
const WAIT = Number(process.env.WAIT_MS ?? 9000);
const OUT = process.env.OUT_DIR ?? "shots";
const [VW, VH] = (process.env.VIEWPORT ?? "1440x810").split("x").map(Number);

mkdirSync(OUT, { recursive: true });

const PAGES = [["bridge", "/index.html"]];

const browser = await chromium.launch({
  // Use a system Chromium build rather than Playwright's own, so verifying the
  // scenes never depends on a 150MB browser download.
  channel: process.env.BROWSER_CHANNEL ?? "chrome",
  args: [
    "--enable-unsafe-swiftshader",
    "--use-gl=swiftshader",
    "--ignore-gpu-blocklist",
    "--enable-webgl",
  ],
});

let failures = 0;

for (const [name, path] of PAGES) {
  const page = await browser.newPage({
    viewport: { width: VW, height: VH },
    deviceScaleFactor: 1,
  });

  const problems = [];
  page.on("console", (message) => {
    const text = message.text();
    // Driver performance notes are emitted by the screenshot itself (ReadPixels
    // stalls the GPU) and by software rendering generally. Reporting them as
    // problems trains you to ignore the output, which is worse than no output.
    if (/Performance|ReadPixels/i.test(text)) return;
    if (message.type() === "error" || /shader|WebGL|GL_/i.test(text)) {
      problems.push(`[${message.type()}] ${text}`);
    }
  });
  page.on("pageerror", (error) => problems.push(`[pageerror] ${error.message}`));

  await page.goto(`${BASE}${path}`, { waitUntil: "load", timeout: 60000 });

  // Wait on the scene's own progress where it publishes one. Animation advances
  // per frame, and SwiftShader renders at a fraction of real time — a fixed
  // wall-clock wait captures a half-assembled scene and makes every conclusion
  // drawn from the image wrong.
  //
  // Scenes without an assembly phase never publish the probe, so check for it
  // once rather than blocking on a value that will never arrive.
  const hasProbe = await page.evaluate(
    () =>
      new Promise((resolve) =>
        setTimeout(() => resolve(typeof window.__buildProgress === "number"), 3000),
      ),
  );

  if (hasProbe) {
    await page
      .waitForFunction(() => (window.__buildProgress ?? 0) >= 1.2, null, {
        // The reveal runs on scene time, and under a software rasteriser that
        // is many times wall time. Too short a wait photographs a half-built
        // bridge and every judgement made from the image is wrong.
        timeout: 600000,
        polling: 500,
      })
      .catch(() => console.warn(`  ${name}: assembly did not finish in time`));
  }

  await page.waitForTimeout(WAIT);

  await page.screenshot({ path: `${OUT}/${name}-${VW}x${VH}.png` });

  if (problems.length) {
    failures += 1;
    console.log(`\n=== ${name} — ${problems.length} problem(s) ===`);
    for (const problem of problems.slice(0, 12)) console.log("  " + problem);
  } else {
    console.log(`${name}: clean`);
  }

  await page.close();
}

await browser.close();
process.exit(failures > 0 ? 1 : 0);
