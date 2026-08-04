/**
 * THE LIVING WORLD.
 *
 * Rebuilt to the 2026-08-03 round-3 direction: not a dark plane the bridge
 * happens to stand on, but a layered, cinematic landscape — rolling hills near
 * the lens, medium ranges across the midground, giants at the horizon, deep
 * valleys flowing between them — with light that comes from WITHIN the land.
 *
 * Two responsibilities live here:
 *
 *   1. THE HEIGHTFIELD. A composed field (hills + domain-warped ridged
 *      ranges gathered into belts + basins + micro raggedness), baked once,
 *      deterministic, and queried by everything else in the scene: seeds rest
 *      on it, piers reach down to it, mist pools in it, the energy network
 *      marches across it. Its API (heightAt / normalAt / slopeAt) is a
 *      contract with five other modules — extend it, never change it.
 *
 *   2. THE MESH. Opaque, depth-writing (the one pass that lets a particle
 *      hide behind a mountain), and now EMISSIVE: a baked per-vertex glow
 *      concentrates soft internal light along ridgelines and crests, breathing
 *      slowly, while valley floors and the viewer's foreground stay pressed
 *      near-black. High contrast is the design: the strongest mesh glow sits
 *      around 0.30 luminance — the terrain glows, it never blooms (0.62
 *      threshold). The bright pinpoint energy on top belongs to
 *      terrainNetwork.ts.
 *
 * The compositional guarantees survive the rework untouched, because they are
 * applied AFTER the noise: the soft saddle keeps the land from rising through
 * the deck, the foreground cap keeps every near hill under the sightline to
 * the span, and the authored framing ridges (reduced to accents) still
 * guarantee the deck exits into mountains and the left flank is never empty.
 */

import * as THREE from "three";
import { LIGHTING, PALETTE, PERF, TERRAIN, WORLD, type Tier } from "@/lib/config";
import { centreline } from "../centreline";

export interface TerrainHandle {
  mesh: THREE.Mesh;
  /** Bilinear heightfield lookup. Queried 140,000 times during seeding. */
  heightAt(x: number, z: number): number;
  /**
   * Height above the locally blurred field — how much of a CREST this point
   * is. The energy network seeds its density from this, so its light lands on
   * the same ridges the mesh glow does.
   */
  prominenceAt(x: number, z: number): number;
  normalAt(x: number, z: number, out?: THREE.Vector3): THREE.Vector3;
  /** Degrees from horizontal. */
  slopeAt(x: number, z: number): number;
  setSwarm(positions: THREE.Vector3[], intensity: number): void;
  /** How many of the five lights are evaluated. The degradation ladder's
   *  cheapest genuine saving: the shader loop simply runs fewer times. */
  setSwarmCount(count: number): void;
  /** Dev only — for sweeping the rim against the colour ratio. */
  setRim(strength: number): void;
  /** Advances the internal glow's slow breathing. Wall clock. */
  update(elapsed: number): void;
  dispose(): void;
}

// ---------------------------------------------------------------------------
// Deterministic value noise
// ---------------------------------------------------------------------------

/**
 * Fixed seed, so the landscape is identical on every load, on every device,
 * forever. Non-negotiable: the reference frame was authored against one specific
 * landscape and the camera's framing constraints were verified against it. A
 * landscape that varies per load cannot be composed.
 */
export function hash2(ix: number, iy: number, seed: number): number {
  let h = (ix * 374761393 + iy * 668265263 + seed * 2246822519) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const smoother = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);

export function valueNoise2(x: number, y: number, seed: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;

  const a = hash2(ix, iy, seed);
  const b = hash2(ix + 1, iy, seed);
  const c = hash2(ix, iy + 1, seed);
  const d = hash2(ix + 1, iy + 1, seed);

  const u = smoother(fx);
  const v = smoother(fy);

  return (
    ((a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v) * 2 - 1
  );
}

/** Plain fractal sum, normalised to roughly -1..1. The rolling-hill base. */
function fbm(
  x: number,
  z: number,
  seed: number,
  freq: number,
  octaves: number,
  lacunarity: number,
  gain: number,
): number {
  let sum = 0;
  let amp = 1;
  let f = freq;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += valueNoise2(x * f, z * f, seed + i * 977) * amp;
    norm += amp;
    f *= lacunarity;
    amp *= gain;
  }
  return sum / norm;
}

