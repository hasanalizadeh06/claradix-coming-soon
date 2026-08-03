/**
 * THE BRIDGE, as a list of positions.
 *
 * There is no bridge object. There is a list of ~140,000 points in space, each
 * tagged with which structural layer it belongs to and where it sits along the
 * span. Particles fly to those points and stop. The bridge is what that looks
 * like.
 *
 * Because there is no mesh, the bridge *cannot* become solid. That constraint is
 * architectural rather than a matter of discipline — nobody can accidentally
 * make it opaque, because there is nothing to make opaque.
 *
 * The budget is deliberately NOT proportional to surface area — particle count
 * buys legibility of THIN things, and since the round-4 redesign EVERYTHING
 * here is thin: the deck is a weave of fiber lines, the towers are 1.6u-wide
 * strokes, the hangers hairline threads. Density along a line is what closes
 * it into continuous light; the per-target sizeScale is what keeps the fine
 * elements fine instead of letting point size fake thickness.
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
  push(p: THREE.Vector3, n: THREE.Vector3, layer: Layer, sizeScale?: number): void;
}

const _p = new THREE.Vector3();
const _n = new THREE.Vector3();
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
    push(p, n, layer, sizeScale = 1) {
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

      // `u` from nearestU, never from the sampling parameter: a cable's own
      // parameter and its projected position along the bridge diverge near the
      // towers, and using it puts cables in the wrong assembly slot.
      uArr[count] = centreline.nearestU(p);
      layerArr[count] = layerIndex(layer);

      grid.record(count, p.x, p.y, p.z);
      count++;
    },
  };

  const budget = (share: number) => Math.floor(nominal * share);
  const d = BRIDGE.targetDistribution;

  buildPiers(sink, rng, budget(d.piers), heightAt);
  buildTowers(sink, rng, budget(d.towers), heightAt);
  buildDeck(sink, rng, budget(d.deck));
  buildCables(sink, rng, budget(d.mainCables));
  buildHangers(sink, rng, budget(d.hangers));
  buildRailing(sink, rng, budget(d.railing));

  // Any shortfall from dedup goes to the deck — the layer least sensitive to a
  // handful of points either way.
  if (count < nominal) buildDeck(sink, rng, nominal - count);

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
// Deck
// ---------------------------------------------------------------------------

/**
 * Along-line sampling bias. The first probe round showed the near road as a
 * dotted carpet: uniform arc-length spacing (~1.5u) subtends several PIXELS
 * inside 500u of the camera, and a line whose points are pixels apart is
 * dots. Exponent 1.6 concentrates samples where they subtend the most
 * screen (≈1.9× density at the near ramp, 0.76× at the fogged far end,
 * where perspective packs many u into each pixel anyway).
 */
const FIBER_NEAR_BIAS = 2.0;

const FIBER_SHARE = 0.76;

function buildDeck(sink: Sink, rng: ReturnType<typeof makeRng>, n: number) {
  const half = BRIDGE.deckWidth / 2;
  const fiberHalf = half - 2;

  // Fiber count scales with budget so along-line spacing stays tight enough
  // to read as an unbroken filament at every tier.
  const fiberBudget = Math.floor(n * FIBER_SHARE);
  const lines = THREE.MathUtils.clamp(Math.round(fiberBudget / 1400), 12, 18);

  // Cosine centre-weighting, normalised so the shares spend the full budget.
  const weights: number[] = [];
  let weightSum = 0;
  for (let l = 0; l < lines; l++) {
    const offset = lines === 1 ? 0 : (l / (lines - 1)) * 2 - 1;
    const w = 0.62 + 0.38 * Math.cos((offset * Math.PI) / 2);
    weights.push(w);
    weightSum += w;
  }

  for (let l = 0; l < lines; l++) {
    // SNAPPED onto the filament lattice (pass 2): the dust rows must sit ON
    // the continuous GL lanes in bridgeFibers, not on their own near-miss
    // spacing — two line families a few degrees apart beat against each
    // other and read as noise, which is the one thing the weave must never
    // do. Row l takes filament lane round(l · (lanes-1)/(rows-1)).
    const lane = Math.round((l * (BRIDGE.fiberLanes - 1)) / (lines - 1));
    const offset = (lane / (BRIDGE.fiberLanes - 1)) * 2 - 1;
    const across0 = offset * fiberHalf;
    const perLine = Math.floor((fiberBudget * weights[l]) / weightSum);

    for (let i = 0; i < perLine; i++) {
      // Stratified, then bent through the near bias — the map is monotone,
      // so stratification (no banding) survives it.
      const u = Math.pow((i + rng.next()) / perLine, FIBER_NEAR_BIAS);
      const { normal: nrm, binormal } = centreline.frameAt(u);
      centreline.positionAt(u, _p);

      // ±0.06 lateral jitter: enough to defeat the dedup grid's coincidence
      // test, far below anything the eye can see. The line stays a line.
      const across = across0 + rng.jitter(0.06);
      const k = 1 - (across / half) ** 2;
      _p.addScaledVector(binormal, across).addScaledVector(
        nrm,
        BRIDGE.deckCamber * k,
      );
      // 0.8 → 0.55 (pass 2): the filaments are the material now — seated
      // fiber particles become the micro-detail living inside it.
      sink.push(_p, nrm, "deck", 0.55);
    }
  }

  // --- micro-stars between the fibers --------------------------------------
  const starCount = n - fiberBudget;
  for (let i = 0; i < starCount; i++) {
    const u = (i + rng.next()) / starCount;
    const { normal: nrm, binormal } = centreline.frameAt(u);
    centreline.positionAt(u, _p);

    const across = rng.range(-fiberHalf, fiberHalf);
    const k = 1 - (across / half) ** 2;
    // A whisper of lift above the surface — dust hanging over the weave,
    // catching light without ever forming a layer.
    _p.addScaledVector(binormal, across).addScaledVector(
      nrm,
      BRIDGE.deckCamber * k + rng.range(0, 0.3),
    );
    sink.push(_p, nrm, "deck", rng.range(0.35, 0.5));
  }
}

