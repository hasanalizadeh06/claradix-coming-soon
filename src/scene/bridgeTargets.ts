/**
 * THE SUSPENSION, as a list of positions.
 *
 * 2026-08-04 architecture redesign: the bridge's visual hierarchy is now
 * three-tiered, and this module generates only the MIDDLE tier —
 *
 *   real objects        the two tower pairs (towerStructures.ts — opaque
 *                       mesh geometry, the scene's only solid)
 *   semi-physical       the suspension: delicate particle cable drapes and
 *                       the hanger curtain — THIS FILE
 *   pure energy         the roadway, which does not exist as geometry at
 *                       all: it is the flowing river in groundStreams.ts,
 *                       perceived as a surface only through density
 *
 * So there are no deck, tower, pier or railing targets any more. The whole
 * (much smaller) particle population is the cables and hangers: thousands
 * of tiny aligned particles forming weightless glowing curves that visibly
 * connect the solid towers to the illusory roadway.
 */

import * as THREE from "three";
import { BRIDGE, LAYERS, TARGET, type Layer } from "@/lib/config";
import { makeRng } from "@/lib/rng";
import { centreline } from "./centreline";

export interface TargetCloud {
  /** xyz per target. */
  position: Float32Array;
  /** Normalised arc-length position along the bridge, 0 near … 1 far. */
  u: Float32Array;
  /** Index into LAYERS. */
  layer: Float32Array;
  /** Local structural normal — the direction a particle departs during rewind. */
  normal: Float32Array;
  /**
   * Per-target point-size multiplier (1 = nominal). The round-4 redesign
   * grades the structure by FINENESS: deck micro-stars at ~0.5, hanger
   * threads at ~0.62, fibers at 0.8, tower cores at 1. Folded into
   * aSizeVar's fractional part in particles.ts — the attribute budget is
   * at its hard limit of fourteen, so this must not become a fifteenth.
   */
  sizeScale: Float32Array;
  count: number;
}

type HeightAt = (x: number, z: number) => number;

interface Sink {
  push(
    p: THREE.Vector3,
    n: THREE.Vector3,
    layer: Layer,
    u: number,
    sizeScale?: number,
  ): void;
}

const _p = new THREE.Vector3();
const _t = new THREE.Vector3();

const layerIndex = (l: Layer) => LAYERS.indexOf(l);

/**
 * A hash grid for the deduplication pass.
 *
 * Coincident targets waste budget and, under additive blending, produce a pixel
 * that is slightly too bright — a hot dot with no structural cause. O(n) with a
 * cell size equal to the rejection radius, which matters at 140k points.
 */
class SeparationGrid {
  private cells = new Map<number, number[]>();
  private cell: number;

  constructor(private minSeparation: number) {
    this.cell = minSeparation;
  }

  private key(x: number, y: number, z: number): number {
    const i = Math.floor(x / this.cell);
    const j = Math.floor(y / this.cell);
    const k = Math.floor(z / this.cell);
    // Cheap spatial hash. Collisions only cost a few extra distance tests.
    return (i * 73856093) ^ (j * 19349663) ^ (k * 83492791);
  }

  /** True if the point was accepted and recorded. */
  accept(px: number, py: number, pz: number, out: Float32Array): boolean {
    const minSq = this.minSeparation * this.minSeparation;

    const ci = Math.floor(px / this.cell);
    const cj = Math.floor(py / this.cell);
    const ck = Math.floor(pz / this.cell);

    for (let di = -1; di <= 1; di++) {
      for (let dj = -1; dj <= 1; dj++) {
        for (let dk = -1; dk <= 1; dk++) {
          const bucket = this.cells.get(
            ((ci + di) * 73856093) ^
              ((cj + dj) * 19349663) ^
              ((ck + dk) * 83492791),
          );
          if (!bucket) continue;
          for (const idx of bucket) {
            const dx = out[idx * 3] - px;
            const dy = out[idx * 3 + 1] - py;
            const dz = out[idx * 3 + 2] - pz;
            if (dx * dx + dy * dy + dz * dz < minSq) return false;
          }
        }
      }
    }
    return true;
  }

  record(index: number, px: number, py: number, pz: number) {
    const k = this.key(px, py, pz);
    const bucket = this.cells.get(k);
    if (bucket) bucket.push(index);
    else this.cells.set(k, [index]);
  }
}

/**
 * Generate the target cloud.
 *
 * `nominal` is the tier's particle count — a target to aim at, not a guarantee.
 * Deduplication removes a fraction of a percent, and the particle count is then
 * DERIVED from what survives so that `particleCount === targetCount` exactly.
 * Fewer particles than targets leaves holes in the bridge; more leaves particles
 * with nowhere to go.
 */
