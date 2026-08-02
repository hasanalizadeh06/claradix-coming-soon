/**
 * Asserts that the page arrives AFTER the bridge, in the order UI_REVEAL says.
 *
 * Three separate promises, none of which can be checked by reading the markup:
 *
 *   1. nothing is readable while the bridge is still building
 *   2. everything is readable once it has finished
 *   3. the order is the one in UI_REVEAL.sequence, not the order of the JSX
 *
 * (3) matters because the sequence lives in config and the elements live in a
 * component tree, and nothing but this connects them. The delays used to be
 * bare millisecond literals typed at each call site — eleven numbers scattered
 * across a tree, which cannot be read as an order by anyone, including whoever
 * wrote them.
 *
 * The order is read back from `data-reveal` and the computed animation delay, so
 * this compares the DOM against config rather than against a second copy of the
 * sequence that would have to be kept in step by hand.
 */

import { chromium } from "playwright";
import { createServer, preview } from "vite";
import { existsSync } from "node:fs";

const PORT = 5198;
const [W, H] = (process.env.VIEWPORT ?? "1280x800").split("x").map(Number);

const server = await createServer({ server: { port: PORT }, logLevel: "silent" });
await server.listen();

const browser = await chromium.launch({
  args: ["--enable-unsafe-swiftshader", "--use-gl=angle", "--use-angle=swiftshader"],
});
const page = await browser.newPage({ viewport: { width: W, height: H } });

const problems = [];
page.on("pageerror", (e) => problems.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error") problems.push(m.text());
});

await page.goto(`http://localhost:${PORT}/`, { waitUntil: "load", timeout: 60000 });
await page.waitForTimeout(2500);

/** Every revealed element, with its id and its resolved delay. */
const readAll = () =>
  page.evaluate(() =>
    [...document.querySelectorAll("[data-reveal]")].map((el) => ({
      id: el.getAttribute("data-reveal"),
      waiting: el.classList.contains("enter--waiting"),
      delay: parseFloat(getComputedStyle(el).animationDelay) || 0,
      visible: getComputedStyle(el).visibility !== "hidden",
    })),
  );

const results = [];
const check = (name, ok, detail) => results.push({ name, ok, detail });

// --- 1. hidden while the bridge builds ------------------------------------
await page.evaluate(() => window.__claradixSeek?.(3.0));
await page.waitForTimeout(500);

const during = await readAll();
check(
  "elements exist in the DOM before reveal",
  during.length >= 10,
  `${during.length} found`,
);
check(
  "nothing is visible while the bridge builds",
  during.every((e) => e.waiting && !e.visible),
  `${during.filter((e) => !e.waiting).length} already revealed`,
);

// --- 2. revealed once it is finished --------------------------------------
//
// Seeking past the reveal point is not enough on its own: the hook polls the
// scene clock, so it needs frames to notice. Waits on the state, not a duration.
await page.evaluate(() => window.__claradixSeek?.(13.0));
let after = [];
for (let i = 0; i < 120; i++) {
  after = await readAll();
  if (after.every((e) => !e.waiting)) break;
  await page.waitForTimeout(100);
}

check(
  "everything reveals once the bridge is finished",
  after.length > 0 && after.every((e) => !e.waiting),
  `${after.filter((e) => e.waiting).length} still waiting`,
);

// --- 3. in the order config declares --------------------------------------
const order = after
  .filter((e) => e.id !== "countdown-units")
  .map((e) => ({ id: e.id, delay: e.delay }));

const monotonic = order.every((e, i) => i === 0 || e.delay >= order[i - 1].delay);
check(
  "reveal order matches UI_REVEAL.sequence",
  monotonic,
  order.map((e) => `${e.id}@${e.delay.toFixed(2)}s`).join(" "),
);