// ---------------------------------------------------------------------------
// Railing
// ---------------------------------------------------------------------------

/**
 * A fine line along both top edges. It seats LAST, so the very final particle of
 * the entire scene is a railing particle at u = 0, in the immediate foreground.
 *
 * Its visual job is to give the deck a crisp bright upper edge — which is what
 * separates the roadway from its own glow in the reference frame.
 */
function buildRailing(sink: Sink, rng: ReturnType<typeof makeRng>, n: number) {
  const lateral = BRIDGE.deckWidth / 2 - 0.5;
  const perSide = Math.floor(n / 2);

  for (let side = -1; side <= 1; side += 2) {
    for (let i = 0; i < perSide; i++) {
      const u = (i + rng.next()) / perSide;
      const { normal: nrm, binormal } = centreline.frameAt(u);
      centreline.positionAt(u, _p);
      // Barely above the ribbon (was +1.8): on a paper-thin deck a floating
      // rail reads as a second, detached line. This is the ribbon's own
      // edge, drawn one hair sharper and higher than the weave.
      _p.addScaledVector(binormal, side * lateral).addScaledVector(
        nrm,
        BRIDGE.deckCamber + 0.7 + rng.jitter(0.06),
      );
      sink.push(_p, nrm, "railing", 0.7);
    }
  }
}

// ---------------------------------------------------------------------------
// Towers
// ---------------------------------------------------------------------------

/**
 * Two legs, tapering, with horizontal cross-braces — and the DECK PASSES THROUGH
 * them, between the legs, as it does on a real suspension bridge. The tower is
 * not a thing the deck sits on top of.
 *
 * Towers remain the densest element per unit of geometry: 18% of the budget
 * condensed into members a third as wide as the previous round's. The additive
 * accumulation pushes the slim cores past lime-core into near-white — which is
 * exactly the round-4 ask: pillars of pure light, not structural columns.
 */
