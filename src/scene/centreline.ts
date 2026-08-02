/**
 * The bridge's spine, and the most-depended-upon module in the project.
 *
 * Terrain carving, target generation, the flight guide curve, assembly ordering,
 * swarm-light binning and cursor depth all ask this module questions. It asks
 * nothing of anyone.
 *
 * Two things here are easy to get subtly wrong and expensive to diagnose:
 *
 *   `u` is normalised ARC LENGTH, not the spline's raw parameter. Using the raw
 *   parameter makes the assembly sweep speed up and slow down as it crosses
 *   control points — visible as a stutter in the construction front that looks
 *   like a scheduling bug and is not.
 *
 *   The local frame is PARALLEL TRANSPORT, not `cross(tangent, worldUp)`. The
 *   naive construction has a singularity when the tangent nears vertical, and
 *   every particle crossing that region snaps to a new roll orientation on the
 *   same frame — a visible twist seam in the river. Our centreline rises only
 *   16u over 1624u so it will not trigger today; it will trigger the moment
 *   somebody moves a control point, and the cause will be very hard to find.
 */

import * as THREE from "three";
import { BRIDGE } from "@/lib/config";

/** Samples in the arc-length table. 256 is ample for a five-point spline. */
const ARC_SAMPLES = 256;

/** Samples in the frame table, baked to a texture for the vertex shader. */
export const FRAME_SAMPLES = 512;

export interface Frame {
  normal: THREE.Vector3;
  binormal: THREE.Vector3;
}

const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _c = new THREE.Vector3();

function buildSpline(): THREE.CatmullRomCurve3 {
  const points = BRIDGE.centreline.map(
    (cp) => new THREE.Vector3(cp.p[0], cp.p[1], cp.p[2]),
  );
  // `centripetal` avoids the cusps and overshoot that `catmullrom` produces on
  // unevenly spaced control points — ours are spaced 284u to 469u apart.
  return new THREE.CatmullRomCurve3(points, false, "centripetal", 0.5);
}

/**
 * Rotation-minimising frames by double reflection.
 *
 * Standard, numerically stable, and computed once at init because the curve
 * never changes. Wang et al., "Computation of Rotation Minimizing Frames".
 */
function buildFrames(
  positions: THREE.Vector3[],
  tangents: THREE.Vector3[],
): Frame[] {
  const n = positions.length;
  const frames: Frame[] = new Array(n);

  // Seed: the MOST VERTICAL perpendicular to the first tangent — world up,
  // projected off the tangent.
  //
  // This is load-bearing, not cosmetic. Everything built off this frame treats
  // `normal` as UP and `binormal` as LATERAL: towers climb the normal, cables
  // rise along it, deck and rails spread along the binormal, the flight guide
  // offsets along it. An earlier seed picked "the world axis the tangent is
  // least aligned with", which made the frame's orientation an accident of the
  // centreline's heading — one re-authored curve later, the normal came out
  // near-horizontal and every tower in the scene rose sideways, capping the
  // whole superstructure at a seventh of its height. Towers rise along
  // gravity; the frame must guarantee it, not happen upon it.
  //
  // Parallel transport then keeps the normal near-vertical along the whole
  // curve (our torsion is tiny), while still avoiding the Frenet flips this
  // module exists to prevent.
  const t0 = tangents[0];
  const up = new THREE.Vector3(0, 1, 0);
  const n0 = up.clone().addScaledVector(t0, -t0.dot(up));
  // A bridge centreline is never vertical, but never trust never.
  if (n0.lengthSq() < 1e-6) n0.set(0, 0, 1).addScaledVector(t0, -t0.z);
  n0.normalize();

  frames[0] = {
    normal: n0,
    binormal: new THREE.Vector3().crossVectors(t0, n0).normalize(),
  };

  for (let i = 1; i < n; i++) {
    const prevN = frames[i - 1].normal;
    const prevT = tangents[i - 1];
    const currT = tangents[i];

    // First reflection: across the plane bisecting the two positions.
    _a.subVectors(positions[i], positions[i - 1]);
    const c1 = _a.dot(_a);
    if (c1 < 1e-12) {
      frames[i] = {
        normal: prevN.clone(),
        binormal: frames[i - 1].binormal.clone(),
      };
      continue;
    }

    const nL = prevN
      .clone()
      .addScaledVector(_a, (-2 / c1) * _a.dot(prevN));
    const tL = prevT
      .clone()
      .addScaledVector(_a, (-2 / c1) * _a.dot(prevT));

    // Second reflection: across the plane bisecting the two tangents.
    _b.subVectors(currT, tL);
    const c2 = _b.dot(_b);
    const normal =
      c2 < 1e-12
        ? nL
        : nL.clone().addScaledVector(_b, (-2 / c2) * _b.dot(nL));

    normal.normalize();
    frames[i] = {
      normal,
      binormal: new THREE.Vector3().crossVectors(currT, normal).normalize(),
    };
  }

  return frames;
}

class Centreline {
  private curve = buildSpline();

