/**
 * Generates public/img/og.png — the 1200×630 card shown when the URL is shared.
 *
 * Written from scratch against zlib rather than pulling in an image library:
 * this runs once at setup, and a 30MB dependency to draw some gradients and
 * composite one logo is not a trade worth making.
 *
 * The artwork is the bridge motif reduced to two dimensions — deck, towers,
 * main cable, suspenders — so the share card and the live scene are recognisably
 * the same idea.
 *
 * A real screenshot of the live scene at 1200×630 would be a better card than
 * this. Drop one in at the same path and nothing else changes.
 */

import { deflateSync, inflateSync } from "node:zlib";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const WIDTH = 1200;
const HEIGHT = 630;

// ---------------------------------------------------------------------------
// Minimal PNG decode (8-bit RGBA, non-interlaced) and encode.
// ---------------------------------------------------------------------------

function decodePng(buffer) {
  if (buffer.readUInt32BE(0) !== 0x89504e47) throw new Error("not a png");

  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  const bitDepth = buffer[24];
  const colorType = buffer[25];
  const interlace = buffer[28];

  if (bitDepth !== 8 || colorType !== 6 || interlace !== 0) {
    throw new Error(`unsupported png: depth ${bitDepth} type ${colorType}`);
  }

  const idat = [];
  let offset = 8;
  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    if (type === "IDAT") idat.push(buffer.subarray(offset + 8, offset + 8 + length));
    if (type === "IEND") break;
    offset += 12 + length;
  }

  const raw = inflateSync(Buffer.concat(idat));
  const bpp = 4;
  const stride = width * bpp;
  const out = Buffer.alloc(height * stride);

  let pos = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[pos++];
    const line = raw.subarray(pos, pos + stride);
    pos += stride;

    const current = out.subarray(y * stride, (y + 1) * stride);
    const previous = y > 0 ? out.subarray((y - 1) * stride, y * stride) : null;

    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? current[x - bpp] : 0;
      const b = previous ? previous[x] : 0;
      const c = previous && x >= bpp ? previous[x - bpp] : 0;
      const value = line[x];

      switch (filter) {
        case 0: current[x] = value; break;
        case 1: current[x] = (value + a) & 0xff; break;
        case 2: current[x] = (value + b) & 0xff; break;
        case 3: current[x] = (value + ((a + b) >> 1)) & 0xff; break;
        case 4: {
          const p = a + b - c;
          const pa = Math.abs(p - a);
          const pb = Math.abs(p - b);
          const pc = Math.abs(p - c);
          const pred = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
          current[x] = (value + pred) & 0xff;
          break;
        }
        default: throw new Error(`bad filter ${filter}`);
      }
    }
  }

  return { width, height, data: out };
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (let i = 0; i < buffer.length; i++) {
    crc ^= buffer[i];
    for (let bit = 0; bit < 8; bit++) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const typeAndData = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData));
  return Buffer.concat([length, typeAndData, crc]);
}