/**
 * Ridged multifractal, 0..1 with sharp crests at 1.
 *
 * (1 - |noise|) folds the field so its zero-crossings become CRESTS — long
 * connected chains rather than isolated bumps, which is the difference between
 * a mountain RANGE and a field of hills. The octave weighting (each octave
 * scaled by the crest strength beneath it) puts the fine detail on the peaks
 * and leaves the valley floors smooth, exactly as erosion does — this is what
 * "naturally formed over millions of years" looks like in maths.
 */
function ridged(
  x: number,
  z: number,
  seed: number,
  freq: number,
  octaves: number,
  lacunarity: number,
  gain: number,
  sharpness: number,
): number {
  let sum = 0;
  let amp = 1;
  let f = freq;
  let norm = 0;
  let weight = 1;
  for (let i = 0; i < octaves; i++) {
    let r = 1 - Math.abs(valueNoise2(x * f, z * f, seed + i * 1409));
    r = Math.pow(r, sharpness) * weight;
    weight = THREE.MathUtils.clamp(r * 1.7, 0, 1);
    sum += r * amp;
    norm += amp;
    f *= lacunarity;
    amp *= gain;
  }
  return sum / norm;
}

/**
 * The quiet-region mask, exported so the energy network's density and the
 * mesh's internal glow are the SAME field — a region that burns on the mesh
 * is dense with particles, a quiet region is empty of both. Two separate
 * masks here would visibly disagree within one screenshot.
 */
export function glowClusterAt(x: number, z: number): number {
  const G = TERRAIN.glow;
  return Math.pow(
    0.5 + 0.5 * valueNoise2(x * G.clusterFreq, z * G.clusterFreq, TERRAIN.noiseSeed ^ 0x3131),
    G.clusterPow,
  );
}

const _tmp = new THREE.Vector3();

/**
 * THE COMPOSED FIELD. See the config's TERRAIN block for what each layer is;
 * the assembly order here is: depth ramp → warp → belt-masked ridged ranges
 * + rolling hills − basins + micro, then the authored framing accents.
 *
 * Everything is a pure function of (x, z) and the fixed seed. No RNG state.
 */
/**
 * The MACRO field — warp, ridged ranges, belts, hills, basins. Every term
 * here is low-frequency (mountain-scale wavelengths), which is what makes
 * the coarse cache below legitimate: sampled at ~18u cells and read back
 * bilinearly, it is visually identical at mesh resolution while costing a
 * ~30× smaller share of the boot's main-thread block (2026-08-04
 * performance pass — the full composition ran ~40 noise evaluations for
 * every one of 147k vertices). Micro raggedness, framing accents and the
 * carve stay exact per-vertex in noiseHeight.
 */
