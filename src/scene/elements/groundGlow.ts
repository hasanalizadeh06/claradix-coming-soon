/**
 * GROUND GLOW.
 *
 * The light the finished bridge casts on the valley under it. A projected decal
 * that hugs the terrain — NOT a reflection.
 *
 * The distinction matters. A reflection would need the ground to be wet, and wet
 * ground in a dry mountain valley at night raises a question the scene cannot
 * answer. A patch of lit ground under a bright object raises none: it is simply
 * what happens.
 *
 * IT ARRIVES WITH THE BRIDGE, SECTION BY SECTION
 * ----------------------------------------------
 * Driven by local completion, not by a global fade. The assembly runs far to
 * near, so the glow runs far to near underneath it, and the ground lights up
 * just behind the construction front. A decal that faded in uniformly would say
 * the light came from somewhere else.
 *
 * The schedule is inverted analytically from the same formula that generates
 * every particle's seat time:
 *
 *     seatAt(u) = windowStart + (1 - u) * windowSpan
 *
 * so the shader needs one line and no per-frame work on the CPU. Layer offsets
 * and jitter are ignored on purpose — this is a soft pool of light, and it
 * should not have the deck's exact millisecond structure written into its edge.
 *
 * WHY IT IS NEARLY FREE
 * ---------------------
 * Painted in --moss rather than the brand lime. Partly for the colour rule —
 * moss at the specified 0.26 opacity is 0.049 luminance, under the 0.058
 * near-black edge, so a wide band of it costs almost nothing. Mostly because it
 * is more correct: light bouncing off ground takes the ground's colour, and
 * lime on the ground would read as a second light source rather than as the
 * bridge's own spill.
 */

import * as THREE from "three";
import {
  ASSEMBLY,
  LIGHTING,
  LOOP,
  PALETTE,
  REWIND_START,
  SCENE,
  WORLD,
} from "@/lib/config";
import { centreline } from "../centreline";
import type { TerrainHandle } from "./terrain";

export interface GroundGlowHandle {
  mesh: THREE.Mesh;
  update(sceneTime: number): void;
  /** So the loop can be switched at runtime and actually exercised. */
  setLoop(on: boolean): void;
  dispose(): void;
}

/** Along the span, and across it. Across needs enough to follow undulation. */
const ALONG = 180;
const ACROSS = 24;

const VERTEX = /* glsl */ `
attribute float aU;
attribute float aLat;

varying float vU;
varying float vLat;
varying vec3  vWorld;

void main() {
  vU = aU;
  vLat = aLat;
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

const FRAGMENT = /* glsl */ `
precision highp float;

uniform vec3  uColor;
uniform float uOpacity;
uniform float uTime;
uniform float uWindowStart;
uniform float uWindowSpan;
uniform float uRewindStart;
uniform float uRewindSpan;
uniform float uFogNear;
uniform float uFogFar;

varying float vU;
varying float vLat;
varying vec3  vWorld;

void main() {
  // Local completion, inverted from the seating schedule. 0.9s of ramp so the
  // light arrives just behind the front rather than switching on with it.
  float seatAt = uWindowStart + (1.0 - vU) * uWindowSpan;
  float complete = smoothstep(0.0, 0.9, uTime - seatAt);

  // ...and taken away again by the rewind, following the same front that is
  // removing the bridge above it. Without this the valley stays lit under a
  // bridge that is no longer there, which is the single most obvious way to
  // reveal that the glow was painted on rather than cast.
  //
  // The rewind front runs u ascending, the build ran u descending, so the light
  // arrives from one end and leaves toward the other.
  if (uRewindSpan > 0.0) {
    float rewindAt = uRewindStart + vU * uRewindSpan;
    complete *= 1.0 - smoothstep(0.0, 0.9, uTime - rewindAt);
  }

  if (complete <= 0.001) discard;

  // Squared lateral falloff. A linear one gives the pool a visible border; this
  // has a bright spine under the deck and no edge anywhere.
  float lat = 1.0 - vLat * vLat;
  lat *= lat;

  // The span's own ends fade, so the decal does not stop dead where the
  // centreline data does.
  float ends = smoothstep(0.0, 0.06, vU) * (1.0 - smoothstep(0.94, 1.0, vU));

  float dist = length(cameraPosition - vWorld);
  float far = 1.0 - smoothstep(uFogNear, uFogFar, dist);

  float a = complete * lat * ends * far * uOpacity;
  gl_FragColor = vec4(uColor * a, a);
}
`;

export function createGroundGlow(terrain: TerrainHandle): GroundGlowHandle {
  const cfg = LIGHTING.groundGlow;

  const positions = new Float32Array(ALONG * ACROSS * 3);
  const us = new Float32Array(ALONG * ACROSS);
  const lats = new Float32Array(ALONG * ACROSS);

  const p = new THREE.Vector3();
  const tan = new THREE.Vector3();
  const lateral = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);

  for (let i = 0; i < ALONG; i++) {
    const u = i / (ALONG - 1);
    centreline.positionAt(u, p);
    centreline.tangentAt(u, tan);

    // Horizontal perpendicular. Using the parallel-transport binormal instead
    // would tilt the decal with the deck's roll and lift one side off the
    // ground — the glow lies on the terrain, not on the bridge.
    lateral.crossVectors(tan, up).normalize();

    for (let j = 0; j < ACROSS; j++) {
      const s = (j / (ACROSS - 1)) * 2 - 1;
      const x = p.x + lateral.x * s * cfg.halfWidth;
      const z = p.z + lateral.z * s * cfg.halfWidth;

      const k = (i * ACROSS + j) * 3;
      positions[k] = x;
      // Sampled from the real heightfield and lifted clear of it. Without the
      // offset the decal z-fights the ground it is painted on, which sparkles.
      positions[k + 1] = terrain.heightAt(x, z) + 1.6;
      positions[k + 2] = z;

      us[i * ACROSS + j] = u;
      lats[i * ACROSS + j] = s;
    }
  }

  const indices: number[] = [];
  for (let i = 0; i < ALONG - 1; i++) {
    for (let j = 0; j < ACROSS - 1; j++) {
      const a = i * ACROSS + j;
      const b = a + 1;
      const c = a + ACROSS;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("aU", new THREE.BufferAttribute(us, 1));
  geometry.setAttribute("aLat", new THREE.BufferAttribute(lats, 1));
  geometry.setIndex(indices);

  const material = new THREE.ShaderMaterial({
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    uniforms: {
      uColor: { value: new THREE.Color(PALETTE.moss) },
      uOpacity: { value: cfg.peakOpacity },
      uTime: { value: 0 },
      uWindowStart: { value: ASSEMBLY.windowStart },
      uWindowSpan: { value: ASSEMBLY.windowSpan },
      // Zero span switches the rewind term off entirely, so a non-looping build
      // costs one comparison rather than carrying a schedule it never reaches.
      uRewindStart: { value: REWIND_START },
      uRewindSpan: { value: SCENE.loop ? LOOP.rewind.spatialSpan : 0 },
      uFogNear: { value: WORLD.fogNear },
      uFogFar: { value: WORLD.fogFar },
    },
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthTest: true,
    depthWrite: false,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  mesh.renderOrder = -1;

  return {
    mesh,

    update(sceneTime) {
      // The SCENE clock, not the wall clock. This is choreography — it has to
      // seek with everything else, or the capture harness measures a frame in
      // which the bridge is built and the ground under it is not.
      material.uniforms.uTime.value = sceneTime;
    },

    setLoop(on) {
      material.uniforms.uRewindSpan.value = on ? LOOP.rewind.spatialSpan : 0;
    },

    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}
