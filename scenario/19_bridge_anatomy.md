# 19 — BRIDGE ANATOMY

**Every part of the structure, and how the target point cloud is generated.**

---

## 19.1 What "the bridge" actually is

There is no bridge object.

There is a **list of 140,000 positions in space**, each tagged with which
structural layer it belongs to and where it sits along the span. Particles fly
to those positions and stop. The bridge is what that looks like.

```ts
interface BridgeTarget {
  position: Vector3      // where the particle stops
  u: number              // 0 (near) … 1 (far) — drives assembly order
  layer: Layer           // drives the structural sub-ordering
  normal: Vector3        // local structural normal — used by rewind departure
}

type Layer = 'piers' | 'towers' | 'deck' | 'mainCables' | 'hangers' | 'railing'
```

**This list is generated once at initialisation and never changes.** It is the
bridge's complete definition.

> **Law 3 in practice:** because there is no mesh, the bridge *cannot* become
> solid. The constraint is architectural, not a matter of discipline. Nobody can
> accidentally make the bridge opaque, because there is nothing to make opaque.

---

## 19.2 The three sections

The bridge is not uniformly a suspension bridge, and this matters: the far and
near thirds have **no cables**, which is exactly what the reference frame shows
in the foreground.

| Section | `u` range | Arc length | Structure |
|---|---|---|---|
| **Near approach viaduct** | `0.00 – 0.34` | ~552u | Piers, deck, railing |
| **Main suspension span** | `0.34 – 0.82` | ~780u | Towers, deck, main cables, hangers, railing |
| **Far approach** | `0.82 – 1.00` | ~292u | Piers, deck, railing |

```
   u=0                  0.34        0.45       0.71    0.82        u=1
   │                     │           │          │       │           │
   │  NEAR APPROACH      │      MAIN SPAN       │   FAR APPROACH    │
   │  piers + deck       │  towers, cables,     │   piers + deck    │
   │                     │  hangers, deck       │                   │
   │                     │      ╔═╗       ╔═╗   │                   │
   │                     │      ║ ║       ║ ║   │                   │
   │  ═══════════════════╪══════╬═╬═══════╬═╬═══╪═══════════════════│
   │   ▓▓   ▓▓   ▓▓   ▓▓ │      ╨ ╨       ╨ ╨   │  ▓▓   ▓▓   ▓▓     │
   │                     │     MAIN      FAR    │                   │
   │                     │    TOWER     TOWER   │                   │
```

> **Why the approaches exist:** a pure suspension bridge tower-to-tower would
> have to fit entirely inside the frame, which makes it a diorama. Long approach
> viaducts running off both edges are what make the structure feel like part of
> a larger infrastructure — and they give the foreground its most characteristic
> shape, the long cable-free sweep of glowing deck.

---

## 19.3 The centreline

Everything is generated relative to a single Catmull-Rom spline. See
[`16_world_map.md`](16_world_map.md) §16.5.

```ts
BRIDGE.centreline = [
  { u: 0.00, p: [-520, 34,  300] },
  { u: 0.22, p: [-300, 38,  120] },
  { u: 0.45, p: [ -60, 42, -160] },   // main tower
  { u: 0.71, p: [ 240, 46, -520] },   // far tower
  { u: 1.00, p: [ 520, 50, -880] },
]
```

Arc length **~1624u**. `u` is normalised **arc length**, from a lookup table.

### The local frame

At any `u`, the centreline provides an orthonormal frame:

```
T  tangent    — along the bridge, toward increasing u
N  normal     — "up", perpendicular to the deck
B  binormal   — "across", the deck's width direction
```

**This must be a parallel-transport (rotation-minimising) frame**, not one
constructed by crossing the tangent with world-up.

> **Why:** a world-up construction produces a frame that twists as the
> centreline's tangent changes direction in plan. Since our centreline sweeps
> through nearly 90° of heading between near and far ends, a naive frame would
> gradually roll the deck — the bridge would be visibly banked at one end and
> level at the other.
>
> Parallel transport carries the frame forward, rotating it only as much as the
> tangent requires. Computed once at init, baked into the arc-length table.

Full derivation: [`23_flight_choreography.md`](23_flight_choreography.md)
§"Parallel transport frames" — the same machinery serves the barrel roll.

---

## 19.4 Deck

**34% of the particle budget** — the largest single allocation.

```ts
BRIDGE.deckWidth = 46
BRIDGE.deckThickness = 3.2
BRIDGE.deckCamber = 1.4
```

### Generation

Sample the centreline at intervals, and at each sample distribute particles
across a cross-section.