function macroHeight(x: number, z: number): number {
  const T = TERRAIN;
  const seed = T.noiseSeed;

  // 0 at the lens, 1 at the horizon, back-loaded.
  const ramp = THREE.MathUtils.clamp(
    (T.depthRamp.zNear - z) / (T.depthRamp.zNear - T.depthRamp.zFar),
    0,
    1,
  );
  const depth = Math.pow(smoother(ramp), T.depthRamp.exponent);

  // Double domain warp. The warped coordinate feeds the RANGES and the belt
  // mask (so a range and its mask bend together); hills and basins read the
  // raw coordinate — warping everything with the same field would just be a
  // change of variables and the lattice would survive it.
  const w = T.mountains.warp;
  const wx =
    x +
    w.strength * valueNoise2(x * w.freq, z * w.freq, seed ^ 0x1111) +
    w.strength2 * valueNoise2(x * w.freq2, z * w.freq2, seed ^ 0x1313);
  const wz =
    z +
    w.strength * valueNoise2(x * w.freq, z * w.freq, seed ^ 0x1717) +
    w.strength2 * valueNoise2(x * w.freq2, z * w.freq2, seed ^ 0x1919);

  // Ranges, gathered into belts.
  const b = T.mountains.belt;
  const beltN = 0.5 + 0.5 * valueNoise2(wx * b.freq, wz * b.freq, seed ^ 0x2323);
  const belt =
    b.floor + (1 - b.floor) * THREE.MathUtils.smoothstep(beltN, b.low, b.high);
  const mAmp = THREE.MathUtils.lerp(T.mountains.amp.near, T.mountains.amp.far, depth);
  const ranges =
    ridged(
      wx, wz, seed + 7,
      T.mountains.freq, T.mountains.octaves, T.mountains.lacunarity,
      T.mountains.gain, T.mountains.sharpness,
    ) * mAmp * belt;

  // Rolling hills — the connective tissue between the ranges.
  const hAmp = THREE.MathUtils.lerp(T.hills.amp.near, T.hills.amp.far, depth);
  const hills =
    fbm(x, z, seed + 31, T.hills.freq, T.hills.octaves, T.hills.lacunarity, T.hills.gain) *
    hAmp;

  // Basins flowing between the ranges.
  const v = T.valleys;
  const vN = 0.5 + 0.5 * valueNoise2(x * v.freq + 37.2, z * v.freq - 11.8, seed ^ 0x2f2f);
  const basins =
    -v.depth * THREE.MathUtils.smoothstep(vN, v.low, v.high) * (0.35 + 0.65 * depth);

  return ranges + hills + basins;
}

const MACRO_N = 160;
let macroCache: Float32Array | null = null;

function macroAt(x: number, z: number): number {
  if (!macroCache) {
    macroCache = new Float32Array(MACRO_N * MACRO_N);
    const { minX, maxX, minZ, maxZ } = WORLD.bounds;
    for (let j = 0; j < MACRO_N; j++) {
      const gz = minZ + ((maxZ - minZ) * j) / (MACRO_N - 1);
      for (let i = 0; i < MACRO_N; i++) {
        const gx = minX + ((maxX - minX) * i) / (MACRO_N - 1);
        macroCache[j * MACRO_N + i] = macroHeight(gx, gz);
      }
    }
  }
  const { minX, maxX, minZ, maxZ } = WORLD.bounds;
  const fx = THREE.MathUtils.clamp(
    ((x - minX) / (maxX - minX)) * (MACRO_N - 1), 0, MACRO_N - 1.001);
  const fz = THREE.MathUtils.clamp(
    ((z - minZ) / (maxZ - minZ)) * (MACRO_N - 1), 0, MACRO_N - 1.001);
  const i = Math.floor(fx);
  const j = Math.floor(fz);
  const a = fx - i;
  const bl = fz - j;
  const m = macroCache;
  const idx = j * MACRO_N + i;
  return (
    (m[idx] * (1 - a) + m[idx + 1] * a) * (1 - bl) +
    (m[idx + MACRO_N] * (1 - a) + m[idx + MACRO_N + 1] * a) * bl
  );
}

function noiseHeight(x: number, z: number): number {
  const T = TERRAIN;
  const seed = T.noiseSeed;

  let h = macroAt(x, z);

  // Silhouette raggedness.
  for (let i = 0; i < T.micro.length; i++) {
    const [f, a] = T.micro[i];
    h += valueNoise2(x * f, z * f, seed + 977 * (i + 9)) * a;
  }

  // Framing accents: composition guarantees, not mountains (those are
  // generated now). The faint ones look like they do nothing — see config.
  for (const ridge of TERRAIN.framingRidges) {
    const dx = x - ridge.centre[0];
    const dz = z - ridge.centre[2];
    const d = Math.hypot(dx, dz);
    if (d >= ridge.radius) continue;
    const k = 1 - THREE.MathUtils.smoothstep(d, 0, ridge.radius);
    h += ridge.height * k * k;
  }

  return h;
}

