# Bridge

How the bridge's geometry is produced. There is no mesh, no model file, and no
imported asset. The bridge is a **list of 82,599 world positions** generated at
load time, which the particle system then flies particles into.

Read [`Architecture.md`](Architecture.md) first.

---

## 1. Overview

```
BRIDGE.centreline (5 control points)
        │
        ▼
  CatmullRomCurve3 (centripetal)
        │
        ├──► arc-length table (2048 samples)  ──►  u ∈ [0,1] is NORMALISED ARC LENGTH
        │
        ├──► parallel-transport frames (512)  ──►  512×4 RGBA32F DataTexture
        │
        └──► buildTargets(nominal, heightAt)
                  │
                  ├─ buildPiers      8%   ──┐
                  ├─ buildTowers    14%     │
                  ├─ buildDeck      34%     ├──► SeparationGrid dedup (0.35u)
                  ├─ buildCables    16%     │
                  ├─ buildHangers   20%     │
                  └─ buildRailing    8%   ──┘
                                              │
                                              ▼
                                     TargetCloud { position, u, layer, count }
                                              │
                                              ▼
                                     createParticles(targets, terrain)
```

---

## 2. `u` — the most important symbol in the project

`u ∈ [0, 1]` is **normalised arc length** along the centreline.

- `u = 0.0` — near end, closest to camera, running off the bottom-left of frame
- `u = 1.0` — far end, vanishing toward the right horizon

Assembly runs `u = 1 → 0` (far to near). Rewind runs `u = 0 → 1`.

**It is never the raw spline parameter `t`.** A Catmull-Rom curve's parameter is
not proportional to distance; on control points spaced 284u to 469u apart the
discrepancy is large enough that particles would visibly bunch. Every `u` in this
codebase has been through the arc-length table.

Not to be confused with world units, which appear in prose as a numeric suffix
(`90u`) and never as a bare `u` in code.

---

## 3. The centreline

### 3.1 Control points

```ts
BRIDGE.centreline = [
  { u: 0.00, p: [-520, 34,  300] },
  { u: 0.18, p: [-300, 38,  120] },
  { u: 0.41, p: [ -60, 42, -160] },   // MAIN TOWER base
  { u: 0.71, p: [ 240, 46, -520] },   // FAR TOWER base
  { u: 1.00, p: [ 520, 50, -880] },
]
BRIDGE.arcLength = 1624          // derived, cached; recompute if points change
```

The bridge climbs 16 units over 1,624 — a 1% grade. It runs from lower-left-near
to upper-right-far, so it recedes diagonally across the frame.

### 3.2 Curve type

```ts
new THREE.CatmullRomCurve3(points, /* closed */ false, "centripetal", 0.5)
```

**`centripetal`, not `catmullrom`.** The uniform parameterisation produces cusps
and overshoot on unevenly spaced control points, and ours are spaced 284u to 469u
apart. Centripetal is provably cusp-free and self-intersection-free.

### 3.3 Arc-length table

`ARC_SAMPLES` cumulative distances over evenly-spaced `t`. Lookup from `u` to `t`
is a **binary search** over the table followed by linear interpolation within the
bracketing pair. `uAtDistance(d)` is the same search in world units.

### 3.4 Parallel-transport frames

Every particle needs a local coordinate frame — a normal and a binormal — to
place itself off the centreline (barrel roll radius, cable lateral offset, deck
width, railing position).

The naive answer is the Frenet frame, `normal = normalize(d²P/dt²)`. It has a
singularity wherever curvature reaches zero — i.e. wherever the curve is locally
straight — and the frame flips 180° through it. Our centreline has near-straight
sections. Every particle riding through one would snap to the other side of the
bridge in a single frame.

So: **rotation-minimising frames by double reflection** (Wang et al.,
*Computation of Rotation Minimizing Frames*).

```
seed = the world axis the first tangent is LEAST aligned with
       (keeps the first cross product well-conditioned)
n₀   = normalize(cross(t₀, seed))
b₀   = normalize(cross(t₀, n₀))

for i = 1 .. N-1:
    a  = P[i] - P[i-1]
    c1 = a·a
    nL = n[i-1] - (2/c1)(a·n[i-1]) a          ← reflect across the position bisector
    tL = t[i-1] - (2/c1)(a·t[i-1]) a
    b  = t[i] - tL
    c2 = b·b
    n[i] = normalize( nL - (2/c2)(b·nL) b )   ← reflect across the tangent bisector
    b[i] = normalize( cross(t[i], n[i]) )
```

Degenerate cases (`c1 < 1e-12`, `c2 < 1e-12`) carry the previous frame forward.

Computed **once at init**, because the curve never changes.

### 3.5 The frame texture

`FRAME_SAMPLES = 512`. Baked into a **512 × 4 RGBA32F `DataTexture`**:

| row | contents |
|---|---|
| 0 | position |
| 1 | tangent |
| 2 | normal |
| 3 | binormal |

Sampled in the vertex shader with a half-texel inset so `LinearFilter` never
bleeds between rows:

```glsl
vec4 frameRow(float u, float row){
  float x = clamp(u, 0.0, 1.0) * (FRAME_SAMPLES - 1.0) / FRAME_SAMPLES
          + 0.5 / FRAME_SAMPLES;
  float y = (row + 0.5) / 4.0;
  return texture2D(uFrameTex, vec2(x, y));
}
```

Four texture fetches per particle per frame. The alternative — reconstructing the
frame in the shader — reintroduces exactly the singularity this whole module
exists to avoid.

### 3.6 Public API (`centreline` singleton)

| Method | Returns |
|---|---|
| `positionAt(u, out?)` | World position |
| `tangentAt(u, out?)` | Unit tangent |
| `frameAt(u)` | `{ normal, binormal }` |
| `uAtDistance(d)` | `u` for a world distance along the curve |
| `nearestU(p)` | Closest `u` to an arbitrary world point |
| `distanceSqTo(p)` | Squared distance to the curve |
| `cableRise(u)` | Main-cable height (see §5) |
| `deckY(u)` | Deck surface height including camber |
| `guidePoint(u, h, lat, taper, out?)` | The flight guide curve (see §7) |
| `buildFrameTexture()` | The 512×4 DataTexture |
| `arcLength` | `1624` |

Plus `CENTRELINE_GLSL`, a shader string exposing `centrelinePos/Tan/Nrm/Bin` and
a GLSL `guidePoint` that **mirrors the CPU implementation exactly**. The two must
agree or the river will not land on the bridge.

---

## 4. Sections

The bridge is **not uniformly a suspension bridge.**

```ts
sections: {
  nearApproach: [0.00, 0.34],
  mainSpan:     [0.34, 0.82],
  farApproach:  [0.82, 1.00],
}
```

Only the main span has cables and hangers. The near and far thirds are a
cable-free sweep of glowing deck on piers — which is what the reference frame
shows in the foreground, and what gives the composition its long clean diagonal
before the structure appears.

---

## 5. The main cable is a PARABOLA

```ts
mainCable: {
  sagRatio: 0.094,        // real bridges run 0.08–0.11
  count: 2,
  lateralOffset: 19,
  anchorageDrop: 0.42,
}
```

```
cableRise(u):
    if u < mainTower.u or u > farTower.u:  return 0

    t     = (u - main.u) / (far.u - main.u)
    chord = lerp(mainTop, farTop, t)              // straight line, tower top to tower top
    span  = (far.u - main.u) * arcLength
    sag   = span * sagRatio
    return chord - sag * 4t(1-t)                  // 4t(1-t) peaks at 1.0 mid-span,
                                                  // exactly 0 at both towers
```

**Not a catenary.** A catenary is the curve of a chain hanging under its own
weight. A suspension bridge's main cable carries a roughly uniform deck load
through its hangers, and that load dominates the cable's own mass — which makes
the curve a parabola. Golden Gate, Brooklyn, Akashi: all parabolic.

The creative pack originally specified `cosh`. It was wrong; the code is the
correction and the pack has been updated (decision log D-016).

Beyond each tower the cable runs straight down toward its anchorage
(`anchorageDrop: 0.42`).

---

## 6. Towers

```ts
towers: {
  main: { u: 0.41, baseY: 42, height: 175,   // top at Y = 217
          legSpacing: 38, legTaper: 0.62,
          crossBraceY: [92, 148, 205] },
  far:  { u: 0.71, baseY: 46, height: 140,   // top at Y = 186
          legSpacing: 32, legTaper: 0.66,
          crossBraceY: [96, 168] },
}
```

Two legs each, tapering inward toward the top (`legTaper` is the ratio of top
spacing to base spacing). Three cross-braces on the main tower, two on the far.
The far tower is shorter and narrower — partly perspective honesty, partly so the
two towers are not read as the same object twice.

---

## 7. The flight guide curve

`guidePoint(u, heightAbove, lateralOffset, taperStart)` returns a point offset
**above** and **camera-side** of the centreline. Gliding particles ride this
curve, not the bridge itself.

```
p     = centrelinePos(u)
taper = u < taperStart ? 1 : 1 - smoothstep(taperStart, 1, u)
side  = binormal.z >= 0 ? +1 : -1            ← camera sits at +Z
p.y  += heightAbove * taper
p    += binormal * (lateralOffset * taper * side)
```

Driven by `RIVER.heightAbove`, `RIVER.lateralOffset`, `RIVER.taperStart`.