  /** Cumulative arc length at each of ARC_SAMPLES evenly-spaced t values. */
  private arcTable: Float32Array;
  /** Baked frames, sampled by u. */
  private framePositions: THREE.Vector3[] = [];
  private frameTangents: THREE.Vector3[] = [];
  private frames: Frame[] = [];

  readonly arcLength: number;

  constructor() {
    // --- arc-length table ---
    this.arcTable = new Float32Array(ARC_SAMPLES + 1);
    let total = 0;
    this.curve.getPoint(0, _a);
    for (let i = 1; i <= ARC_SAMPLES; i++) {
      this.curve.getPoint(i / ARC_SAMPLES, _b);
      total += _a.distanceTo(_b);
      this.arcTable[i] = total;
      _a.copy(_b);
    }
    this.arcLength = total;

    // --- frame table, uniform in ARC LENGTH so the shader can index by u ---
    for (let i = 0; i < FRAME_SAMPLES; i++) {
      const u = i / (FRAME_SAMPLES - 1);
      const t = this.tOf(u);
      this.framePositions.push(this.curve.getPoint(t, new THREE.Vector3()));
      this.frameTangents.push(
        this.curve.getTangent(t, new THREE.Vector3()).normalize(),
      );
    }
    this.frames = buildFrames(this.framePositions, this.frameTangents);
  }

  /** Spline parameter `t` for a normalised arc length `u`. Binary search. */
  private tOf(u: number): number {
    const target = THREE.MathUtils.clamp(u, 0, 1) * this.arcLength;

    let lo = 0;
    let hi = ARC_SAMPLES;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (this.arcTable[mid] < target) lo = mid + 1;
      else hi = mid;
    }

    if (lo === 0) return 0;
    const before = this.arcTable[lo - 1];
    const after = this.arcTable[lo];
    const span = after - before;
    const frac = span > 1e-9 ? (target - before) / span : 0;
    return (lo - 1 + frac) / ARC_SAMPLES;
  }

  positionAt(u: number, out = new THREE.Vector3()): THREE.Vector3 {
    return this.curve.getPoint(this.tOf(u), out);
  }

  tangentAt(u: number, out = new THREE.Vector3()): THREE.Vector3 {
    return this.curve.getTangent(this.tOf(u), out).normalize();
  }

  /** Interpolated from the baked table — never reconstructed from world-up. */
  frameAt(u: number): Frame {
    const f = THREE.MathUtils.clamp(u, 0, 1) * (FRAME_SAMPLES - 1);
    const i = Math.min(FRAME_SAMPLES - 2, Math.floor(f));
    const k = f - i;

    const normal = this.frames[i].normal
      .clone()
      .lerp(this.frames[i + 1].normal, k)
      .normalize();
    const binormal = this.frames[i].binormal
      .clone()
      .lerp(this.frames[i + 1].binormal, k)
      .normalize();

    return { normal, binormal };
  }

  uAtDistance(d: number): number {
    return THREE.MathUtils.clamp(d / this.arcLength, 0, 1);
  }

  /**
   * Nearest `u` to an arbitrary point. Coarse scan then local refinement —
   * about 40 distance tests, which is cheap enough to call per terrain vertex
   * during the corridor carve and per cursor sample at runtime.
   */
  nearestU(p: THREE.Vector3): number {
    let bestU = 0;
    let bestD = Infinity;

    const COARSE = 32;
    for (let i = 0; i <= COARSE; i++) {
      const u = i / COARSE;
      const d = this.positionAt(u, _c).distanceToSquared(p);
      if (d < bestD) {
        bestD = d;
        bestU = u;
      }
    }

    let step = 1 / COARSE;
    for (let iter = 0; iter < 8; iter++) {
      step *= 0.5;
      for (const candidate of [bestU - step, bestU + step]) {
        if (candidate < 0 || candidate > 1) continue;
        const d = this.positionAt(candidate, _c).distanceToSquared(p);
        if (d < bestD) {
          bestD = d;
          bestU = candidate;
        }
      }
    }

    return bestU;
  }

  /** Squared distance from a point to the curve. Used by the corridor carve. */
  distanceSqTo(p: THREE.Vector3): number {
    return this.positionAt(this.nearestU(p), _c).distanceToSquared(p);
  }

  /**
   * The main cable's height above the deck at `u`, as a PARABOLA.
   *
   * Not a catenary. A catenary is a chain hanging under its own weight; a
   * suspension cable carries the deck through its hangers, and that load —
   * uniform along the horizontal and far heavier than the cable — makes the
   * curve parabolic. Golden Gate, Brooklyn, Akashi: all parabolic.
   *
   * Returns 0 outside the main span.
   */
  cableRise(u: number): number {
    const { main, far } = BRIDGE.towers;
    if (u < main.u || u > far.u) return 0;

    const mainTop = main.baseY + main.height;
    const farTop = far.baseY + far.height;

    // Normalised position between the towers.
    const t = (u - main.u) / (far.u - main.u);

    // Straight line between the two tower tops, minus a parabolic sag.
    const chord = THREE.MathUtils.lerp(mainTop, farTop, t);
    const span = (far.u - main.u) * this.arcLength;
    const sag = span * BRIDGE.mainCable.sagRatio;

    // 4t(1-t) peaks at 1.0 at mid-span and is 0 at both towers.
    return chord - sag * 4 * t * (1 - t);
  }

  /** Deck surface height at `u`, including camber. */
  deckY(u: number): number {
    return this.positionAt(u, _c).y + BRIDGE.deckCamber;
  }

  /**
   * The flight guide curve — offset above and camera-side of the bridge so the
   * assembly is never hidden behind the stream feeding it.
   *
   * Pure staging with no physical justification. It exists so the camera can see
   * both the source of the particles and their destination at once, which is the
   * entire compositional argument of the frame.
   */
  guidePoint(
    u: number,
    heightAbove: number,
    lateralOffset: number,
    taperStart: number,
    out = new THREE.Vector3(),
  ): THREE.Vector3 {
    this.positionAt(u, out);
    const taper =
      u < taperStart
        ? 1
        : 1 - THREE.MathUtils.smoothstep(u, taperStart, 1);

    const { binormal } = this.frameAt(u);
    // Camera sits at +Z, so the camera side is whichever binormal faces it.
    const side = binormal.z >= 0 ? 1 : -1;

    out.y += heightAbove * taper;
    out.addScaledVector(binormal, lateralOffset * taper * side);
    return out;
  }

  /**
   * The baked frame table as a DataTexture the vertex shader samples by `u`.
   *
   * 512 × 4 RGBA32F — position, tangent, normal, binormal. Four texture fetches
   * per particle per frame, and the alternative (reconstructing the frame in the
   * shader) reintroduces exactly the singularity this module exists to avoid.
   */
  buildFrameTexture(): THREE.DataTexture {
    const data = new Float32Array(FRAME_SAMPLES * 4 * 4);

    for (let i = 0; i < FRAME_SAMPLES; i++) {
      const u = i / (FRAME_SAMPLES - 1);
      const p = this.framePositions[i];
      const t = this.frameTangents[i];
      const f = this.frames[i];

      // row 0: position (w = u)
      let o = i * 4;
      data[o + 0] = p.x;
      data[o + 1] = p.y;
      data[o + 2] = p.z;
      data[o + 3] = u;

      // row 1: tangent
      o = (FRAME_SAMPLES + i) * 4;
      data[o + 0] = t.x;
      data[o + 1] = t.y;
      data[o + 2] = t.z;
      data[o + 3] = 0;

      // row 2: normal
      o = (FRAME_SAMPLES * 2 + i) * 4;
      data[o + 0] = f.normal.x;
      data[o + 1] = f.normal.y;
      data[o + 2] = f.normal.z;
      data[o + 3] = 0;

      // row 3: binormal
      o = (FRAME_SAMPLES * 3 + i) * 4;
      data[o + 0] = f.binormal.x;
      data[o + 1] = f.binormal.y;
      data[o + 2] = f.binormal.z;
      data[o + 3] = 0;
    }

    const tex = new THREE.DataTexture(
      data,
      FRAME_SAMPLES,
      4,
      THREE.RGBAFormat,
      THREE.FloatType,
    );
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.generateMipmaps = false;
    tex.needsUpdate = true;
    return tex;
  }
}