/**
 * THE SOFT SADDLE — the only intervention the terrain receives.
 *
 * No canyon, no trench (client direction, 2026-08-01 round 2: the mountain
 * keeps its natural shape and the bridge settles ONTO it — pier lengths
 * follow the relief, short on knolls, long over hollows). The one thing the
 * land may not do is rise THROUGH the deck, so ground that would is relaxed
 * partially (85% of the excess) across a wide, soft footprint. What remains
 * reads as a natural pass between shoulders, never as a cut.
 */
/**
 * COARSE CORRIDOR FIELD (2026-08-04 performance pass). carveAmount used to
 * run a full nearestU search — ~50 spline evaluations — for EVERY heightfield
 * vertex: 384² × 50 ≈ 7.4 million curve samples in one synchronous task,
 * measured as the dominant share of a 13-second total-blocking-time on a
 * 4×-throttled CPU (Lighthouse mobile — and therefore also every real
 * mid-range phone). The carve is a SOFT feature 280u wide; it does not need
 * per-vertex exactness. A 128×128 grid of (distance-to-centreline, line
 * height), stamped once from ~900 polyline samples in a few hundred
 * thousand cheap ops, then read bilinearly, is indistinguishable in the
 * render and ~40× cheaper.
 */
const CD_N = 128;
let cdD: Float32Array | null = null;
let cdY: Float32Array | null = null;

function buildCorridorField(): void {
  if (cdD) return;
  cdD = new Float32Array(CD_N * CD_N).fill(1e9);
  cdY = new Float32Array(CD_N * CD_N);

  const { minX, maxX, minZ, maxZ } = WORLD.bounds;
  const sx = (CD_N - 1) / (maxX - minX);
  const sz = (CD_N - 1) / (maxZ - minZ);
  const cellX = (maxX - minX) / (CD_N - 1);
  const cellZ = (maxZ - minZ) / (CD_N - 1);
  const reach = TERRAIN.clearance.halfWidth + Math.max(cellX, cellZ) * 2;
  const wx = Math.ceil(reach / cellX);
  const wz = Math.ceil(reach / cellZ);

  const p = new THREE.Vector3();
  const SAMPLES = 900;
  for (let s = 0; s <= SAMPLES; s++) {
    centreline.positionAt(s / SAMPLES, p);
    const ci = Math.round((p.x - minX) * sx);
    const cj = Math.round((p.z - minZ) * sz);
    for (let j = Math.max(0, cj - wz); j <= Math.min(CD_N - 1, cj + wz); j++) {
      const gz = minZ + j / sz;
      for (let i = Math.max(0, ci - wx); i <= Math.min(CD_N - 1, ci + wx); i++) {
        const gx = minX + i / sx;
        const d = Math.hypot(gx - p.x, gz - p.z);
        const idx = j * CD_N + i;
        if (d < cdD[idx]) {
          cdD[idx] = d;
          cdY[idx] = p.y;
        }
      }
    }
  }
}

/** Bilinear read of the corridor field: [distance to centreline, line Y]. */
function corridorAt(x: number, z: number): [number, number] {
  buildCorridorField();
  const { minX, maxX, minZ, maxZ } = WORLD.bounds;
  const fx = THREE.MathUtils.clamp(
    ((x - minX) / (maxX - minX)) * (CD_N - 1), 0, CD_N - 1.001);
  const fz = THREE.MathUtils.clamp(
    ((z - minZ) / (maxZ - minZ)) * (CD_N - 1), 0, CD_N - 1.001);
  const i = Math.floor(fx);
  const j = Math.floor(fz);
  const a = fx - i;
  const b = fz - j;
  const idx = j * CD_N + i;
  const d = cdD as Float32Array;
  const y = cdY as Float32Array;
  const d00 = d[idx], d10 = d[idx + 1], d01 = d[idx + CD_N], d11 = d[idx + CD_N + 1];
  const y00 = y[idx], y10 = y[idx + 1], y01 = y[idx + CD_N], y11 = y[idx + CD_N + 1];
  return [
    (d00 * (1 - a) + d10 * a) * (1 - b) + (d01 * (1 - a) + d11 * a) * b,
    (y00 * (1 - a) + y10 * a) * (1 - b) + (y01 * (1 - a) + y11 * a) * b,
  ];
}