This is **pure staging with no physical justification.** It exists so the camera
can see both the source of the particles and their destination at the same time —
the stream is never hidden behind the structure it is feeding. That is the entire
compositional argument of the frame. The taper collapses the offset to zero
toward the far end so the river converges onto the bridge line at the horizon
rather than running parallel to it forever.

---

## 8. Target generation

`buildTargets(nominal, heightAt) → TargetCloud`

```ts
interface TargetCloud {
  position: Float32Array   // n * 3
  u:        Float32Array   // n
  layer:    Uint8Array     // n, index into LAYERS
  count:    number
}
```

`LAYERS = ["piers", "towers", "deck", "mainCables", "hangers", "railing"]` — the
order is **load-bearing order**, used by the assembly schedule
([`Timeline.md`](Timeline.md) §5).

### 8.1 Budget distribution

```ts
targetDistribution: {
  deck:       0.34,
  hangers:    0.20,
  mainCables: 0.16,
  towers:     0.14,
  piers:      0.08,
  railing:    0.08,
}
```

**Deliberately NOT proportional to surface area.** Hangers are roughly 2% of the
bridge's surface and receive 20% of the budget, because particle count buys
legibility of *thin* things. At proportional sampling each hanger would get about
42 particles and read as a dotted line. Broad surfaces like the deck tolerate
sparse sampling because additive blending fills in the impression.

### 8.2 Builders

Each builder writes into a `Sink` and receives a seeded RNG and its share `n`.

| Builder | Method |
|---|---|
| `buildPiers` | Spaced every `78u` along the span. Trapezoid section, `widthBase 26` → `widthTop 16`. Footings sampled down to `terrain.heightAt(x, z)`. |
| `buildTowers` | Two tapering legs per tower plus horizontal cross-braces at the specified heights. |
| `buildDeck` | Sampled across `deckWidth 46` with `deckCamber 1.4`, thickness `3.2`. Uses `DECK_ZONES` to bias sampling. |
| `buildCables` | Two cables at `lateralOffset ±19`, following `cableRise(u)`, only within the main span, with anchorage drops beyond the towers. |
| `buildHangers` | Vertical drops every `14u` from the cable to the deck, `minLength 2.5` to prevent zero-length hangers at mid-span. |
| `buildRailing` | Edge lines along both sides of the deck. |

### 8.3 Deduplication

A `SeparationGrid` with cell size `TARGET.minSeparation` (0.35u) rejects any
candidate within that distance of an already-accepted point.

**This is why `count` is 82,599 and not the nominal 140,000.** The dedup rejects
roughly 41% of candidates. `particleCount === targetCount` is an invariant — there
is exactly one particle per target, no more and no fewer.

The consequence to be aware of: **raising `PARTICLES.countByTier` does not raise
the particle count proportionally.** It raises the number of *attempts*. Past a
point, the separation grid absorbs everything you add.

---

## 9. LOD and instancing — there are none

This is a deliberate architectural position and it should be understood before
anyone tries to "fix" it.

- **No LOD.** Every particle is evaluated every frame at every distance. There is
  no distance-based culling and no simplified far representation. Distance is
  handled entirely by `sizeAttenuation` (points shrink) and fog (points dim).
- **No instancing.** There is nothing to instance. The bridge is `THREE.Points` —
  one geometry, one material, **one draw call** for the entire structure.
- **No frustum culling.** `points.frustumCulled = false`, with an explicit
  bounding sphere `(0, 100, -300) r=2600`. The `position` attribute is all zeros
  (real positions are computed in the shader), so three.js would otherwise
  compute a zero-radius sphere at the origin and cull the entire system.

The cost model is therefore **flat**: 82,599 vertex shader invocations per pass,
regardless of what is on screen. The vertex shader is the expensive part, not the
fill.

### The attribute budget

The particle system binds **14 vertex attributes**, and that is a hard ceiling
enforced by `hygiene-check.mjs`.

Adding a fifteenth links a program that fails validation — `Too many attributes` —
and three.js then **skips the draw without throwing**. The bridge is simply absent
from every frame while every inspectable property of it stays perfectly valid.
This happened; see decision log D-026. The `(u, rewindAt)` pair is packed into a
single `vec2 aUR` for exactly this reason.

---

## 10. Coordinate system

Three.js handedness: **+X right, +Y up, +Z toward the viewer.** The camera looks
down −Z.

One world unit is conceptually one metre, which is what makes the numbers
sanity-checkable — a 468-unit main span is a plausible bridge. If a value stops
being physically believable, that is a signal something is wrong.

```ts
WORLD.bounds = { minX: -900, maxX: 900, minY: -40, maxY: 420,
                 minZ: -1400, maxZ: 400 }
WORLD.valleyFloorY = 0
WORLD.mistPlaneY   = 6
```