```
Cross-section of the deck (looking along the bridge):

        railing ●                                    ● railing
                ┌────────────────────────────────────┐
    top edge ●●●│●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●│●●● top edge
                │                                    │  ▲
                │         (sparse interior)          │  │ 3.2u
                │                                    │  ▼
 bottom edge ●●●│●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●│●●● bottom edge
                └────────────────────────────────────┘
                ├───────────── 46u ──────────────────┤
```

### Distribution within the cross-section

| Zone | Share of deck budget | Why |
|---|---|---|
| Top edges (both) | 34% | Catch the light; define the deck's line |
| Bottom edges (both) | 22% | Give the deck visible thickness from below |
| Top surface | 26% | The luminous plane the eye tracks |
| Interior / underside | 18% | Sparse — mostly hidden, but prevents the deck reading as hollow |

> **The edges get more than the surface.** This is the key decision. A uniformly
> sampled deck reads as a fuzzy band. Concentrating density at the edges gives
> it a crisp silhouette against the dark, which is what makes the long
> foreground sweep read as a *road* rather than as a smear of light.

### Longitudinal spacing

Particles are distributed **by arc length, not by spline parameter** — otherwise
density varies where the spline's parameterisation is uneven, producing visible
bright and dark bands along the deck.

### Camber

`deckCamber: 1.4` — the deck surface is 1.4u higher at its centre than at its
edges, as real roadways are for drainage.

Invisible directly. Its effect is that the top-edge particles sit slightly lower
than the surface particles, so the deck has a subtle crown that catches the
rim of the glow differently across its width.

---

## 19.5 Towers

**14% of the budget.**

```ts
BRIDGE.towers = {
  main: {
    u: 0.45, baseY: 42, height: 175,
    legSpacing: 38, legTaper: 0.62,
    crossBraces: 3, crossBraceY: [92, 148, 205],
  },
  far: {
    u: 0.71, baseY: 46, height: 140,
    legSpacing: 32, legTaper: 0.66,
    crossBraces: 2, crossBraceY: [96, 168],
  },
}
```

### Structure

```
              ┌─┐        ┌─┐          ← tops, tapered to 62% of base width
              │ │        │ │
              ├─┼────────┼─┤          ← cross-brace 3 (Y=205)
              │ │        │ │
              │ │        │ │
              ├─┼────────┼─┤          ← cross-brace 2 (Y=148)
              │ │        │ │
              │ │        │ │
              ├─┼────────┼─┤          ← cross-brace 1 (Y=92)
              │ │        │ │
        ══════╪═╪════════╪═╪══════    ← deck passes THROUGH the tower
              │ │        │ │
              │ │        │ │
              └─┘        └─┘          ← bases at Y=42
              ├── 38u ───┤
```

**The deck passes through the towers**, between the legs — as it does on a real
suspension bridge. The tower is not a thing the deck sits on top of.

### Taper

`legTaper: 0.62` — each leg's cross-section at the top is 62% of its width at
the base.

Applied as a smooth interpolation over height, not a linear one:
`width(t) = lerp(base, base × taper, smoothstep(0, 1, t))`. Linear taper reads
as a wedge; smooth taper reads as structure.

### Cross-braces

Three on the main tower, two on the far. Horizontal members between the legs.

The topmost brace (`Y = 205` on the main tower) sits just below the tower top,
where the main cable passes over — structurally correct, and it gives the tower
a distinct "head" in silhouette.

### Density

Towers get 14% of the budget across two structures with relatively small
surface area, which makes them the **densest** part of the bridge.

That density is why the towers read as near-solid bars of light with white-hot
cores in the reference frame — the additive accumulation pushes them past
`--lime-core`. Nobody painted that; it is a consequence of the allocation. See
[`06_art_direction.md`](06_art_direction.md) §6.3.

---

## 19.6 Main cables

**16% of the budget**, for two long thin curves. Deliberately generous.

```ts
BRIDGE.mainCable = {
  sagRatio: 0.094,
  count: 2,
  lateralOffset: 19,
  anchorageDrop: 0.42,
}
```

### The parabola

Between the two tower tops, the cable follows a **parabola**.

```
y = a · x²
```

**Not a catenary.** A catenary is what a chain does hanging under its *own*
weight. A suspension bridge's main cable carries the deck through its hangers,
and that load — uniform along the horizontal, and far heavier than the cable
itself — makes the governing curve a parabola. Golden Gate, Brooklyn, Akashi:
all parabolic. An unloaded suspension cable is not a thing.

> **Corrected.** This section originally specified `cosh` and argued the
> opposite. The existing implementation in `src/scene/centreline.ts` had it
> right, and its comment is what caught the error. See
> [`40_decision_log.md`](40_decision_log.md) entry **D-016**.

### Sag

`sagRatio: 0.094` — the cable's lowest point sits 9.4% of the span length below
the tower tops.

```
span    = 468u
sag     = 468 × 0.094 = 44u
```