/** One instance for the whole page. The curve never changes. */
export const centreline = new Centreline();

/**
 * GLSL twin for sampling the frame texture.
 *
 * Generated against FRAME_SAMPLES rather than hard-coded, because two
 * hand-maintained copies of the same constant drift apart the first time
 * somebody edits one, and the symptom — light that no longer sits on the
 * structure — is very hard to trace.
 */
export const CENTRELINE_GLSL = /* glsl */ `
uniform sampler2D uFrameTex;

const float FRAME_SAMPLES = ${FRAME_SAMPLES}.0;

vec4 frameRow(float u, float row){
  // Half-texel inset so LinearFilter never bleeds between rows.
  float x = clamp(u, 0.0, 1.0) * (FRAME_SAMPLES - 1.0) / FRAME_SAMPLES
          + 0.5 / FRAME_SAMPLES;
  float y = (row + 0.5) / 4.0;
  return texture2D(uFrameTex, vec2(x, y));
}

vec3 centrelinePos(float u){ return frameRow(u, 0.0).xyz; }
vec3 centrelineTan(float u){ return frameRow(u, 1.0).xyz; }
vec3 centrelineNrm(float u){ return frameRow(u, 2.0).xyz; }
vec3 centrelineBin(float u){ return frameRow(u, 3.0).xyz; }

/** The flight guide curve. Mirrors Centreline.guidePoint on the CPU. */
vec3 guidePoint(float u, float heightAbove, float lateralOffset, float taperStart){
  vec3 p = centrelinePos(u);
  float taper = u < taperStart
    ? 1.0
    : 1.0 - smoothstep(taperStart, 1.0, u);

  vec3 bin = centrelineBin(u);
  float side = bin.z >= 0.0 ? 1.0 : -1.0;

  p.y += heightAbove * taper;
  p += bin * (lateralOffset * taper * side);
  return p;
}
`;
