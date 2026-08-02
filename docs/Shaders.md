# Shaders

Every shader in the project, in full. Nine programs.

| # | Program | File | Vert | Frag |
|---|---|---|---|---|
| 1 | Particles | `scene/elements/particles.ts` | generated | inline |
| 2 | Terrain | `scene/elements/terrain.ts` | inline | inline |
| 3 | Sky | `scene/elements/sky.ts` | inline | inline |
| 4 | Mist | `scene/elements/mist.ts` | inline | inline |
| 5 | Ground glow | `scene/elements/groundGlow.ts` | inline | inline |
| 6 | Trail accumulate | `gl/PostFX.ts` | `VERT` | `TRAIL_ACCUM` |
| 7 | Trail add | `gl/PostFX.ts` | `VERT` | `TRAIL_ADD` |
| 8 | Bloom prefilter / down / up | `gl/PostFX.ts` | `VERT` | 3 shaders |
| 9 | Composite | `gl/PostFX.ts` | `VERT` | `COMPOSITE` |

Plus `CENTRELINE_GLSL`, a shared include (not a program).

---

## 1. Shared: `CENTRELINE_GLSL`

Injected into the particle vertex shader. Provides frame lookups and the guide
curve.

```glsl
uniform sampler2D uFrameTex;
const float FRAME_SAMPLES = 512.0;

vec4 frameRow(float u, float row){
  // Half-texel inset so LinearFilter never bleeds between rows.
  float x = clamp(u, 0.0, 1.0) * (FRAME_SAMPLES - 1.0) / FRAME_SAMPLES
          + 0.5 / FRAME_SAMPLES;
  float y = (row + 0.5) / 4.0;
  return texture2D(uFrameTex, vec2(x, y));
}

vec3 centrelinePos(float u){ return frameRow(u, 0.0).xyz; }
vec3 centrelineTan(float u){ return frameRow(u, 1.0).xyz; }
vec3 centrelineNrm(float u){ return frameRow(u, 2.0).xyz; }
vec3 centrelineBin(float u){ return frameRow(u, 3.0).xyz; }

vec3 guidePoint(float u, float heightAbove, float lateralOffset, float taperStart){
  vec3 p = centrelinePos(u);
  float taper = u < taperStart ? 1.0 : 1.0 - smoothstep(taperStart, 1.0, u);
  vec3 bin = centrelineBin(u);
  float side = bin.z >= 0.0 ? 1.0 : -1.0;
  p.y += heightAbove * taper;
  p += bin * (lateralOffset * taper * side);
  return p;
}
```

`guidePoint` **mirrors `Centreline.guidePoint` on the CPU exactly.** If the two
diverge the river no longer lands on the bridge. Any change to one must be made
to the other.

---

## 2. Particles

### 2.1 Generation

The vertex shader is **assembled from config at runtime** by
`buildVertexShader()`. Constants are interpolated as literals via a formatter
`f(n)`, so `${f(FLIGHT.approachFraction)}` becomes `0.2200` in the source. No
uniform is spent on a value that never changes.

> **Trap:** the shader lives inside a JS template literal. A backtick anywhere in
> a GLSL comment terminates the string. This broke the build three separate times
> during development. Do not write \`identifiers\` in these comments.

Read the generated source at runtime with `window.__particleShader()` (DEV only).

### 2.2 Declarations

```glsl
attribute vec3  aSeed;
attribute vec3  aTarget;
attribute vec3  aSeedNormal;
attribute vec3  aBreatheDir;
attribute float aLiftAt;
attribute float aSeatAt;
attribute vec2  aUR;            // (u, rewindAt) PACKED — see Bridge.md §9
attribute float aRollPhase;
attribute float aRollRadius;
attribute float aRollTurns;
attribute float aSizeVar;
attribute float aSpeedVar;
attribute float aHash;

uniform float uTime;
uniform float uPointScale;
uniform vec3  uCursor;
uniform float uCursorStrength;
uniform float uDisperse;
uniform float uLoop;
uniform float uTrailPass;
uniform vec3  uDisperseOrigin;
uniform float uPulseU;

