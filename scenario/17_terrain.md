# 17 — TERRAIN

**The valley. Built geometry, never particles.**

---

## 17.1 Law 1, restated

> **The world is not made of particles. Only the bridge is.**

The terrain, the hills, the ridgelines, the mountains: all **solid built
geometry**, present at full quality from `T+0.000`, unchanged for the entire
scene.

Particles rest *on* the terrain in Phase 0. They are not *of* it.

### The test

Disable the particle system entirely. You should still see a complete,
believable, well-composed dark valley — a finished environment that happens to
have nothing in it.

If disabling particles leaves a blank frame, Law 1 has been broken and the whole
premise collapses: a place that is itself made of specks cannot be *transformed*
by specks, because nothing is being changed into anything.

`npm run reveal-check` renders exactly this control frame and diffs against it.

---

## 17.2 It is not a flat plane

The client was explicit: the ground is **a real, undulating, mountainous
environment** — not a plane with mountains sitting on it.

Practically this means:

- Height varies **everywhere**, including under the bridge and in the far
  distance
- There is no visible "ground plane" horizon line — the horizon is a *ridgeline*
- Slopes range from flat valley floor to near-cliff on the framing ridges
- Detail exists at five scales, so the terrain reads correctly at any distance

---

## 17.3 Construction

A **heightfield**: a grid of height samples over the XZ plane.

```ts
TERRAIN = {
  segmentsX: 384,
  segmentsZ: 384,
}
```

`384 × 384` = 147,456 vertices, 294,912 triangles across an 1800 × 1800 unit
area — a sample every **4.7 world units**.

> **Why a heightfield and not arbitrary geometry:** it is cheap, it is trivially
> queryable (given `(x, z)` you get `y` in constant time, which the particle
> seeding needs 140,000 times at init), and it cannot produce overhangs — which
> this landscape does not want.

### The noise stack

Five octaves of value noise, summed.

```ts
TERRAIN.octaves = [
  [0.00042, 148],   // continental — the big ridgelines
  [0.00120,  62],   // hills
  [0.00380,  19],   // undulation
  [0.01100,   6.5], // surface roughness
  [0.03400,   1.8], // micro detail
]
```

Each entry is `[frequency, amplitude]`.

| Octave | Wavelength | Amplitude | What it produces |
|---|---|---|---|
| 1 | ~2380u | 148u | The overall shape of the valley — where it is high, where it is low |
| 2 | ~830u | 62u | Individual hills |
| 3 | ~263u | 19u | Undulation across a hillside |
| 4 | ~91u | 6.5u | Surface roughness — visible on near terrain |
| 5 | ~29u | 1.8u | Micro detail — breaks up silhouettes so ridgelines are not smooth |

**Total possible height range:** ±237u, though in practice the octaves rarely
align and the real range is about ±150u.

### Why the fifth octave matters more than it looks

At `1.8u` amplitude, octave 5 is invisible on any surface. Its entire job is
**silhouettes**.

The terrain is read almost entirely from rim light along ridgelines. A ridgeline
built from four octaves is a smooth mathematical curve, and it looks it. Octave
5 adds a 1.8u wobble at ~29u wavelength, which turns that smooth curve into a
ragged edge — and ragged edges read as rock.

> **Trap:** octave 5 is the first thing dropped when someone optimises the noise
> function, because it "contributes almost nothing to the height". It
> contributes almost nothing to the *height* and almost everything to the
> *silhouette*, which is the only thing anyone sees.

### Determinism

The noise is seeded with a **fixed constant**. The terrain is identical on every
page load, on every device, forever.

This is non-negotiable: the reference frame was authored against one specific
landscape, and the framing constraints in [`16_world_map.md`](16_world_map.md)
§16.6 were verified against it. A landscape that varies per load cannot be
composed.

---

## 17.4 The bridge corridor — Law 2 made mechanical

> **"The bridge should never feel placed inside the world. The world should feel
> like it evolved around the bridge."**

The terrain is generated from noise, and then the ground **beneath the bridge's
path is pushed down**.

