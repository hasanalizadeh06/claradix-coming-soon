/**
 * THE TOWERS — the bridge's only real objects, rebuilt against the client's
 * design-breakdown sheet (2026-08-04): "Bridge Main Towers Design Breakdown".
 *
 * This module is a faithful recreation of that blueprint, not a
 * reinterpretation. The decisions extracted from it, and where each lives:
 *
 *   silhouette      two deep-section masts converging toward the top —
 *                   portal narrows base → saddle (front view 24 → 18 m).
 *                   Ours converges 80 → 70 so the leg centres land exactly
 *                   on the main-cable line (±35): the cable rides its
 *                   saddle, the anchorage reads as load transfer
 *   cross-section   legs DEEPER than wide (6.5 × 12 m), the depth halving
 *                   toward the top (side view 12 → 6.5) — an engineering
 *                   taper, "almost imperceptible" in front view
 *   corners         no perfectly sharp box edges: every member is a
 *                   CHAMFERED prism, and the chamfer facets are exactly
 *                   where the light lives ("glowing accents on edges and
 *                   key lines" — thin bright lines, never a full outline)
 *   crossbeam       ONE massive structural beam high on the mast with an
 *                   ARCHED underside (detail close-up), plus a slab-level
 *                   deck connection derived from deckY(u)
 *   top             a cable-saddle cap, slightly proud of the leg, the
 *                   brightest piece — "particles naturally accumulate
 *                   there"
 *   base            a widened foundation pedestal that continues BELOW the
 *                   terrain (foundation detail: "embedded, most of the
 *                   tower exists underground") — the terrain wraps it, the
 *                   tower grows out of the landscape
 *   material        dark anodized steel / engineered concrete: near-black
 *                   body, no chrome, no gloss — visibility comes from the
 *                   camera-facing fresnel and the chamfer light lines
 *
 * Opaque and depth-writing on purpose: these masts occlude the particle
 * cables and the flowing roadway behind them, which is the entire
 * "solid anchors in a field of energy" hierarchy.
 *
 * Choreography stays a pure function of the clock: each tower grows out of
 * the ground when the construction front reaches its station and shrinks
 * back during the rewind. No integration, no fired flags.
 */

import * as THREE from "three";
import {
  ASSEMBLY,
  BRIDGE,
  LOOP,
  REWIND_START,
  TOWER_GLOW,
  WORLD,
} from "@/lib/config";
import { centreline } from "../centreline";
import type { TerrainHandle } from "./terrain";

export interface TowerStructuresHandle {
  group: THREE.Group;
  /** Scene clock + loop flag drive growth/shrink. */
  update(t: number, loop: boolean): void;
  dispose(): void;
}

const f = (x: number) => x.toFixed(4);

/**
 * A chamfered-rectangle cross-section: 8 points, CCW, centred on (cx, 0).
 * Faces alternate main / chamfer starting with a chamfer at index 0→1 —
 * `EDGE_FLAGS` below must stay in step with this ordering.
 */
function ring(
  cx: number,
  halfW: number,
  halfD: number,
  y: number,
): number[][] {
  const c = Math.min(halfW, halfD) * 0.32;
  return [
    [cx + halfW - c, y, -halfD],
    [cx + halfW, y, -halfD + c],
    [cx + halfW, y, halfD - c],
    [cx + halfW - c, y, halfD],
    [cx - halfW + c, y, halfD],
    [cx - halfW, y, halfD - c],
    [cx - halfW, y, -halfD + c],
    [cx - halfW + c, y, -halfD],
  ];
}

/** Face i spans ring[i] → ring[i+1]. Chamfer facets carry the light. */
const EDGE_FLAGS = [1, 0, 1, 0, 1, 0, 1, 0];

interface GeoSink {
  positions: number[];
  normals: number[];
  aH: number[];
  aEdge: number[];
}

/**
 * Lofts two 8-point rings into a closed prism segment (8 side quads + top
 * cap), with FLAT per-face normals — the blueprint's surfaces are planes
 * meeting at seams, not a smoothed tube.
 */
