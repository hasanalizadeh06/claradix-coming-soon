/**
 * THE FILAMENTS — the bridge's actual material (client, 2026-08-03 pass 2).
 *
 * "Particles are NOT the material. The material is light itself."
 *
 * The particle system draws the bridge's micro-detail and carries the whole
 * construction choreography — but points can never be CONTINUOUS, and the
 * pass-2 direction is explicit: the roadway must read as unbroken parallel
 * energy lines that never break, never jitter, never appear noisy. So the
 * structure gains a second, complementary body: GL line primitives — true
 * one-pixel filaments — baked once from the same centreline, cable maths and
 * tower dimensions the targets use, with every dynamic behaviour (existence
 * behind the construction front, energy flow, the completion pulse, the
 * rewind) computed in-shader as a pure function of the scene clock.
 *
 * Layering of duties:
 *   filaments — the continuous material: roadway weave, main cables, tower
 *               cores, hanger hairlines, railing edges
 *   particles — microscopic stars living IN that material, plus the entire
 *               build/rewind flight choreography
 *   streams   — the discrete packets travelling the road
 *
 * Nothing here moves geometrically, ever. The geometry is structure; only
 * LIGHT travels through it — slow pulse trains flowing away from the camera
 * (the round-5 direction), up the towers, along the drapes. That is the
 * "electricity through optical fibers" the client describes, delivered
 * without a single vertex changing position.
 *
 * Like the sky, the fine constants here are designed values, not tunables —
 * the shape of a material, authored in one place.
 */

import * as THREE from "three";
import {
  ASSEMBLY,
  BRIDGE,
  LOOP,
  PARTICLE_COLOR_RAMP,
  REWIND_START,
  WORLD,
} from "@/lib/config";
import { makeRng } from "@/lib/rng";
import { centreline } from "../centreline";
import { sideCableY } from "../bridgeTargets";
import type { TerrainHandle } from "./terrain";

export interface BridgeFibersHandle {
  lines: THREE.LineSegments;
  update(t: number): void;
  setPulseU(u: number): void;
  setLoop(on: boolean): void;
  dispose(): void;
}

/** Roadway weave: this many continuous lanes across the ribbon — the shared
 *  lattice the particle dust rows snap onto (config.BRIDGE.fiberLanes). */
const DECK_LANES = BRIDGE.fiberLanes;
/** Deck/railing polyline resolution — ~5.5u steps keep the S-curve smooth. */
const DECK_SEGMENTS = 320;
const CABLE_SEGMENTS = 200;

const f = (x: number) => x.toFixed(4);

function buildRamp(): THREE.DataTexture {
  const N = 256;
  const data = new Uint8Array(N * 4);
  const stops = PARTICLE_COLOR_RAMP.map(([t, hex]) => ({
    t: t as number,
    c: new THREE.Color(hex as string),
  }));
  const tmp = new THREE.Color();
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1);
    let a = stops[0];
    let b = stops[stops.length - 1];
    for (let s = 0; s < stops.length - 1; s++) {
      if (t >= stops[s].t && t <= stops[s + 1].t) {
        a = stops[s];
        b = stops[s + 1];
        break;
      }
    }
    tmp.copy(a.c).lerp(b.c, b.t > a.t ? (t - a.t) / (b.t - a.t) : 0);
    data[i * 4] = Math.round(tmp.r * 255);
    data[i * 4 + 1] = Math.round(tmp.g * 255);
    data[i * 4 + 2] = Math.round(tmp.b * 255);
    data[i * 4 + 3] = 255;
  }
  const tex = new THREE.DataTexture(data, N, 1, THREE.RGBAFormat);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

