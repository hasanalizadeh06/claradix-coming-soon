/**
 * DECK TRAFFIC — the data crossing the bridge.
 *
 * Client direction (2026-08-01): the flowing particles ARE information, and
 * information rides the bridge. So the currents are not free curves over the
 * valley any more — every lane follows THE CENTRELINE ITSELF, from the road
 * behind the viewer, up the ramp, across the spans, into the far mountains.
 * Four clean lanes, one shared origin and destination.
 *
 * AND THE BRIDGE IS WHAT HOLDS THEM UP. Traffic only flows where deck exists:
 * it fades in behind the construction front, runs full through the stillness,
 * and in Act IV — as the black hole drinks the deck section by section — the
 * packets that were riding a dissolved section FALL, straight down from where
 * the roadway used to be, and land on the ground directly beneath it, where
 * they gutter out. The seam stays invisible: everything fallen has faded
 * before the wrap, which matches the pre-build state at T+0.
 *
 * TWO CLOCKS: lane progress runs on the UNWRAPPED elapsed clock (an endless
 * current with no cycle of its own); existence, the fall and the fade follow
 * the WRAPPED act clock, matching the bridge's own schedule exactly.
 */

import * as THREE from "three";
import {
  ASSEMBLY,
  BRIDGE,
  CYCLE_LENGTH,
  LOOP,
  PARTICLE_COLOR_RAMP,
  REWIND_START,
  WORLD,
  type Tier,
} from "@/lib/config";
import { makeRng } from "@/lib/rng";
import { CENTRELINE_GLSL, centreline } from "../centreline";
import type { TerrainHandle } from "./terrain";
import { TRAIL_LAYER } from "./particles";

export interface GroundStreamsHandle {
  points: THREE.Points;
  /** `intensity` follows the wrapped act clock; `elapsed` never wraps;
   *  `sceneT` is the wrapped clock the existence gates read. */
  update(intensity: number, elapsed: number, sceneT: number): void;
  setPointScale(v: number): void;
  /** Loop mode governs the falls and the pre-wrap fade — with the loop off
   *  the bridge stands forever and so does its traffic. */
  setLoop(on: boolean): void;
  dispose(): void;
}

/** ×2.5 (architecture redesign), then ×1.6 again (2026-08-04 refinement:
 *  "a massive flowing particle field instead of a single strip") — these
 *  packets ARE the road, and the near fan is now ~2.6× wider, so the
 *  density has to keep up or the landscape reads as dust. */
const COUNT_BY_TIER: Record<Tier, number> = {
  ultra: 24000,
  high: 17500,
  medium: 12500,
  low: 7000,
  minimal: 3200,
};

/**
 * THE ROADWAY THAT DOES NOT EXIST (2026-08-04). No lanes — "the viewer
 * should never perceive organized lanes, only a living stream of light."
 * Each packet draws a continuous base offset from a TRIANGULAR distribution
 * (densest on the invisible spline, thinning toward the edges) and then
 * wanders slowly across the ribbon in the shader: thousands of overlapping
 * trajectories at different speeds, offsets, brightnesses and depths.
 */
const RIVER_HALF = 33;

const GROUND_SAMPLES = 256;

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

/** Ground height directly under the centreline, sampled by u — the floor a
 *  fallen packet lands on, baked so the shader needs one fetch. */
function buildGroundTexture(terrain: TerrainHandle): THREE.DataTexture {
  const data = new Float32Array(GROUND_SAMPLES * 4);
  const p = new THREE.Vector3();
  for (let i = 0; i < GROUND_SAMPLES; i++) {
    const u = i / (GROUND_SAMPLES - 1);
    centreline.positionAt(u, p);
    data[i * 4] = terrain.heightAt(p.x, p.z);
  }
  const tex = new THREE.DataTexture(
    data,
    GROUND_SAMPLES,
    1,
    THREE.RGBAFormat,
    THREE.FloatType,
  );
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return tex;
}

