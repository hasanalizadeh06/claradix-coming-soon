/**
 * Measures how far the colour ratio drifts with viewport size.
 *
 * The scene is composed and tuned at one reference frame, 1536x1024, and
 * everything in `palette-check` is measured there. That leaves an obvious
 * question nobody was asking: does any of it hold on a 13-inch laptop?
 *
 * WHAT THIS IS NOT MEASURING
 * --------------------------
 * A previous version of this finding claimed the scene COLLAPSED on short
 * viewports — accent measured 0.1% against a 4-5% target. It was wrong. The
 * measurement was taken while the particle program was failing to link, so the
 * bridge was not being drawn at ANY viewport, and the number said far more about
 * the harness than about the scene. Retracted. See D-026.
 *
 * WHAT IT IS MEASURING
 * --------------------
 * A real and much smaller effect, in the opposite direction: smaller viewports
 * come out BRIGHTER. Point size scales with viewport height, but a point cannot
 * rasterise smaller than one fragment — so on a short viewport the dimmest
 * particles keep their absolute one-pixel footprint while the frame around them
 * shrinks, and their share of it goes up.
 *
 * That is a bounded, monotone drift rather than a failure, so this reports the
 * SPREAD and fails only if it grows past what the rule's own tolerance can
 * absorb. The point is to know the number, and to be told when it changes.
 */

import { chromium } from "playwright";
import { createServer } from "vite";
import { inflateSync } from "node:zlib";

const PORT = 5192;

/** Reference first, then progressively shorter frames people actually have. */
const VIEWPORTS = [
  [1536, 1024, "reference"],
  [1440, 900, "13in laptop"],
  [1152, 768, "small laptop"],
  [1920, 1080, "desktop 1080p"],
];

/** One moment, the one the whole film is building toward. */
const AT = 16.0;

/**
 * SET FROM MEASUREMENT, and that needs defending because this session has twice
 * refused to do exactly that.
 *
 * The distinction is where the number comes from. §6.1's per-capture targets are
 * a specification: they say what the film should look like, they were arrived at
 * by someone deciding, and moving them to match what the code does destroys the
 * only independent check there is (see Q-05, where two captures are left failing
 * for precisely this reason).
 *
 * This threshold is not a specification. Nothing in the pack says how much the
 * ratio may drift with viewport, because nobody had measured whether it drifted
 * at all. Inventing a number and calling it a requirement would be worse than
 * useless — it would be a requirement with no author.
 *
 * So: what the scene currently does plus a little. Its job is to catch a
 * REGRESSION, not to assert a target. When the mechanism is understood well
 * enough to reduce the drift, this comes down with it.
 *
 * RE-BASED 2.5 → 3.3 with the reference-frame composition (July 2026), and
 * the mechanism IS understood now: the vertical FOV is fixed, so a wider
 * aspect adds frame at the sides — and where the old bridge overflowed both
 * frame edges (widening added bridge), the reference composition deliberately
 * confines the span inside the frame, so widening adds dark sky and terrain.
 * Measured spread is 2.9 points, monotonic in aspect from 1.5 to 1.78,
 * brightest-to-darkest. That is composition geometry, not drift.
 */
const MAX_SPREAD = 0.033;

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

function bands(png) {
  const from = Math.floor(png.width * 0.45);
  let black = 0;
  let accent = 0;
  let total = 0;
  let peak = 0;
  for (let y = 0; y < png.height; y++) {
    for (let x = from; x < png.width; x++) {
      const i = (y * png.width + x) * png.channels;
      const l =
        (0.2126 * png.data[i] + 0.7152 * png.data[i + 1] + 0.0722 * png.data[i + 2]) / 255;
      total += 1;
      if (l > peak) peak = l;
      if (l < 0.058) black += 1;
      else if (l >= 0.387) accent += 1;
    }
  }
  return { black: black / total, accent: accent / total, peak };
}

const server = await createServer({ server: { port: PORT }, logLevel: "silent" });
await server.listen();

const browser = await chromium.launch({
  args: ["--enable-unsafe-swiftshader", "--use-gl=angle", "--use-angle=swiftshader"],
});

const problems = [];
const rows = [];

for (const [w, h, label] of VIEWPORTS) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  // Both channels. A program that fails to link is reported through
  // console.error and then silently not drawn — which reads to a colour checker
  // as a very dark, very well-behaved frame. See D-026.
  page.on("pageerror", (e) => problems.push(`${label}: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") problems.push(`${label}: ${m.text().split("\n")[0]}`);
  });

  await page.goto(`http://localhost:${PORT}/`, { waitUntil: "load", timeout: 60000 });
  await page.waitForFunction(() => window.__fade === 1, null, {
    timeout: 120000,
    polling: 100,
  });

  await page.evaluate((t) => window.__claradixSeek(t), AT);
  await page.waitForTimeout(500);

  const b = bands(decodePng(await page.screenshot()));
  rows.push({ label, w, h, ...b });
  await page.close();
}

const blacks = rows.map((r) => r.black);
const accents = rows.map((r) => r.accent);
const blackSpread = Math.max(...blacks) - Math.min(...blacks);
const accentSpread = Math.max(...accents) - Math.min(...accents);

console.log(`\n  colour ratio at T+${AT} across viewports\n`);
console.log("  viewport        label            black   accent   peak");
console.log("  " + "-".repeat(56));
for (const r of rows) {
  console.log(
    `  ${`${r.w}x${r.h}`.padEnd(15)} ${r.label.padEnd(15)} ` +
      `${(r.black * 100).toFixed(1).padStart(5)}%  ${(r.accent * 100).toFixed(1).padStart(5)}%  ` +
      `${r.peak.toFixed(2)}`,
  );
}

let failures = 0;
const verdict = (name, spread) => {
  const ok = spread <= MAX_SPREAD;
  if (!ok) failures += 1;
  console.log(
    `\n  ${ok ? "ok  " : "FAIL"}  ${name} spread ${(spread * 100).toFixed(1)} points ` +
      `(limit ${(MAX_SPREAD * 100).toFixed(1)})`,
  );
};
verdict("near-black", blackSpread);
verdict("accent    ", accentSpread);

if (problems.length) {
  failures += 1;
  console.log(`\n  FAIL  ${problems.length} page problem(s):`);
  for (const p of [...new Set(problems)].slice(0, 5)) console.log(`        ${p.slice(0, 140)}`);
}

console.log(
  "\n" +
    (failures
      ? `  ${failures} viewport check(s) FAILED`
      : "  the scene holds its ratio across viewports"),
);

await browser.close();
await server.close();
process.exit(failures ? 1 : 0);