varying float vBrightness;
varying float vFog;

const float TAU = 6.28318530718;
const float PI  = 3.14159265359;
```

Only **two varyings**. Colour is not interpolated — it is looked up in the
fragment shader from `vBrightness`.

### 2.3 State derivation

```glsl
float aU        = aUR.x;
float aRewindAt = aUR.y;

float t = uTime;                 // already wrapped to one cycle by BridgeScene

float flightSpan  = max(aSeatAt - aLiftAt, 0.0001);
float approachDur = flightSpan * 0.2200;

float returnDur  = 1.5100;
bool isDeparting = uLoop > 0.5 && t >= aRewindAt && t < aRewindAt + returnDur;
bool hasLanded   = uLoop > 0.5 && t >= aRewindAt + returnDur;

bool isDormant     = t <  aLiftAt || hasLanded;
bool isSeated      = t >= aSeatAt && !isDeparting && !hasLanded;
bool isLifting     = !isDormant && !isSeated && !isDeparting && t < aLiftAt + 0.4200;
bool isApproaching = !isDormant && !isSeated && !isDeparting && t >= aSeatAt - approachDur;
```

Three comparisons, **zero memory**, and — critically — computed in the *same
shader invocation* that computes the position. That removes any possibility of a
one-frame lag between a particle seating and its trail stopping. A CPU-side check
running one frame late accumulates a persistent faint blur exactly on the
bridge's shape, and the bridge looks out of focus with no findable cause.

See [`StateMachine.md`](StateMachine.md) for the full transition table.

### 2.4 Branch: DORMANT

```glsl
pos = aSeed;
float rate = aHash < 0.0900 ? 2.0 : 1.0;
brightness = 0.1700
  + sin(t * TAU * 0.1300 * rate + aHash * TAU) * 0.0550;
```

Position is **completely static**. Moving dormant particles would make the ground
look already active, which pre-empts the awakening. They are asleep, and asleep
things do not drift. The shimmer is brightness only.

9% of particles shimmer at double rate, which stops the field pulsing as one.

### 2.5 Branch: LIFTING

```glsl
float e = t - aLiftAt;
pos = aSeed + aSeedNormal * max(26.0 * e - 9.0 * e * e, 0.0);

brightness = mix(0.1700, 0.5500,
                 smoothstep(0.0, 9.5000, distance(pos, aSeed)));
```

Ballistic along the seed normal, decelerating. The `9.0` is a gravity term.

Brightening is a function of **distance from seed, not elapsed time**. A particle
on a steep slope covers less ground in the same time and so brightens more
slowly — which is exactly right, and means the whole field brightens unevenly
following the landscape without anyone authoring it.

### 2.6 Branch: GLIDING / APPROACHING

```glsl
float p = easeInOutCubic(clamp((t - aLiftAt) / flightSpan, 0.0, 1.0));

float u = mix(clamp(aU + 0.10, 0.0, 1.0), aU, p);

vec3 base = guidePoint(u, 74.0, 46.0, 0.7200);

// Barrel roll
float rollFade = smoothstep(0.0, 0.1200, p) * (1.0 - smoothstep(0.7800, 1.0, p));
float theta = aRollPhase + aRollTurns * TAU * p * aSpeedVar;
base += (centrelineNrm(u) * cos(theta) + centrelineBin(u) * sin(theta))
      * aRollRadius * rollFade;

// The peel
float approachP = isApproaching
  ? clamp((t - (aSeatAt - approachDur)) / approachDur, 0.0, 1.0)
  : 0.0;
pos = mix(base, aTarget, smoothstep(0.0, 1.0, approachP));

brightness = isApproaching ? mix(0.9200, 1.0000, approachP) : 0.9200;
```

**The barrel roll radius is ~1% of the width of the stream it lives in**, and
that is deliberate. Tested in isolation a 1u helix looks like nothing and the
instinct is to raise it; at 3–6u the river fragments into traceable strands and
above 8u it is confetti. The roll is never *seen*, only *felt* — as the reason
the river shimmers instead of sliding.

`smoothstep` at both ends of the peel means there is **no corner** where the
particle departs the river. Visually the stream continuously sheds particles from
its underside, concentrated wherever the construction front currently is.

### 2.7 Branch: SEATED

```glsl
pos = aTarget;
float since = t - aSeatAt;

