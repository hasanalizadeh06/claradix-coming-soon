/**
 * Static checks for the failure modes this project keeps producing.
 *
 * Every rule here exists because the thing it forbids actually happened, cost
 * real time, and gave no signal at the moment it was introduced. None of them
 * need a browser; all of them would have fired the instant the mistake was made.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

const srcFiles = walk(join(ROOT, "src")).filter((f) => /\.(ts|tsx)$/.test(f));
const scriptFiles = walk(join(ROOT, "scripts")).filter((f) => /-check\.mjs$/.test(f));
const read = (f) => readFileSync(f, "utf8");
const rel = (f) => relative(ROOT, f).replace(/\\/g, "/");

/**
 * Source with comments removed.
 *
 * Without this the first run flagged `Math.random()` inside the comment
 * FORBIDDING `Math.random()` — a checker that cannot tell code from prose will
 * eventually be ignored, which is worse than not having it.
 */
const code = (f) =>
  read(f)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");

const problems = [];
const notes = [];
const fail = (rule, where, detail) => problems.push({ rule, where, detail });

// ---------------------------------------------------------------------------
// 1 · The vertex attribute budget
// ---------------------------------------------------------------------------
//
// Adding a fifteenth attribute to the particle system linked a program that
// failed validation — "Too many attributes" — and three.js then skipped the draw
// WITHOUT THROWING. The entire bridge was absent from every frame while every
// attribute, uniform and line of generated shader source inspected clean.
//
// A silent renderer failure also moves the colour ratio in the direction the
// rule calls good, so the acceptance check reported it as a pass. This is the
// cheapest possible place to catch it.

const ATTRIBUTE_BUDGET = 14;

for (const file of srcFiles) {
  const src = read(file);
  const attrs = [...src.matchAll(/^attribute\s+\w+\s+(\w+)\s*;/gm)].map((m) => m[1]);
  if (attrs.length === 0) continue;

  // `position` is supplied by three.js and counts against the same budget.
  const total = attrs.length + (src.includes("attribute vec3 position") ? 0 : 1);
  if (total > ATTRIBUTE_BUDGET) {
    fail(
      "vertex attribute budget",
      rel(file),
      `${total} attributes (limit ${ATTRIBUTE_BUDGET}): ${attrs.join(", ")}. ` +
        `Pack two scalars into a vec2 rather than adding a slot.`,
    );
  } else {
    notes.push(`${rel(file)}: ${total}/${ATTRIBUTE_BUDGET} vertex attributes`);
  }
}

// ---------------------------------------------------------------------------
// 2 · Determinism
// ---------------------------------------------------------------------------
//
// The scene has to render identically on every device and at every replay, or
// the capture harness is comparing two different pictures and none of its
// numbers mean anything. Everything random comes from the seeded generator.

for (const file of srcFiles) {
  if (!/[\\/]src[\\/](scene|lib)[\\/]/.test(file)) continue;
  if (rel(file).endsWith("src/lib/rng.ts")) continue;
  if (/Math\.random\s*\(/.test(code(file))) {
    fail(
      "determinism",
      rel(file),
      "Math.random() in a deterministic module — use makeRng() from lib/rng.",
    );
  }
}

// ---------------------------------------------------------------------------
// 3 · Harnesses must hear the renderer
// ---------------------------------------------------------------------------
//
// three.js reports a shader link failure through console.error and then draws
// nothing. A harness listening only for `pageerror` sees a clean run and a very
// dark, very well-behaved frame — which is exactly what the colour rule
// rewards. Every capture script listened only for `pageerror` and every one of
// them passed a scene with no bridge in it.

for (const file of scriptFiles) {
  const src = code(file);
  // An actual call, not a mention. The first version matched its own source,
  // which describes the rule it enforces.
  if (!/\.newPage\s*\(/.test(src)) continue;
  if (!/\.on\(\s*["']console["']/.test(src)) {
    fail(
      "harness must capture console",
      rel(file),
      'opens a page but never listens for console errors — a failed shader link ' +
        "is reported there and nowhere else.",
    );
  }
}

// ---------------------------------------------------------------------------
// 4 · Constants that are declared and never read
// ---------------------------------------------------------------------------
//
// Three separate instances of this in one session: a seven-point bloom curve
// pinned to one of its values, a mip count the renderer never read, and the
// fifth point of a light curve that was skipped over. Each looked like a tuning
// problem for as long as it went unnoticed.

const configPath = join(ROOT, "src/lib/config.ts");
const configSrc = read(configPath);
const elsewhere = srcFiles
  .filter((f) => f !== configPath)
  .map(read)
  .join("\n");

for (const m of configSrc.matchAll(/^export const (\w+)/gm)) {
  const name = m[1];
  if (new RegExp(`\\b${name}\\b`).test(elsewhere)) continue;

  // Used inside config.ts itself — TIERS exists to derive the `Tier` type — is
  // a redundant export rather than a dead constant. Worth saying, not worth
  // failing over.
  const internalUses = (configSrc.match(new RegExp(`\\b${name}\\b`, "g")) ?? []).length;
  if (internalUses > 1) {
    notes.push(`${name} is exported but only used inside config.ts`);
    continue;
  }

  fail(
    "unused export",
    "src/lib/config.ts",
    `${name} is exported and never read anywhere. A constant nothing reads is a bug, not documentation.`,
  );
}

/**
 * Nested keys, reported as WARNINGS rather than failures.
 *
 * The heuristic cannot tell a genuinely dead key from one reached dynamically,
 * so it filters to distinctive names and leaves the judgement to a person. It
 * would have caught `mips` — declared here, never read, renderer quietly using
 * its own default of 5, and worth seven points of the colour ratio.
 */
const COMMON = new Set([
  "min", "max", "x", "y", "z", "count", "color", "colour", "value", "start",
  "end", "duration", "radius", "width", "height", "depth", "speed", "opacity",
  "enabled", "intensity", "distance", "decay", "offset", "scale", "seed",
  "direction", "amplitude", "centre", "center", "near", "far", "fov", "lerp",
  "id", "label", "easing", "top", "bottom", "left", "right",
]);

const seen = new Set();
for (const m of configSrc.matchAll(/^\s{2,}(\w{5,}):/gm)) {
  const key = m[1];
  if (COMMON.has(key) || seen.has(key)) continue;
  seen.add(key);
  if (!new RegExp(`\\b${key}\\b`).test(elsewhere)) {
    notes.push(`possibly unread config key: ${key}`);
  }
}

// ---------------------------------------------------------------------------

console.log("\n  hygiene\n");

if (notes.length) {
  for (const n of notes) console.log(`  note  ${n}`);
  console.log("");
}

for (const p of problems) {
  console.log(`  FAIL  [${p.rule}] ${p.where}`);
  console.log(`        ${p.detail}`);
}

console.log(
  problems.length
    ? `\n  ${problems.length} hygiene problem(s)`
    : "\n  all hygiene checks pass",
);

process.exit(problems.length ? 1 : 0);
