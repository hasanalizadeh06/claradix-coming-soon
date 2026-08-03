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

uniform vec3  uNebulaGlow;

uniform vec2  uStarGrid;
uniform float uStarProbability;
uniform vec2  uStarSize;
uniform vec2  uStarBrightness;
uniform vec2  uStarFalloff;
uniform vec2  uStarPeriod;
uniform float uStarTwinkle;

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

/** Four octaves — enough for a cloud to have a silhouette AND a texture. */
float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.54;
  for (int i = 0; i < 4; i++) {
    v += vnoise(p) * a;
    p = p * 2.13 + 17.7;
    a *= 0.5;
  }
  return v;
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

  // --- LAYER: THE GREAT HAZE (2026-08-04 sky redesign) ---------------------
  //
  // Atmosphere rising off the terrain — the fog does not float on its own,
  // it ORIGINATES at the ground: densest against the ridgelines, thinning
  // exponentially with elevation until the upper sky is essentially black.
  // A very low-frequency field at its own (slowest) tempo keeps it from
  // ever reading as a painted band; darkness above is the artistic tool.
  {
    float az = sxy.x;
    float e = max(dir.y, 0.0);
    vec2 t3 = vec2(uTime * ${f(SKY.nebula.driftSpeed * 0.35)},
                   -uTime * ${f(SKY.nebula.driftSpeed * 0.22)});
    float hz = fbm(vec2(az * 1.1, e * 2.0) + t3);
    float ground = exp(-e * 7.0);
    // Dark emerald breath near the terrain...
    color += vec3(0.010, 0.026, 0.017) * (ground * (0.45 + 0.55 * hz));
    // ...over a blue-black pre-dawn lift that carries a little higher.
    color += vec3(0.006, 0.009, 0.014) * exp(-e * 3.0) * 0.55;
  }

  // --- THE NEBULA ----------------------------------------------------------
  //
  // A volumetric deep-space plasma formation — NOT clouds, NOT fog. Four
  // cooperating systems:
  //
  //   WARP    two nested domain warps bend every coordinate before any
  //           field is read, so no Perlin patterning survives; the same
  //           warp feeds every layer, which is what keeps membranes,
  //           veins and energy physically coherent with each other
  //   BODY    two stacked translucent sheets — a coarse back sheet seen
  //           THROUGH the thin regions of a finer front sheet — plus a
  //           high-frequency micro field that shreds every edge into
  //           filaments instead of letting it end in an outline
  //   ENERGY  a slow internal plasma field. Light originates INSIDE:
  //           it escapes only through translucent mid-density membranes
  //           and thin ridged fracture VEINS; fully thick regions occlude
  //           their own light and stay near-black. No rims, no edge glow.
  //   FRAMING a center-open mask — the formation wraps the frame's edges
  //           and corners and leaves negative space over the bridge.
  //
  // cloudBody (opacity: stars and meteors dim behind it) and glowField
  // (energy: the painted ranges borrow it for crest light) escape the
  // block, so the rest of the sky keeps one physical story.
  float cloudBody = 0.0;
  float glowField = 0.0;
  {
    float az = sxy.x;
    float e = max(dir.y, 0.0);

    // Nothing floats below the horizon haze.
    float skyMask = smoothstep(0.004, 0.045, e);

    // Center-open framing, aspect-corrected so the negative space is a
    // circle of screen, not of UV.
    float aspect = uResolution.x / max(uResolution.y, 1.0);
    vec2 fc = (sxy - vec2(0.52, 0.42)) * vec2(aspect, 1.0);
    float framing = 0.3 + 0.7 * smoothstep(0.16, 0.62, length(fc));
    // The far corners carry MORE than the edge average — the formation
    // visibly wraps the frame instead of merely avoiding the middle.
    framing *= 1.0 + 0.4 * smoothstep(0.55, 0.95, length(fc));

    // Anisotropic base coordinates — the formation stretches along the
    // horizon, as a structure hundreds of kilometres wide would.
    vec2 P = vec2(az * 3.1, e * 5.0);

    // GLACIAL drift, three tempos. The nebula does not blow anywhere; its
    // warp fields migrate against each other so the interior slowly folds.
    vec2 t1 = vec2(uTime * ${f(SKY.nebula.driftSpeed)},
                   -uTime * ${f(SKY.nebula.driftSpeed * 0.6)});
    vec2 t2 = vec2(-uTime * ${f(SKY.nebula.driftSpeed * 0.8)},
                   uTime * ${f(SKY.nebula.driftSpeed * 0.45)});

    // The double warp.
    vec2 q = vec2(fbm(P + t1), fbm(P + vec2(5.2, 1.3) + t2));
    vec2 r = vec2(fbm(P + 2.4 * q + vec2(1.7, 9.2)),
                  fbm(P + 2.4 * q + vec2(8.3, 2.8)));

    // Micro-detail — the highest frequency in the sky. Multiplied into
    // every density threshold below, so silhouettes dissolve into finer
    // and finer tears instead of ending.
    float micro = fbm(P * 8.0 + 3.0 * r + t2 * 2.0);

    // The two sheets. The back is coarser and offset; the front is finer
    // and more torn. Their thresholds ride the micro field.
    float dBack = fbm(P * 0.55 + 1.7 * r + vec2(11.0, 3.0));
    float dFront = fbm(P * 1.35 + 2.2 * r);
    float backBody = smoothstep(0.27, 0.65, dBack * (0.78 + 0.44 * micro));
    float frontBody = smoothstep(0.31, 0.71, dFront * (0.7 + 0.56 * micro));

    float density = clamp(backBody * 0.6 + frontBody * 0.8, 0.0, 1.0)
                  * skyMask * framing;
    cloudBody = density;

    // The internal plasma. Slower than everything else (t1 * 0.5): light
    // MIGRATES through the formation rather than flickering.
    float en = fbm(P * 0.8 + 1.6 * q + vec2(4.0, 7.0) + t1 * 0.5);
    float energy = pow(smoothstep(0.42, 0.78, en), 1.7);
    glowField = energy;

    // Ridged folds, reduced to a WHISPER (2026-08-04 sky redesign: the
    // hard "fracture vein" plasma look was too dramatic — this is ionized
    // atmosphere catching distant light, not deep-space plasma).
    float vein = 1.0 - abs(2.0 * fbm(P * 2.6 + 2.8 * r + vec2(9.0, 5.0)) - 1.0);
    vein = pow(vein, 4.0);

    // The translucent membrane window: emission escapes where the body is
    // present but thin-to-mid; a fully thick core occludes its own light.
    float membrane = smoothstep(0.08, 0.34, density)
                   * (1.0 - smoothstep(0.52, 0.94, density));

    // VERTICAL LIGHT LAW: brightness belongs to the horizon and to the
    // energy regions the framing selects (the reference's upper-right).
    // Everything else fades upward into darkness.
    float vertDamp = 0.38 + 0.62 * exp(-e * 2.1);

    // Occlusion FIRST — the body stands in front of space and darkens it.
    // Most of the formation stays near-black; brightness is rare.
    color = mix(color, vec3(0.004, 0.010, 0.006), density * 0.96);

    // The unlit body is NEAR-BLACK GREEN, not invisible: a faint ambient
    // lift, textured by the micro field, keeps the formation's silhouette
    // legible against pure black space even where no energy stands.
    color += vec3(0.014, 0.034, 0.021) * (density * (0.5 + 0.5 * micro));

    // Emission: SOFT ACCUMULATION — light gathering in the thin of the
    // haze, with the ridged folds only articulating it, never dominating.
    float emit = energy * (membrane * 1.15 + vein * energy * 0.55)
               + energy * backBody * (1.0 - frontBody) * 0.3;
    emit *= 0.65 + 0.55 * micro;
    emit *= vertDamp;
    emit = clamp(emit, 0.0, 1.0);

    // LAYER: VOLUMETRIC SCATTERING — not bloom: a broad, dim softness in
    // the AIR around the bright regions, from the same energy field read
    // through a much wider window, so light bleeds into the atmosphere
    // the way it does before sunrise.
    float scatter = smoothstep(0.3, 0.75, en) * skyMask * vertDamp;
    color += vec3(0.018, 0.052, 0.028) * (scatter * framing * 0.55);

    // The designed ramp. Deep emerald dominates; the yellow-green core is
    // reserved for the strongest energy and stays under the 0.62 bloom
    // threshold — the sky never blooms.
    vec3 glow = vec3(0.016, 0.075, 0.038);
    glow = mix(glow, vec3(0.045, 0.160, 0.070), smoothstep(0.15, 0.40, emit));
    glow = mix(glow, vec3(0.130, 0.380, 0.100), smoothstep(0.35, 0.65, emit));
    glow = mix(glow, vec3(0.320, 0.620, 0.160), smoothstep(0.60, 0.85, emit));
    glow = mix(glow, vec3(0.440, 0.660, 0.180), smoothstep(0.82, 0.97, emit));

    color += glow * emit;
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

  // Star FIELDS: a large-scale noise reshapes the existence probability, so
  // the sky carries dense drifts and near-empty pools instead of a uniform
  // sprinkle — the reference's speckled regions against open black.
  float clusterN = vnoise(cell * ${f(SKY.stars.cluster.scale)} + 5.0);
  float prob = uStarProbability
             * mix(${f(SKY.stars.cluster.min)}, ${f(SKY.stars.cluster.max)},
                   clusterN * clusterN);

  float exists = hash21(cell + 11.7);
  if (exists < prob) {
    vec2 jitter = hash22(cell * 1.37);
    float r = hash21(cell + 3.1);

    // A rare few burn brighter and larger — the "named" stars of the frame.
    float isBright = step(1.0 - ${f(SKY.stars.brightStar.fraction)},
                          hash21(cell + 27.9));

    // Distance in PIXELS, not cell units, so a star is the same size wherever
    // it lands and whatever the viewport aspect is.
    vec2 cellPx = uResolution / uStarGrid;
    float dPx = length((frac - jitter) * cellPx);

    float sizePx = mix(uStarSize.x, uStarSize.y, r)
                 * mix(1.0, ${f(SKY.stars.brightStar.sizeBoost)}, isBright);
    float core = 1.0 - smoothstep(0.0, sizePx, dPx);

    float period = mix(uStarPeriod.x, uStarPeriod.y, hash21(cell + 7.3));
    float phase = hash21(cell + 19.4) * 6.2831853;
    float tw = 1.0 + uStarTwinkle * sin(uTime / period * 6.2831853 + phase);

    // Capped AFTER the twinkle and the bright-star boost: even the brightest
    // star at the top of its twinkle stays under the 0.62 bloom threshold.
    float bright = mix(uStarBrightness.x, uStarBrightness.y, r * r)
                 * mix(1.0, ${f(SKY.stars.brightStar.boost)}, isBright);
    bright = min(bright * tw, ${f(SKY.stars.brightStar.cap)});

    // Thinned toward the ridgeline. Terrain draws over the sky anyway, so this
    // only has to stop stars crowding the silhouette from just above it.
    float fade = 1.0 - smoothstep(uStarFalloff.x, uStarFalloff.y, sxy.y);

    // TEMPERATURE (2026-08-04 sky redesign): most stars cold white with a
    // faint blue cast; a small fraction burn slightly warm. Astronomy,
    // not decoration — the warmth stays subtle.
    float temp = hash21(cell + 31.7);
    vec3 starCol = mix(vec3(0.84, 0.92, 1.0), vec3(1.0, 0.88, 0.72),
                       smoothstep(0.86, 0.97, temp) * 0.7);

    // Stars live BEHIND the clouds. This one multiply is what turns the
    // masses from painted glow into weather.
    color += starCol * (bright * core * fade) * (1.0 - cloudBody * 0.93);
  }

  // --- LAYER: MICRO DRIFT --------------------------------------------------
  //
  // Tiny particles adrift in the atmosphere, almost invisible — the layer
  // between the stars and the haze that makes the sky feel inhabited by
  // AIR rather than painted. They drift at their own slow tempo, unsynced
  // with everything else; motion felt, never seen.
  {
    vec2 g2 = (sxy + vec2(uTime * 0.0017, uTime * 0.00093)) * vec2(85.0, 56.0);
    vec2 c2 = floor(g2);
    vec2 f2 = fract(g2);
    float ex2 = hash21(c2 + 77.3);
    if (ex2 < 0.055) {
      vec2 j2 = hash22(c2 * 1.91);
      float d2 = length((f2 - j2) * (uResolution / vec2(85.0, 56.0)));
      float core2 = 1.0 - smoothstep(0.0, 1.0, d2);
      float fade2 = 1.0 - smoothstep(0.35, 0.8, sxy.y);
      color += vec3(0.042, 0.062, 0.05)
             * (core2 * fade2 * (0.5 + 0.5 * fract(ex2 * 17.0)))
             * (1.0 - cloudBody * 0.9);
    }
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
      // Per-meteor size: some burn small and quick, some carve wide — the
      // sky stops repeating itself.
      float mScale = mix(${f(SKY.meteors.scale[0])}, ${f(SKY.meteors.scale[1])},
                         hash21(vec2(win, 37.7)));
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
                      * mScale
                      * smoothstep(0.0, 0.35, mp);
        vec2 tail0 = head - dirA * tailLen;
        float h01 = clamp(dot(Pa - tail0, dirA) / max(tailLen, 1e-4), 0.0, 1.0);
        float dSeg = length(Pa - (tail0 + dirA * tailLen * h01));

        // Gaussian cross-section ~1.7px at scale 1; quadratic fade along the
        // tail so the head burns and the tail breathes out.
        float w = 1.7 * mScale / uResolution.y;
        float core = exp(-dSeg * dSeg / (2.0 * w * w));
        float life = smoothstep(0.0, 0.1, mp) * (1.0 - smoothstep(0.6, 1.0, mp));
        // A meteor passing behind a cloud dims behind it, as it should.
        color += vec3(0.82, 1.0, 0.88)
               * (core * h01 * h01 * life
                  * ${f(SKY.meteors.brightness)} * (0.75 + 0.35 * mScale))
               * (1.0 - cloudBody * 0.85);
      }
    }
  }

  // --- distant ranges — painted silhouettes --------------------------------
  //
  // THREE ridgelines of pure paint, LAST in the stack so they mask stars,
  // clouds and meteors exactly as real mountains would. The real terrain
  // draws OVER the sky, so these only ever show where the world is empty —
  // the holes they exist to fill. (Client, 2026-08-03 round 2: "the image
  // has MANY mountains, not one" — a tall rugged back range was added, its
  // height enveloped by azimuth so it crowds the right flank and the far
  // left, and stays low in the open middle where the bridge lives.)
  //
  // Each range catches the cloud layer's light on its UPPER flank: where
  // glowField stands overhead the crest glints green and the light dies
  // downslope; where it does not, the range stays shadow. Same field as the
  // clouds, so a lit ridge always sits under a lit sky.
  {
    float az = sxy.x;
    float e = dir.y;

    // Back range — tall and rugged, higher right-of-frame and at the far
    // left edge, low across the bridge's middle.
    float env3 = (0.45 + 0.55 * vnoise(vec2(az * 1.7, 71.0)))
               * (0.6 + 0.5 * smoothstep(0.5, 0.95, az)
                      + 0.35 * (1.0 - smoothstep(0.06, 0.3, az)));
    float r3 = 0.025 + env3 * (0.075
      + (vnoise(vec2(az * 4.2 + 7.3, 53.0)) - 0.5) * 0.09
      + (vnoise(vec2(az * 12.0, 61.0)) - 0.5) * 0.03);
    float m3 = 1.0 - smoothstep(r3 - 0.004, r3 + 0.008, e);
    float crest3 = smoothstep(r3 - 0.07, r3, e);
    vec3 c3 = vec3(0.020, 0.038, 0.028)
            + uNebulaGlow * (glowField * crest3 * 0.3);
    color = mix(color, c3, m3 * 0.82);

    // Mid range.
    float r1 = 0.032
      + (vnoise(vec2(az * 5.0 + 3.7, 11.0)) - 0.5) * 0.05
      + (vnoise(vec2(az * 13.0, 23.0)) - 0.5) * 0.02;
    float m1 = 1.0 - smoothstep(r1 - 0.003, r1 + 0.007, e);
    float crest1 = smoothstep(r1 - 0.05, r1, e);
    vec3 c1 = vec3(0.016, 0.031, 0.024)
            + uNebulaGlow * (glowField * crest1 * 0.2);
    color = mix(color, c1, m1 * 0.85);

    // Near range — darkest, lowest, barely lit.
    float r2 = 0.016
      + (vnoise(vec2(az * 3.4 + 9.1, 31.0)) - 0.5) * 0.045
      + (vnoise(vec2(az * 9.0 + 4.2, 41.0)) - 0.5) * 0.022;
    float m2 = 1.0 - smoothstep(r2 - 0.003, r2 + 0.007, e);
    float crest2 = smoothstep(r2 - 0.04, r2, e);
    vec3 c2 = vec3(0.010, 0.020, 0.017)
            + uNebulaGlow * (glowField * crest2 * 0.12);
    color = mix(color, c2, m2 * 0.9);
  }

  gl_FragColor = vec4(color, 1.0);
}
`;

export function createSky(): SkyHandle {
  const { colors, heights } = gradientUniforms();
  const stars = SKY.stars;

  // A grid fine enough that the existence probability, rather than the
  // lattice, is what sets the spacing.
  const gridX = 60;
  const gridY = 40;

  const material = new THREE.ShaderMaterial({
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    uniforms: {
      uGradientColor: { value: colors },
      uGradientY: { value: heights },

      uNebulaGlow: { value: new THREE.Color(SKY.nebula.glowColor) },

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
