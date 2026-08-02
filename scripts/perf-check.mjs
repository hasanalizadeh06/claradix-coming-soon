/**
 * Exercises the degradation ladder, which almost never runs where it is written.
 *
 * `PERF` specified the whole thing — sample window, thresholds, upgrade
 * hysteresis, thermal guard, and an ordered list of what to give up — and none
 * of it was wired to anything. That is not an accident of this project: adaptive
 * quality only fires on hardware that struggles, and nobody develops on hardware
 * that struggles, so it is the one system that can be fully specified, shipped,
 * and never once executed.
 *
 * So the governor is driven directly with synthetic frame times. That tests the
 * thing that DECIDES, which is the part with the logic in it. Calling the knobs
 * instead would only prove that knobs turn.
 */

import { chromium } from "playwright";
import { createServer } from "vite";

const PORT = 5191;

const server = await createServer({ server: { port: PORT }, logLevel: "silent" });
await server.listen();

const browser = await chromium.launch({
  args: ["--enable-unsafe-swiftshader", "--use-gl=angle", "--use-angle=swiftshader"],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

const problems = [];
page.on("pageerror", (e) => problems.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error") problems.push(m.text().split("\n")[0]);
});

await page.goto(`http://localhost:${PORT}/`, { waitUntil: "load", timeout: 60000 });
await page.waitForFunction(() => window.__fade === 1, null, {
  timeout: 120000,
  polling: 100,
});

const stress = (frameMs, windows, phase) =>
  page.evaluate(
    ([ms, w, p]) => window.__perfStress(ms, w, p),
    [frameMs, windows, phase],
  );

const results = [];
const check = (name, ok, detail) => results.push({ name, ok, detail });

// --- 1. it does nothing until it is allowed to measure ---------------------
//
// Phase 0 costs almost nothing and every device sails through it. Measuring
// there hands a weak machine a high tier and then lets it collapse in Phase 2,
// which is the peak and the part that matters.
let s = await stress(60, 4, 0);
check("silent before the measuring phase", s.level === 0, `level ${s.level}`);

// --- 2. a slow device steps down, one rung at a time ----------------------
s = await stress(60, 1, 5);
check("one bad window costs one rung", s.level === 1, `level ${s.level}, ${s.applied.join(" ")}`);

const first = s.applied[0];
check(
  "and it gives up the cheapest thing first",
  first === "chromaticAberration",
  `gave up "${first}"`,
);

// --- 3. it keeps going, in the specified order ---------------------------
s = await stress(60, 6, 5);
check(
  "a persistently slow device keeps retreating",
  s.level >= 3,
  `level ${s.level}: ${s.applied.join(" → ")}`,
);
check(
  "particle count is not among the first to go",
  !s.applied.slice(0, 2).includes("particleCount"),
  s.applied.join(" → "),
);

// --- 4. nothing changes mid-assembly -------------------------------------
//
// A particle count that changes while the bridge is being built is a visible
// pop in the one sequence the entire page exists to show.
const before = s.level;
const during = await stress(60, 3, 3);
check(
  "frozen during assembly",
  during.level === before,
  `level ${before} → ${during.level}`,
);

// --- 5. recovery is slow and requires sustained evidence ------------------
const oneGood = await stress(6, 1, 5);
check(
  "one good window is not enough to recover",
  oneGood.level === before,
  `level ${oneGood.level}`,
);

const sustained = await stress(6, 4, 5);
check(
  "sustained good frames do recover",
  sustained.level < before,
  `level ${before} → ${sustained.level}`,
);

// ---------------------------------------------------------------------------

console.log("\n  degradation ladder\n");
let failures = 0;
for (const r of results) {
  if (!r.ok) failures += 1;
  console.log(`  ${r.ok ? "ok  " : "FAIL"}  ${r.name.padEnd(44)} ${r.detail}`);
}

if (problems.length) {
  failures += 1;
  console.log(`\n  FAIL  ${problems.length} page problem(s):`);
  for (const p of [...new Set(problems)].slice(0, 5)) console.log(`        ${p.slice(0, 140)}`);
}

console.log(
  "\n" + (failures ? `  ${failures} perf check(s) FAILED` : "  all perf checks pass"),
);

await browser.close();
await server.close();
process.exit(failures ? 1 : 0);