export function buildTargets(nominal: number, heightAt: HeightAt): TargetCloud {
  const rng = makeRng(TARGET.randomSeed);

  const position = new Float32Array(nominal * 3);
  const uArr = new Float32Array(nominal);
  const layerArr = new Float32Array(nominal);
  const normal = new Float32Array(nominal * 3);
  const sizeScaleArr = new Float32Array(nominal);

  const grid = new SeparationGrid(TARGET.minSeparation);
  let count = 0;

  const sink: Sink = {
    push(p, n, layer, u, sizeScale = 1) {
      if (count >= nominal) return;
      if (!grid.accept(p.x, p.y, p.z, position)) return;

      const o = count * 3;
      position[o] = p.x;
      position[o + 1] = p.y;
      position[o + 2] = p.z;
      normal[o] = n.x;
      normal[o + 1] = n.y;
      normal[o + 2] = n.z;
      sizeScaleArr[count] = sizeScale;

      // `u` is ANALYTIC (2026-08-04 performance pass): both remaining
      // generators derive their sample position FROM a normalised-arc u, so
      // they simply hand it over. The old per-target nearestU search — ~50
      // spline evaluations × every target — was a measurable slice of the
      // boot's main-thread block and computed the same number the caller
      // already had.
      uArr[count] = u;
      layerArr[count] = layerIndex(layer);

      grid.record(count, p.x, p.y, p.z);
      count++;
    },
  };

  const budget = (share: number) => Math.floor(nominal * share);
  const d = BRIDGE.targetDistribution;

  // Cables and hangers ONLY (2026-08-04 redesign): towers are real geometry
  // in towerStructures.ts, and the roadway deliberately has no targets at
  // all — it exists only as flowing packets. The shares under-spend
  // `nominal` on purpose, and there is no shortfall refill: the particle
  // count is derived from what the suspension actually needs.
  void heightAt;
  buildCables(sink, rng, budget(d.mainCables));
  buildHangers(sink, rng, budget(d.hangers));

  return {
    position: position.subarray(0, count * 3),
    u: uArr.subarray(0, count),
    layer: layerArr.subarray(0, count),
    normal: normal.subarray(0, count * 3),
    sizeScale: sizeScaleArr.subarray(0, count),
    count,
  };
}

// ---------------------------------------------------------------------------
// Main cables
// ---------------------------------------------------------------------------

/**
 * The side-span cable's height at `u` — the run from a tower top down to its
 * deck-level anchorage, as the reference frame draws left of the main tower.
 *
 * Mostly a straight descent with a mild parabolic sag below the chord
 * (sagFraction of the total drop). Returns null outside the side span.
 */
export function sideCableY(u: number): number | null {
  const { main, far } = BRIDGE.towers;
  const spans = [
    {
      towerU: main.u,
      anchorU: main.u - BRIDGE.mainCable.sideSpan.main.anchorU,
      topY: main.baseY + main.height,
      sagFraction: BRIDGE.mainCable.sideSpan.main.sagFraction,
      inside: (v: number) => v >= main.u - BRIDGE.mainCable.sideSpan.main.anchorU && v < main.u,
    },
    {
      towerU: far.u,
      anchorU: far.u + BRIDGE.mainCable.sideSpan.far.anchorU,
      topY: far.baseY + far.height,
      sagFraction: BRIDGE.mainCable.sideSpan.far.sagFraction,
      inside: (v: number) => v > far.u && v <= far.u + BRIDGE.mainCable.sideSpan.far.anchorU,
    },
  ];

  for (const s of spans) {
    if (!s.inside(u)) continue;
    const anchorY = centreline.deckY(s.anchorU) + 1.5;
    // t = 0 at the anchorage, 1 at the tower top.
    const t = (u - s.anchorU) / (s.towerU - s.anchorU);
    const drop = s.topY - anchorY;
    return (
      THREE.MathUtils.lerp(anchorY, s.topY, t) -
      drop * s.sagFraction * 4 * t * (1 - t)
    );
  }
  return null;
}

/**
 * Two parabolas across the main span, PLUS the two side spans descending from
 * each tower top to a deck-level anchorage. 20% of the budget for very little
 * surface area — deliberately generous, because during construction the cable
 * sweep has to read as a LINE BEING DRAWN rather than as a row of dots
 * appearing, and because the drape is the reference frame's signature curve.
 */