const f = (x: number) => x.toFixed(4);

export function createGroundStreams(
  terrain: TerrainHandle,
  tier: Tier,
): GroundStreamsHandle {
  const rng = makeRng(0x57e4_a201);
  const n = COUNT_BY_TIER[tier];

  const position = new Float32Array(n * 3);
  const aS0 = new Float32Array(n);
  const aSpeed = new Float32Array(n);
  const aLane = new Float32Array(n);
  const aHash = new Float32Array(n);

  for (let i = 0; i < n; i++) {
    aS0[i] = rng.next();
    // u per second, WIDE range (2026-08-04: "some move slightly faster,
    // some slower") — a full crossing takes 9–28s.
    aSpeed[i] = rng.range(0.035, 0.11);
    // Sum of two uniforms = triangular PDF: peak density on the invisible
    // spline, linear falloff to the edges. No lane exists to be counted.
    aLane[i] = (rng.next() + rng.next() - 1) * RIVER_HALF;
    aHash[i] = rng.next();
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(position, 3));
  geometry.setAttribute("aS0", new THREE.BufferAttribute(aS0, 1));
  geometry.setAttribute("aSpeed", new THREE.BufferAttribute(aSpeed, 1));
  geometry.setAttribute("aLane", new THREE.BufferAttribute(aLane, 1));
  geometry.setAttribute("aHash", new THREE.BufferAttribute(aHash, 1));
  geometry.boundingSphere = new THREE.Sphere(
    new THREE.Vector3(400, 60, 100),
    1900,
  );

  const material = new THREE.ShaderMaterial({
    vertexShader: /* glsl */ `
precision highp float;

${CENTRELINE_GLSL}

attribute float aS0;
attribute float aSpeed;
attribute float aLane;
attribute float aHash;

uniform sampler2D uGroundTex;
uniform float uElapsed;
uniform float uSceneT;
uniform float uIntensity;
uniform float uPointScale;
uniform float uLoop;

varying float vBrightness;
varying float vFog;

const float TAU = 6.28318530718;
const float GROUND_N = ${GROUND_SAMPLES}.0;

float groundYAt(float u){
  float x = clamp(u, 0.0, 1.0) * (GROUND_N - 1.0) / GROUND_N + 0.5 / GROUND_N;
  return texture2D(uGroundTex, vec2(x, 0.5)).x;
}

void main(){
  // Lane progress: the endless current, unwrapped clock.
  float u = fract(aS0 + uElapsed * aSpeed);
  float t = uSceneT;

  // The packet's place on the invisible spline. No lane holds it: a slow
  // lateral wander carries it across the ribbon, so neighbouring
  // trajectories continuously merge, separate and reconnect — the roadway
  // is woven fresh every frame by the flow itself.
  vec3 deckP = centrelinePos(u);
  vec3 bin = centrelineBin(u);

  // THE WIDTH FIELD (2026-08-04 refinement): the roadway is a LANDSCAPE,
  // not a strip. Underfoot it fans to ~2.6× the span width — monumental,
  // physically large enough to stand on — and funnels down to the portal
  // width by the main tower. The far half stays narrow only because
  // perspective makes it so.
  float widthK = mix(2.6, 1.0, smoothstep(0.05, 0.45, u));

  // Two wander octaves: a slow drift that merges and splits the streams,
  // and a faster micro-turbulence that keeps the surface from ever
  // reading flat or procedural.
  float wA = 2.5 + 7.0 * fract(aHash * 5.31);
  float wW = 0.05 + 0.1 * fract(aHash * 11.7);
  float across = aLane * widthK
               + wA * sin(uElapsed * TAU * wW + aHash * TAU)
               + (0.6 + 1.1 * fract(aHash * 3.7))
                 * sin(uElapsed * TAU * (0.21 + 0.2 * fract(aHash * 9.1)) + aHash * 41.0);
  vec3 pos = deckP + bin * across;

  // DEPTH — stacked layers, not a sheet: packets ride up to ~2u above and
  // below the mean surface, and each oscillates vertically at its own
  // amplitude and rate. Volume without a surface ever existing.
  float depth = (fract(aHash * 7.91) - 0.5) * 4.2;
  float rideY = deckP.y + ${f(BRIDGE.deckCamber)} + 0.9 + depth;

  // --- existence: the deck's own schedule ------------------------------
  // Traffic appears only once the deck at this u has been laid...
  float seatAt = ${f(ASSEMBLY.windowStart + ASSEMBLY.layerOffset.deck)}
               + u * ${f(ASSEMBLY.windowSpan)};
  float born = smoothstep(seatAt + 0.4, seatAt + 1.8, t);

  // ...and FALLS the moment the black hole takes that section. The front
  // sweeps u DESCENDING (round 5: opposite to the build, which now travels
  // away from the camera); one fixed-point pass freezes the packet's u at
  // the instant the front crossed it (error term (speed x span)^2 — dust).
  float rewindBase = ${f(REWIND_START + LOOP.rewind.layerOffset.deck)};
  float span = ${f(LOOP.rewind.spatialSpan)};
  float uF = fract(aS0 + aSpeed * (uElapsed + (rewindBase + (1.0 - u) * span) - t));
  float fallAt = rewindBase + (1.0 - uF) * span;

  float brightness = 0.72 + 0.28 * sin(uElapsed * TAU * (0.16 + aHash * 0.22) + aHash * TAU);

  if (uLoop > 0.5 && t >= fallAt) {
    // THE FALL. The bridge that held this packet is gone: it drops from the
    // roadway straight down onto the ground directly beneath — exactly where
    // the bridge stood — and gutters out in the dark.
    float uZ = fract(aS0 + aSpeed * (uElapsed + fallAt - t));
    vec3 deckF = centrelinePos(uZ);
    // The wander freezes at the instant the roadway vanished beneath it.
    float eF = uElapsed - (t - fallAt);
    float acrossF = aLane * widthK + wA * sin(eF * TAU * wW + aHash * TAU);
    pos = deckF + centrelineBin(uZ) * acrossF;

    float deckH = deckF.y + ${f(BRIDGE.deckCamber)} + 0.9;
    float floorY = groundYAt(uZ) + 1.3;

    float tf = max(t - fallAt, 0.0);
    float drop = 0.5 * 90.0 * tf * tf;
    float yNow = max(deckH - drop, floorY);
    pos.y = yNow;

    // Time it hit the ground, and how long it has lain there.
    float tLand = sqrt(max(2.0 * (deckH - floorY) / 90.0, 0.0001));
    float lying = max(tf - tLand, 0.0);

    // A wink at impact, then the light drains into the soil.
    float impact = exp(-8.0 * abs(tf - tLand)) * 0.5;
    brightness = (brightness * 0.85 + impact) * (1.0 - smoothstep(0.0, 1.6, lying));
  } else {
    pos.y = rideY;
    // Per-packet vertical oscillation, amplitude and rate individual —
    // every particle independently alive inside the same global flow.
    pos.y += sin(uElapsed * TAU * 0.5 * (0.7 + aHash) + aHash * TAU)
           * (0.35 + 0.75 * fract(aHash * 6.3));
  }

  // Existence gates: not yet built, and — loop mode only — the pre-wrap
  // settle (everything must be dark before the wrap so the seam is
  // invisible). With the loop off the traffic simply keeps flowing.
  brightness *= born;
  if (uLoop > 0.5) {
    brightness *= 1.0 - smoothstep(${f(CYCLE_LENGTH - 1.9)}, ${f(CYCLE_LENGTH - 0.7)}, t);
  }
  brightness *= uIntensity;

  // THE DENSITY ARC (2026-08-04, brief points 4 and 7). The bridge is born
  // sparse at the viewer, gathers strength as the flow approaches the
  // towers — where the concentration peaks — and then, past the far tower,
  // thins and dims until it dissolves into the mountains. No hard endpoint:
  // the roadway must feel like it continues beyond what is visible.
  brightness *= mix(0.6, 1.0, smoothstep(0.06, 0.5, u));
  brightness *= 1.0 - smoothstep(0.74, 0.98, u);

  // THE EDGES DISSOLVE: past 60% of the LOCAL half-width the energy simply
  // thins until it is gone — the landscape's borders are density, never a
  // cut. And a slow spatial CLUMPING field breaks the surface into drifts,
  // pools and small gaps, so nothing ever reads flat or procedural.
  brightness *= 1.0 - smoothstep(0.6, 1.08,
                                 abs(across) / (${f(RIVER_HALF)} * widthK));
  brightness *= 0.72 + 0.38 * sin(u * 61.0 + aHash * TAU)
                            * sin(across * 0.17 + uElapsed * 0.26);

  vec4 viewPos = viewMatrix * vec4(pos, 1.0);
  float viewDist = -viewPos.z;

  // Near fade — the lanes pass directly under the camera now, and packets
  // within arm's reach otherwise flood the frame bottom.
  brightness *= smoothstep(25.0, 110.0, viewDist);

  // Mid attenuation — same curve as the bridge particles: the ramp column
  // additively saturates to yellow without it, and the two systems must
  // agree or the traffic reads brighter than the road it rides.
  brightness *= mix(0.65, 1.0, smoothstep(200.0, 700.0, viewDist));

  vBrightness = clamp(brightness, 0.0, 1.0);
  vFog = clamp((viewDist - ${f(WORLD.fogNear)}) /
               ${f(WORLD.fogFar - WORLD.fogNear)}, 0.0, 1.0);

  gl_Position = projectionMatrix * viewPos;
  gl_PointSize = clamp(
    mix(1.2, 2.6, vBrightness) * uPointScale * (950.0 / max(viewDist, 1.0)),
    0.7, 2.8);
}
`,
    fragmentShader: /* glsl */ `
precision highp float;

uniform sampler2D uRamp;

varying float vBrightness;
varying float vFog;

void main(){
  // Same hard-edged falloff as the bridge particles (round 4) — the moving
  // packets are the light travelling INSIDE the fibers, so they share the
  // fibers' razor edge.
  float d = length(gl_PointCoord - vec2(0.5));
  float alpha = 1.0 - smoothstep(0.32, 0.48, d);
  if (alpha <= 0.001) discard;

  vec3 color = texture2D(uRamp, vec2(vBrightness, 0.5)).rgb;
  color *= (1.0 - vFog);
  gl_FragColor = vec4(color * vBrightness, alpha);
}
`,
    uniforms: {
      uFrameTex: { value: centreline.buildFrameTexture() },
      uGroundTex: { value: buildGroundTexture(terrain) },
      uRamp: { value: buildRamp() },
      uElapsed: { value: 0 },
      uSceneT: { value: 0 },
      uIntensity: { value: 0 },
      uPointScale: { value: 1 },
      uLoop: { value: 0 },
    },
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthTest: true,
    depthWrite: false,
  });

  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  points.renderOrder = 4;
  // Traffic streaks in the trail pass like every other moving light.
  points.layers.enable(TRAIL_LAYER);

  return {
    points,
    update(intensity, elapsed, sceneT) {
      material.uniforms.uIntensity.value = intensity;
      material.uniforms.uElapsed.value = elapsed;
      material.uniforms.uSceneT.value = sceneT;
    },
    setPointScale(v) {
      material.uniforms.uPointScale.value = v;
    },
    setLoop(on) {
      material.uniforms.uLoop.value = on ? 1 : 0;
    },
    dispose() {
      geometry.dispose();
      (material.uniforms.uFrameTex.value as THREE.DataTexture).dispose();
      (material.uniforms.uGroundTex.value as THREE.DataTexture).dispose();
      (material.uniforms.uRamp.value as THREE.DataTexture).dispose();
      material.dispose();
    },
  };
}