```ts
TERRAIN.corridor = {
  halfWidth: 210,      // affected distance either side of the centreline
  depth: 132,          // maximum carve at the centre
  falloffExp: 2.4,     // smoothstep exponent from centre to edge
}
```

### The carve function

```
d = distance from (x, z) to the nearest point on the bridge centreline

if d >= halfWidth:
    carve = 0
else:
    t = d / halfWidth                       // 0 at centre, 1 at edge
    carve = depth × pow(1 − smoothstep(0, 1, t), falloffExp)

height = noiseHeight − carve
```

```
Cross-section across the corridor:

    ▔▔▔╲                                        ╱▔▔▔
        ╲                                      ╱
         ╲__                                __╱
            ╲___                        ___╱
                ╲_____              ____╱
                      ╲____________╱          ← 132u below the noise surface
    ├────210u────┤              ├────210u────┤
                 ├─── centreline ───┤
```

### Why this is the most important twelve lines in the terrain

Without the carve, you get a bridge over terrain that did not need bridging — a
3D asset dropped onto a landscape. No amount of lighting fixes it, and everybody
can tell, even people who cannot say why.

With the carve, the valley exists **because** the bridge crosses there. The gap
is the reason the bridge is there at all.

> Nobody consciously notices the corridor. Everybody notices its absence.

### Second-order effects

The carve also does three useful things nobody planned:

**It creates the mist basin.** The carved corridor is the lowest ground in the
scene, so `WORLD.mistPlaneY` = 6 pools exactly along the bridge's line. The haze
under the bridge in the reference frame is a free consequence.

**It sets pier heights.** Piers extend from the deck underside down to terrain
height at their position — which the carve makes deeper near the centreline. Tall
piers in the middle of the span, short ones at the abutments. Correct, and
authored by nobody.

**It shapes the particle seed distribution.** `SEED.downhillBias` = 0.42 makes
seeds settle toward locally lower ground, and the lowest ground is the corridor.
The dormant particle density concentrating along the bridge's footprint —
described in [`09_phase_0_dormant.md`](09_phase_0_dormant.md) §9.5 — partly
falls out of the carve for free.

---

## 17.5 Framing ridges

Three explicit landforms, placed for composition rather than generated.

```ts
TERRAIN.framingRidges = [
  { centre: [ 640, 0, -560], radius: 420, height: 196 },
  { centre: [ 880, 0, -980], radius: 520, height: 244 },
  { centre: [-760, 0, -300], radius: 380, height: 128 },
]
```

Each is a smooth radial bump added on top of the noise.

```
height += ridge.height × pow(1 − smoothstep(0, ridge.radius, distanceTo(centre)), 2.0)
```

| Ridge | Screen position | Job |
|---|---|---|
| `(640, 0, −560)` | `x 84–100%`, `y 60–85%` | **Sits behind the far tower.** The most defined silhouette in the frame; gives the far end something to read against. |
| `(880, 0, −980)` | Behind and right of the above | Layered depth. Two overlapping ridges at different fog depths is what makes the right side feel deep rather than flat. |
| `(-760, 0, −300)` | `x 0–20%`, `y 72–88%` | Barely visible. Stops the left side dissolving into pure black under the scrim. |

> **Trap:** the third ridge is nearly invisible and gets deleted as "not doing
> anything". It is doing something: without it, the left third of the frame has
> no depth information at all and the scrim reads as a flat black rectangle
> rather than as a dark part of a landscape.

---

## 17.6 Material

```ts
TERRAIN.material = {
  baseColor: '#0B0F18',
  roughness: 0.94,
  metalness: 0.0,
  rimColor: '#41750F',
  rimStrength: 0.34,
  rimPower: 3.2,
}
```

### The terrain is essentially pure black

`#0B0F18` has a luminance of about **0.008**. Against a page background of
`#040610`, the terrain's own albedo is almost indistinguishable from nothing.

**The shape is read entirely from rim light.**

```glsl
float rim = pow(1.0 - abs(dot(normal, viewDir)), rimPower);
vec3 color = baseColor + rimColor * rim * rimStrength;
```

Where a surface turns away from the camera — along a ridgeline, at the edge of a
silhouette — `dot(normal, viewDir)` approaches zero and the rim term rises.