function carveAmount(x: number, z: number, h: number): number {
  const cl = TERRAIN.clearance;
  const [dLine, lineY] = corridorAt(x, z);
  if (dLine >= cl.halfWidth) return 0;

  const needed = Math.max(0, h - (lineY - cl.margin));
  const fall =
    1 - THREE.MathUtils.smoothstep(dLine / cl.halfWidth, cl.innerFrac, 1);
  return needed * cl.strength * fall;
}

/**
 * The FOREGROUND CAP. The terrain runs past the camera (the frame's bottom
 * must never look past the ground's edge into the void), but every hill
 * between the lens and the bridge is a potential curtain in front of the
 * gorge. The cap is derived from the sightline to the deck's near end: ground
 * may roll freely UNDER that line and is soft-kneed down wherever it tries
 * to cross it. Occlusion becomes impossible by construction, not by luck.
 */
function foregroundCap(z: number, h: number): number {
  const cap = TERRAIN.foregroundCap;
  if (z <= cap.startZ) return h;
  const ceiling = cap.base + (z - cap.startZ - 20) * cap.slopePerZ;
  return h > ceiling ? ceiling + (h - ceiling) * cap.knee : h;
}

// ---------------------------------------------------------------------------
// Shader
// ---------------------------------------------------------------------------

const VERT = /* glsl */ `
attribute vec2 aGlow;

varying vec3 vWorld;
varying vec3 vNrm;
varying vec2 vGlow;

void main(){
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  vNrm = normalize(mat3(modelMatrix) * normal);
  vGlow = aGlow;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

const FRAG = /* glsl */ `
precision highp float;

uniform vec3  uBase;
uniform vec3  uRim;
uniform float uRimStrength;
uniform float uRimPower;
uniform vec3  uAmbient;
uniform vec3  uKeyColor;
uniform float uKeyIntensity;
uniform vec3  uKeyDir;

uniform float uTime;
uniform float uBreathe;
uniform float uGlowStrength;
uniform vec3  uGlowA;
uniform vec3  uGlowB;

uniform vec3  uSwarmPos[5];
uniform float uSwarmIntensity;
uniform float uSwarmRange;
uniform float uSwarmDecay;
uniform float uSwarmClamp;
uniform vec3  uSwarmColor;
uniform int   uSwarmCount;

uniform vec3  uFogColor;
uniform float uFogNear;
uniform float uFogFar;

varying vec3 vWorld;
varying vec3 vNrm;
varying vec2 vGlow;

