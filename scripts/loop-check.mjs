/**
 * Exercises the rewind, which ships switched OFF.
 *
 * `SCENE.loop` is false by default and the reasoning is sound — a landing page
 * that repeatedly dismantles itself while a visitor is reading it is hostile.
 * But eight seconds of choreography that nothing can ever run is eight seconds
 * that will be broken the next time somebody turns it on, and this one shipped
 * as a flag pointing at an implementation that did not exist. The loop is
 * therefore a runtime uniform rather than a compile-time branch, so this can
 * switch it on and actually look.
 *
 * The claim being tested is the strong one: THE CYCLE IS EXACTLY REPEATABLE.
 * Position is a pure function of time and particles return to their original
 * seeds, so frame T and frame T + 42 should be pixel-identical. If they are not,
 * something in the scene is accumulating — and an accumulator is a slow leak
 * that will look fine for a minute and wrong after an hour.
 */

import { chromium } from "playwright";
import { createServer } from "vite";
import { inflateSync } from "node:zlib";

const PORT = 5196;
const [W, H] = (process.env.VIEWPORT ?? "1152x768").split("x").map(Number);

/** Minimal PNG reader: 8-bit truecolour, the only thing Playwright emits. */
function decodePng(buffer) {
  let offset = 8;
  let width = 0;
  let height = 0;
  let channels = 4;
  const idat = [];

  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    const body = buffer.subarray(offset + 8, offset + 8 + length);
    if (type === "IHDR") {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      channels = body[9] === 2 ? 3 : 4;
    } else if (type === "IDAT") idat.push(body);
    else if (type === "IEND") break;
    offset += 12 + length;
  }

  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const out = Buffer.alloc(height * stride);

  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const cur = out.subarray(y * stride, (y + 1) * stride);
    const prev = y > 0 ? out.subarray((y - 1) * stride, y * stride) : null;
    for (let i = 0; i < stride; i++) {
      const a = i >= channels ? cur[i - channels] : 0;
      const b = prev ? prev[i] : 0;
      const c = prev && i >= channels ? prev[i - channels] : 0;
      const x = line[i];
      let v;
      switch (filter) {
        case 0: v = x; break;
        case 1: v = x + a; break;
        case 2: v = x + b; break;
        case 3: v = x + ((a + b) >> 1); break;
        case 4: {
          const p = a + b - c;
          const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
          v = x + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c);
          break;
        }
        default: throw new Error(`unknown filter ${filter}`);
      }
      cur[i] = v & 0xff;
    }
  }
  return { width, height, channels, data: out };
}

/**
 * Share of world-side pixels in the ACCENT band — effectively, how much bridge.
 *
 * The threshold is 0.387, the top of the terrain greens, and not the 0.058
 * near-black edge. At 0.058 the measure is dominated by terrain and mist, which
 * sit there throughout and do not move during a rewind: a first version using it
 * read 9.5% before the rewind and 9.1% after, and reported that nothing had
 * happened while the entire bridge was in fact flying home.
 *
 * Above 0.387 essentially nothing but particles survives — settled measures
 * ~5.9% and dormant ~0.0%, which is the signal this needs.
 */
function lit(png) {
  const from = Math.floor(png.width * 0.45);
  // The BRIDGE BAND only. Above it lives the aurora ribbon (permanent, and
  // bright enough to cross the 0.387 threshold — counting it reports a valley
  // that never empties); below it the frame is foreground ground. In the
  // luminous-highway composition the deck runs y ≈ 0.46–0.49 with towers
  // above and pylons/traffic below, so the strip [0.36, 0.68] is where "is
  // there a bridge" actually lives.
  const fromY = Math.floor(png.height * 0.36);
  const toY = Math.floor(png.height * 0.68);
  let n = 0;
  let total = 0;
  for (let y = fromY; y < toY; y++) {
    for (let x = from; x < png.width; x++) {
      const i = (y * png.width + x) * png.channels;
      const l =
        (0.2126 * png.data[i] + 0.7152 * png.data[i + 1] + 0.0722 * png.data[i + 2]) / 255;
      total += 1;
      if (l >= 0.387) n += 1;
    }
  }
  return n / total;
}

/** Mean absolute per-channel difference, 0..1. */
function diff(a, b) {
  let sum = 0;
  const n = Math.min(a.data.length, b.data.length);
  for (let i = 0; i < n; i++) sum += Math.abs(a.data[i] - b.data[i]);
  return sum / n / 255;
}

const server = await createServer({ server: { port: PORT }, logLevel: "silent" });
await server.listen();