| `rimPower` | Result |
|---|---|
| 1.5 | Broad, soft glow across whole hillsides. Reads as fog, not as edges. |
| **3.2** | **A tight edge, a few pixels wide, following each ridgeline.** |
| 6.0 | Almost nothing survives. The terrain disappears. |

At `3.2` and `rimStrength 0.34`, the brightest terrain pixel reaches a luminance
of about **0.09** — which sits comfortably below `POSTFX.bloom.threshold` of
0.62.

> **This separation is deliberate and load-bearing:** the terrain never glows.
> Only particles glow. That is what keeps the landscape reading as solid matter
> next to objects made of light. If terrain ever crosses the bloom threshold,
> the two categories merge and the scene loses its most basic visual distinction.

### No textures

No albedo map, no normal map, no roughness map. The terrain is a solid colour
plus a rim term plus the swarm-light contribution.

At this darkness, texture detail is invisible, and the noise's octave 5 already
provides all the surface variation that reads.

---

## 17.7 Swarm light response

The one dynamic lighting the terrain receives.

```ts
LIGHTING.swarmLights = {
  count: 5,
  color: '#A6FD3F',
  intensityMax: 0.35,
  distance: 320,
  decay: 2,
  terrainClamp: 0.18,
}
```

### The clamp is enforced in the shader

```glsl
float swarmContribution = /* accumulate five point lights */;
swarmContribution = min(swarmContribution, TERRAIN_SWARM_CLAMP);  // 0.18
```

Not a post-hoc adjustment. A hard ceiling.

**Why:** when the river passes close to a ridge, an unclamped inverse-square
falloff produces a bright hotspot — a spotlight sliding across the mountain.
That reads as a light being shone at the landscape, which introduces an external
agent into a story that has none.

Clamped, the ridge brightens *up to a point* and no further, so the light reads
as ambient spill rather than as illumination from a source.

### The restraint test

> A viewer must not be able to identify the moment the mountains became visible.
> They should only be able to say, in retrospect, that they can see more of the
> valley than they could at the start.

Check `npm run palette` at the `awakening` and `glide` captures. If the deep
green band exceeds ~9%, the swarm lights are too strong.

---

## 17.8 Particle seeding on the terrain

How 140,000 dormant particles are placed. Full spec in
[`09_phase_0_dormant.md`](09_phase_0_dormant.md) §9.5; the terrain-side
requirements:

```ts
SEED = {
  scatterRadius: 86,
  downhillBias: 0.42,
  surfaceOffset: [0.15, 0.55],
  maxSlopeDeg: 46,
}
```

### What the terrain module must provide

```ts
heightAt(x: number, z: number): number
normalAt(x: number, z: number): Vector3
slopeAt(x: number, z: number): number      // degrees from horizontal
```

All three are queried once per particle at initialisation — 140,000 times — so
they must be **direct heightfield lookups with bilinear interpolation**, not
re-evaluations of the noise stack.

> Re-running five octaves of noise 140,000 times at startup costs roughly 400ms
> on a mid-range laptop, which is a visible hitch before the scene begins.
> Sampling the already-built heightfield costs about 6ms.

### The slope rejection

`maxSlopeDeg: 46`. A particle whose candidate seed lands on steeper ground is
re-rolled, up to eight attempts, then falls back to the nearest valid point.

**Why:** particles on a near-vertical cliff face look *stuck to* it rather than
*resting on* it, and when they lift they appear to peel off a wall.

### The surface offset

`[0.15, 0.55]` world units above the surface, randomised per particle.

- **At 0**, particles z-fight with the terrain and flicker
- **Above ~1.5u**, they visibly hover, and the "seeds lying in soil" reading is
  lost

The window is narrow because both failure modes are close.

---

## 17.9 Level of detail

The terrain is 294,912 triangles, which is fine on desktop and not fine on a
four-year-old phone.

```ts
PERF.degradation includes 'terrainSegments'    // 384 → 256 → 160
```

| Tier | Segments | Triangles | Sample spacing |
|---|---|---|---|
| `ultra` / `high` | 384 | 294,912 | 4.7u |
| `medium` | 256 | 131,072 | 7.0u |
| `low` / `minimal` | 160 | 51,200 | 11.3u |

