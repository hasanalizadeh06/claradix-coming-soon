/** Diagnostic probe: timed captures across all four acts + target stats. */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = process.env.BASE ?? "http://localhost:5199";
const OUT = process.env.OUT ?? "shots/probe";
const TIMES = (process.env.TIMES ?? "16").split(",").map(Number);
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  channel: "chrome",
  args: ["--enable-unsafe-swiftshader", "--use-gl=angle", "--use-angle=swiftshader"],
});
const [VW, VH] = (process.env.VIEWPORT ?? "1536x1024").split("x").map(Number);
const page = await browser.newPage({ viewport: { width: VW, height: VH } });
const problems = [];
page.on("pageerror", (e) => problems.push("[pageerror] " + e.message));
page.on("console", (m) => {
  if (m.type() === "error") problems.push("[console] " + m.text().split("\n")[0]);
});

await page.goto(BASE + "/", { waitUntil: "load", timeout: 60000 });
await page.waitForTimeout(3500);

if (process.env.STATS) {
  const stats = await page.evaluate(() => window.__targets?.());
  console.log("TARGET STATS:", JSON.stringify(stats));
}

if (process.env.NO_TRAILS) {
  await page.evaluate(() => window.__scene?.trails(false));
  console.log("trails disabled for shape captures");
}

// HIDE="particles,streams" — isolate elements via the __scene toggles.
if (process.env.HIDE) {
  await page.evaluate((list) => {
    for (const el of list.split(",")) window.__scene?.[el]?.(false);
  }, process.env.HIDE);
  console.log("hidden: " + process.env.HIDE);
}

const WAIT_MS = Number(process.env.WAIT_MS ?? 500);
if (process.env.SHOW_PERF) {
  const perf = await page.evaluate(() => window.__perf);
  console.log("PERF STATE:", JSON.stringify(perf));
}
for (const t of TIMES) {
  await page.evaluate((tt) => window.__claradixSeek?.(tt), t);
  await page.waitForTimeout(WAIT_MS);
  await page.screenshot({ path: `${OUT}/t${String(t).replace(".", "_")}.png` });
  console.log(`captured t=${t}`);
}

if (problems.length) {
  console.log("PROBLEMS:");
  for (const p of problems.slice(0, 10)) console.log("  " + p);
} else console.log("no page problems");

await browser.close();
