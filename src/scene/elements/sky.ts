/**
 * THE SKY.
 *
 * Four layers in one draw call and no geometry worth the name: a gradient, a
 * starfield, a nebula, and the fog colour they all resolve into.
 *
 * It is the only element in the scene with no choreography at all. Nothing here
 * reacts to the build, the cursor, or the clock beyond its own drift. That
 * constancy is load-bearing — the transformation below it is legible precisely
 * because the thing behind it never moves.
 *
 * NO GEOMETRY, NO DOME
 * --------------------
 * A skybox would need a mesh large enough to contain the world, which means it
 * competes with the far clipping plane and gets fogged by anything that fogs by
 * distance. Instead this is one triangle-pair pinned to the far plane in clip
 * space, and every pixel reconstructs its own view ray from the inverse
 * view-projection matrix. The ray is what the gradient and the nebula are
 * expressed in, so the horizon lands wherever the horizon actually is, at any
 * camera angle, with no seam to hide and no depth sorting to lose.
 *
 * NOTHING HERE BLOOMS
 * -------------------
 * The brightest thing in this file is a 0.34 star against a 0.62 bloom
 * threshold. Sky, stars, nebula, horizon: all under it, all deliberately. Only
 * particles glow. A sky that blooms leaves the bridge nothing to be bright
 * against, and the whole image goes to milk.
 */

import * as THREE from "three";
import { PALETTE, SKY, WORLD } from "@/lib/config";

export interface SkyHandle {
  mesh: THREE.Mesh;
  /**
   * Two clocks on purpose: `time` is the wall clock (gradient drift, nebula,
   * aurora — things that must never visibly repeat), `sceneTime` is the
   * wrapped scene clock (the shooting stars — things that must repeat
   * EXACTLY, or the loop's pixel-identical guarantee dies).
   */
  update(time: number, sceneTime: number, camera: THREE.PerspectiveCamera): void;
  /** Star size is expressed in pixels, so the shader needs the real viewport. */
  setSize(width: number, height: number): void;
  dispose(): void;
}

const f = (x: number) => x.toFixed(4);

/** Packs the four gradient stops into uniform arrays the shader can lerp. */
function gradientUniforms() {
  const stops = SKY.gradient;
  const colors = stops.map((s) => new THREE.Color(s.color));
  const heights = stops.map((s) => s.y);
  // Pad to a fixed length so the shader can use a constant loop bound.
  while (colors.length < 4) {
    colors.push(colors[colors.length - 1].clone());
    heights.push(1.0);
  }
  return { colors, heights };
}

const VERTEX = /* glsl */ `
varying vec2 vNdc;

void main() {
  vNdc = position.xy;
  // z = w = 1 puts the quad exactly on the far plane, so anything with real
  // depth draws in front of it without a depth test being needed at all.
  gl_Position = vec4(position.xy, 1.0, 1.0);
}
`;

