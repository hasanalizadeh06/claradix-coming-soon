/**
 * Seeded pseudo-random numbers.
 *
 * `Math.random()` is banned everywhere in scene/ and lib/. Not as a style rule —
 * it makes every visual acceptance check fail intermittently, which presents as
 * flaky tests rather than as a bug and can cost days before anyone suspects the
 * generator. The reference frame is diffed pixel by pixel; the framing
 * constraints were verified against one specific target cloud; a loop must
 * produce identical cycles. All of that needs the same numbers every time.
 *
 * mulberry32: 32-bit state, passes gjrand, and is about as fast as a multiply.
 */

export interface Rng {
  /** Uniform in [0, 1). */
  next(): number;
  /** Uniform in [min, max). */
  range(min: number, max: number): number;
  /** Uniform in [-half, +half). */
  jitter(half: number): number;
  /** A point uniformly distributed over a disc of the given radius. */
  disc(radius: number): { x: number; y: number };
  /** Integer in [0, n). */
  int(n: number): number;
}

export function makeRng(seed: number): Rng {
  let s = seed >>> 0;

  const next = (): number => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  return {
    next,
    range: (min, max) => min + next() * (max - min),
    jitter: (half) => (next() * 2 - 1) * half,
    /** Square-root radius, or the samples bunch toward the centre. */
    disc(radius) {
      const angle = next() * Math.PI * 2;
      const r = Math.sqrt(next()) * radius;
      return { x: Math.cos(angle) * r, y: Math.sin(angle) * r };
    },
    int: (n) => Math.floor(next() * n),
  };
}

/**
 * A stable per-index hash, for randomness a particle needs but that does not
 * deserve its own attribute — shimmer phase, breathing phase, micro-jitter.
 *
 * Computed once on the CPU with a good generator rather than hashed from
 * `gl_VertexID` in the shader: that is unavailable in WebGL 1, and hash quality
 * from a small integer input is poor enough to produce visible patterning in the
 * shimmer.
 */
export function hashIndex(i: number, salt = 0): number {
  let t = (i + salt * 0x9e3779b9) >>> 0;
  t = Math.imul(t ^ (t >>> 16), 0x45d9f3b);
  t = Math.imul(t ^ (t >>> 16), 0x45d9f3b);
  return ((t ^ (t >>> 16)) >>> 0) / 4294967296;
}