float fade = clamp(since / 0.4000, 0.0, 1.0);
pos += aBreatheDir * sin(t * TAU * 0.2100 + aHash * TAU) * 0.9000 * fade;

float decay = clamp(since / 0.1800, 0.0, 1.0);
brightness = mix(1.0000, 0.7400, decay * decay);
sizeBoost  = mix(1.3500, 1.0, clamp(since / 0.03, 0.0, 1.0));

if (uPulseU >= 0.0) {
  float d = abs(aU - uPulseU) * 1578.1674;
  brightness = mix(brightness, 1.0, 1.0 - smoothstep(0.0, 190.0, d));
}
```

**The snap is one frame at peak, then a decay.** Two or three frames and the
construction front develops a bright leading edge that reads as a scanning beam
sweeping the bridge into existence — a completely different, far more generic
idea.

Breathe phase is scattered by `aHash`. Synchronised breathing makes the whole
bridge swell as one, which is a pulse, and the scene gets exactly one of those.

### 2.8 Branch: DEPARTING (rewind only)

```glsl
float k = clamp((t - aRewindAt) / returnDur, 0.0, 1.0);
float e = 1.0 - (1.0 - k) * (1.0 - k);        // easeOutQuad

pos = mix(aTarget, aSeed, e);
pos += aSeedNormal * sin(k * PI) * 48.0000 * 0.35;
pos.y += sin(k * PI) * 48.0000;

float lift = max(34.0000 * (t - aRewindAt), 0.0);
pos += aSeedNormal * lift * exp(-8.0 * k);

float theta = aRollPhase + aRollTurns * TAU * k * 0.6;
float rollFade = sin(k * PI);
pos += (aSeedNormal * cos(theta)
      + normalize(cross(aSeedNormal, vec3(0.0, 1.0, 0.0001))) * sin(theta))
      * aRollRadius * rollFade;

float flash = 1.0 - smoothstep(0.0, 0.10, k);
brightness = mix(mix(0.7400, 0.1700, smoothstep(0.55, 1.0, k)), 1.0, flash);
sizeBoost  = mix(1.0, 1.3500, flash);
```

`sin(k·π)` peaks at the middle and is exactly zero at both ends, so neither the
departure nor the landing inherits an offset it has to correct for.

`easeOutQuad`, gentler than the assembly's easing: **arriving is an event and
deserves a hard landing; leaving is a decision and does not.**

The return does **not** retrace the outbound path. An exact reversal looks like
video played backwards — the eye catches time-reversed easing immediately, and
the moment it does, these stop being particles going home and become a recording
being scrubbed.

### 2.9 Interaction — Law 4

```glsl
if (!isDormant && uCursorStrength > 0.001) {
  vec3 away = pos - uCursor;
  float d = length(away);
  if (d < 90.0000 && d > 0.0001) {
    float s = 1.0 - smoothstep(26.0000, 90.0000, d);
    vec3 push = (away / d) * s * 30.0000 * uCursorStrength;

    if (isLifting) {
      push -= aSeedNormal * dot(push, aSeedNormal);
    } else if (!isSeated) {
      vec3 travel = normalize(centrelineTan(aU));
      push -= travel * dot(push, travel);
    }

    pos += push;
  }
}
```

**THE CURSOR MAY DEFLECT A PARTICLE. IT MAY NOT STOP ONE.**

A plain radial push has a component along the direction of travel, so a cursor
held in front of an oncoming particle shoves it *backwards down its own path*.
The river visibly stalls under the pointer and then snaps forward when it leaves:
the cursor reads as an obstruction, and the scene stops being something you are
disturbing and becomes something you are obstructing.

Projecting the push onto the plane perpendicular to travel removes exactly that
component and nothing else. Progress along the path is then untouchable **by
construction** — the particle keeps its schedule to the millisecond and steps
sideways around the cursor.

The direction of travel is free here: position is a pure function of time, so
every state already knows the curve it is riding — the guide tangent in flight,
the seed normal on the way up.

**Seated particles are deliberately exempt.** They are structure, not traffic;
there is no progress left to protect, and a bridge that refuses to be pushed
along its own axis feels like it is on rails.

### 2.10 Push-in dispersion

```glsl
if (uDisperse > 0.001 && !isDormant) {
  vec3 dir = centrelineNrm(aU) * cos(aRollPhase)
           + centrelineBin(aU) * sin(aRollPhase);
  float near = 1.0 - smoothstep(0.0, 180.0000, distance(pos, uDisperseOrigin));
  pos += dir * 64.0000 * uDisperse * near * (0.45 + 0.55 * aSizeVar);
}
```

The **one place Law 5 is relaxed**. Everywhere else the silhouette is protected
by construction; here it is meant to come apart, because the gesture is "get
closer" and what you find when you get close to something made of light is that
it was never solid.

Radial about the **centreline**, not random per particle. A random direction
makes the bridge fizz, which reads as noise; expanding outward along the curve's
own frame makes it *bloom*, which reads as the structure loosening.

### 2.11 Output

```glsl
vec4 viewPos = viewMatrix * vec4(pos, 1.0);
float viewDist = -viewPos.z;