const FRAGMENT = /* glsl */ `
precision highp float;

uniform vec3  uGradientColor[4];
uniform float uGradientY[4];

uniform vec3  uNebulaColor;
uniform float uNebulaOpacity;
uniform vec4  uNebulaExtent;      // xMin, xMax, yMin, yMax — screen, y from top
uniform vec3  uNebulaOctaves[3];  // frequency, amplitude, unused
uniform vec2  uNebulaDrift;
uniform float uNebulaTurbulence;

uniform vec2  uStarGrid;
uniform float uStarProbability;
uniform vec2  uStarSize;
uniform vec2  uStarBrightness;
uniform vec2  uStarFalloff;
uniform vec2  uStarPeriod;
uniform float uStarTwinkle;

uniform vec3  uAuroraLow;
uniform vec3  uAuroraHigh;
uniform float uAuroraIntensity;

uniform mat4  uInvViewProj;
uniform vec3  uCameraPos;
uniform vec2  uResolution;
uniform float uTime;
uniform float uSceneTime;

varying vec2 vNdc;

// --- hashing -------------------------------------------------------------
//
// Deterministic and stateless. The starfield has to be identical on every load
// and on every device, or two people looking at the same page are not looking
// at the same picture — and a screenshot taken for the colour-ratio harness
// would not describe the frame anyone else sees.

float hash21(vec2 p) {
  vec3 q = fract(vec3(p.xyx) * 0.1031);
  q += dot(q, q.yzx + 33.33);
  return fract((q.x + q.y) * q.z);
}

vec2 hash22(vec2 p) {
  vec3 q = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  q += dot(q, q.yzx + 33.33);
  return fract((q.xx + q.yz) * q.zy);
}

/** Value noise. Smoothstep interpolation, so no visible lattice. */
float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

void main() {
  // --- the view ray ------------------------------------------------------
  vec4 far = uInvViewProj * vec4(vNdc, 1.0, 1.0);
  vec3 dir = normalize(far.xyz / far.w - uCameraPos);

  // Elevation: 0 at the horizon, 1 straight up. This is what the gradient is
  // expressed in, which is why the horizon band tracks the camera instead of
  // being painted at a fixed screen height and drifting off the ridgeline the
  // moment the camera pitches.
  float elev = max(dir.y, 0.0);

  vec3 color = uGradientColor[0];
  for (int i = 1; i < 4; i++) {
    float t = smoothstep(uGradientY[i - 1], uGradientY[i], elev);
    color = mix(color, uGradientColor[i], t);
  }

  // Screen coordinates with y measured from the TOP, matching how the frame is
  // described everywhere else in the pack.
  vec2 uv = vNdc * 0.5 + 0.5;
  vec2 sxy = vec2(uv.x, 1.0 - uv.y);

  // --- nebula ------------------------------------------------------------
  //
  // Three octaves of scrolling value noise, masked to the upper right —
  // diagonally opposite the headline, and directly behind where the far end of
  // the bridge assembles.
  //
  // The drift is far too slow to see. That is the point: it exists so no two
  // frames are identical, which the eye registers as air even when it cannot
  // name what it registered. The turbulence term evolves the internal structure
  // as well, so over a long session the shape genuinely changes rather than
  // sliding past unchanged.
  vec2 flow = uNebulaDrift * uTime * 0.004;
  float turb = sin(uTime / uNebulaTurbulence * 6.2831853) * 0.35;

  float n = 0.0;
  float amp = 0.0;
  for (int i = 0; i < 3; i++) {
    vec2 p = sxy * uNebulaOctaves[i].x * 3.4 + flow * uNebulaOctaves[i].x;
    p += turb * float(i) * 0.5;
    n += vnoise(p) * uNebulaOctaves[i].y;
    amp += uNebulaOctaves[i].y;
  }
  n /= amp;

  float maskX = smoothstep(uNebulaExtent.x, uNebulaExtent.x + 0.22, sxy.x)
              * (1.0 - smoothstep(uNebulaExtent.y - 0.06, uNebulaExtent.y, sxy.x));
  float maskY = (1.0 - smoothstep(uNebulaExtent.w - 0.20, uNebulaExtent.w, sxy.y));
  float mask = maskX * maskY;

  // Squared, so the cloud has a dense core and a long soft edge rather than a
  // uniform slab with a feathered border.
  float density = n * n * mask;
  color += uNebulaColor * (density * uNebulaOpacity);

  // --- aurora --------------------------------------------------------------
  //
  // ONE serpentine ribbon, not a wash (client direction, 2026-08-01): the
  // classic polar-light anatomy — a narrow band ZIGZAGGING across the sky,
  // with a crisp bright lower edge and wispy rays feathering upward. Small,
  // vivid, and visibly alive: the folds travel and the ray striations
  // flicker on the wall clock.
  {
    float ax = sxy.x;
    float t1 = uTime * 0.055;

    // The centreline: elevation as a function of azimuth. Two counter-
    // travelling folds plus a noise wander — the serpent's zigzag. The
    // frequencies put 3–4 visible folds across the ribbon's extent; lower
    // ones read as a single smooth arch, which is exactly not the point.
    float zig = sin(ax * 17.0 + t1 * 2.1) * 0.5
              + sin(ax * 7.3 - t1 * 1.4 + 1.7) * 0.5;
    zig += (vnoise(vec2(ax * 3.4 + t1 * 0.5, 8.2)) - 0.5) * 1.2;
    float eC = 0.30 + zig * 0.08;

    // Real aurora reads: sharp below the band, long soft rays above it.
    float d = elev - eC;
    float band = d < 0.0
      ? exp(-pow(-d * 34.0, 1.7))
      : exp(-d * 9.0);

    // Vertical ray striations scrolling along the ribbon — the flicker.
    band *= 0.55 + 0.45 * vnoise(vec2(ax * 26.0 + zig * 2.0, uTime * 0.13));

    // One ribbon with soft ends, biased away from the text column.
    float extent = smoothstep(0.3, 0.48, ax) * (1.0 - smoothstep(0.93, 1.02, ax));
    // Slow breathing, so even a still glance reads intensity in motion.
    float breathe = 0.72 + 0.28 * sin(uTime * 0.23 + 1.3);

    // Clamped under the bloom threshold — the sky must never glow.
    float aur = min(band * extent * breathe, 0.85);
    vec3 aurCol = mix(uAuroraLow, uAuroraHigh,
                      clamp(d * 6.0 + 0.35, 0.0, 1.0));
    color += aurCol * aur * uAuroraIntensity;
  }

  // --- stars -------------------------------------------------------------
  //
  // Screen-space, camera-locked, per the pack. Stars that translate with a
  // ±22u camera parallax stop reading as stars and start reading as fireflies,
  // and the distance that would make the parallax negligible puts them behind
  // the far plane and inside the fog.
  //
  // One hash per cell decides whether a star exists at all, so the field is
  // sparse and irregular instead of a regular lattice with jitter.
  vec2 grid = sxy * uStarGrid;
  vec2 cell = floor(grid);
  vec2 frac = fract(grid);

  float exists = hash21(cell + 11.7);
  if (exists < uStarProbability) {
    vec2 jitter = hash22(cell * 1.37);
    float r = hash21(cell + 3.1);

    // Distance in PIXELS, not cell units, so a star is the same size wherever
    // it lands and whatever the viewport aspect is.
    vec2 cellPx = uResolution / uStarGrid;
    float dPx = length((frac - jitter) * cellPx);

    float sizePx = mix(uStarSize.x, uStarSize.y, r);
    float core = 1.0 - smoothstep(0.0, sizePx, dPx);

    float period = mix(uStarPeriod.x, uStarPeriod.y, hash21(cell + 7.3));
    float phase = hash21(cell + 19.4) * 6.2831853;
    float tw = 1.0 + uStarTwinkle * sin(uTime / period * 6.2831853 + phase);

    float bright = mix(uStarBrightness.x, uStarBrightness.y, r * r) * tw;

    // Thinned toward the ridgeline. Terrain draws over the sky anyway, so this
    // only has to stop stars crowding the silhouette from just above it.
    float fade = 1.0 - smoothstep(uStarFalloff.x, uStarFalloff.y, sxy.y);

    color += vec3(bright * core * fade);
  }

  // --- shooting stars ------------------------------------------------------
  //
  // The SCENE clock, deliberately: two opportunity windows per cycle, each
  // firing (or not) at a hash-chosen moment, place and heading. The same
  // meteors recur each cycle, which is what keeps frame T and frame T+35
  // pixel-identical — the loop's foundational guarantee. Rarity does the
  // rest: nobody counts the sky.
  {
    float win = floor(uSceneTime / ${f(SKY.meteors.window)});
    float wh = hash21(vec2(win, 42.7));
    if (wh < ${f(SKY.meteors.probability)}) {
      float dur = mix(${f(SKY.meteors.duration[0])}, ${f(SKY.meteors.duration[1])},
                      hash21(vec2(win, 7.7)));
      float t0 = win * ${f(SKY.meteors.window)} + 0.4
               + hash21(vec2(win, 3.9)) * (${f(SKY.meteors.window)} - dur - 1.0);
      float mp = (uSceneTime - t0) / dur;
      if (mp > 0.0 && mp < 1.0) {
        // Aspect-corrected screen space, so the streak is straight and its
        // width is a pixel width at every viewport shape.
        float aspect = uResolution.x / max(uResolution.y, 1.0);
        vec2 Pa = vec2(sxy.x * aspect, sxy.y);

        vec2 Aa = vec2((0.1 + 0.72 * hash21(vec2(win, 11.3))) * aspect,
                       0.07 + 0.2 * hash21(vec2(win, 13.9)));
        float ang = 0.42 + 0.4 * hash21(vec2(win, 17.3));
        float sgn = hash21(vec2(win, 23.1)) < 0.5 ? 1.0 : -1.0;
        vec2 dirA = vec2(sgn * cos(ang), sin(ang));

        float flight = mix(0.26, 0.44, hash21(vec2(win, 29.9)));
        vec2 head = Aa + dirA * flight * mp;

        float tailLen = mix(${f(SKY.meteors.tailLength[0])}, ${f(SKY.meteors.tailLength[1])},
                            hash21(vec2(win, 31.7)))
                      * smoothstep(0.0, 0.35, mp);
        vec2 tail0 = head - dirA * tailLen;
        float h01 = clamp(dot(Pa - tail0, dirA) / max(tailLen, 1e-4), 0.0, 1.0);
        float dSeg = length(Pa - (tail0 + dirA * tailLen * h01));

        // Gaussian cross-section ~1.7px; quadratic fade along the tail so
        // the head burns and the tail breathes out.
        float w = 1.7 / uResolution.y;
        float core = exp(-dSeg * dSeg / (2.0 * w * w));
        float life = smoothstep(0.0, 0.1, mp) * (1.0 - smoothstep(0.6, 1.0, mp));
        color += vec3(0.82, 1.0, 0.88)
               * (core * h01 * h01 * life * ${f(SKY.meteors.brightness)});
      }
    }
  }

  // --- distant ranges — painted silhouettes --------------------------------
  //
  // Two ridgelines of pure paint just above the horizon, LAST in the stack so
  // they mask stars, nebula and meteors exactly as real mountains would. The
  // real terrain draws OVER the sky, so these only ever show where the world
  // is empty — precisely the holes they exist to fill (the left flank,
  // between the true ridges). Jagged at two noise scales; near layer darker,
  // both under the near-black band edge.
  {
    float az = sxy.x;
    float e = dir.y;

    float r1 = 0.032
      + (vnoise(vec2(az * 5.0 + 3.7, 11.0)) - 0.5) * 0.05
      + (vnoise(vec2(az * 13.0, 23.0)) - 0.5) * 0.02;
    float m1 = 1.0 - smoothstep(r1 - 0.003, r1 + 0.007, e);
    color = mix(color, vec3(0.016, 0.031, 0.024), m1 * 0.85);

    float r2 = 0.016
      + (vnoise(vec2(az * 3.4 + 9.1, 31.0)) - 0.5) * 0.045
      + (vnoise(vec2(az * 9.0 + 4.2, 41.0)) - 0.5) * 0.022;
    float m2 = 1.0 - smoothstep(r2 - 0.003, r2 + 0.007, e);
    color = mix(color, vec3(0.010, 0.020, 0.017), m2 * 0.9);
  }

  gl_FragColor = vec4(color, 1.0);
}
`;