Real suspension bridges run **8–11%**. At 0.094 we are mid-range and plausible.

```
    ╔═╗ 217                                     ╔═╗ 186
    ║ ║╲                                      ╱ ║ ║
    ║ ║ ╲___                            ___╱   ║ ║
    ║ ║     ╲______                ____╱       ║ ║
    ║ ║           ╲______________╱             ║ ║    ← lowest point,
    ║ ║                                        ║ ║      44u below tower tops
 ═══╬═╬════════════════════════════════════════╬═╬═══  ← deck
```

The cable's lowest point sits **just above the deck** at mid-span, which is what
makes the hangers near the middle very short and the ones near the towers very
long — the characteristic silhouette of a suspension bridge.

### Two cables

`count: 2`, `lateralOffset: 19` — one at `±19u` from the centreline, just inside
the deck's 46u width.

### Beyond the towers

`anchorageDrop: 0.42` — past each tower the cable leaves the catenary and runs
in a straight line down toward its anchorage, dropping 42% of the tower height
over the approach.

The anchorages themselves are off-frame at both ends.

### Why cables get 16%

Two curves have very little surface area. Allocating 16% of 140,000 particles
(22,400) to them gives roughly **11,200 per cable** over ~500u of length — about
**22 particles per world unit**.

That density is required for the catenary sweep during Phase 3 (`T+7.6` – `T+8.4`)
to read as a **line being drawn** rather than as a row of dots appearing. It is
the most beautiful single motion in the build, and it is the only moment in the
scene where a long, smooth, mathematically pure curve is revealed as a curve.

---

## 19.7 Hangers

**20% of the budget** — the second-largest allocation, for the thinnest elements.

```ts
BRIDGE.hangers = {
  spacing: 14,
  minLength: 2.5,
}
```

One hanger every 14u of deck length, wherever the main cable is at least 2.5u
above the deck. Over the 468u main span: roughly **33 per cable, 66 total**.

### Why 20%

Hangers have the **highest spatial frequency** in the scene — many thin parallel
lines close together. High-frequency detail needs high sampling density or it
breaks up.

```
Sufficient density:        Insufficient density:

  │ │ │ │ │ │ │ │            ╷ ╵ ╷ ╵ ╷ ╵ ╷ ╵
  │ │ │ │ │ │ │ │            ╵ ╷ ╵ ╷ ╵ ╷ ╵ ╷
  │ │ │ │ │ │ │ │            ╷ ╵ ╷ ╵ ╷ ╵ ╷ ╵
  reads as cables            reads as noise
```

**Hangers are the first thing to fail as particle count drops.** They are the
canary for the whole tier system:

| Tier | Particles | Hangers read as |
|---|---|---|
| `ultra` / `high` | 200k / 140k | Continuous lines |
| `medium` | 90k | Slightly dotted, still legible |
| `low` | 45k | Clearly dotted |
| `minimal` | 16k | Sparse dots — accepted degradation |

This is the expected and accepted degradation curve, noted in
[`07_reference_frame_analysis.md`](07_reference_frame_analysis.md) §7.11 as
**R-3**.

---

## 19.8 Piers

**8% of the budget.**

```ts
BRIDGE.piers = {
  spacing: 78,
  widthTop: 16,
  widthBase: 26,
}
```

One pier every 78u along the approach viaducts. Over ~844u of combined approach
length: roughly **11 piers**.

### They stand on the terrain

Each pier extends from the deck underside **down to the terrain height at its
position**, sampled from the heightfield.

```ts
pierHeight = deckUndersideY − TERRAIN.heightAt(pier.x, pier.z)
```

This is where the corridor carve from [`17_terrain.md`](17_terrain.md) §17.4
pays off: the carve makes ground deeper near the centreline, so piers are
naturally tall in the middle of the valley and short near the abutments.

**Nobody authored the pier heights.** They fall out of the terrain, which is
Law 2 producing correct architecture for free.

### They are mostly dark

Piers sit low, in the deepest part of the valley, furthest from anything that
lights them. 8% of the budget is enough to define them as forms without making
them compete with the deck above.

---

## 19.9 Railing

**8% of the budget.**

A fine line along both top edges of the deck, `1.8u` above the deck surface at
`±23u` lateral.

**It seats last** (`layerOffset.railing` = 0.580) and it is the final detail to
appear in the build — so the very last particle in the entire scene is a railing
particle at `u = 0`, in the immediate foreground.

Its visual job is to give the deck a crisp bright upper edge, which is what
separates the roadway from its own glow in the reference frame.

---

## 19.10 Target budget summary