export function createBridgeFibers(terrain: TerrainHandle): BridgeFibersHandle {
  const rng = makeRng(0x0f1b_e125);

  // Growable CPU-side buffers; one LineSegments draw call at the end.
  const positions: number[] = [];
  const aU: number[] = [];
  const aFlow: number[] = [];
  const aWeight: number[] = [];
  const aPhase: number[] = [];
  const aSeat0: number[] = [];
  const aRew0: number[] = [];

  interface Sample {
    x: number;
    y: number;
    z: number;
    u: number;
    flow: number;
  }

  /**
   * A polyline becomes LineSegments pairs. Existence (aSeat0/aRew0) and
   * brightness weight are constant per polyline; u and flow vary per vertex
   * so the construction front and the energy flow both slide along it.
   */
  const addPolyline = (
    samples: Sample[],
    weight: number,
    seatOffset: number,
    rewOffset: number,
  ) => {
    const phase = rng.next() * Math.PI * 2;
    for (let i = 0; i < samples.length - 1; i++) {
      for (const s of [samples[i], samples[i + 1]]) {
        positions.push(s.x, s.y, s.z);
        aU.push(s.u);
        aFlow.push(s.flow);
        aWeight.push(weight);
        aPhase.push(phase);
        aSeat0.push(seatOffset);
        aRew0.push(rewOffset);
      }
    }
  };

  const _p = new THREE.Vector3();

  // --- the roadway weave ---------------------------------------------------
  //
  // DECK_LANES perfectly parallel lanes, cosine-weighted so the central
  // energy path burns brightest and the ribbon dies into darkness at its
  // edges. The flow coordinate is u scaled to ten pulse cycles: pulses sit
  // ~180u apart and drift away from the camera slower than the traffic —
  // the material breathes under the packets that ride it.
  {
    const half = BRIDGE.deckWidth / 2;
    const fiberHalf = half - 2;
    for (let l = 0; l < DECK_LANES; l++) {
      const offset = (l / (DECK_LANES - 1)) * 2 - 1;
      const across = offset * fiberHalf;
      const k = 1 - (across / half) ** 2;
      const weight = 0.28 + 0.5 * Math.cos((offset * Math.PI) / 2) ** 1.4;

      const samples: Sample[] = [];
      for (let i = 0; i <= DECK_SEGMENTS; i++) {
        const u = i / DECK_SEGMENTS;
        centreline.positionAt(u, _p);
        const fr = centreline.frameAt(u);
        _p.addScaledVector(fr.binormal, across).addScaledVector(
          fr.normal,
          BRIDGE.deckCamber * k + 0.12,
        );
        samples.push({ x: _p.x, y: _p.y, z: _p.z, u, flow: u * 10 });
      }
      addPolyline(
        samples,
        weight,
        ASSEMBLY.layerOffset.deck,
        LOOP.rewind.layerOffset.deck,
      );
    }
  }

  // --- railing: the ribbon's own crisp edges -------------------------------
  {
    const lateral = BRIDGE.deckWidth / 2 - 0.5;
    for (let side = -1; side <= 1; side += 2) {
      const samples: Sample[] = [];
      for (let i = 0; i <= DECK_SEGMENTS; i++) {
        const u = i / DECK_SEGMENTS;
        centreline.positionAt(u, _p);
        const fr = centreline.frameAt(u);
        _p.addScaledVector(fr.binormal, side * lateral).addScaledVector(
          fr.normal,
          BRIDGE.deckCamber + 0.7,
        );
        samples.push({ x: _p.x, y: _p.y, z: _p.z, u, flow: u * 10 });
      }
      addPolyline(
        samples,
        0.55,
        ASSEMBLY.layerOffset.railing,
        LOOP.rewind.layerOffset.railing,
      );
    }
  }

  // --- main cables: the signature drapes -----------------------------------
  //
  // Main-span parabola plus both descending side spans, one continuous
  // filament per side. The flow coordinate follows the cable's own run so
  // pulses pour over the saddles and down the drape.
  {
    const { main, far } = BRIDGE.towers;
    const side = BRIDGE.mainCable.sideSpan;
    const u0 = main.u - side.main.anchorU;
    const u1 = far.u + side.far.anchorU;
    const lat = BRIDGE.mainCable.lateralOffset;

    for (let s = -1; s <= 1; s += 2) {
      const samples: Sample[] = [];
      for (let i = 0; i <= CABLE_SEGMENTS; i++) {
        const u = THREE.MathUtils.lerp(u0, u1, i / CABLE_SEGMENTS);
        const y =
          u >= main.u && u <= far.u ? centreline.cableRise(u) : sideCableY(u);
        if (y === null) continue;
        centreline.positionAt(u, _p);
        const fr = centreline.frameAt(u);
        _p.addScaledVector(fr.binormal, s * lat);
        samples.push({
          x: _p.x,
          y,
          z: _p.z,
          u,
          flow: ((u - u0) / (u1 - u0)) * 8,
        });
      }
      addPolyline(
        samples,
        0.68,
        ASSEMBLY.layerOffset.mainCables,
        LOOP.rewind.layerOffset.mainCables,
      );
    }
  }

  // --- tower cores: pillars of light ---------------------------------------
  //
  // One filament per leg, running from the ground (the pylon plunge) past
  // the saddle, plus the cross-braces. Flow climbs: light travels UP the
  // towers, exactly as the pass-2 brief describes.
  {
    for (const tower of [BRIDGE.towers.main, BRIDGE.towers.far]) {
      const base = centreline.positionAt(tower.u, new THREE.Vector3());
      const fr = centreline.frameAt(tower.u);
      const ground = terrain.heightAt(base.x, base.z);
      const top = base.y + tower.height * 1.045;

      for (let s = -1; s <= 1; s += 2) {
        const samples: Sample[] = [];
        const N = 48;
        for (let i = 0; i <= N; i++) {
          const h = i / N;
          const y = THREE.MathUtils.lerp(Math.min(ground + 1, base.y), top, h);
          _p.copy(base).addScaledVector(fr.binormal, (s * tower.legSpacing) / 2);
          samples.push({ x: _p.x, y, z: _p.z, u: tower.u, flow: h * 3 });
        }
        addPolyline(
          samples,
          0.7,
          ASSEMBLY.layerOffset.towers,
          LOOP.rewind.layerOffset.towers,
        );
      }

      for (const braceY of tower.crossBraceY) {
        const y = tower.baseY + (braceY - tower.baseY);
        const samples: Sample[] = [];
        const N = 12;
        for (let i = 0; i <= N; i++) {
          const across = (i / N - 0.5) * tower.legSpacing;
          _p.copy(base).addScaledVector(fr.binormal, across);
          samples.push({ x: _p.x, y, z: _p.z, u: tower.u, flow: (i / N) * 1.5 });
        }
        addPolyline(
          samples,
          0.38,
          ASSEMBLY.layerOffset.towers,
          LOOP.rewind.layerOffset.towers,
        );
      }
    }
  }

  // --- hangers: hundreds of perfectly aligned hairlines --------------------
  //
  // Each one a single straight segment from deck to cable — by construction
  // they can never jitter. Deliberately the dimmest element: they "almost
  // disappear into the darkness while remaining visible through subtle
  // green illumination".
  {
    const { main, far } = BRIDGE.towers;
    const side = BRIDGE.mainCable.sideSpan;
    const lat = BRIDGE.mainCable.lateralOffset;
    const segments = [
      { u0: main.u, u1: far.u, main: true },
      { u0: main.u - side.main.anchorU, u1: main.u, main: false },
      { u0: far.u, u1: far.u + side.far.anchorU, main: false },
    ];

    for (const seg of segments) {
      const span = Math.abs(seg.u1 - seg.u0) * centreline.arcLength;
      const count = Math.max(1, Math.floor(span / BRIDGE.hangers.spacing));
      for (let h = 0; h < count; h++) {
        const u = THREE.MathUtils.lerp(seg.u0, seg.u1, (h + 0.5) / count);
        const cableY = seg.main ? centreline.cableRise(u) : sideCableY(u);
        if (cableY === null) continue;
        centreline.positionAt(u, _p);
        const deckY = _p.y + BRIDGE.deckCamber;
        if (cableY - deckY < BRIDGE.hangers.minLength) continue;
        const fr = centreline.frameAt(u);
        for (let s = -1; s <= 1; s += 2) {
          const x = _p.x + fr.binormal.x * s * lat;
          const z = _p.z + fr.binormal.z * s * lat;
          addPolyline(
            [
              { x, y: deckY, z, u, flow: u * 10 },
              { x, y: cableY, z, u, flow: u * 10 + 0.4 },
            ],
            0.24,
            ASSEMBLY.layerOffset.hangers,
            LOOP.rewind.layerOffset.hangers,
          );
        }
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3),
  );
  const set = (name: string, arr: number[]) =>
    geometry.setAttribute(name, new THREE.Float32BufferAttribute(arr, 1));
  set("aU", aU);
  set("aFlow", aFlow);
  set("aWeight", aWeight);
  set("aPhase", aPhase);
  set("aSeat0", aSeat0);
  set("aRew0", aRew0);
  geometry.boundingSphere = new THREE.Sphere(
    new THREE.Vector3(400, 80, 100),
    1900,
  );

  const material = new THREE.ShaderMaterial({
    vertexShader: /* glsl */ `
precision highp float;

attribute float aU;
attribute float aFlow;
attribute float aWeight;
attribute float aPhase;
attribute float aSeat0;
attribute float aRew0;

uniform float uTime;
uniform float uLoop;
uniform float uPulseU;

varying float vBrightness;
varying float vFog;

const float TAU = 6.28318530718;

void main(){
  float t = uTime;

  // --- existence: the construction front (round 5: near to far) ----------
  float seatAt = ${f(ASSEMBLY.windowStart)} + aU * ${f(ASSEMBLY.windowSpan)} + aSeat0;
  float born = smoothstep(seatAt + 0.25, seatAt + 1.3, t);

  // --- the rewind: sections dim out as the black hole takes them ---------
  if (uLoop > 0.5) {
    float rewindAt = ${f(REWIND_START)} + (1.0 - aU) * ${f(LOOP.rewind.spatialSpan)} + aRew0;
    born *= 1.0 - smoothstep(rewindAt, rewindAt + 0.55, t);
  }

  // --- the material's light ----------------------------------------------
  //
  // A dim constant body — light leaking through the structure from inside —
  // plus slow pulse trains flowing along the filament, plus a barely-there
  // shimmer so no frame is ever static. All authored WELL below the point
  // where the additive sum across lanes could bloom on its own; only the
  // pulse crests and the completion pulse reach for the threshold.
  float body = 0.62 + 0.1 * sin(t * 0.53 + aPhase + aFlow * 2.1);
  float pulse = pow(0.5 + 0.5 * sin(TAU * (aFlow - t * 0.22) + aPhase), 4.0);
  float brightness = aWeight * (body + 0.55 * pulse);

  // The completion pulse rides the MATERIAL as well as the particles — one
  // white band leaving the viewer toward the mountains.
  if (uPulseU >= 0.0) {
    float d = abs(aU - uPulseU) * ${f(centreline.arcLength)};
    brightness = mix(brightness, 1.0, 1.0 - smoothstep(0.0, 190.0, d));
  }

  brightness *= born;

  vec4 viewPos = viewMatrix * vec4(position, 1.0);
  float viewDist = -viewPos.z;

  // Same three depth laws as every luminous element: near fade (the road
  // passes underfoot), mid attenuation (the ramp column stacks additively),
  // additive fog (attenuate toward zero, never toward a colour).
  // Re-ranged for the camera-correction round: the eye stands just over
  // the road's start, and the old windows blacked out the foreground fan
  // the directive wants as leading lines.
  brightness *= smoothstep(20.0, 90.0, viewDist);
  brightness *= mix(0.65, 1.0, smoothstep(200.0, 700.0, viewDist));

  vBrightness = clamp(brightness, 0.0, 1.0);
  vFog = clamp((viewDist - ${f(WORLD.fogNear)}) /
               ${f(WORLD.fogFar - WORLD.fogNear)}, 0.0, 1.0);

  gl_Position = projectionMatrix * viewPos;
}
`,
    fragmentShader: /* glsl */ `
precision highp float;

uniform sampler2D uRamp;

varying float vBrightness;
varying float vFog;

void main(){
  vec3 color = texture2D(uRamp, vec2(vBrightness, 0.5)).rgb;
  color *= (1.0 - vFog);
  gl_FragColor = vec4(color * vBrightness, 1.0);
}
`,
    uniforms: {
      uRamp: { value: buildRamp() },
      uTime: { value: 0 },
      uLoop: { value: 0 },
      uPulseU: { value: -1 },
    },
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthTest: true,
    depthWrite: false,
  });

  const lines = new THREE.LineSegments(geometry, material);
  lines.frustumCulled = false;
  // With the streams (4), before the particles (5) — the micro-stars draw
  // over their own material.
  lines.renderOrder = 4;
  // NOT on the trail layer: filaments are structure, and structure does not
  // smear.

  return {
    lines,
    update(t) {
      material.uniforms.uTime.value = t;
    },
    setPulseU(u) {
      material.uniforms.uPulseU.value = u;
    },
    setLoop(on) {
      material.uniforms.uLoop.value = on ? 1 : 0;
    },
    dispose() {
      geometry.dispose();
      (material.uniforms.uRamp.value as THREE.DataTexture).dispose();
      material.dispose();
    },
  };
}
