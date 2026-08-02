/**
 * Stacks two screenshots into one image for before/after review.
 *
 *   node scripts/compare.mjs <before.png> <after.png> <out.png> "left label" "right label"
 */

import { chromium } from "playwright";
import { writeFileSync, unlinkSync } from "node:fs";
import { resolve } from "node:path";

const [before, after, out, labelA = "Before", labelB = "After"] =
  process.argv.slice(2);

if (!before || !after || !out) {
  console.error("usage: node scripts/compare.mjs <before> <after> <out> [labelA] [labelB]");
  process.exit(1);
}

const page = `<!doctype html><meta charset="utf-8">
<style>
  body { margin: 0; background: #050810; font: 500 13px/1 "Segoe UI", sans-serif; color: #7cfc00; }
  figure { margin: 0; padding: 14px 16px 4px; }
  figcaption { letter-spacing: .2em; text-transform: uppercase; margin-bottom: 8px; }
  img { width: 100%; display: block; border: 1px solid rgba(255,255,255,.1); }
</style>
<figure><figcaption>${labelA}</figcaption><img src="${before.split("/").pop()}"></figure>
<figure><figcaption>${labelB}</figcaption><img src="${after.split("/").pop()}"></figure>`;

const temp = resolve("shots/_compare.html");
writeFileSync(temp, page, "utf8");

const browser = await chromium.launch({ channel: "chrome" });
const tab = await browser.newPage({
  viewport: { width: 1280, height: 1400 },
  deviceScaleFactor: 1.4,
});
await tab.goto(`file:///${temp.replace(/\\/g, "/")}`);
await tab.waitForTimeout(900);
await tab.screenshot({ path: out, fullPage: true });
await browser.close();
unlinkSync(temp);

console.log(`wrote ${out}`);