function encodePng(width, height, rgba) {
  const stride = width * 4;
  const raw = Buffer.alloc(height * (stride + 1));
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter: none — gradients deflate well regardless
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------------------
// Canvas
// ---------------------------------------------------------------------------

const canvas = new Float32Array(WIDTH * HEIGHT * 3);

function addLight(x, y, radius, r, g, b, strength) {
  const minX = Math.max(0, Math.floor(x - radius));
  const maxX = Math.min(WIDTH - 1, Math.ceil(x + radius));
  const minY = Math.max(0, Math.floor(y - radius));
  const maxY = Math.min(HEIGHT - 1, Math.ceil(y + radius));

  for (let py = minY; py <= maxY; py++) {
    for (let px = minX; px <= maxX; px++) {
      const dx = px - x;
      const dy = py - y;
      const d = Math.sqrt(dx * dx + dy * dy) / radius;
      if (d >= 1) continue;
      // Smooth quartic falloff — no visible disc edge.
      const falloff = (1 - d * d) * (1 - d * d) * strength;
      const i = (py * WIDTH + px) * 3;
      canvas[i] += r * falloff;
      canvas[i + 1] += g * falloff;
      canvas[i + 2] += b * falloff;
    }
  }
}

// Base: a very dark blue-black, slightly lighter at the top.
for (let y = 0; y < HEIGHT; y++) {
  const t = y / HEIGHT;
  for (let x = 0; x < WIDTH; x++) {
    const i = (y * WIDTH + x) * 3;
    canvas[i] = 0.022 - t * 0.008;
    canvas[i + 1] = 0.028 - t * 0.010;
    canvas[i + 2] = 0.048 - t * 0.018;
  }
}

const GREEN = [0.486, 0.988, 0.0];

// Ambient haze. Deliberately faint: the light in this frame comes off the
// structure itself, and a big radial wash behind it flattens the whole image
// into a green rectangle.
addLight(880, 470, 640, GREEN[0], GREEN[1], GREEN[2], 0.028);
addLight(830, 500, 300, GREEN[0], GREEN[1], GREEN[2], 0.022);

// --- Bridge geometry, projected -------------------------------------------

const DECK_LEFT = { x: 210, y: 560 };
const DECK_RIGHT = { x: 1260, y: 372 };
const TOWER_A_X = 640;
const TOWER_B_X = 1010;
const TOWER_A_TOP = 214;
const TOWER_B_TOP = 268;

function deckAt(t) {
  return {
    x: DECK_LEFT.x + (DECK_RIGHT.x - DECK_LEFT.x) * t,
    y: DECK_LEFT.y + (DECK_RIGHT.y - DECK_LEFT.y) * t + Math.sin(t * Math.PI) * -14,
  };
}

function cableAt(t) {
  const point = deckAt(t);
  const x = point.x;
  // Side spans hang between the tower top and the anchor: a straight chord plus
  // a downward sag. Interpolating with a power curve instead makes the cable
  // bulge upward, which is the classic tell of a bridge nobody checked.
  if (x < TOWER_A_X) {
    const local = (TOWER_A_X - x) / (TOWER_A_X - DECK_LEFT.x);
    const chord = TOWER_A_TOP + (point.y - TOWER_A_TOP) * local;
    return { x, y: chord + 46 * local * (1 - local) * 4 };
  }
  if (x > TOWER_B_X) {
    const local = (x - TOWER_B_X) / (DECK_RIGHT.x - TOWER_B_X);
    const chord = TOWER_B_TOP + (point.y - TOWER_B_TOP) * local;
    return { x, y: chord + 30 * local * (1 - local) * 4 };
  }
  const local = (x - TOWER_A_X) / (TOWER_B_X - TOWER_A_X);
  const top = TOWER_A_TOP + (TOWER_B_TOP - TOWER_A_TOP) * local;
  const centred = local * 2 - 1;
  const sag = 128 * (1 - centred * centred);
  return { x, y: top + sag };
}

// Deck: dense and bright, the strongest line in the frame.
for (let i = 0; i < 1700; i++) {
  const t = i / 1700;
  const point = deckAt(t);
  const near = 0.45 + (1 - t) * 0.55;
  const jitter = (Math.random() - 0.5) * 3.2;
  addLight(point.x, point.y + jitter, 2.6 * near, GREEN[0], GREEN[1], GREEN[2], 0.4 * near);
}

// Main cable.
for (let i = 0; i < 1300; i++) {
  const t = i / 1300;
  const point = cableAt(t);
  const near = 0.45 + (1 - t) * 0.55;
  const jitter = (Math.random() - 0.5) * 2.4;
  addLight(point.x, point.y + jitter, 2.3 * near, GREEN[0], GREEN[1], GREEN[2], 0.34 * near);
}

// Suspenders.
for (let s = 0; s <= 46; s++) {
  const t = s / 46;
  const deck = deckAt(t);
  const cable = cableAt(t);
  if (deck.y - cable.y < 14) continue;
  const steps = Math.floor((deck.y - cable.y) / 4);
  for (let i = 0; i <= steps; i++) {
    const y = cable.y + ((deck.y - cable.y) * i) / steps;
    addLight(deck.x, y, 1.5, GREEN[0], GREEN[1], GREEN[2], 0.09);
  }
}

// Towers.
for (const [towerX, towerTop] of [[TOWER_A_X, TOWER_A_TOP], [TOWER_B_X, TOWER_B_TOP]]) {
  const t = (towerX - DECK_LEFT.x) / (DECK_RIGHT.x - DECK_LEFT.x);
  const base = deckAt(t).y + 92;
  for (let y = towerTop; y < base; y += 2.4) {
    const strength = 0.16 + 0.1 * (1 - (y - towerTop) / (base - towerTop));
    addLight(towerX - 3, y, 2.0, GREEN[0], GREEN[1], GREEN[2], strength);
    addLight(towerX + 3, y, 2.0, GREEN[0], GREEN[1], GREEN[2], strength);
  }
  // Lamp at each tower head. Small and hot, so bloom reads as a light source
  // rather than as a smudge.
  addLight(towerX, towerTop, 5, 1, 1, 1, 1.6);
  addLight(towerX, towerTop, 22, GREEN[0], GREEN[1], GREEN[2], 0.22);
}

// Water: reflected light beneath the deck, falling off fast.
for (let i = 0; i < 5200; i++) {
  const t = Math.random();
  const deck = deckAt(t);
  const drop = 40 + Math.pow(Math.random(), 1.7) * 210;
  const spreadX = (Math.random() - 0.5) * 340;
  const y = deck.y + drop;
  if (y > HEIGHT + 10) continue;
  const strength = 0.075 * Math.exp(-drop / 130) * Math.exp(-Math.abs(spreadX) / 150);
  addLight(deck.x + spreadX, y, 2.4, GREEN[0], GREEN[1], GREEN[2], strength);
}

// --- Logo ------------------------------------------------------------------

try {
  const logo = decodePng(readFileSync(resolve(root, "public/img/claradix-logo.png")));
  const targetWidth = 250;
  const scale = logo.width / targetWidth;
  const targetHeight = Math.round(logo.height / scale);
  const originX = 84;
  const originY = 74;

  for (let y = 0; y < targetHeight; y++) {
    for (let x = 0; x < targetWidth; x++) {
      // Box filter over the source footprint — the logo is 8× the drawn size,
      // so point sampling would alias the type badly.
      const sx0 = Math.floor(x * scale);
      const sx1 = Math.min(logo.width, Math.ceil((x + 1) * scale));
      const sy0 = Math.floor(y * scale);
      const sy1 = Math.min(logo.height, Math.ceil((y + 1) * scale));

      let r = 0, g = 0, b = 0, a = 0, n = 0;
      for (let sy = sy0; sy < sy1; sy++) {
        for (let sx = sx0; sx < sx1; sx++) {
          const si = (sy * logo.width + sx) * 4;
          const alpha = logo.data[si + 3] / 255;
          // Premultiply before averaging, or transparent pixels drag the
          // colour toward black along every edge.
          r += (logo.data[si] / 255) * alpha;
          g += (logo.data[si + 1] / 255) * alpha;
          b += (logo.data[si + 2] / 255) * alpha;
          a += alpha;
          n++;
        }
      }
      if (n === 0 || a === 0) continue;
      r /= n; g /= n; b /= n; a /= n;

      const px = originX + x;
      const py = originY + y;
      if (px < 0 || px >= WIDTH || py < 0 || py >= HEIGHT) continue;

      const i = (py * WIDTH + px) * 3;
      // sRGB → linear before compositing into a linear buffer.
      const toLinear = (v) => Math.pow(v, 2.2);
      canvas[i] = canvas[i] * (1 - a) + toLinear(r / Math.max(a, 0.0001)) * a;
      canvas[i + 1] = canvas[i + 1] * (1 - a) + toLinear(g / Math.max(a, 0.0001)) * a;
      canvas[i + 2] = canvas[i + 2] * (1 - a) + toLinear(b / Math.max(a, 0.0001)) * a;
    }
  }
  console.log("[og] logo composited");
} catch (error) {
  console.warn(`[og] logo skipped: ${error.message}`);
}

// --- Grade -----------------------------------------------------------------

const out = Buffer.alloc(WIDTH * HEIGHT * 4);

function aces(x) {
  const a = 2.51, b = 0.03, c = 2.43, d = 0.59, e = 0.14;
  return Math.min(1, Math.max(0, (x * (a * x + b)) / (x * (c * x + d) + e)));
}

for (let y = 0; y < HEIGHT; y++) {
  for (let x = 0; x < WIDTH; x++) {
    const i = (y * WIDTH + x) * 3;
    const o = (y * WIDTH + x) * 4;

    const nx = (x / WIDTH - 0.5) * 2;
    const ny = (y / HEIGHT - 0.5) * 2;
    const vignette = 1 - 0.42 * Math.min(1, (nx * nx + ny * ny) * 0.62);

    for (let c = 0; c < 3; c++) {
      let v = aces(canvas[i + c] * 1.18);
      v = v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
      out[o + c] = Math.round(Math.min(255, Math.max(0, v * vignette * 255)));
    }
    out[o + 3] = 255;
  }
}

const png = encodePng(WIDTH, HEIGHT, out);
writeFileSync(resolve(root, "public/img/og.png"), png);
console.log(`[og] wrote public/img/og.png — ${(png.length / 1024).toFixed(1)} KB`);
