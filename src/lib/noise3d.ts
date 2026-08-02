/**
 * Small deterministic 3D gradient noise for CPU-side geometry baking.
 *
 * Classic Perlin with a seeded permutation table. Deterministic matters here:
 * the river lanes and the ridge line are baked once at startup, and a seeded
 * generator means the composition is identical on every load and on every
 * device. A composition that reshuffles per visit cannot be art-directed.
 */

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const GRAD3 = [
  [1, 1, 0], [-1, 1, 0], [1, -1, 0], [-1, -1, 0],
  [1, 0, 1], [-1, 0, 1], [1, 0, -1], [-1, 0, -1],
  [0, 1, 1], [0, -1, 1], [0, 1, -1], [0, -1, -1],
];

export class Noise3D {
  private perm = new Uint8Array(512);

  constructor(seed = 1337) {
    const random = mulberry32(seed);
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      const tmp = p[i];
      p[i] = p[j];
      p[j] = tmp;
    }
    for (let i = 0; i < 512; i++) this.perm[i] = p[i & 255];
  }

  private static fade(t: number) {
    return t * t * t * (t * (t * 6 - 15) + 10);
  }

  private grad(hash: number, x: number, y: number, z: number) {
    const g = GRAD3[hash % 12];
    return g[0] * x + g[1] * y + g[2] * z;
  }

  /** Returns roughly [-1, 1]. */
  noise(x: number, y: number, z: number): number {
    const xi = Math.floor(x) & 255;
    const yi = Math.floor(y) & 255;
    const zi = Math.floor(z) & 255;
    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);
    const zf = z - Math.floor(z);

    const u = Noise3D.fade(xf);
    const v = Noise3D.fade(yf);
    const w = Noise3D.fade(zf);

    const p = this.perm;
    const aaa = p[p[p[xi] + yi] + zi];
    const aba = p[p[p[xi] + yi + 1] + zi];
    const aab = p[p[p[xi] + yi] + zi + 1];
    const abb = p[p[p[xi] + yi + 1] + zi + 1];
    const baa = p[p[p[xi + 1] + yi] + zi];
    const bba = p[p[p[xi + 1] + yi + 1] + zi];
    const bab = p[p[p[xi + 1] + yi] + zi + 1];
    const bbb = p[p[p[xi + 1] + yi + 1] + zi + 1];

    const lerp = (a: number, b: number, t: number) => a + t * (b - a);

    const x1 = lerp(this.grad(aaa, xf, yf, zf), this.grad(baa, xf - 1, yf, zf), u);
    const x2 = lerp(this.grad(aba, xf, yf - 1, zf), this.grad(bba, xf - 1, yf - 1, zf), u);
    const y1 = lerp(x1, x2, v);

    const x3 = lerp(this.grad(aab, xf, yf, zf - 1), this.grad(bab, xf - 1, yf, zf - 1), u);
    const x4 = lerp(this.grad(abb, xf, yf - 1, zf - 1), this.grad(bbb, xf - 1, yf - 1, zf - 1), u);
    const y2 = lerp(x3, x4, v);

    return lerp(y1, y2, w) * 1.15;
  }

  fbm(x: number, y: number, z: number, octaves = 3): number {
    let value = 0;
    let amplitude = 0.5;
    let frequency = 1;
    for (let i = 0; i < octaves; i++) {
      value += amplitude * this.noise(x * frequency, y * frequency, z * frequency);
      frequency *= 2.03;
      amplitude *= 0.5;
    }
    return value;
  }

  /**
   * Curl of a scalar potential in the XY plane, which yields a divergence-free
   * 2D field for the cost of four noise samples instead of the twelve a full 3D
   * curl needs. The strands live in a shallow slab, so the third dimension
   * contributes almost nothing visually — but it costs the full price.
   */
  curl2D(x: number, y: number, z: number, epsilon = 0.35): [number, number] {
    const n1 = this.noise(x, y + epsilon, z);
    const n2 = this.noise(x, y - epsilon, z);
    const n3 = this.noise(x + epsilon, y, z);
    const n4 = this.noise(x - epsilon, y, z);
    const dx = (n1 - n2) / (2 * epsilon);
    const dy = -(n3 - n4) / (2 * epsilon);
    const length = Math.hypot(dx, dy) || 1;
    return [dx / length, dy / length];
  }
}