vBrightness = clamp(brightness, 0.0, 1.0);
vFog = clamp((viewDist - 420.0000) / 1680.0000, 0.0, 1.0);

gl_Position = projectionMatrix * viewPos;

if (uTrailPass > 0.5 && (isDormant || isSeated || hasLanded)) {
  gl_Position = vec4(2.0, 2.0, 2.0, 1.0);      // outside the clip volume
  gl_PointSize = 0.0;
  return;
}

gl_PointSize = clamp(
  mix(1.1000, 2.9000, vBrightness)
    * aSizeVar * sizeBoost * uPointScale
    * (900.0000 / max(viewDist, 1.0)),
  0.6, 14.0);
```

**Trail suppression moves the vertex outside the clip volume, not to zero size.**
Not all drivers clamp `gl_PointSize` below one — the first version did exactly
that, and the dormant frame, in which every particle is suppressed and nothing
should have changed, still lost a point of near-black and gained a measurable
accent band. Clipping is defined behaviour everywhere; a zero-size point is a
request.

`900.0` is `PARTICLES.sizeAttenuation` — the distance at which a particle renders
at its nominal `sizePx`. **It is a reference distance, not a strength.** It was
`320` for a long time, inherited from a 277-unit world; the bridge now sits
700–1500u away, so `320/1100` shrank every particle to 0.29× nominal and even a
peak-brightness one rendered at 0.85 px, below the point-size floor. Accent
measured 1.6% against a 5% target while peak brightness measured 0.96 — the light
was all there, in far too few pixels to count.

### 2.12 Fragment shader

```glsl
precision highp float;
uniform sampler2D uRamp;
varying float vBrightness;
varying float vFog;

