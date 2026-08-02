/**
 * THE VALLEY MIST.
 *
 * A single horizontal sheet lying just above the valley floor, thick in the
 * hollows and thin over the rises. It is the element that makes the ground
 * exist.
 *
 * WHY THIS AND NOT MORE LIGHT
 * ---------------------------
 * The requirement is that the design establishes the ground, not the particles.
 * Before this the scene did the opposite: the opening frame's landscape was
 * 140,000 particles seeded across it, and the instant they lifted away to build
 * the bridge the valley went black.
 *
 * Lighting the terrain harder does not fix that. The rim term only fires where
 * a surface turns away from the viewer — silhouette edges — and a valley seen
 * down its own length presents almost none: the floor faces the camera, so
 * `1 - |dot(n, v)|` stays near zero across the whole of it. Raising the rim was
 * measured at 2.7 points of the near-black budget for a change that was not
 * visible in the composite at all.
 *
 * Mist works because it is a thing lying ON the ground rather than a property
 * of the ground's surface. Where it is thick you are looking into a hollow;
 * where it breaks you are looking at a rise. It draws the topography instead of
 * shading it.
 *
 * WHY IT IS FREE
 * --------------
 * Near-black is not black. The colour rule's near-black edge is 0.058 luminance;
 * this contributes about 0.014 on top of terrain sitting around 0.03. The sum is
 * plainly visible on a dark screen and still counted as near-black. The rule
 * constrains the histogram, not the visibility — there is a lot of usable
 * picture underneath it, and this is what it is for.
 *
 * DENSITY IS PER-VERTEX, FROM THE REAL HEIGHTFIELD
 * ------------------------------------------------
 * Every vertex asks the terrain how high the ground is beneath it. It does not
 * re-evaluate the terrain's noise in its own shader — a duplicated heightfield
 * is a heightfield that will eventually disagree with the one it is copying, and
 * mist that pools where there is no hollow is worse than no mist.
 */

import * as THREE from "three";
import { WORLD } from "@/lib/config";
import type { TerrainHandle } from "./terrain";

export interface MistHandle {
  mesh: THREE.Mesh;
  update(time: number): void;
  dispose(): void;
}

const VERTEX = /* glsl */ `
attribute float aDensity;

varying float vDensity;
varying vec2  vPlane;
varying vec3  vWorld;

void main() {
  vDensity = aDensity;
  vPlane = position.xy;

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
uniform float uDriftSpeed;
uniform float uTurbulence;
uniform float uFogNear;
uniform float uFogFar;

varying float vDensity;
varying vec2  vPlane;
varying vec3  vWorld;

float hash21(vec2 p) {
  vec3 q = fract(vec3(p.xyx) * 0.1031);
  q += dot(q, q.yzx + 33.33);
  return fract((q.x + q.y) * q.z);
}

float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash21(i), hash21(i + vec2(1.0, 0.0)), u.x),
    mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

void main() {
  if (vDensity <= 0.001) discard;

  // Two octaves drifting in different directions, so the pattern shears rather
  // than sliding. A sheet that translates rigidly reads as a moving texture; one
  // that shears reads as air.
  vec2 p = vPlane * 0.0042;
  float t = uTime * uDriftSpeed * 0.001;
  float turb = sin(uTime / uTurbulence * 6.2831853) * 0.25;

  float n = vnoise(p + vec2(t, turb * 0.4)) * 0.68
          + vnoise(p * 2.7 - vec2(t * 0.6, t * 0.35)) * 0.32;

  // Grazing-angle thickening. Looking along the sheet you see through more of
  // it than looking down at it, which is the whole reason low mist reads as
  // depth: the far valley is denser than the near ground for free.
  vec3 viewDir = normalize(cameraPosition - vWorld);
  float graze = 1.0 - abs(viewDir.y);
  float thickness = mix(0.35, 1.0, graze * graze);

  // Distance fade, ending BEFORE the sheet's own edge. Without it the plane
  // terminates in a straight line across the valley, and one straight line is
  // all it takes to reveal that the world is a rectangle.
  //
  // Starting much further out than the terrain's fog does, because the mist's
  // rim is already faded per-vertex and this only has to finish the job. Begun
  // at uFogNear it removed half the brightness from everything worth seeing:
  // the valley the mist exists to describe sits mostly between 500 and 1500
  // units out, which is exactly the range that fade was eating.
  float dist = length(cameraPosition - vWorld);
  float far = 1.0 - smoothstep(uFogNear * 2.5, uFogFar, dist);

  float alpha = vDensity * n * thickness * far * uOpacity;

  gl_FragColor = vec4(uColor * alpha, alpha);
}
`;

export function createMist(terrain: TerrainHandle): MistHandle {
  const cfg = WORLD.mist;
  const b = WORLD.bounds;

  const width = b.maxX - b.minX;
  const depth = b.maxZ - b.minZ;
  const seg = cfg.segments;

  const geometry = new THREE.PlaneGeometry(width, depth, seg, seg);

  // Density per vertex, sampled from the terrain that is actually rendering.
  const pos = geometry.attributes.position;
  const density = new Float32Array(pos.count);

  const cx = (b.minX + b.maxX) * 0.5;
  const cz = (b.minZ + b.maxZ) * 0.5;

  for (let i = 0; i < pos.count; i++) {
    // The plane is authored in XY and rotated flat below, so its local y maps to
    // world z — and it does so NEGATED by the -90 degree rotation about X.
    const x = pos.getX(i) + cx;
    const z = -pos.getY(i) + cz;

    const h = terrain.heightAt(x, z);

    // 1 in the hollows, 0 on the ridges. Smoothstep rather than a hard cut, so
    // the mist has a shoreline instead of an outline.
    let d = 1 - THREE.MathUtils.smoothstep(h, cfg.floor, cfg.ceiling);

    // Fade to nothing at the sheet's rim, so its boundary is never an event.
    const ex = 1 - THREE.MathUtils.smoothstep(
      Math.abs(pos.getX(i)) / (width * 0.5), 0.72, 1.0,
    );
    const ez = 1 - THREE.MathUtils.smoothstep(
      Math.abs(pos.getY(i)) / (depth * 0.5), 0.72, 1.0,
    );

    d *= ex * ez;
    density[i] = d;
  }

  geometry.setAttribute("aDensity", new THREE.BufferAttribute(density, 1));

  const material = new THREE.ShaderMaterial({
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    uniforms: {
      uColor: { value: new THREE.Color(cfg.color) },
      uOpacity: { value: cfg.opacity },
      uTime: { value: 0 },
      uDriftSpeed: { value: cfg.driftSpeed },
      uTurbulence: { value: cfg.turbulencePeriod },
      uFogNear: { value: WORLD.fogNear },
      uFogFar: { value: WORLD.fogFar },
    },
    transparent: true,
    // Additive, like everything else that emits rather than reflects. Mist lit
    // from within is the only kind that belongs in this palette — a mist that
    // occludes would have to be brighter than what is behind it to be seen, and
    // there is nothing behind it but black.
    blending: THREE.AdditiveBlending,
    // Reads depth so terrain occludes it; writes none, so it never occludes the
    // particles that fly over it.
    depthTest: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(cx, WORLD.mistPlaneY, cz);
  // Between the terrain and the particles. It must not sort against the sky.
  mesh.renderOrder = -1;

  return {
    mesh,

    update(time) {
      material.uniforms.uTime.value = time;
    },

    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}