void main(){
  vec3 n = normalize(vNrm);
  vec3 viewDir = normalize(cameraPosition - vWorld);
  float dist = distance(cameraPosition, vWorld);

  vec3 color = uBase;

  // Ambient is almost nothing, and essential: without it, terrain facing away
  // from the skyglow is mathematically pure black, and pure black regions kill
  // the sense that a surface continues into shadow.
  color += uAmbient;

  // Skyglow, not a sun. Its job is normal disambiguation, so slopes facing
  // different ways are marginally different rather than identical.
  color += uKeyColor * uKeyIntensity * max(dot(n, normalize(uKeyDir)), 0.0);

  // THE INTERNAL GLOW. Baked per-vertex: crest-weighted, cluster-masked,
  // valley floors excluded (see the bake). Breathes slowly, phase-scattered
  // so the land never pulses as one. The near field is suppressed in CAMERA
  // space — whatever the bake says, the ground at the viewer's feet stays
  // pressed dark and the road remains the foreground's only light.
  float g = vGlow.x * (0.84 + 0.16 * sin(uTime * uBreathe * 6.2832 + vGlow.y * 6.2832));
  g *= smoothstep(130.0, 430.0, dist);
  color += mix(uGlowA, uGlowB, min(g * 1.5, 1.0)) * (g * uGlowStrength);

  // The rim term — how the unlit flanks stay visible at all.
  //
  // MASKED BY SLOPE: (1 - |n.y|) is zero on level ground, so the flat plain
  // seen at grazing incidence never lights into a green blanket — only the
  // flanks of real relief rim, which is what a night ridgeline actually shows.
  float rim = pow(1.0 - abs(dot(n, viewDir)), uRimPower);
  rim *= pow(clamp(1.0 - abs(n.y), 0.0, 1.0), 0.9);

  // DISTANT relief catches the sky's green light — the lift rises with
  // distance so the near plain stays pressed black, and it is DIRECTIONAL:
  // slopes facing the glow bank in the upper sky glint green, the flanks
  // turned away stay in shadow — one mountain, both treatments.
  float farLift = smoothstep(480.0, 1250.0, dist);
  vec3 glowDir = normalize(vec3(0.35, 0.55, -0.5));
  float facing = 0.3 + 0.7 * max(dot(n, glowDir), 0.0);
  rim *= mix(1.0, 3.0 * facing, farLift);
  color += uRim * rim * uRimStrength;

  // Swarm lights — the flying river illuminating the landscape it passes.
  // WINDOWED falloff reaching exactly zero at uSwarmRange, so the pools stay
  // discrete and the light visibly travels. See config for the full history.
  float swarm = 0.0;
  for (int i = 0; i < 5; i++) {
    if (i >= uSwarmCount) break;
    float x = clamp(distance(vWorld, uSwarmPos[i]) / uSwarmRange, 0.0, 1.0);
    swarm += pow(1.0 - x * x, uSwarmDecay);
  }
  color += uSwarmColor * min(swarm * uSwarmIntensity, uSwarmClamp);

  // Linear fog, tinted to the sky's horizon band so distant terrain dissolves
  // rather than ending at an edge. SOFTENED against the old curve (pow 1.35):
  // the far ranges must fade toward darkness while KEEPING their silhouettes —
  // atmospheric perspective, not erasure.
  float fog = clamp((dist - uFogNear) / (uFogFar - uFogNear), 0.0, 1.0);
  fog = pow(fog, 1.35);
  color = mix(color, uFogColor, fog);

  // THE SILHOUETTE FLOOR, applied AFTER the fog on purpose. At 2,000u the
  // fog has taken ~90% of everything, which is how the far giants vanished
  // entirely (they are why the fog curve alone cannot deliver "fades into
  // darkness while MAINTAINING visible silhouettes"). Rim light is edge-only,
  // so letting a fraction of it through the fog draws faint green crest
  // lines on the horizon ranges without lifting their faces out of the dark.
  color += uRim * rim * uRimStrength * 0.35 * smoothstep(1100.0, 1900.0, dist);

  gl_FragColor = vec4(color, 1.0);
}
`;

// ---------------------------------------------------------------------------

export function createTerrain(tier: Tier): TerrainHandle {
  const segments = PERF.terrainSegmentsByTier[tier];
  const width = WORLD.bounds.maxX - WORLD.bounds.minX;
  const depth = WORLD.bounds.maxZ - WORLD.bounds.minZ;
  const centreX = (WORLD.bounds.maxX + WORLD.bounds.minX) / 2;
  const centreZ = (WORLD.bounds.maxZ + WORLD.bounds.minZ) / 2;

  const geometry = new THREE.PlaneGeometry(
    width,
    depth,
    segments - 1,
    segments - 1,
  );
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(centreX, 0, centreZ);

  const pos = geometry.attributes.position as THREE.BufferAttribute;

  /**
   * The heightfield is cached so heightAt / normalAt / slopeAt are direct
   * lookups. Re-running the composed field plus a nearestU search 140,000
   * times during seeding costs the better part of a second and shows up as a
   * visible hitch before the scene starts; sampling this costs about 6ms.
   */
  const field = new Float32Array(segments * segments);

  for (let j = 0; j < segments; j++) {
    for (let i = 0; i < segments; i++) {
      const idx = j * segments + i;
      const x = pos.getX(idx);
      const z = pos.getZ(idx);
      const hN = noiseHeight(x, z);
      const h = foregroundCap(z, hN - carveAmount(x, z, hN));
      field[idx] = h;
      pos.setY(idx, h);
    }
  }

  pos.needsUpdate = true;
  geometry.computeVertexNormals();

  /**
   * THE PROMINENCE MAP: the field minus a blurred copy of itself. Positive
   * where a point stands proud of its neighbourhood — ridgelines, hilltops,
   * peaks — which is exactly where the brief accumulates the energy. A
   * separable box blur, radius 5 cells (~35u): cheap, and the scale that
   * separates "a ridge" from "a mountain being generally high".
   */
  const R = 5;
  const blurTmp = new Float32Array(field.length);
  const blurred = new Float32Array(field.length);
  const clampI = (v: number) => THREE.MathUtils.clamp(v, 0, segments - 1);
  for (let j = 0; j < segments; j++) {
    for (let i = 0; i < segments; i++) {
      let s = 0;
      for (let k = -R; k <= R; k++) s += field[j * segments + clampI(i + k)];
      blurTmp[j * segments + i] = s / (2 * R + 1);
    }
  }
  for (let j = 0; j < segments; j++) {
    for (let i = 0; i < segments; i++) {
      let s = 0;
      for (let k = -R; k <= R; k++) s += blurTmp[clampI(j + k) * segments + i];
      blurred[j * segments + i] = s / (2 * R + 1);
    }
  }
  const prominence = new Float32Array(field.length);
  for (let i = 0; i < field.length; i++) prominence[i] = field[i] - blurred[i];

  /**
   * THE BAKED GLOW — (intensity, phase) per vertex. Crest-led, elevation-
   * assisted, cluster-masked: ridges burn, high ground glows faintly, valley
   * floors and the quiet regions stay black. Never uniform by construction.
   */
  const G = TERRAIN.glow;
  const aGlow = new Float32Array(segments * segments * 2);
  for (let j = 0; j < segments; j++) {
    for (let i = 0; i < segments; i++) {
      const idx = j * segments + i;
      const x = pos.getX(idx);
      const z = pos.getZ(idx);
      const h = field[idx];
      const crest = THREE.MathUtils.clamp(prominence[idx] / G.crestNorm, 0, 1);
      const elev = THREE.MathUtils.smoothstep(h, G.elevLow, G.elevHigh);
      const cluster = glowClusterAt(x, z);
      // Crest-dominant on purpose (probe round 4): with more elevation term
      // the whole face of a tall mountain glowed uniformly — the reference
      // keeps faces DARK and spends the light on crests and ridgelines.
      aGlow[idx * 2] =
        (0.8 * crest + 0.2 * elev) * (0.25 + 0.75 * cluster);
      aGlow[idx * 2 + 1] = hash2(i, j, TERRAIN.noiseSeed ^ 0x3737);
    }
  }
  geometry.setAttribute("aGlow", new THREE.BufferAttribute(aGlow, 2));

  const cellX = width / (segments - 1);
  const cellZ = depth / (segments - 1);

  const sampleField = (arr: Float32Array, i: number, j: number) =>
    arr[
      THREE.MathUtils.clamp(j, 0, segments - 1) * segments +
        THREE.MathUtils.clamp(i, 0, segments - 1)
    ];

  const bilinear = (arr: Float32Array, x: number, z: number): number => {
    const fx = (x - WORLD.bounds.minX) / cellX;
    const fz = (z - WORLD.bounds.minZ) / cellZ;
    const i = Math.floor(fx);
    const j = Math.floor(fz);
    const tx = fx - i;
    const tz = fz - j;

    return (
      (sampleField(arr, i, j) * (1 - tx) + sampleField(arr, i + 1, j) * tx) * (1 - tz) +
      (sampleField(arr, i, j + 1) * (1 - tx) + sampleField(arr, i + 1, j + 1) * tx) * tz
    );
  };

  const heightAt = (x: number, z: number) => bilinear(field, x, z);
  const prominenceAt = (x: number, z: number) => bilinear(prominence, x, z);

  function normalAt(x: number, z: number, out = new THREE.Vector3()) {
    const e = cellX;
    return out
      .set(
        heightAt(x - e, z) - heightAt(x + e, z),
        2 * e,
        heightAt(x, z - e) - heightAt(x, z + e),
      )
      .normalize();
  }

  function slopeAt(x: number, z: number): number {
    normalAt(x, z, _tmp);
    return THREE.MathUtils.radToDeg(
      Math.acos(THREE.MathUtils.clamp(_tmp.y, -1, 1)),
    );
  }

  const swarmPos = Array.from({ length: 5 }, () => new THREE.Vector3());

  const material = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: {
      /**
       * --void, the darkest token, not --soil. The unlit floor must sit clear
       * of the near-black band edge with room for ambient and key on top —
       * the landscape's SHAPE is read from the rim and the internal glow,
       * which are unaffected. The contrast the round-3 brief demands comes
       * from the glow rising out of this floor, not from lifting the floor.
       */
      uBase: { value: new THREE.Color(PALETTE.void) },
      uRim: { value: new THREE.Color(PALETTE.rim) },
      uRimStrength: { value: TERRAIN.material.rimStrength },
      uRimPower: { value: TERRAIN.material.rimPower },
      uAmbient: {
        value: new THREE.Color(PALETTE.moss).multiplyScalar(
          LIGHTING.ambient.intensity * 0.12,
        ),
      },
      uKeyColor: { value: new THREE.Color("#a9c77e") },
      uKeyIntensity: { value: LIGHTING.key.intensity },
      uKeyDir: { value: new THREE.Vector3(...LIGHTING.key.direction) },

      uTime: { value: 0 },
      uBreathe: { value: TERRAIN.glow.breatheHz },
      uGlowStrength: { value: TERRAIN.glow.strength },
      uGlowA: { value: new THREE.Color(TERRAIN.glow.colorA) },
      uGlowB: { value: new THREE.Color(TERRAIN.glow.colorB) },

      uSwarmPos: { value: swarmPos },
      uSwarmIntensity: { value: 0 },
      uSwarmRange: { value: LIGHTING.swarmLights.range },
      uSwarmDecay: { value: LIGHTING.swarmLights.decay },
      uSwarmClamp: { value: LIGHTING.swarmLights.terrainClamp },
      uSwarmColor: { value: new THREE.Color(PALETTE.limeBright) },
      uSwarmCount: { value: PERF.swarmLightsByTier[tier] },

      // NOT --ink (world-polish pass): the terrain dissolves toward a
      // green-black, not the sky's blue-black, so the far ranges melt into
      // the nebula's atmosphere instead of reading as cut-outs against it.
      uFogColor: { value: new THREE.Color(TERRAIN.material.horizonFog) },
      uFogNear: { value: WORLD.fogNear },
      uFogFar: { value: WORLD.fogFar },
    },
    // The ONLY pass that writes depth, and everything downstream depends on it:
    // it is what lets a particle behind a mountain be correctly hidden.
    depthWrite: true,
    depthTest: true,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  mesh.renderOrder = 1;

  return {
    mesh,
    heightAt,
    prominenceAt,
    normalAt,
    slopeAt,
    setRim(strength: number) {
      material.uniforms.uRimStrength.value = strength;
    },
    setSwarmCount(count: number) {
      material.uniforms.uSwarmCount.value = Math.max(0, Math.min(5, count));
    },
    setSwarm(positions, intensity) {
      for (let i = 0; i < swarmPos.length; i++) {
        if (positions[i]) swarmPos[i].copy(positions[i]);
      }
      material.uniforms.uSwarmIntensity.value = intensity;
    },
    update(elapsed: number) {
      material.uniforms.uTime.value = elapsed;
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}