void main(){
  float d = length(gl_PointCoord - vec2(0.5));
  float alpha = 1.0 - smoothstep(0.24, 0.5, d);

  if (alpha <= 0.001) discard;

  vec3 color = texture2D(uRamp, vec2(vBrightness, 0.5)).rgb;

  color *= (1.0 - vFog);          // ADDITIVE FOG

  gl_FragColor = vec4(color * vBrightness, alpha);
}
```

**Procedural round sprite, no texture.** One fetch per particle per frame is real
bandwidth for a shape that is four lines of maths, and the procedural version
stays crisp at any `gl_PointSize`.

**The `discard` matters.** A point sprite is a square and the visible dot is a
circle; without it the transparent corners — about 36% of the quad — still write
to the framebuffer, on the scene's most fill-bound pass.

**ADDITIVE FOG.** Standard fog blends toward the fog colour: `mix(color,
fogColor, f)`. Correct for opaque surfaces and **backwards** for additive ones —
blending toward a non-black colour makes a dense distant region *add* fog colour
and get brighter, so the far end of the bridge glows more than the near end and
the entire depth read inverts. Additive geometry attenuates toward zero instead.

### 2.13 The colour ramp

```ts
PARTICLE_COLOR_RAMP = [
  [0.00, "#16300a"],
  [0.35, "#4aa30c"],
  [0.62, "#7cfc00"],   // the brand
  ...
]
```

Baked into a 256×1 RGBA8 `DataTexture` at init and sampled by **brightness**. A
hot particle is naturally whiter and a cold one deeper green without anyone
authoring a per-state colour. Temperature reads as energy for free.

Dense regions sum past 1.0 under additive blending and clamp toward `limeCore`,
which is why tower legs have white-hot cores that nobody painted.

---

## 3. Terrain

```glsl
// vertex
varying vec3 vWorld;
varying vec3 vNrm;
// standard model→world, passes world position and normal

// fragment
uniform vec3  uBase;         // PALETTE.void
uniform vec3  uRim;          // PALETTE.rim  #41750f
uniform float uRimStrength;  // 0.55
uniform float uRimPower;     // 3.2
uniform vec3  uAmbient;      // moss * ambientIntensity * 0.12
uniform vec3  uKeyColor;
uniform float uKeyIntensity; // 0.03
uniform vec3  uKeyDir;
uniform vec3  uSwarmPos[5];
uniform float uSwarmIntensity;
uniform float uSwarmRange;   // 260
uniform float uSwarmDecay;   // 2
uniform float uSwarmClamp;   // 0.18
uniform vec3  uSwarmColor;   // limeBright
uniform int   uSwarmCount;
uniform vec3  uFogColor;
uniform float uFogNear, uFogFar;

void main(){
  vec3 n = normalize(vNrm);
  vec3 viewDir = normalize(cameraPosition - vWorld);

  vec3 color = uBase;
  color += uAmbient;
  color += uKeyColor * uKeyIntensity * max(dot(n, normalize(uKeyDir)), 0.0);

  float rim = pow(1.0 - abs(dot(n, viewDir)), uRimPower);
  color += uRim * rim * uRimStrength;

  float swarm = 0.0;
  for (int i = 0; i < 5; i++) {
    if (i >= uSwarmCount) break;
    float x = clamp(distance(vWorld, uSwarmPos[i]) / uSwarmRange, 0.0, 1.0);
    swarm += pow(1.0 - x * x, uSwarmDecay);
  }
  color += uSwarmColor * min(swarm * uSwarmIntensity, uSwarmClamp);

  float fog = clamp((distance(cameraPosition, vWorld) - uFogNear)
                  / (uFogFar - uFogNear), 0.0, 1.0);
  color = mix(color, uFogColor, fog);          // OPAQUE fog — mix, not attenuate
  gl_FragColor = vec4(color, 1.0);
}
```

### The windowed swarm falloff

The original was `1.0 / (1.0 + d*d)` with `distance` as a scale factor — **a
curve that never reaches zero.** Swarm-lit terrain is deep-band by definition
(the light's colour has luminance 0.87), so the question is not how bright the
light is but how far its tail stays above the 0.058 band edge:

```
0.87 · falloff · intensity < 0.058  →  falloff < 0.19  →  d > 310u
```

Five lights over a 1,624u bridge sit **325u** apart. Every light reached every
other light's territory: a flat valley-wide wash measured at 25 points of deep
against a 10-point budget — while the comment in `config.ts` claimed in detail
that the pools were discrete.

`(1 - x²)^decay` keeps the same near-field shape and terminates exactly at
`range`. This one change moved `awakening` from 74.4% near-black to 89.5% and
`glide` from 61.0% to 77.0%.

---

## 4. Sky

**One fullscreen quad, no geometry, no dome.**

```glsl
// vertex
void main() {
  vNdc = position.xy;
  gl_Position = vec4(position.xy, 1.0, 1.0);   // pinned to the far plane
}
```

`z = w = 1` puts the quad exactly on the far plane, so anything with real depth
draws in front of it without a depth test being needed at all.

```glsl
// fragment — the view ray
vec4 far = uInvViewProj * vec4(vNdc, 1.0, 1.0);
vec3 dir = normalize(far.xyz / far.w - uCameraPos);
float elev = max(dir.y, 0.0);
```

**Elevation, not screen height.** The pack specifies screen height with 0 at the
horizon, which is the same thing for a fixed camera and stops being the same
thing the moment the camera pitches. Elevation costs one normalise and is right
in both cases.

### Gradient

```glsl
vec3 color = uGradientColor[0];
for (int i = 1; i < 4; i++) {
  float t = smoothstep(uGradientY[i - 1], uGradientY[i], elev);
  color = mix(color, uGradientColor[i], t);
}
```

```ts
gradient: [
  { y: 0.000, color: "#0e1626" },   // horizon
  { y: 0.025, color: "#080c17" },
  { y: 0.100, color: "#05070e" },
  { y: 0.450, color: "#02030a" },   // zenith — the darkest thing in the frame
]
```

The horizon is **brighter than the pack asked for and spread over a twentieth of
the height.** The pack's `#0C1220` is luminance 0.0695 against a near-black band
edge of 0.0580 — above its own ceiling — and ramped across 30% of the sky it put
~16% of the frame into the deep band on its own.