| Layer | Share | @ 140k (`high`) | @ 45k (`low`) |
|---|---|---|---|
| Deck | 34% | 47,600 | 15,300 |
| Hangers | 20% | 28,000 | 9,000 |
| Main cables | 16% | 22,400 | 7,200 |
| Towers | 14% | 19,600 | 6,300 |
| Piers | 8% | 11,200 | 3,600 |
| Railing | 8% | 11,200 | 3,600 |
| **Total** | **100%** | **140,000** | **45,000** |

### The count must match exactly

```
targets.length === PARTICLES.countByTier[tier]
```

Every particle has exactly one target; every target has exactly one particle.

> **Why this is enforced rather than approximated:** it guarantees the bridge
> completes perfectly — no gaps, no leftovers, no particles circling with nowhere
> to go. It is also why there is no emitter (see
> [`09_phase_0_dormant.md`](09_phase_0_dormant.md) §9.5): a spawning system would
> have to reconcile counts every frame, and any drift shows up as holes in the
> finished structure.

The generator distributes by percentage and then assigns the remainder to
`deck`, which is the layer least sensitive to a handful of particles either way.

---

## 19.11 Generation order

```
1.  Build centreline spline
2.  Build arc-length lookup table (256 samples)
3.  Build parallel-transport frames along the table
4.  For each layer, in budget order:
      a. Determine the u-range where this layer exists
      b. Distribute N particles by arc length within that range
      c. For each, compute position from the local frame
      d. Compute the structural normal (used by rewind departure)
      e. Tag with u and layer
5.  Concatenate; assert length === particle count
6.  Sort by seatAt(u, layer)          ← see 24_target_assignment
```

**Cost:** ~35ms at 140k on a mid-range laptop. Runs during Phase 0, which is one
of the reasons Phase 0's 1.2 seconds exists.

---

## 19.12 What the bridge must never have

| Forbidden | Why |
|---|---|
| **Any mesh** | Law 3. The bridge is a point cloud, permanently. |
| **Lines connecting particles** | Turns the cloud into a wireframe, and implies connections that do not exist. |
| **A collision volume** | Nothing collides with the bridge. |
| **Textures or sprites other than the standard particle** | Every particle in the scene is identical. |
| **Per-layer colours** | Layers are distinguished by density, never by hue. One accent colour. |
| **A second bridge, or any other structure** | One bridge. See [`05_visual_language.md`](05_visual_language.md) §5.4. |
| **Vehicles, lights, signage** | The bridge is infrastructure as pure form. Anything implying use breaks the metaphor. |

---

## 19.13 Failure modes

**1 · Catenary cables.**
Symptom: subtly wrong to anyone who knows bridges. Use a parabola — the deck
load governs, not the cable's own weight.

**2 · Frame twist along the span.**
World-up frame construction instead of parallel transport. Symptom: the deck is
visibly banked at one end.

**3 · Uniform deck sampling.**
Symptom: the deck reads as a fuzzy band instead of a road with edges.

**4 · Spline-parameter spacing instead of arc-length.**
Symptom: visible density banding along the deck.

**5 · Target count not matching particle count.**
Symptom: holes in the finished bridge, or particles with no destination.

**6 · Deck sitting on top of the towers.**
Symptom: reads as a different — and structurally impossible — kind of bridge.

**7 · Hangers under-allocated.**
Symptom: the main span's most characteristic detail breaks into noise at
`medium` tier instead of at `low`.

**8 · Pier heights authored rather than sampled.**
Symptom: piers float above or sink into the terrain, and the corridor carve
stops paying off.

---

## 19.14 Checklist

- [ ] The bridge is a **list of positions**. No mesh exists anywhere.
- [ ] Three sections: near approach, main span, far approach. The approaches
      have **no cables**.
- [ ] The local frame is **parallel-transport**, not world-up derived. No twist
      along the span.
- [ ] Deck edges are denser than the deck surface.
- [ ] All longitudinal distribution is by **arc length**, not spline parameter.
- [ ] The deck passes **through** the towers, between their legs.
- [ ] Tower taper is smooth, not linear.
- [ ] Main cables are **parabolas**, not catenaries.
- [ ] Sag ratio 0.094 — the lowest point sits just above the deck at mid-span.
- [ ] Two cables at ±19u lateral.
- [ ] Cable density ≈ 22 particles per world unit, so the Phase 3 sweep reads
      as a line being drawn.
- [ ] Hangers get 20% of the budget and read as continuous lines at `high`.
- [ ] Pier heights are **sampled from the terrain heightfield**.
- [ ] Railing seats last; the final particle of the scene is a railing particle
      at `u = 0`.
- [ ] `targets.length === particleCount`, asserted at init.
- [ ] Generation completes within Phase 0's 1.2s budget.
- [ ] No lines, no meshes, no per-layer colours, no vehicles or signage.

---

**Next:** [`20_lighting_design.md`](20_lighting_design.md) — all the light in
the scene.