const browser = await chromium.launch({
  args: ["--enable-unsafe-swiftshader", "--use-gl=angle", "--use-angle=swiftshader"],
});
const page = await browser.newPage({ viewport: { width: W, height: H } });
const problems = [];
page.on("pageerror", (e) => problems.push(e.message));
// three.js reports a failed shader link through console.error and then draws
// nothing at all — which a checker measuring "is the bridge gone" would happily
// score as a successful rewind.
page.on("console", (m) => {
  if (m.type() === "error") problems.push(m.text().split("\n")[0]);
});

await page.goto(`http://localhost:${PORT}/`, { waitUntil: "load", timeout: 60000 });
await page.waitForTimeout(3000);

await page.evaluate(() => window.__scene?.loop(true));
await page.waitForTimeout(300);

const shoot = async (t) => {
  await page.evaluate((tt) => window.__claradixSeek?.(tt), t);
  await page.waitForTimeout(420);
  return decodePng(await page.screenshot());
};

const results = [];
const check = (name, ok, detail) => results.push({ name, ok, detail });

// --- the shape of a cycle --------------------------------------------------
//
// REWIND_START is 20.0, departures run 9.0s, returns land by 34.55, one cycle
// is 35.0s: Act III stillness 15.6–20, Act IV return 20–35.
const settled = await shoot(18.0);
const midRewind = await shoot(26.0);
const emptied = await shoot(34.6);

const sLit = lit(settled);
const mLit = lit(midRewind);
const eLit = lit(emptied);

check(
  "the bridge is there before the rewind",
  sLit > 0.05,
  `${(sLit * 100).toFixed(1)}% of the world lit`,
);
// NOT "there is less light". Departure raises a particle's brightness from 0.74
// to 1.00 — the same peak as arrival, because leaving is acknowledged the way
// arriving was — so mid-rewind the frame is if anything brighter. The light does
// not go away, it MOVES. A first version asserted a drop and failed on a rewind
// that was working perfectly.
check(
  "the rewind has rearranged the frame",
  diff(settled, midRewind) > 0.004,
  `mean channel difference ${(diff(settled, midRewind) * 255).toFixed(2)}/255`,
);
check(
  "the valley is empty again by the end",
  eLit < sLit * 0.25,
  `${(eLit * 100).toFixed(2)}% vs ${(sLit * 100).toFixed(1)}%`,
);

// --- nothing accumulates ---------------------------------------------------
//
// Frame T and frame T + one cycle must be the same frame. Not similar — the
// same. Anything that drifts here is an accumulator, and an accumulator is a
// leak that looks fine for a minute and wrong after an hour.
//
// This is a weaker claim than it looks: with the loop on, seeking to T+42 wraps
// to T, so what it directly proves is that the wrap is total — that no element
// is reading an unwrapped clock and quietly carrying state across the boundary.
// The rewind's own correctness is the three checks above.
// Measured against a CONTROL, not against zero.
//
// Two things in this scene run on the WALL clock on purpose and are therefore
// genuinely different a cycle later: the sky's nebula drift, and the camera's
// idle drift. Both exist so that no two frames are ever identical, which is the
// opposite of what a naive repeatability test asserts.
//
// So the noise floor is established first — the same scene time captured twice,
// a moment apart — and the cycle comparison only has to come in under it. What
// that isolates is the particle system, which is the thing actually claiming to
// be exactly repeatable.
for (const t of [0.6, 8.0, 17.0]) {
  const a = await shoot(t);
  const b = await shoot(t);
  const floor = diff(a, b);

  const later = await shoot(t + 35.0);
  const d = diff(a, later);

  check(
    `T+${t} repeats at T+${t + 35}`,
    d <= Math.max(floor * 1.6, 0.004),
    `${(d * 255).toFixed(2)}/255 against a drift floor of ${(floor * 255).toFixed(2)}`,
  );
}

// --- and it stays off when it is off ---------------------------------------
await page.evaluate(() => window.__scene?.loop(false));
await page.waitForTimeout(300);
const noLoop = await shoot(36.0);
check(
  "with the loop off the bridge stays built",
  lit(noLoop) > sLit * 0.85,
  `${(lit(noLoop) * 100).toFixed(1)}% vs ${(sLit * 100).toFixed(1)}%`,
);

console.log("\n  loop / rewind\n");
let failures = 0;
for (const r of results) {
  if (!r.ok) failures += 1;
  console.log(`  ${r.ok ? "ok  " : "FAIL"}  ${r.name.padEnd(42)} ${r.detail}`);
}

if (problems.length) {
  failures += 1;
  console.log(`\n  FAIL  ${problems.length} page problem(s):`);
  for (const p of problems.slice(0, 5)) console.log(`        ${p}`);
}

console.log(
  "\n" + (failures ? `  ${failures} loop check(s) FAILED` : "  all loop checks pass"),
);

await browser.close();
await server.close();
process.exit(failures ? 1 : 0);
