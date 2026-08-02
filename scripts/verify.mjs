/**
 * Runs every acceptance check and reports all of them.
 *
 * Chaining these with `&&` meant the first failure hid the other four — and
 * since two colour captures are deliberately left failing against a
 * specification inconsistency nobody has ruled on yet (Q-05), that was
 * permanent. A suite that stops at the first known problem stops being a suite.
 *
 * Each check still exits non-zero on its own, so they remain useful
 * individually; this only changes who decides to stop.
 */

import { spawn } from "node:child_process";

const CHECKS = [
  ["hygiene", "static rules, no browser needed"],
  ["palette", "colour ratio at the reference frame"],
  ["viewport", "colour ratio across viewport sizes"],
  ["interact", "cursor, touch and push-in"],
  ["reveal", "the UI arrives after the bridge"],
  ["loop", "rewind and cycle repeatability"],
  ["perf", "the degradation ladder"],
];

const run = (script) =>
  new Promise((resolve) => {
    const child = spawn(
      process.execPath,
      [`scripts/${script}-check.mjs`],
      { stdio: ["ignore", "pipe", "pipe"] },
    );
    let out = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (out += d));
    child.on("close", (code) => resolve({ code, out }));
  });

const results = [];

for (const [script, description] of CHECKS) {
  process.stdout.write(`\n${"=".repeat(70)}\n  ${script} — ${description}\n${"=".repeat(70)}\n`);
  const { code, out } = await run(script);
  process.stdout.write(out);
  results.push({ script, description, ok: code === 0 });
}

console.log(`\n${"=".repeat(70)}\n  summary\n${"=".repeat(70)}\n`);
for (const r of results) {
  console.log(`  ${r.ok ? "PASS" : "FAIL"}  ${r.script.padEnd(10)} ${r.description}`);
}

const failed = results.filter((r) => !r.ok);
console.log(
  "\n" +
    (failed.length
      ? `  ${failed.length}/${results.length} checks failed: ${failed.map((r) => r.script).join(", ")}`
      : `  all ${results.length} checks pass`),
);

process.exit(failed.length ? 1 : 0);
