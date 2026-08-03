/**
 * Proves the scene actually responds to input.
 *
 * None of this can be checked by reading the source. Every one of these paths
 * has at some point existed as entirely plausible-looking code that did nothing
 * at all — touch press-and-hold was bound to `pointermove` alone, which on a
 * touchscreen fires only while a finger is SLIDING, so the single gesture the
 * scene was specified around produced no events whatsoever.
 *
 * Fields are read directly rather than diffed from screenshots. A pixel diff can
 * only report that something moved; these report WHICH something, and by how
 * much, which is the difference between a passing test and a useful one.
 *
 * Everything waits on a value rather than on a duration. Under a software
 * rasteriser the frame rate is a tenth of real, and the return spring is 1.6
 * seconds of SCENE time — a fixed wall-clock wait would report a half-finished
 * recovery as a failure.
 */

import { chromium } from "playwright";
import { createServer } from "vite";

const PORT = 5197;
const [W, H] = (process.env.VIEWPORT ?? "1280x800").split("x").map(Number);

/** Polls a page value until it satisfies `done`, or gives up. Returns the last. */
async function until(page, read, done, tries = 400, gap = 120) {
  let value = await page.evaluate(read);
  for (let i = 0; i < tries && !done(value); i++) {
    await page.waitForTimeout(gap);
    value = await page.evaluate(read);
  }
  return value;
}

const server = await createServer({ server: { port: PORT }, logLevel: "silent" });
await server.listen();

const browser = await chromium.launch({
  args: ["--enable-unsafe-swiftshader", "--use-gl=angle", "--use-angle=swiftshader"],
});
const page = await browser.newPage({ viewport: { width: W, height: H } });

const problems = [];
page.on("pageerror", (e) => problems.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error" || /shader|GL_/i.test(m.text())) problems.push(m.text());
});

await page.goto(`http://localhost:${PORT}/`, { waitUntil: "load", timeout: 60000 });
await page.waitForTimeout(3000);

// Settled. The bridge is fully built, so every particle is somewhere the cursor
// can actually reach and the fields are not competing with the build.
await page.evaluate(() => window.__claradixSeek?.(16));
await page.waitForTimeout(600);

const results = [];
const check = (name, ok, detail) => {
  results.push({ name, ok, detail });
};

// --- 1. a mouse hover engages, and STAYS engaged --------------------------
//
// A held field, not an envelope. An earlier version fired on approach and
// decayed on its own, so the bridge began rebuilding while the visitor was
// still pointing at it — which reads as a flicker, not as a response.
// On the main span itself — the old (0.72, 0.66) point sat on the ground
// below the deck in the luminous-highway composition, and with the tightened
// influence radius a near-miss correctly reads as a near-miss.
await page.mouse.move(W * 0.5, H * 0.44);
const peak = await until(page, () => window.__cursorStrength ?? 0, (v) => v > 0.6);

const trace = [];
for (let i = 0; i < 16; i++) {
  trace.push(await page.evaluate(() => window.__cursorStrength ?? 0));
  await page.waitForTimeout(120);
}
const held = Math.min(...trace.slice(8));

check("mouse hover engages", peak > 0.6, `peak ${peak.toFixed(3)}`);
check("hover field is HELD, not an envelope", held > 0.5, `held ${held.toFixed(3)}`);

// --- 2. leaving releases it -----------------------------------------------
await page.mouse.move(W * 0.04, H * 0.05);
const released = await until(page, () => window.__cursorStrength ?? 0, (v) => v < 0.02);
check("leaving releases", released < 0.05, `settled to ${released.toFixed(3)}`);

// --- 3. touch press-and-hold, WITHOUT any movement ------------------------
//
// Dispatched as a real touch pointer rather than through page.touchscreen,
// which would release immediately. This is the gesture that was doing nothing.
await page.evaluate(([x, y]) => {
  window.dispatchEvent(new PointerEvent("pointerdown", {
    pointerId: 1, pointerType: "touch", isPrimary: true,
    clientX: x, clientY: y, bubbles: true,
  }));
}, [W * 0.72, H * 0.66]);

const touchPeak = await until(page, () => window.__cursorStrength ?? 0, (v) => v > 0.6);
check("touch press-and-hold engages", touchPeak > 0.6, `peak ${touchPeak.toFixed(3)}`);

// --- 4. lifting the finger releases it ------------------------------------
//
// The opposite of the mouse: a mouse that stops moving is still pointing at
// something, a finger that lifts is not.
await page.evaluate(() => {
  window.dispatchEvent(new PointerEvent("pointerup", {
    pointerId: 1, pointerType: "touch", isPrimary: true, bubbles: true,
  }));
});
const lifted = await until(page, () => window.__cursorStrength ?? 0, (v) => v < 0.02);
check("lifting a finger releases", lifted < 0.05, `settled to ${lifted.toFixed(3)}`);

// --- 5. push-in dollies, and passes the dispersion threshold ---------------
for (let i = 0; i < 10; i++) {
  await page.mouse.wheel(0, 260);
  await page.waitForTimeout(80);
}
const dolly = await until(page, () => window.__dolly ?? 0, (v) => v > 0.9);
const disperse = await page.evaluate(() => window.__disperse ?? 0);

check("push-in reaches full travel", dolly > 0.9, `dolly ${dolly.toFixed(3)}`);
check("push-in disperses the span", disperse > 0.5, `disperse ${disperse.toFixed(3)}`);

// --- 6. and releases itself ------------------------------------------------
//
// A landing page that stays where it was shoved greets its next reader with a
// composition nobody chose.
const returned = await until(page, () => window.__dolly ?? 0, (v) => v < 0.05, 600);
check("push-in auto-returns", returned < 0.1, `dolly ${returned.toFixed(3)}`);

// ---------------------------------------------------------------------------

console.log("\n  interaction\n");
let failures = 0;
for (const r of results) {
  if (!r.ok) failures += 1;
  console.log(`  ${r.ok ? "ok  " : "FAIL"}  ${r.name.padEnd(40)} ${r.detail}`);
}

if (problems.length) {
  failures += 1;
  console.log(`\n  FAIL  ${problems.length} page problem(s):`);
  for (const p of problems.slice(0, 6)) console.log(`        ${p}`);
}

console.log(
  "\n" + (failures ? `  ${failures} interaction check(s) FAILED` : "  all interaction checks pass"),
);

await browser.close();
await server.close();
process.exit(failures ? 1 : 0);