The resolution is not a darker horizon but a **narrower** one. *A silhouette is
an edge, and an edge needs one bright pixel behind it, not a thousand.* `#0E1626`
is 0.0841 but has decayed under the band edge within about 0.9° of the horizon,
so the whole glow costs around 2% of the frame instead of 16%. This is what makes
the mountains read as mountains.

### Nebula

Three octaves of scrolling value noise, masked to the upper right — diagonally
opposite the headline, and directly behind where the far end of the bridge
assembles.

```glsl
vec2 flow = uNebulaDrift * uTime * 0.004;
float turb = sin(uTime / uNebulaTurbulence * 6.2831853) * 0.35;

float n = 0.0, amp = 0.0;
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

float density = n * n * mask;        // SQUARED: dense core, long soft edge
color += uNebulaColor * (density * uNebulaOpacity);
```

Octaves `[1.0, 1.00], [2.3, 0.46], [5.1, 0.19]`. Colour `--moss #1d3a0a`, peak
opacity 0.30 → maximum luminance ~0.03, far below the 0.62 bloom threshold.

Drift is 0.6 u/s — about 0.7 world units across the whole of Phase 0,
imperceptible, and meant to be. **Its job is not to be seen moving. Its job is
that no two frames are identical**, which the eye detects even when it cannot
name it. A perfectly static sky reads as a photograph.

### Stars

Screen-space, camera-locked, per the pack. One hash per cell decides whether a
star exists at all, so the field is sparse and irregular rather than a jittered
lattice.

```glsl
vec2 grid = sxy * uStarGrid;        // 60 × 40 = 2400 cells
vec2 cell = floor(grid);
vec2 frac = fract(grid);

float exists = hash21(cell + 11.7);
if (exists < uStarProbability) {    // 900 / 2400 = 0.375
  vec2 jitter = hash22(cell * 1.37);
  float r = hash21(cell + 3.1);

  vec2 cellPx = uResolution / uStarGrid;
  float dPx = length((frac - jitter) * cellPx);      // PIXELS, not cell units

  float sizePx = mix(uStarSize.x, uStarSize.y, r);   // 0.7 – 1.6
  float core = 1.0 - smoothstep(0.0, sizePx, dPx);

  float period = mix(3.0, 11.0, hash21(cell + 7.3));
  float phase  = hash21(cell + 19.4) * TAU;
  float tw = 1.0 + 0.28 * sin(uTime / period * TAU + phase);

  float bright = mix(0.10, 0.34, r * r) * tw;
  float fade = 1.0 - smoothstep(0.42, 0.86, sxy.y);
  color += vec3(bright * core * fade);
}
```

