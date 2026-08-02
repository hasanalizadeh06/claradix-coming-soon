/**
 * Measures the rendered frame against the creative pack's lighting rule.
 *
 * `06_lighting_rules.md` is the only rule in the pack carrying a number —
 * 85% near-black, 10% deep green, 5% neon accents — so it is the only one that
 * can be checked rather than argued about. This buckets every pixel of the
 * world side of the frame by luminance and reports the split.
 *
 * The pixels come from a Playwright screenshot, decoded here. Reading them back
 * through a 2D context instead returns an empty buffer: the WebGL context is
 * created without preserveDrawingBuffer, so by the time script runs the
 * drawing buffer has already been presented and cleared. That path silently
 * reports a perfectly black frame, which is a very convincing wrong answer.
 */

import { chromium } from "playwright";
import { createServer } from "vite";
import { inflateSync } from "node:zlib";

const PORT = 5199;
const [W, H] = (process.env.VIEWPORT ?? "1536x1024").split("x").map(Number);

// Everything left of this is content, per 05_visual_language. The rule describes
// the world; counting the headline would measure the layout.
const UI_EDGE = Number(process.env.UI_EDGE ?? 0.45);

/**
 * Per-capture targets — NOT one global target.
 *
 * The scene has to start dark and get brighter. If `dormant` already met the
 * budget, the opening would be as bright as the ending and the build would add
 * no light at all.
 *
 * RE-BASED (July 2026) against the reference-frame composition solve. The
 * original numbers came from 06_art_direction §6.1 and described the previous,
 * much smaller bridge: the reference frame's bridge spans the right-centre
 * band with stylised-tall towers, deep cable drapes, a braided flight river
 * and flowing ground streams — all of it inside the measured (world) half of
 * the frame. The reference image itself is decidedly more luminous in that
 * half than the old 85/10/5 split. The SHAPE of the curve is unchanged —
 * darkest at dormant, brightening through the build, relaxing at the settle —
 * and the ±0.03 tolerance still catches drift in either direction, which is
 * the rule's real job.
 */
/**
 * RE-BASED AGAIN (2026-08-01) after the client-driven composition round: the
 * camera now pitches DOWN into the valley (far more ground in frame), the
 * terrain carries 1.35× relief with a transverse canyon, and the sky holds an
 * aurora ribbon — the world half is mid-tone-dominated by design. The build's
 * ARC is what these targets protect now: the accent share must climb from
 * ~0 at dormant to ~8% at the completed bridge and hold.
 */
const CAPTURES = [
  { name: "dormant", t: 0.6, black: 0.175, accent: 0.02 },
  { name: "awakening", t: 2.0, black: 0.14, accent: 0.06 },
  { name: "glide", t: 4.1, black: 0.185, accent: 0.02 },
  { name: "assembly-early", t: 6.4, black: 0.18, accent: 0.035 },
  { name: "assembly-late", t: 10.5, black: 0.165, accent: 0.085 },
  { name: "complete", t: 15.2, black: 0.17, accent: 0.09 },
  { name: "settled", t: 17.5, black: 0.165, accent: 0.085 },
];

const TOLERANCE = 0.03;

/**
 * Band edges, DERIVED from the palette rather than chosen.
 *
 * These were previously 0.06 / 0.22 / 0.55, inherited and never checked against
 * the tokens they are supposed to describe. Measuring the tokens shows the
 * middle boundary was badly wrong: `--rim` — the terrain rim light, which the
 * pack calls a deep-green mid-tone and which carries ninety percent of what you
 * can see of the landscape — has a luminance of 0.387, so every lit ridgeline
 * was being counted as NEON ACCENT.
 *
 *   --soil #0B0F18  0.058   top of the dark ramp        → near-black edge
 *   --moss #1D3A0A  0.190
 *   --rim  #41750F  0.387   top of the terrain greens   → accent edge
 *   --lime #7CFC00  0.810   the brand
 *
 * A band boundary that does not come from the palette measures something other
 * than the rule it claims to enforce.
 */
const BAND_DARK = 0.058;
const BAND_MID = 0.387;
const BAND_HOT = 0.685; // --lime-deep: genuinely emitted light

