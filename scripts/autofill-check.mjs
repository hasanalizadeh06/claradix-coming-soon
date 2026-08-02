/**
 * Verifies the autofill styling without needing a browser profile with saved
 * addresses in it.
 *
 * Real autofill cannot be triggered headlessly, but Chrome's DevTools Protocol
 * can force the `:autofill` pseudo-class on a node, which makes the UA rules
 * apply exactly as they would after a real fill. That is enough to see whether
 * the grey slab still appears.
 */

import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = process.env.BASE_URL ?? "http://localhost:4173";
mkdirSync("shots", { recursive: true });

const browser = await chromium.launch({ channel: "chrome" });
const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
// Reported here, and reported nowhere else: a failed shader link, a chunk that
// did not load, a React error swallowed by an error boundary.
const pageProblems = [];
page.on("pageerror", (e) => pageProblems.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error") pageProblems.push(m.text().split("\n")[0]);
});
await page.goto(BASE, { waitUntil: "load" });
await page.waitForTimeout(2000);

await page.fill(".subscribe-input", "hello@claradix.com");

const client = await page.context().newCDPSession(page);
await client.send("DOM.enable");
await client.send("CSS.enable");

const { root } = await client.send("DOM.getDocument", { depth: -1 });
const { nodeId } = await client.send("DOM.querySelector", {
  nodeId: root.nodeId,
  selector: ".subscribe-input",
});

let forced = true;
try {
  await client.send("CSS.forcePseudoState", {
    nodeId,
    forcedPseudoClasses: ["autofill"],
  });
} catch (error) {
  forced = false;
  console.warn(`could not force :autofill — ${error.message}`);
}

await page.waitForTimeout(600);

const styles = await page.evaluate(() => {
  const input = document.querySelector(".subscribe-input");
  const cs = getComputedStyle(input);
  return {
    background: cs.backgroundColor,
    textFill: cs.webkitTextFillColor,
    color: cs.color,
    transition: cs.transitionDuration,
  };
});

const row = await page.locator(".subscribe-row").boundingBox();
await page.screenshot({
  path: "shots/autofill.png",
  clip: {
    x: row.x - 12,
    y: row.y - 12,
    width: row.width + 24,
    height: row.height + 24,
  },
});

console.log(`forced :autofill      ${forced ? "yes" : "NO (result inconclusive)"}`);
console.log(`background-color      ${styles.background}`);
console.log(`-webkit-text-fill     ${styles.textFill}`);
console.log(`transition-duration   ${styles.transition}`);
console.log("screenshot            shots/autofill.png");

if (pageProblems.length) {
  console.log(`\n${pageProblems.length} page problem(s) — the reading above is suspect:`);
  for (const p of [...new Set(pageProblems)].slice(0, 5)) console.log(`  ${p.slice(0, 140)}`);
}

await browser.close();
process.exit(pageProblems.length ? 1 : 0);