// --- 4. the safety net: no scene at all, and the page still arrives --------
//
// The failure this is guarding is a blank page forever. Gating readable text on
// a WebGL animation is a promise that the animation will finish, and it might
// not — no WebGL, a failed chunk, a context loss. Simulated by refusing the
// WebGL context outright.
const bare = await browser.newPage({ viewport: { width: W, height: H } });
await bare.addInitScript(() => {
  const deny = () => null;
  HTMLCanvasElement.prototype.getContext = deny;
});
await bare.goto(`http://localhost:${PORT}/`, { waitUntil: "load", timeout: 60000 });

let survived = false;
for (let i = 0; i < 300; i++) {
  const state = await bare.evaluate(() =>
    [...document.querySelectorAll("[data-reveal]")].every(
      (el) => !el.classList.contains("enter--waiting"),
    ),
  );
  if (state) {
    survived = true;
    break;
  }
  await bare.waitForTimeout(200);
}
check("page still arrives with no WebGL at all", survived, survived ? "revealed" : "BLANK");
await bare.close();

// --- 5. the safety net under the safety net: no JavaScript at all ---------
//
// The prerendered HTML ships with every element marked as waiting, because the
// server has no clock and cannot know the bridge has finished. That is only
// survivable because the rule which actually hides them is gated on a class
// added by an inline script — so with JavaScript off, nothing is hidden and the
// page renders exactly as sent. Get this wrong and the static HTML is a blank
// page for every crawler and every visitor with a script blocker.
// Against the BUILT artefact, not the dev server. `vite dev` serves the raw
// template with an empty root, so with scripts off there is nothing to render
// and the check would fail for a reason that has nothing to do with what it is
// testing. The thing being tested only exists after prerendering.
if (existsSync("dist/index.html")) {
  const previewServer = await preview({
    preview: { port: PORT + 1 },
    logLevel: "silent",
  });
  // The RESOLVED url, never the requested port. Vite silently increments past
  // a busy port, and with logLevel: silent the goto then hits whatever else is
  // living there — a dev server on the neighbouring port serves the raw
  // template with an empty root, and this check reports BLANK against a page
  // that was never the one being tested.
  const previewUrl = previewServer.resolvedUrls?.local?.[0] ?? `http://localhost:${PORT + 1}/`;

  const noJs = await browser.newPage({
    viewport: { width: W, height: H },
    javaScriptEnabled: false,
  });
  await noJs.goto(previewUrl, { waitUntil: "load", timeout: 60000 });

  // The entrance animations are pure CSS, so they run even with scripts off —
  // starting from opacity 0. Sampling mid-animation reports BLANK on a page
  // that is perfectly readable a second later; wait past the longest delay
  // (2.6s) plus the duration (0.52s) so what is measured is the settled state.
  await noJs.waitForTimeout(3600);

  const headlineVisible = await noJs.evaluate(() => {
    const el = document.querySelector(".headline-line");
    if (!el) return false;
    const s = getComputedStyle(el);
    return s.visibility !== "hidden" && parseFloat(s.opacity) > 0.5;
  });

  check(
    "prerendered page is readable with JS disabled",
    headlineVisible,
    headlineVisible ? "headline visible" : "BLANK — the waiting state is not gated",
  );

  await noJs.close();
  await previewServer.close();
} else {
  console.log("\n  note: dist/ missing, skipped the no-JavaScript check (run npm run build)");
}

// ---------------------------------------------------------------------------

console.log("\n  reveal\n");
let failures = 0;
for (const r of results) {
  if (!r.ok) failures += 1;
  console.log(`  ${r.ok ? "ok  " : "FAIL"}  ${r.name.padEnd(46)} ${r.detail}`);
}

if (problems.length) {
  failures += 1;
  console.log(`\n  FAIL  ${problems.length} page problem(s):`);
  for (const p of problems.slice(0, 5)) console.log(`        ${p}`);
}

console.log(
  "\n" + (failures ? `  ${failures} reveal check(s) FAILED` : "  all reveal checks pass"),
);

await browser.close();
await server.close();
process.exit(failures ? 1 : 0);