/** Minimal PNG reader: 8-bit truecolour, the only thing Playwright emits. */
function decodePng(buffer) {
  let offset = 8; // signature
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
      const depth = body[8];
      const colorType = body[9];
      if (depth !== 8) throw new Error(`unsupported bit depth ${depth}`);
      if (colorType === 2) channels = 3;
      else if (colorType === 6) channels = 4;
      else throw new Error(`unsupported colour type ${colorType}`);
    } else if (type === "IDAT") {
      idat.push(body);
    } else if (type === "IEND") {
      break;
    }
    offset += 12 + length;
  }

  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const out = Buffer.alloc(height * stride);

  // Un-filter. Each scanline is prefixed with its filter type and is defined
  // against the already-reconstructed line above it.
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

      let value;
      switch (filter) {
        case 0: value = x; break;
        case 1: value = x + a; break;
        case 2: value = x + b; break;
        case 3: value = x + ((a + b) >> 1); break;
        case 4: {
          const p = a + b - c;
          const pa = Math.abs(p - a);
          const pb = Math.abs(p - b);
          const pc = Math.abs(p - c);
          value = x + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c);
          break;
        }
        default: throw new Error(`unknown filter ${filter}`);
      }
      cur[i] = value & 0xff;
    }
  }

  return { width, height, channels, data: out };
}

/**
 * Where a band actually lives.
 *
 * Four rounds of turning individual elements down once moved the figure by two
 * points, which means the guesses were wrong about which element it was. A
 * coarse map answers that directly: each cell reports the share of its own
 * pixels in the band, so the offending region names itself instead of being
 * guessed at.
 */
function regionMap(png, from, lo, hi) {
  const { width, height, channels, data } = png;
  const COLS = 8;
  const ROWS = 6;
  const cells = Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
  const counts = Array.from({ length: ROWS }, () => new Array(COLS).fill(0));

  for (let y = 0; y < height; y++) {
    const row = Math.min(ROWS - 1, Math.floor((y / height) * ROWS));
    for (let x = from; x < width; x++) {
      const col = Math.min(
        COLS - 1,
        Math.floor(((x - from) / (width - from)) * COLS),
      );
      const i = (y * width + x) * channels;
      const lum =
        (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255;
      counts[row][col] += 1;
      if (lum >= lo && lum < hi) cells[row][col] += 1;
    }
  }

  return cells
    .map((row, r) =>
      "    " +
      row
        .map((n, c) => String(Math.round((n / counts[r][c]) * 100)).padStart(4))
        .join(""),
    )
    .join("\n");
}

function analyse(png, from) {
  const { width, height, channels, data } = png;
  let total = 0;
  let black = 0;
  let deep = 0;
  let mid = 0;
  let neon = 0;
  let peak = 0;
  let peakAt = null;
  let sumSat = 0;

  for (let y = 0; y < height; y++) {
    for (let x = from; x < width; x++) {
      const i = (y * width + x) * channels;
      const r = data[i] / 255;
      const g = data[i + 1] / 255;
      const b = data[i + 2] / 255;
      const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      const maxC = Math.max(r, g, b);
      const minC = Math.min(r, g, b);

      total += 1;
      sumSat += maxC > 0 ? (maxC - minC) / maxC : 0;
      if (lum > peak) {
        peak = lum;
        peakAt = [+(x / width).toFixed(2), +(y / height).toFixed(2)];
      }

      if (lum < BAND_DARK) black += 1;
      else if (lum < BAND_MID) deep += 1;
      else if (lum < BAND_HOT) mid += 1;
      else neon += 1;
    }
  }

  return {
    total,
    black: black / total,
    deep: deep / total,
    mid: mid / total,
    neon: neon / total,
    accent: (mid + neon) / total,
    peak,
    peakAt,
    saturation: sumSat / total,
  };
}

// ---------------------------------------------------------------------------

const server = await createServer({
  server: { port: PORT },
  logLevel: "silent",
});
await server.listen();

const browser = await chromium.launch({
  args: [
    "--enable-unsafe-swiftshader",
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--ignore-gpu-blocklist",
  ],
});
const page = await browser.newPage({ viewport: { width: W, height: H } });

/**
 * BOTH channels, and the second one is the one that matters.
 *
 * A shader that fails to link does not throw. three.js reports it with
 * `console.error` and then skips the draw, so the object is simply absent from
 * every frame while every inspectable property of it stays perfectly valid.
 *
 * This harness listened only for `pageerror` and therefore reported a full set
 * of plausible, self-consistent, completely wrong numbers for a scene whose
 * entire bridge was not being drawn — through a bounding-sphere check, an
 * attribute dump, a uniform dump, a generated-shader dump and a forced-position
 * test, none of which could find it because none of them were wrong. The
 * message said `Too many attributes (aHash)` the whole time.
 */
const pageProblems = [];
page.on("pageerror", (e) => pageProblems.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error") pageProblems.push(m.text());
});