Peak star brightness 0.34, comfortably under the 0.62 bloom threshold.
**Nothing in the sky ever blooms.** Sky, stars, nebula, horizon: all under it, all
deliberately. Only particles glow.

Twinkle periods spread across 3–11 s and phase-scattered: with periods clustered
around one value the starfield develops a visible collective rhythm within a
minute.

### Value noise (used by sky and mist)

```glsl
float hash21(vec2 p) {
  vec3 q = fract(vec3(p.xyx) * 0.1031);
  q += dot(q, q.yzx + 33.33);
  return fract((q.x + q.y) * q.z);
}

float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash21(i),               hash21(i + vec2(1,0)), u.x),
             mix(hash21(i + vec2(0,1)),   hash21(i + vec2(1,1)), u.x), u.y);
}
```

Plain smoothstep-interpolated value noise. **Not simplex, not curl.** A full
simplex implementation exists in `src/gl/glsl.ts` and is imported by nothing.

---

## 5. Mist

```glsl
if (vDensity <= 0.001) discard;

vec2 p = vPlane * 0.0042;
float t = uTime * uDriftSpeed * 0.001;
float turb = sin(uTime / uTurbulence * TAU) * 0.25;

float n = vnoise(p + vec2(t, turb * 0.4)) * 0.68
        + vnoise(p * 2.7 - vec2(t * 0.6, t * 0.35)) * 0.32;

vec3 viewDir = normalize(cameraPosition - vWorld);
float graze = 1.0 - abs(viewDir.y);
float thickness = mix(0.35, 1.0, graze * graze);

float dist = length(cameraPosition - vWorld);
float far = 1.0 - smoothstep(uFogNear * 2.5, uFogFar, dist);

float alpha = vDensity * n * thickness * far * uOpacity;
gl_FragColor = vec4(uColor * alpha, alpha);
```

Two octaves drifting in **different directions**, so the pattern shears rather
than sliding. A sheet that translates rigidly reads as a moving texture; one that
shears reads as air.

**Grazing-angle thickening** is the whole reason low mist reads as depth: looking
along the sheet you see through more of it than looking down at it, so the far
valley is denser than the near ground for free.

`vDensity` is a **per-vertex** attribute computed on the CPU from the real
heightfield — `1 - smoothstep(h, floor, ceiling)` — never a second copy of the
terrain noise. A duplicated heightfield is one that will eventually disagree with
the one it is copying, and mist that pools where there is no hollow is worse than
no mist.

---

## 6. Trail accumulator

```glsl
// TRAIL_ACCUM
vec3 previous = texture2D(tPrevious, vUv).rgb * uDecay;
vec3 current  = texture2D(tCurrent,  vUv).rgb;
gl_FragColor = vec4(min(previous + current, vec3(1.0)), 1.0);
```

**The clamp is what made the feature free.** Unclamped, a pixel the river crosses
slowly — the far end, where perspective compresses the stream — receives
contribution after contribution and converges on `1/(1-decay)` = **8.3×**. Those
regions saturate to white, the green goes out of them, and the river reads as a
solid bar of light rather than as particles.

With the clamp, `glide` measures 84.6% near-black: **identical to the same frame
with trails switched off.** The blow-out was the entire cost of the effect.

The fade is a *multiply*, not a subtract. A linear fade gives every trail the
same length regardless of how bright its particle was, which reads as a ribbon
dragged behind the river rather than as light dying away.

```glsl
// TRAIL_ADD
gl_FragColor = vec4(texture2D(tSource, vUv).rgb * uStrength, 1.0);
```

`uStrength = 0.35`, well under 1 because the particles are drawn again in full on
top of their own smear.

---

## 7. Bloom chain

### Prefilter (soft knee)

```glsl
float brightness = max(c.r, max(c.g, c.b));
float soft = clamp(brightness - uThreshold.x + uThreshold.y, 0.0, uThreshold.z);
soft = soft * soft / (4.0 * uThreshold.y + 0.0001);
float contribution = max(soft, brightness - uThreshold.x) / max(brightness, 0.0001);
gl_FragColor = vec4(c * contribution, 1.0);
```

