/**
 * THE VALLEY.
 *
 * Built geometry, never particles. Law 1: the world is not made of specks, only
 * the bridge is. Disable the particle system entirely and you should still see a
 * complete, believable dark valley — a finished environment that happens to have
 * nothing in it. If disabling particles leaves a blank frame the premise has
 * collapsed, because a place that is itself made of specks cannot be
 * *transformed* by specks; it is just noise rearranging itself.
 *
 * The previous implementation made the terrain a particle field, on the argument
 * that a displaced plane has a silhouette exactly as sharp as its tessellation
 * and the eye reads that edge as geometry. That is a real risk and it is handled
 * here by two things rather than by dissolving the land: the fifth noise octave
 * makes ridgelines ragged at a scale finer than the mesh reads, and fog eats the
 * far ones before their edges resolve.
 *
 * The albedo is essentially pure black. Ninety percent of what you can see of
 * the landscape is the rim term — a thin green edge where a surface turns away
 * from the camera. That is how hills genuinely look at night, and it is why the
 * terrain needs almost no shading: almost none of it is lit.
 */

import * as THREE from "three";
import { LIGHTING, PALETTE, PERF, TERRAIN, WORLD, type Tier } from "@/lib/config";
import { centreline } from "../centreline";

export interface TerrainHandle {
  mesh: THREE.Mesh;
  /** Bilinear heightfield lookup. Queried 140,000 times during seeding. */
  heightAt(x: number, z: number): number;
  normalAt(x: number, z: number, out?: THREE.Vector3): THREE.Vector3;
  /** Degrees from horizontal. */
  slopeAt(x: number, z: number): number;
  setSwarm(positions: THREE.Vector3[], intensity: number): void;
  /** How many of the five lights are evaluated. The degradation ladder's
   *  cheapest genuine saving: the shader loop simply runs fewer times. */
  setSwarmCount(count: number): void;
  /** Dev only — for sweeping the rim against the colour ratio. */
  setRim(strength: number): void;
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
function hash2(ix: number, iy: number, seed: number): number {
  let h = (ix * 374761393 + iy * 668265263 + seed * 2246822519) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const smoother = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);

function valueNoise2(x: number, y: number, seed: number): number {
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

const _probe = new THREE.Vector3();
const _tmp = new THREE.Vector3();

/**
 * Five octaves.
 *
 * The fifth is 1.8u at ~29u wavelength — invisible on any surface, and its
 * entire job is SILHOUETTES. A ridgeline built from four octaves is a smooth
 * mathematical curve and it looks like one; the fifth turns it ragged, and
 * ragged edges read as rock.
 *
 * It is the first thing anyone optimising this will drop, because it
 * "contributes almost nothing to the height". It contributes almost nothing to
 * the height and almost everything to the only thing anyone sees.
 */
function noiseHeight(x: number, z: number): number {
  let h = 0;
  for (let i = 0; i < TERRAIN.octaves.length; i++) {
    const [freq, amp] = TERRAIN.octaves[i];
    h += valueNoise2(x * freq, z * freq, TERRAIN.noiseSeed + i * 977) * amp;
  }

  // Ruggedness by depth: wild relief where the eye reads silhouettes, calm
  // ground near the lens. Applied to the NOISE only — the framing ridges
  // below are compositional absolutes and keep their authored heights.
  const r = TERRAIN.relief;
  h *= THREE.MathUtils.lerp(
    r.far,
    r.near,
    THREE.MathUtils.smoothstep(z, r.zFar, r.zNear),
  );

  // Framing ridges: placed for composition rather than generated. Two
  // overlapping ridges at different fog depths are what make the right side
  // feel deep rather than flat. The faint left one is nearly invisible and
  // gets deleted as "not doing anything" — without it the left third has no
  // depth information and the scrim reads as a black rectangle.
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
function carveAmount(x: number, z: number, h: number): number {
  const cl = TERRAIN.clearance;
  _probe.set(x, 0, z);
  const u = centreline.nearestU(_probe);
  centreline.positionAt(u, _probe);
  const dLine = Math.hypot(x - _probe.x, z - _probe.z);
  if (dLine >= cl.halfWidth) return 0;

  const needed = Math.max(0, h - (_probe.y - cl.margin));
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
varying vec3 vWorld;
varying vec3 vNrm;

void main(){
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  vNrm = normalize(mat3(modelMatrix) * normal);
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

void main(){
  vec3 n = normalize(vNrm);
  vec3 viewDir = normalize(cameraPosition - vWorld);

  vec3 color = uBase;

  // Ambient is almost nothing, and essential: without it, terrain facing away
  // from the skyglow is mathematically pure black, and pure black regions kill
  // the sense that a surface continues into shadow.
  color += uAmbient;

  // Skyglow, not a sun. At 0.16 it produces no visible highlight and no
  // discernible shadow direction — its job is normal disambiguation, so slopes
  // facing different ways are marginally different rather than identical.
  color += uKeyColor * uKeyIntensity * max(dot(n, normalize(uKeyDir)), 0.0);

  // The rim term. This is how the mountains are visible at all.
  float rim = pow(1.0 - abs(dot(n, viewDir)), uRimPower);
  color += uRim * rim * uRimStrength;

  // Swarm lights — flying particles illuminating the landscape.
  //
  // WINDOWED falloff, reaching exactly zero at uSwarmRange. This was previously
  // an unwindowed 1/(1+d^2), which never reaches zero, and the difference is not
  // academic: swarm-lit terrain is deep-band BY DEFINITION (the light's own
  // colour has luminance 0.87), so wherever the tail stays above the band edge,
  // the terrain is spending the deep budget. Solving 0.87 * falloff * intensity
  // < 0.058 for the old curve put that boundary at 310u — nearly twice the
  // nominal 150u and wider than the 325u spacing between lights. Every light
  // reached every other light's territory: a flat valley-wide wash, measured at
  // 25 points of deep against a 10-point budget.
  //
  // (1 - x^2)^decay keeps the same near-field shape and terminates. Beyond
  // uSwarmRange a light contributes nothing at all, so the pools stay discrete
  // and the illumination visibly TRAVELS with the river — which is the entire
  // reason the effect reads as caused by the particles rather than as a fill
  // light someone switched on.
  //
  // The clamp is a ceiling for the rare close pass, not the normal case. When
  // intensity sits well above it, a light saturates across most of its footprint
  // and the clamp stops limiting a hotspot and starts PRODUCING a flat disc of
  // constant brightness — the very spotlight-on-a-ridge it exists to prevent.
  float swarm = 0.0;
  for (int i = 0; i < 5; i++) {
    if (i >= uSwarmCount) break;
    float x = clamp(distance(vWorld, uSwarmPos[i]) / uSwarmRange, 0.0, 1.0);
    swarm += pow(1.0 - x * x, uSwarmDecay);
  }
  color += uSwarmColor * min(swarm * uSwarmIntensity, uSwarmClamp);

  // Linear fog, tinted to the sky's horizon band so distant terrain dissolves
  // rather than ending at an edge. Opaque geometry mixes TOWARD the fog colour;
  // additive geometry must not, and does not — see the particle shader.
  float fog = clamp(
    (distance(cameraPosition, vWorld) - uFogNear) / (uFogFar - uFogNear),
    0.0, 1.0
  );
  color = mix(color, uFogColor, fog);

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
   * lookups. Re-running five octaves plus a nearestU search 140,000 times during
   * seeding costs roughly 400ms and shows up as a visible hitch before the scene
   * starts; sampling this costs about 6ms.
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

  const cellX = width / (segments - 1);
  const cellZ = depth / (segments - 1);

  const sample = (i: number, j: number) =>
    field[
      THREE.MathUtils.clamp(j, 0, segments - 1) * segments +
        THREE.MathUtils.clamp(i, 0, segments - 1)
    ];

  function heightAt(x: number, z: number): number {
    const fx = (x - WORLD.bounds.minX) / cellX;
    const fz = (z - WORLD.bounds.minZ) / cellZ;
    const i = Math.floor(fx);
    const j = Math.floor(fz);
    const tx = fx - i;
    const tz = fz - j;

    return (
      (sample(i, j) * (1 - tx) + sample(i + 1, j) * tx) * (1 - tz) +
      (sample(i, j + 1) * (1 - tx) + sample(i + 1, j + 1) * tx) * tz
    );
  }

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
       * --void, the darkest token, not --soil.
       *
       * The terrain's unlit floor has to sit clear of the near-black band edge
       * (0.058) with room for the ambient and key terms on top, or every visible
       * slope crosses it and the landscape alone consumes the whole deep-green
       * budget. Isolating the elements measured exactly that: terrain 25 points
       * of deep against the particles' 0.6.
       *
       *   --soil  0.0580  ON the edge; ambient alone tips it over
       *   --ink   0.0390  + ambient 0.015 = 0.054, key takes it to 0.074 — over
       *   --void  0.0247  + ambient 0.005 = 0.030, key takes it to 0.050 — under
       *
       * Making the terrain indistinguishable from the page background is not a
       * loss: its shape is read from the rim term, which is unaffected.
       */
      uBase: { value: new THREE.Color(PALETTE.void) },
      uRim: { value: new THREE.Color(PALETTE.rim) },
      uRimStrength: { value: TERRAIN.material.rimStrength },
      uRimPower: { value: TERRAIN.material.rimPower },
      // Ambient exists only so surfaces facing away from the skyglow are not
      // mathematically zero — pure black regions clip once grain and bloom are
      // applied on top. It must not be large enough to lift the floor across the
      // band edge on its own.
      uAmbient: {
        value: new THREE.Color(PALETTE.moss).multiplyScalar(
          LIGHTING.ambient.intensity * 0.12,
        ),
      },
      uKeyColor: { value: new THREE.Color("#a9c77e") },
      uKeyIntensity: { value: LIGHTING.key.intensity },
      uKeyDir: { value: new THREE.Vector3(...LIGHTING.key.direction) },

      uSwarmPos: { value: swarmPos },
      uSwarmIntensity: { value: 0 },
      uSwarmRange: { value: LIGHTING.swarmLights.range },
      uSwarmDecay: { value: LIGHTING.swarmLights.decay },
      uSwarmClamp: { value: LIGHTING.swarmLights.terrainClamp },
      uSwarmColor: { value: new THREE.Color(PALETTE.limeBright) },
      uSwarmCount: { value: PERF.swarmLightsByTier[tier] },

      uFogColor: { value: new THREE.Color(PALETTE.ink) },
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
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}