function buildCables(sink: Sink, rng: ReturnType<typeof makeRng>, n: number) {
  const { main, far } = BRIDGE.towers;
  const lat = BRIDGE.mainCable.lateralOffset;
  const sideCfg = BRIDGE.mainCable.sideSpan;

  // Budget by arc length would starve the main span's long drape; weighted so
  // the main drape stays the dominant line.
  const segments = [
    { u0: main.u, u1: far.u, share: 0.6, main: true },
    { u0: main.u - sideCfg.main.anchorU, u1: main.u, share: 0.24, main: false },
    { u0: far.u, u1: far.u + sideCfg.far.anchorU, share: 0.16, main: false },
  ];

  for (const seg of segments) {
    const perCable = Math.floor((n * seg.share) / 2);
    for (let side = -1; side <= 1; side += 2) {
      for (let i = 0; i < perCable; i++) {
        const t = (i + rng.next()) / perCable;
        const u = THREE.MathUtils.lerp(seg.u0, seg.u1, t);

        const { normal: nrm, binormal } = centreline.frameAt(u);
        centreline.positionAt(u, _p);

        const y = seg.main ? centreline.cableRise(u) : sideCableY(u);
        if (y === null) continue;
        const rise = y - _p.y;
        // disc 0.2 → 0.12 (2026-08-04: "extremely thin... almost invisible
        // ... delicate glowing curves") — the tightest scatter the dedup
        // grid tolerates; the drape is a thread of aligned points.
        const jx = rng.disc(0.12);

        _p.addScaledVector(binormal, side * lat + jx.x).addScaledVector(
          nrm,
          rise + jx.y,
        );

        sink.push(_p, nrm, "mainCables", u, 0.6);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Hangers
// ---------------------------------------------------------------------------

/**
 * The thin verticals from cable to deck — the highest spatial frequency in the
 * scene, and the FIRST thing to fail as particle count drops. They are the canary
 * for the whole tier system: if hangers are dotted on a machine you expected to
 * run `high`, the tier detection is wrong or the device is throttled. Check that
 * before assuming the geometry is broken.
 */
function buildHangers(sink: Sink, rng: ReturnType<typeof makeRng>, n: number) {
  const { main, far } = BRIDGE.towers;
  const sideCfg = BRIDGE.mainCable.sideSpan;
  const lat = BRIDGE.mainCable.lateralOffset;

  // Main span carries most of the hangers; the side spans get their own short
  // runs, as the reference frame shows left of the main tower.
  const segments = [
    { u0: main.u, u1: far.u, share: 0.74, main: true },
    { u0: main.u - sideCfg.main.anchorU, u1: main.u, share: 0.18, main: false },
    { u0: far.u, u1: far.u + sideCfg.far.anchorU, share: 0.08, main: false },
  ];

  for (const seg of segments) {
    const spanLength = Math.abs(seg.u1 - seg.u0) * centreline.arcLength;
    const hangerCount = Math.max(
      1,
      Math.floor(spanLength / BRIDGE.hangers.spacing),
    );
    const perHanger = Math.floor((n * seg.share) / (hangerCount * 2));
    if (perHanger < 1) continue;

    for (let h = 0; h < hangerCount; h++) {
      const t = (h + 0.5) / hangerCount;
      const u = THREE.MathUtils.lerp(seg.u0, seg.u1, t);

      const { normal: nrm, binormal } = centreline.frameAt(u);
      centreline.positionAt(u, _p);

      const cableY = seg.main ? centreline.cableRise(u) : sideCableY(u);
      if (cableY === null) continue;

      const deckLocal = BRIDGE.deckCamber;
      const cableLocal = cableY - _p.y;
      const length = cableLocal - deckLocal;

      // Prevents zero-length hangers where the cable nears the deck — at
      // mid-span (deep sag) and toward the side-span anchorages.
      if (length < BRIDGE.hangers.minLength) continue;

      for (let side = -1; side <= 1; side += 2) {
        for (let i = 0; i < perHanger; i++) {
          const k = (i + rng.next()) / perHanger;
          // Jitter 0.2 → 0.05 and size 0.62 (round 4: "hundreds of
          // perfectly aligned, evenly spaced vertical cables… almost
          // disappear into the darkness while remaining visible through
          // subtle green illumination"). At half spacing the curtain is
          // twice as fine; each thread is a hairline, not a beam.
          _t.copy(_p)
            .addScaledVector(binormal, side * lat + rng.jitter(0.05))
            .addScaledVector(nrm, deckLocal + k * length);
          sink.push(_t, nrm, "hangers", u, 0.5);
        }
      }
    }
  }
}