export function createSky(): SkyHandle {
  const { colors, heights } = gradientUniforms();
  const stars = SKY.stars;
  const neb = SKY.nebula;

  // A grid fine enough that the existence probability, rather than the lattice,
  // is what sets the spacing. 2400 cells at p=0.375 gives the specified 900.
  const gridX = 60;
  const gridY = 40;

  const material = new THREE.ShaderMaterial({
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    uniforms: {
      uGradientColor: { value: colors },
      uGradientY: { value: heights },

      uNebulaColor: { value: new THREE.Color(neb.color) },
      uNebulaOpacity: { value: neb.peakOpacity },
      uNebulaExtent: {
        value: new THREE.Vector4(
          neb.extent.x[0], neb.extent.x[1], neb.extent.y[0], neb.extent.y[1],
        ),
      },
      uNebulaOctaves: {
        value: neb.octaves.map(([f, a]) => new THREE.Vector3(f, a, 0)),
      },
      uNebulaDrift: {
        value: new THREE.Vector2(...neb.drift.direction).multiplyScalar(
          neb.drift.speed,
        ),
      },
      uNebulaTurbulence: { value: neb.drift.turbulencePeriod },

      uStarGrid: { value: new THREE.Vector2(gridX, gridY) },
      uStarProbability: { value: stars.count / (gridX * gridY) },
      uStarSize: { value: new THREE.Vector2(stars.sizePx.min, stars.sizePx.max) },
      uStarBrightness: {
        value: new THREE.Vector2(stars.brightness.min, stars.brightness.max),
      },
      uStarFalloff: {
        value: new THREE.Vector2(stars.falloffStart, stars.falloffEnd),
      },
      uStarPeriod: {
        value: new THREE.Vector2(...stars.twinkle.periodRange),
      },
      uStarTwinkle: { value: stars.twinkle.amplitude },

      uAuroraLow: { value: new THREE.Color(SKY.aurora.colorLow) },
      uAuroraHigh: { value: new THREE.Color(SKY.aurora.colorHigh) },
      uAuroraIntensity: { value: SKY.aurora.intensity },

      uInvViewProj: { value: new THREE.Matrix4() },
      uCameraPos: { value: new THREE.Vector3() },
      uResolution: { value: new THREE.Vector2(1, 1) },
      uTime: { value: 0 },
      uSceneTime: { value: 0 },
    },
    depthTest: false,
    depthWrite: false,
    // The quad is already pinned to the far plane; nothing may draw behind it,
    // and it must never occlude what draws in front.
    side: THREE.DoubleSide,
  });

  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  mesh.frustumCulled = false;
  mesh.renderOrder = -1000;

  const invViewProj = material.uniforms.uInvViewProj.value as THREE.Matrix4;
  const camPos = material.uniforms.uCameraPos.value as THREE.Vector3;
  const res = material.uniforms.uResolution.value as THREE.Vector2;
  const _vp = new THREE.Matrix4();

  return {
    mesh,

    update(time, sceneTime, camera) {
      material.uniforms.uTime.value = time;
      material.uniforms.uSceneTime.value = sceneTime;

      // Derived here rather than read off the camera, because the renderer does
      // not refresh matrixWorldInverse until it draws. Reading it would give the
      // PREVIOUS frame's view — the horizon would trail the ridgeline by exactly
      // one frame of camera drift, which reads as the mountains sliding against
      // the sky. Off by one frame is the hardest kind of wrong to see and the
      // easiest to feel.
      camera.updateMatrixWorld();
      camera.matrixWorldInverse.copy(camera.matrixWorld).invert();

      _vp.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
      invViewProj.copy(_vp).invert();
      camPos.copy(camera.position);
    },

    setSize(width, height) {
      res.set(width, height);
    },

    dispose() {
      mesh.geometry.dispose();
      material.dispose();
    },
  };
}

/** The colour distant terrain dissolves into, so callers agree with the sky. */
export const FOG_COLOR = WORLD.fogColor;

/** Kept so the fallback clear colour cannot drift from the zenith. */
export const CLEAR_COLOR = PALETTE.void;