### What is lost

At 160 segments the sample spacing (11.3u) is larger than octave 5's wavelength
(29u) can properly resolve, so ridgeline raggedness smooths out. The mountains
read slightly more like CG and slightly less like rock.

Acceptable. The alternative — cutting particles instead — costs the bridge, and
the bridge is the point.

> **Terrain LOD must be chosen at initialisation and never changed at runtime.**
> Rebuilding a heightfield mid-scene means re-seeding every particle, because
> their seed positions were sampled from the old surface. Tier changes affect
> terrain only on reload.
>
> This is an exception to the adaptive-tier system in
> [`34_performance_budget.md`](34_performance_budget.md), and it is listed there.

---

## 17.10 The mist plane

```ts
WORLD.mistPlaneY = 6
```

A single horizontal plane at `Y = 6`, just above the valley floor. Rendered with
a soft depth-fade so it dissolves where terrain intersects it.

| Property | Value |
|---|---|
| Colour | `--ink` `#070A13` with a faint `--moss` tint |
| Opacity | 0.42 at maximum thickness, fading to 0 within 14u of an intersection |
| Movement | Very slow drift, 0.3 u/s |

**It is not water.** It never reflects, never ripples, never mirrors the bridge.
A reflection would double the fill-rate cost and imply a lake, which changes what
the valley is.

Because the corridor carve makes the bridge's line the lowest ground, the mist
pools exactly along it — producing the soft glow-catching haze visible beneath
the bridge in the reference frame.

---

## 17.11 Failure modes

**1 · Terrain made of particles.**
Law 1. Symptom: disabling the particle system leaves a blank frame.

**2 · No corridor carve.**
Symptom: the bridge looks placed. Reviewers say "it looks CG" and cannot say
why.

**3 · Terrain crossing the bloom threshold.**
`rimStrength` too high. Symptom: the mountains glow, and the distinction between
solid matter and light dissolves.

**4 · Non-deterministic noise seed.**
Symptom: the landscape differs between loads, and no framing constraint can be
verified.

**5 · Octave 5 removed as an optimisation.**
Symptom: ridgelines become smooth curves. Reads as mathematical.

**6 · Seeds sampling the noise instead of the heightfield.**
Symptom: a ~400ms hitch before the scene starts.

**7 · Terrain LOD changing at runtime.**
Symptom: particles detach from the ground, or sink into it, because their seeds
were sampled from a surface that no longer exists.

**8 · The third framing ridge deleted.**
Symptom: the left third of the frame becomes a flat black rectangle.

**9 · Mist plane reflecting.**
Symptom: a mirrored bridge in the valley floor. Implies water.

---

## 17.12 Checklist

- [ ] Terrain is built geometry. Disabling particles leaves a complete valley.
- [ ] Five noise octaves, including the 1.8u micro-detail octave.
- [ ] Ridgeline silhouettes are ragged, not smooth.
- [ ] Noise seed is a fixed constant; the landscape is identical every load.
- [ ] The corridor carve is applied: 132u deep, 210u half-width, exponent 2.4.
- [ ] All three framing ridges are present, including the faint left one.
- [ ] Terrain albedo is near-black; shape is read from rim light only.
- [ ] Peak terrain luminance (~0.09) stays **below** the bloom threshold
      (0.62). The terrain never glows.
- [ ] Swarm light contribution to terrain is clamped at 0.18 **in the shader**.
- [ ] No terrain textures — no albedo, normal, or roughness maps.
- [ ] Terrain exposes `heightAt` / `normalAt` / `slopeAt` as heightfield
      lookups, not noise re-evaluations.
- [ ] No particle is seeded on a slope steeper than 46°.
- [ ] Particle surface offset is 0.15–0.55u — no z-fighting, no hovering.
- [ ] Terrain LOD is fixed at initialisation and never changes at runtime.
- [ ] Mist plane at `Y = 6`, non-reflective, depth-faded at intersections.

---

**Next:** [`18_sky_and_atmosphere.md`](18_sky_and_atmosphere.md) — everything
above the horizon.
