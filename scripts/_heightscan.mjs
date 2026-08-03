/** Scan the baked heightfield through the dev hook: max heights per far band. */
import { chromium } from "playwright";

const BASE = process.env.BASE ?? "http://localhost:5203";
const browser = await chromium.launch({
  channel: "chrome",
  args: ["--enable-unsafe-swiftshader", "--use-gl=angle", "--use-angle=swiftshader"],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto(BASE + "/", { waitUntil: "load", timeout: 60000 });
await page.waitForTimeout(3500);

const rows = await page.evaluate(() => {
  const out = [];
  for (let z = -1400; z <= 400; z += 200) {
    let max = -999, maxX = 0, count150 = 0;
    for (let x = -1400; x <= 1350; x += 50) {
      const r = window.__terrainAt?.(x, z);
      if (!r) continue;
      if (r.h > max) { max = r.h; maxX = x; }
      if (r.h > 150) count150++;
    }
    out.push({ z, max, maxX, count150 });
  }
  return out;
});
for (const r of rows) console.log(`z=${String(r.z).padStart(6)}  max=${String(r.max).padStart(4)} @x=${String(r.maxX).padStart(6)}  cells>150: ${r.count150}`);
await browser.close();
