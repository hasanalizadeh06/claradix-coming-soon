/**
 * Post-build step: render the page to static HTML and inject it.
 *
 * Runs after the client build so the emitted <script> and <link> tags are
 * already in place; this only fills the empty root and stamps the metadata
 * that cannot be known until the copy is resolved.
 */

import { readFile, writeFile, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = resolve(root, "dist");
const ssrDist = resolve(root, "dist-ssr");

const entryPath = resolve(ssrDist, "prerender.js");
if (!existsSync(entryPath)) {
  console.error(
    "[prerender] dist-ssr/prerender.js not found — run the ssr build first.",
  );
  process.exit(1);
}

const { render, meta } = await import(pathToFileURL(entryPath).href);

const target = resolve(dist, "index.html");
if (!existsSync(target)) {
  console.error("[prerender] dist/index.html not found");
  process.exit(1);
}

const template = await readFile(target, "utf8");
if (!template.includes("<!--app-html-->")) {
  console.error("[prerender] index.html has no <!--app-html--> placeholder");
  process.exit(1);
}

const info = meta();
const html = template
  .replace("<!--app-html-->", render())
  .replace(/<!--app-title-->/g, escapeHtml(info.title))
  .replace(/<!--app-description-->/g, escapeHtml(info.description));

await writeFile(target, html, "utf8");
console.log(`[prerender] index.html (${(html.length / 1024).toFixed(1)} KB)`);

// The SSR bundle is a build artefact, not something to deploy.
await rm(ssrDist, { recursive: true, force: true });

function escapeHtml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