function loft(
  sink: GeoSink,
  ringA: number[][],
  ringB: number[][],
  hA: number,
  hB: number,
  edgeScale: number,
  capTop: boolean,
) {
  const va = new THREE.Vector3();
  const vb = new THREE.Vector3();
  const n = new THREE.Vector3();

  for (let i = 0; i < 8; i++) {
    const j = (i + 1) % 8;
    const a0 = ringA[i];
    const a1 = ringA[j];
    const b0 = ringB[i];
    const b1 = ringB[j];

    va.set(a1[0] - a0[0], a1[1] - a0[1], a1[2] - a0[2]);
    vb.set(b0[0] - a0[0], b0[1] - a0[1], b0[2] - a0[2]);
    n.crossVectors(va, vb).normalize();

    const edge = EDGE_FLAGS[i] * edgeScale;
    for (const [v, h] of [
      [a0, hA], [a1, hA], [b1, hB],
      [a0, hA], [b1, hB], [b0, hB],
    ] as const) {
      sink.positions.push(v[0], v[1], v[2]);
      sink.normals.push(n.x, n.y, n.z);
      sink.aH.push(h);
      sink.aEdge.push(edge);
    }
  }

  if (capTop) {
    for (let i = 1; i < 7; i++) {
      for (const v of [ringB[0], ringB[i], ringB[i + 1]]) {
        sink.positions.push(v[0], v[1], v[2]);
        sink.normals.push(0, 1, 0);
        sink.aH.push(hB);
        sink.aEdge.push(edgeScale);
      }
    }
  }
}

function sinkToGeometry(sink: GeoSink): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(sink.positions, 3));
  geo.setAttribute("normal", new THREE.Float32BufferAttribute(sink.normals, 3));
  geo.setAttribute("aH", new THREE.Float32BufferAttribute(sink.aH, 1));
  geo.setAttribute("aEdge", new THREE.Float32BufferAttribute(sink.aEdge, 1));
  return geo;
}

/** Constant-attribute fill for geometries three.js generated for us. */
function tagGeometry(
  geo: THREE.BufferGeometry,
  hFrac: number,
  edge: number,
): THREE.BufferGeometry {
  const count = geo.getAttribute("position").count;
  geo.setAttribute("aH", new THREE.Float32BufferAttribute(new Array(count).fill(hFrac), 1));
  geo.setAttribute("aEdge", new THREE.Float32BufferAttribute(new Array(count).fill(edge), 1));
  return geo;
}

const VERT = /* glsl */ `
attribute float aH;
attribute float aEdge;

varying vec3 vWorld;
varying vec3 vNrm;
varying float vH;
varying float vEdge;

void main(){
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  vNrm = normalize(mat3(modelMatrix) * normal);
  vH = aH;
  vEdge = aEdge;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

const FRAG = /* glsl */ `
precision highp float;

uniform vec3  uBase;
uniform vec3  uGlow;
uniform float uTime;

varying vec3 vWorld;
varying vec3 vNrm;
varying float vH;
varying float vEdge;