Threshold 0.62, knee `t * 0.6`. Terrain peaks around 0.09 (0.27 with the swarm),
stars at 0.34, dormant particles at 0.17 — **none of them cross it. Only
particles bloom.**

### Downsample — 13-tap Karis box

```
       a   b   c
         j   k
       d   e   f
         l   m
       g   h   i

result  = e·0.125
        + (a+c+g+i)·0.03125
        + (b+d+f+h)·0.0625
        + (j+k+l+m)·0.125
```

### Upsample — 3×3 tent

```
1 2 1
2 4 2   / 16,   spread by uTexel * uRadius
1 2 1
```

### Mip depth is the real lever

`POSTFX.bloom.mips = 3`, measured **down** from 5 — and it was 5 only because the
field was declared in config and never read, so PostFX used its own default.

Each level halves the resolution the glow is reconstructed from, so five levels
throw light from one bright particle across roughly 32 pixels. With 140,000 in
flight the union of those throws became a faint wash over the middle third of the
frame.

`bloom.radius` is the trap: it reads like the halo's size and is not. Sweeping it
0.42 → 0.10 moved the ratio by **under half a point**.

> **The general rule.** The colour rule counts PIXELS IN A BAND and is indifferent
> to how bright a pixel is once it has crossed an edge. So every parameter that
> sets an AREA is expensive and every parameter that sets a BRIGHTNESS is cheap.
> `mips` vs `strength`; `rimPower` vs `rimStrength`; `swarmRange` vs
> `swarmIntensity`; `sizeAttenuation` vs `PARTICLES.brightness`.

---

## 8. Composite

The final pass, in order:

```glsl
1.  depth → linearDepth → circle of confusion → blurRadius
2.  chromatic aberration offset = centered * uAberration * r²
3.  R, G, B sampled at +offset, 0, −offset through sampleDefocused()
4.  color = scene + bloom * uBloomStrength
5.  color *= uExposure
6.  color = acesFilm(color)            ← Narkowicz 2015 ACES approximation
7.  color = toSRGB(color)
8.  color *= 1 - uVignette * smoothstep(0.15, 0.75, r²)
9.  color += (hash12(fragCoord + uTime*60) - 0.5) * uGrain
10. color += (hash12(...131) - hash12(...71)) / 255.0     ← triangular dither
11. gl_FragColor = vec4(color * uFade, 1.0)
```

### ACES, not Reinhard

```glsl
vec3 acesFilm(vec3 x){
  const float a = 2.51, b = 0.03, c = 2.43, d = 0.59, e = 0.14;
  return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
}
```

One multiply-add richer than Reinhard and it keeps saturated greens from clipping
to white at the bloom cores — which matters enormously on a monochrome-green
palette where every bright thing is the same hue.

### Vignette after encoding

Applied *after* `toSRGB` so it reads as a lens property rather than as a change
in scene lighting.

### Aberration is radial and centre-free

`centered * uAberration * r²` — strongest at the frame edge, absent at centre,
which is where the headline sits. **Text never smears.** Value 0.0008, near zero:
radial aberration on a point cloud fringes every isolated speck red and blue near
the edge and the scene turns into coloured confetti.

### Depth of field is OFF

`defocus: 0`. `uFocusDistance` and `uMaxBlur` were tuned for a 277-unit world; the
bridge now sits 700–1500u away so everything was blurred. Measured as an 18%
mid-tone wash that read convincingly as bloom.

The six-tap ring is retained but `sampleDefocused` early-outs at `radius < 0.35`,
so with `uMaxBlur = 0` it is a single texture fetch.

### Triangular dither

Two independent hash samples subtracted give a triangular distribution rather
than a uniform one, which removes the residual banding a single sample leaves
behind. Because it changes every frame the eye integrates it away entirely, so
the noise floor costs nothing visually. This matters on a palette that is almost
entirely large dark gradients, where 8-bit output falls apart.