function buildTowers(
  sink: Sink,
  rng: ReturnType<typeof makeRng>,
  n: number,
  heightAt: HeightAt,
) {
  const towers = [BRIDGE.towers.main, BRIDGE.towers.far] as const;
  // The main tower is taller and closer, so it earns the larger share.
  const shares = [0.6, 0.4];

  towers.forEach((tower, ti) => {
    const count = Math.floor(n * shares[ti]);
    const { normal: nrm, binormal } = centreline.frameAt(tower.u);
    const base = centreline.positionAt(tower.u, new THREE.Vector3());

    // The PYLON: the tower does not stop at the deck — it plunges past it
    // into whatever lies below (the reference's main tower stands in dark
    // water). One merged shaft, slightly wider than a leg.
    const ground = heightAt(base.x, base.z);
    const below = base.y - ground;
    const hasPylon = below > 10;

    const pylonCount = hasPylon ? Math.floor(count * 0.16) : 0;
    const legCount = Math.floor((count - pylonCount) * 0.84);
    const braceCount = count - pylonCount - legCount;

    for (let i = 0; i < pylonCount; i++) {
      const v = rng.next();
      // Slimmed with the legs (round 4): the pylon is a falling thread of
      // light into the water, not a caisson.
      _p.copy(base)
        .addScaledVector(binormal, rng.jitter(tower.legSpacing * 0.3))
        .addScaledVector(nrm, -v * (below - 2));
      _p.x += rng.jitter(1.0);
      _n.copy(binormal);
      sink.push(_p, _n, "towers");
    }

    // --- legs ---
    // Legs run slightly PAST the cable saddle — on the reference frame the
    // tower tops stand proud of the cable anchorage, which is what makes them
    // read as masts rather than as posts the cable happens to end on.
    //
    // Member width 4.4 → 1.6 (round 4: "elegant pillars of pure light").
    // The particle share barely moved, so the same light condenses into a
    // line a third as wide — the additive sum runs hotter and the leg reads
    // as a drawn laser stroke, not a structural column.
    const legHeight = tower.height * 1.045;
    for (let i = 0; i < legCount; i++) {
      const side = rng.next() < 0.5 ? -1 : 1;
      const h = rng.next();
      // Smooth taper, not linear: a linear taper reads as a wedge.
      const k = h * h * (3 - 2 * h);
      const width = THREE.MathUtils.lerp(1, tower.legTaper, k) * 1.6;

      _p.copy(base)
        .addScaledVector(binormal, (side * tower.legSpacing) / 2 + rng.jitter(width))
        .addScaledVector(nrm, h * legHeight + rng.jitter(0.6));

      _n.copy(binormal).multiplyScalar(side);
      sink.push(_p, _n, "towers");
    }

    // --- cross-braces ---
    const perBrace = Math.floor(braceCount / tower.crossBraceY.length);
    for (const braceY of tower.crossBraceY) {
      const localY = braceY - tower.baseY;
      for (let i = 0; i < perBrace; i++) {
        const across =
          ((i + rng.next()) / perBrace - 0.5) * tower.legSpacing;
        _p.copy(base)
          .addScaledVector(binormal, across)
          .addScaledVector(nrm, localY + rng.jitter(0.45));
        sink.push(_p, nrm, "towers");
      }
    }
  });
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
        // disc(0.5) → disc(0.2) (round 4: "dramatically thinner" cables) —
        // the drape becomes a drawn line, not a rope of scattered light.
        const jx = rng.disc(0.2);

        _p.addScaledVector(binormal, side * lat + jx.x).addScaledVector(
          nrm,
          rise + jx.y,
        );

        sink.push(_p, nrm, "mainCables", 0.7);
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
          sink.push(_t, nrm, "hangers", 0.5);
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Piers
// ---------------------------------------------------------------------------

/**
 * Each pier runs from the deck underside DOWN TO THE TERRAIN at its position,
 * sampled from the heightfield.
 *
 * This is where the corridor carve pays off: the carve makes the ground deeper
 * near the centreline, so piers come out tall in the middle of the valley and
 * short near the abutments. Nobody authored those heights — they fall out of the
 * terrain, which is Law 2 producing correct architecture for free.
 */
function buildPiers(
  sink: Sink,
  rng: ReturnType<typeof makeRng>,
  n: number,
  heightAt: HeightAt,
) {
  const { nearApproach, farApproach } = BRIDGE.sections;
  const ranges = [nearApproach, farApproach];

  const spans = ranges.map((r) => (r[1] - r[0]) * centreline.arcLength);
  const totalSpan = spans[0] + spans[1];
  const pierCount = Math.max(2, Math.floor(totalSpan / BRIDGE.piers.spacing));
  const perPier = Math.max(1, Math.floor(n / pierCount));

  let placed = 0;
  ranges.forEach((range, ri) => {
    const share = spans[ri] / totalSpan;
    const countHere = Math.max(1, Math.round(pierCount * share));

    for (let i = 0; i < countHere; i++) {
      const t = (i + 0.5) / countHere;
      const u = THREE.MathUtils.lerp(range[0], range[1], t);

      const { normal: nrm, binormal } = centreline.frameAt(u);
      const base = centreline.positionAt(u, new THREE.Vector3());

      const ground = heightAt(base.x, base.z);
      const top = base.y - BRIDGE.deckThickness;
      const height = top - ground;
      if (height <= 1) continue;

      for (let k = 0; k < perPier; k++) {
        const v = rng.next();
        // Surface sample only — nobody sees inside a pier.
        const width = THREE.MathUtils.lerp(
          BRIDGE.piers.widthBase,
          BRIDGE.piers.widthTop,
          v,
        );
        const angle = rng.next() * Math.PI * 2;

        _p.copy(base)
          .addScaledVector(binormal, (Math.cos(angle) * width) / 2)
          .addScaledVector(nrm, -(1 - v) * height - BRIDGE.deckThickness);
        _p.x += (Math.sin(angle) * width) / 2 * 0.35;

        _n.set(Math.cos(angle), 0, Math.sin(angle)).normalize();
        sink.push(_p, _n, "piers", 0.7);
        placed++;
        if (placed >= n) return;
      }
    }
  });
}