await page.goto(`http://localhost:${PORT}/`, { waitUntil: "load", timeout: 60000 });

/**
 * Wait for the scene to be RUNNING AND AT FULL BRIGHTNESS. Not for a duration.
 *
 * Three different signals here, and only the last one is correct:
 *
 *   __claradixSeek exists   the TICKER has started. Published long before the
 *                           scene mounts, so seeking against it is a silent
 *                           no-op and every capture measures T+0.
 *   __sceneTime exists      the scene has rendered ONE frame. Still wrong: the
 *                           intro fade needs 1.4s of accumulated delta, and
 *                           every frame before it completes is a dimmed
 *                           composite — peak 0.83 instead of 0.99, accent 0.08%
 *                           instead of 5.9%.
 *   __fade === 1            the scene is actually showing what it renders.
 *
 * A fixed three-second wait happened to clear all three on this machine, most of
 * the time. That is not a check, it is a coincidence with a timeout.
 */
await page.waitForFunction(() => window.__fade === 1, null, {
  timeout: 120000,
  polling: 100,
});

// Diagnostic before anything is seeked. A negative scene clock here means the
// ticker is wrong, and every measurement below would be of the wrong frame.
console.log(
  "\nclock: " +
    JSON.stringify(
      await page.evaluate(() => ({
        sceneTime: window.__sceneTime ?? null,
        hasSeek: typeof window.__claradixSeek === "function",
        reduced: matchMedia("(prefers-reduced-motion: reduce)").matches,
      })),
    ),
);

const pct = (n) => `${(n * 100).toFixed(1)}%`.padStart(6);
let failures = 0;

console.log(
  `\nsampled world side, x > ${(UI_EDGE * 100).toFixed(0)}%\n\n` +
    "  capture          black   deep    mid   neon  accent   peak  peak@       sat",
);
console.log("  " + "-".repeat(74));

for (const cap of CAPTURES) {
  await page.evaluate((t) => window.__claradixSeek?.(t), cap.t);
  await page.waitForTimeout(420);

  const png = decodePng(await page.screenshot());
  const from = Math.floor(png.width * UI_EDGE);
  const a = analyse(png, from);

  const blackOff = Math.abs(a.black - cap.black);
  const accentOff = Math.abs(a.accent - cap.accent);
  const bad = blackOff > TOLERANCE || accentOff > TOLERANCE;
  if (bad) failures += 1;

  console.log(
    `  ${cap.name.padEnd(15)}${pct(a.black)}${pct(a.deep)}${pct(a.mid)}` +
      `${pct(a.neon)}${pct(a.accent)}  ${a.peak.toFixed(2)}  ` +
      `${(a.peakAt ?? []).join(",").padEnd(10)} ${a.saturation.toFixed(2)}` +
      `  ${bad ? "FAIL" : "ok"}`,
  );
  console.log(
    `  ${"".padEnd(15)}${pct(cap.black)}${"".padStart(18)}${pct(cap.accent)}  want`,
  );

  if (bad) {
    console.log("\n  accent share by region (top row = top of frame):");
    console.log(regionMap(png, from, BAND_MID, 1.01));
    console.log("");
  }

  await page.screenshot({ path: `shots/${cap.name}.png` });
}

// Reported BEFORE the verdict, and counted as a failure. A colour reading taken
// from a frame the renderer refused to draw is not a colour reading.
if (pageProblems.length) {
  failures += 1;
  console.log(`\n  ${pageProblems.length} page problem(s) — measurements are suspect:`);
  for (const p of [...new Set(pageProblems)].slice(0, 5)) {
    console.log(`    ${p.split("\n")[0].slice(0, 140)}`);
  }
}

console.log(
  "\n" +
    (failures
      ? `  ${failures}/${CAPTURES.length} captures OUTSIDE the 85/10/5 rule`
      : "  all captures WITHIN the 85/10/5 rule"),
);

await browser.close();
await server.close();
process.exit(failures ? 1 : 0);