void main(){
  vec3 n = normalize(vNrm);
  vec3 viewDir = normalize(cameraPosition - vWorld);
  float dist = distance(cameraPosition, vWorld);

  // MATTE GRAPHITE COMPOSITE (2026-08-04 refinement). A near-black body;
  // the green is never emission — it is the ENVIRONMENT's light caught in
  // reflection. Every green term below is therefore gated by how much the
  // surface faces the sky's glow bank (the same direction the terrain's
  // distant rims use), so a face turned away from the light stays dark no
  // matter how it meets the camera.
  vec3 color = uBase;

  float envFacing = 0.15 + 0.85 *
    max(dot(n, normalize(vec3(0.35, 0.55, -0.5))), 0.0);

  // Camera-grazing sheen: mostly a NEUTRAL cool graphite reflection, with
  // the green environmental component weighted by envFacing and toward
  // the saddle, breathing slowly on the wall clock.
  float fres = pow(1.0 - abs(dot(n, viewDir)), ${f(TOWER_GLOW.rimPower)});
  float vertical = mix(${f(TOWER_GLOW.verticalFloor)}, 1.0, vH * vH);
  float breathe = 0.9 + 0.1 * sin(uTime * 0.7 + vWorld.x * 0.01);
  color += vec3(0.012, 0.016, 0.015) * fres;
  color += uGlow * (fres * envFacing * vertical * breathe * 0.5);

  // THE CHAMFER LINES — light caught on bevels, joints and anchor plates.
  // Gated by envFacing too: a reflected accent, never paint.
  float facing = clamp(dot(n, viewDir), 0.0, 1.0);
  color += uGlow * (vEdge * envFacing * vertical
                    * (0.05 + 0.3 * facing) * breathe);

  // PANEL SEAMS — segmental construction: thin horizontal joints where
  // the lifts meet, catching a whisper of the environment's green on lit
  // faces. Understated engineering detail, not decoration.
  float band = fract(vH * 13.0);
  float seam = smoothstep(0.0, 0.018, band) * (1.0 - smoothstep(0.028, 0.05, band));
  color += uGlow * (seam * envFacing * facing * 0.09);

  // The terrain's fog law, so the far tower recedes into the same
  // atmosphere as the mountains behind it.
  float fog = clamp((dist - ${f(WORLD.fogNear)}) /
                    ${f(WORLD.fogFar - WORLD.fogNear)}, 0.0, 1.0);
  fog = pow(fog, 1.35);
  color = mix(color, vec3(${f(0x07 / 255)}, ${f(0x0a / 255)}, ${f(0x13 / 255)}), fog);

  gl_FragColor = vec4(color, 1.0);
}
`;

export function createTowerStructures(
  terrain: TerrainHandle,
): TowerStructuresHandle {
  const group = new THREE.Group();
  const geometries: THREE.BufferGeometry[] = [];

  const material = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: {
      uBase: { value: new THREE.Color(TOWER_GLOW.base) },
      uGlow: { value: new THREE.Vector3(...TOWER_GLOW.glow) },
      uTime: { value: 0 },
    },
    transparent: false,
    depthTest: true,
    depthWrite: true,
  });

  interface TowerRig {
    pivot: THREE.Group;
    u: number;
  }
  const rigs: TowerRig[] = [];

  const addMesh = (pivot: THREE.Group, geo: THREE.BufferGeometry) => {
    geometries.push(geo);
    pivot.add(new THREE.Mesh(geo, material));
  };

  for (const tower of [BRIDGE.towers.main, BRIDGE.towers.far]) {
    const base = centreline.positionAt(tower.u, new THREE.Vector3());
    const fr = centreline.frameAt(tower.u);
    const tangent = centreline.tangentAt(tower.u, new THREE.Vector3());

    // Local axes: X across the portal (binormal), Z along the span.
    const basis = new THREE.Matrix4().makeBasis(
      fr.binormal.clone(),
      new THREE.Vector3(0, 1, 0),
      tangent.clone().projectOnPlane(new THREE.Vector3(0, 1, 0)).normalize(),
    );
    const quat = new THREE.Quaternion().setFromRotationMatrix(basis);

    const saddleY = tower.baseY + tower.height;
    const [baseW, baseD] = tower.legBase;
    const [topW, topD] = tower.legTop;

    const legCentres = [-tower.legSpacing / 2, tower.legSpacing / 2];
    const topCentres = [-tower.topPortal / 2, tower.topPortal / 2];

    const groundYs = legCentres.map((off) => {
      const p = base.clone().addScaledVector(fr.binormal, off);
      return terrain.heightAt(p.x, p.z);
    });
    const pivotY = Math.min(...groundYs) - 1;

    const pivot = new THREE.Group();
    pivot.position.set(base.x, pivotY, base.z);
    pivot.quaternion.copy(quat);

    // Everything below is in the pivot's local space: y = 0 at pivotY.
    const yTop = saddleY - pivotY;
    const deckLevel = centreline.deckY(tower.u) - pivotY;

    legCentres.forEach((cx, i) => {
      const cxTop = topCentres[i];
      const sink: GeoSink = { positions: [], normals: [], aH: [], aEdge: [] };

      // --- foundation pedestal: widened, buried, heavy -------------------
      // From 8u below the terrain to a shoulder above it — "the tower
      // grows out of the landscape, most of it exists underground".
      loft(
        sink,
        ring(cx, baseW * 1.8, baseD * 1.55, -8),
        ring(cx, baseW * 1.18, baseD * 1.12, 11),
        0, 0.04,
        0.35,
        true,
      );

      // --- the leg: one lofted taper, base ring → saddle ring ------------
      // Width tapers subtly, depth halves, and the centre LEANS inward so
      // the top lands on the cable line. Split into two segments so the
      // profile can ease rather than cone linearly.
      const midH = yTop * 0.55;
      const midW = THREE.MathUtils.lerp(baseW, topW, 0.5);
      const midD = THREE.MathUtils.lerp(baseD, topD, 0.62);
      const cxMid = THREE.MathUtils.lerp(cx, cxTop, 0.5);
      loft(
        sink,
        ring(cx, baseW, baseD, 6),
        ring(cxMid, midW, midD, midH),
        0.05, 0.55,
        1,
        false,
      );
      loft(
        sink,
        ring(cxMid, midW, midD, midH),
        ring(cxTop, topW, topD, yTop),
        0.55, 0.96,
        1,
        false,
      );

      // --- the cable saddle cap: slightly proud, the brightest piece ----
      loft(
        sink,
        ring(cxTop, topW * 1.22, topD * 1.12, yTop),
        ring(cxTop, topW * 1.08, topD * 0.95, yTop + 4.2),
        1, 1,
        1,
        true,
      );

      // --- cable anchor housings (2026-08-04 refinement) ----------------
      // The suspension arrives along the span axis at exactly this point
      // (leg centres converge to the cable line), so each saddle carries a
      // reinforced entry housing on both span faces — the mechanical
      // "where the cable locks into the tower" the sheet's close-up shows.
      for (let s = -1; s <= 1; s += 2) {
        loft(
          sink,
          ring(cxTop, topW * 0.72, 1.6, yTop + 0.4),
          ring(cxTop, topW * 0.58, 1.1, yTop + 3.2),
          1, 1,
          0.9,
          true,
        );
        // Push the housing out along the span face.
        const start = sink.positions.length - 8 * 6 * 3 - 6 * 6 * 3;
        for (let pi = start; pi < sink.positions.length; pi += 3) {
          sink.positions[pi + 2] += s * (topD * 1.02);
        }
      }

      addMesh(pivot, sinkToGeometry(sink));
    });

    // --- the structural crossbeam: arched underside, embedded ends -------
    {
      const hFrac = (tower.beamY - tower.baseY) / tower.height;
      const beamH = tower.height * 0.062;
      const yBeam = tower.beamY - pivotY;
      const k = (yBeam - 6) / (yTop - 6);
      const cxAt =
        THREE.MathUtils.lerp(tower.legSpacing / 2, tower.topPortal / 2, k);
      const wAt = THREE.MathUtils.lerp(baseW, topW, k);
      const halfSpan = cxAt + wAt * 0.4;

      const shape = new THREE.Shape();
      shape.moveTo(-halfSpan, 0);
      shape.lineTo(-halfSpan, beamH);
      shape.lineTo(halfSpan, beamH);
      shape.lineTo(halfSpan, 0);
      // The arched underside from the detail close-up.
      shape.quadraticCurveTo(0, beamH * 1.1, -halfSpan, 0);

      const depth = THREE.MathUtils.lerp(baseD, topD, k) * 0.9;
      const geo = new THREE.ExtrudeGeometry(shape, {
        depth,
        bevelEnabled: false,
      });
      geo.translate(0, yBeam - beamH / 2, -depth / 2);
      // Low edge tag: a dark structural member with a whisper of seam
      // light, never a lit panel — the first render made it a billboard.
      tagGeometry(geo, THREE.MathUtils.clamp(hFrac, 0, 1), 0.05);
      addMesh(pivot, geo);
    }

    // --- the deck connection: a slab-level tie through both legs ---------
    {
      const geo = new THREE.BoxGeometry(
        tower.legSpacing + baseW * 1.6,
        4,
        baseD * 1.5,
      );
      geo.translate(0, deckLevel - 3, 0);
      tagGeometry(geo, Math.max((deckLevel - 6) / yTop, 0), 0.05);
      addMesh(pivot, geo);
    }

    group.add(pivot);
    rigs.push({ pivot, u: tower.u });
  }

  return {
    group,

    update(t, loop) {
      material.uniforms.uTime.value = t;

      for (const rig of rigs) {
        const seatAt =
          ASSEMBLY.windowStart +
          rig.u * ASSEMBLY.windowSpan +
          ASSEMBLY.layerOffset.towers;
        let s = THREE.MathUtils.smoothstep(t, seatAt, seatAt + 1.4);
        if (loop) {
          const rewindAt =
            REWIND_START +
            (1 - rig.u) * LOOP.rewind.spatialSpan +
            LOOP.rewind.layerOffset.towers;
          s *= 1 - THREE.MathUtils.smoothstep(t, rewindAt, rewindAt + 1.1);
        }
        rig.pivot.scale.y = Math.max(s, 1e-4);
        rig.pivot.visible = s > 1e-3;
      }
    },

    dispose() {
      for (const geo of geometries) geo.dispose();
      material.dispose();
    },
  };
}
