/**
 * Transcodes a source plate to WebP at two widths.
 *
 * Uses the browser's own encoder through a canvas rather than pulling in sharp
 * (~30MB of native binaries) for something that runs once when an asset
 * changes. The source stays in assets-src/ and is never deployed; only the
 * encoded output lands in public/.
 *
 *   node scripts/optimize-image.mjs <source> <out-basename> [quality]
 */

import { chromium } from "playwright";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const [source, outBase, qualityArg] = process.argv.slice(2);

if (!source || !outBase) {
  console.error("usage: node scripts/optimize-image.mjs <source> <out-basename> [quality]");
  process.exit(1);
}

const quality = Number(qualityArg ?? 0.74);
const SIZES = [
  { suffix: "", width: 1536 },
  { suffix: "-sm", width: 896 },
];

const bytes = readFileSync(resolve(root, source));
const dataUrl = `data:image/png;base64,${bytes.toString("base64")}`;

const browser = await chromium.launch({ channel: "chrome" });
const page = await browser.newPage();
await page.goto("about:blank");

mkdirSync(resolve(root, "public/img"), { recursive: true });

for (const size of SIZES) {
  const encoded = await page.evaluate(
    async ({ url, width, quality }) => {
      const image = new Image();
      image.src = url;
      await image.decode();

      const scale = Math.min(1, width / image.naturalWidth);
      const w = Math.round(image.naturalWidth * scale);
      const h = Math.round(image.naturalHeight * scale);

      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(image, 0, 0, w, h);

      return { data: canvas.toDataURL("image/webp", quality), w, h };
    },
    { url: dataUrl, width: size.width, quality },
  );

  const base64 = encoded.data.split(",")[1];
  const out = Buffer.from(base64, "base64");
  const path = `public/img/${outBase}${size.suffix}.webp`;
  writeFileSync(resolve(root, path), out);
  console.log(
    `${path}  ${encoded.w}×${encoded.h}  ${(out.length / 1024).toFixed(1)} KB`,
  );
}

await browser.close();
