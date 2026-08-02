# 24 — TARGET ASSIGNMENT

**Which particle goes where, and the stagger formula that produces far→near
assembly.**

---

## 24.1 The three questions

Every particle needs an answer to three questions, all resolved **once, at
initialisation**:

| Question | Answer | §
|---|---|---|
| Where do I belong? | `aTarget` — a point on the bridge | 24.2 |
| Where do I start? | `aSeed` — a point on the terrain | 24.4 |
| When do I move? | `aLiftAt` and `aSeatAt` | 24.5 |

Get these right and the entire choreography follows automatically. There is no
runtime scheduling, no queue, no coordinator.

---

## 24.2 Generating the target cloud

The bridge is sampled into a point cloud **before** any particle exists.

### Budget

```ts
BRIDGE.targetDistribution = {
  deck:       0.34,
  hangers:    0.20,
  mainCables: 0.16,
  towers:     0.14,
  piers:      0.08,
  railing:    0.08,
}
```

At `high` tier — 140,000 particles:

| Layer | Share | Count |
|---|---|---|
| Deck | 34% | 47,600 |
| Hangers | 20% | 28,000 |
| Main cables | 16% | 22,400 |
| Towers | 14% | 19,600 |
| Piers | 8% | 11,200 |
| Railing | 8% | 11,200 |
| **Total** | **100%** | **140,000** |

### The budget is not proportional to surface area

Deliberately.

| Layer | Share of budget | Share of surface area | Ratio |
|---|---|---|---|
| Hangers | 20% | ~2% | **10×** |
| Main cables | 16% | ~3% | **5.3×** |
| Deck | 34% | ~58% | 0.6× |
| Piers | 8% | ~19% | 0.4× |

**Hangers and cables are massively over-sampled** relative to their area, and
the deck and piers under-sampled.

> **Why:** particle count buys *legibility of thin things*. A hanger is a
> 0.4u-diameter line 40u long — at proportional sampling it would receive about
> 2,800 particles across all 66 hangers, i.e. **42 particles per hanger**, which
> reads as a dotted line with visible gaps.
>
> At 28,000 it gets **424 per hanger**, which merges into a continuous line at
> `high` tier and above.
>
> The deck, by contrast, is a broad surface where the eye reads *area* rather
> than *edge*. It tolerates sparse sampling because additive blending fills in
> the impression.

**The rule:** thin, high-frequency elements need disproportionate density.
Broad surfaces do not.

### Sampling each layer

| Layer | Method |
|---|---|
| **Deck** | Stratified sample over a 2D surface parameterised by `(u, lateral)`. Weighted toward the edges — the deck's silhouette matters more than its middle. |
| **Towers** | Volume sample within the leg solids and cross-braces. Density scales with `1/height` so tower tops are slightly denser, which counters perspective. |
| **Main cables** | Arc-length-uniform sample along the catenary, ±0.5u radial jitter for thickness. |
| **Hangers** | Uniform along each hanger's length, ±0.2u jitter. |
| **Piers** | Surface sample of the pier solids; interiors are empty (nobody sees inside). |
| **Railing** | Uniform along the two top edges of the deck. |

### Deduplication

Two targets closer than `TARGET.minSeparation` = **0.35u** are merged, and the
budget is redistributed.

Without it, dense regions develop coincident targets — two particles occupying
the same point — which wastes budget and creates a slightly-too-bright pixel
that reads as a hot dot.

### Every target carries its own metadata

```ts
type Target = {
  position: Vector3
  u: number          // arc-length position along the centreline
  layer: Layer       // 0..5
  normal: Vector3    // local structural normal — used for rewind departure
}
```

`u` is computed by `centreline.nearestU(position)`, **not** by the sampling
parameter — because a cable's parameter and its projected position along the
bridge are not the same thing near the towers.

---

## 24.3 Matching particles to targets

**The count must match exactly.**

```ts
assert(particles.length === targets.length)
```

Fewer particles than targets → holes in the bridge.
More particles than targets → particles with nowhere to go.

The particle count is therefore **derived from the target count**, not chosen
independently:

```
1. Pick the tier's nominal count (e.g. 140,000)
2. Generate targets to that budget
3. Deduplicate → actual count, e.g. 139,847
4. Set particleCount = 139,847
```

The tier numbers in `PARTICLES.countByTier` are **targets to aim at**, not
guarantees.

### The assignment is 1:1 and arbitrary

Particle `i` gets target `i`. There is **no optimisation** — no nearest-neighbour
matching, no Hungarian algorithm, no minimisation of total travel distance.

> **Why not optimise?** Because the seeds are generated *from* the targets (§24.4),
> not independently. Particle `i`'s seed is already placed beneath target `i`'s
> footprint. The assignment is optimal by construction, at zero cost.
>
> Solving an optimal-assignment problem over 140,000 points would take seconds
> and produce the same answer.

---

## 24.4 Seeding — targets come first

**This is the ordering that makes everything else work.**

```
1. Generate the bridge target cloud
2. For each target, generate its particle's seed on the terrain
3. Never the other way round
```

### The seed function

```
seed(target) =
    project onto terrain(
        target.xz
        + randomDisk(SEED.scatterRadius)
        + downhillGradient × SEED.downhillBias
    )
    + terrainNormal × random(0.15, 0.55)
```

```ts
SEED = {
  scatterRadius: 86,
  downhillBias: 0.42,
  surfaceOffset: [0.15, 0.55],
  maxSlopeDeg: 46,
}
```

### What this produces

The dormant particle distribution is **not uniform** — it follows the bridge's
footprint, with visible concentrations beneath both towers.

```
Density from above (■ dense · ▓ medium · ░ sparse · · empty)

        NEAR (u=0)                                    FAR (u=1)
    ┌──────────────────────────────────────────────────────────┐
    │ ·  ·   ░  ░   ·    ·     ·      ·        ·       ·      · │
    │ ░ ▓ ▓▓███▓▓ ▓ ░ ▓  ▓▓█▓▓  ▓   ░  ▓▓█▓▓  ░   ▓  ░    ░    │
    │ ▓███████████▓▓▓███████████▓▓▓██████████▓▓▓▓███▓▓▓░░░     │
    │ ░ ▓ ▓▓███▓▓ ▓ ░ ▓  ▓▓█▓▓  ▓   ░  ▓▓█▓▓  ░   ▓  ░    ░    │
    │ ·  ·   ░  ░   ·    ·     ·      ·        ·       ·      · │
    └──────────────────────────────────────────────────────────┘
                        ↑                    ↑
                   main tower           far tower
```

### Three things this buys

**1 · Short, consistent flight paths.** A particle destined for the main tower
starts near the main tower's footprint. Its journey is a rise, a curve, and a
short traverse — not a trip across the whole valley.

This is what keeps every flight duration inside the tight **4.5–5.7 second**
band that makes the river read as one coherent current at one characteristic
speed.

**2 · The river feeds along its whole length.** Because particles join the guide
curve near where they were lying (see
[`23_flight_choreography.md`](23_flight_choreography.md) §23.3), the stream
picks up particles continuously and visibly **thickens** as it goes — instead of
all flowing from a single source.

**3 · The bridge's shape is latent in the ground.** A viewer rewatching the
scene will notice that the bridge's footprint was visible in the seed
distribution from frame one.

> That is a gift to the second viewing, not a spoiler for the first — at
> `brightness 0.17` the pattern is far below the threshold of conscious
> recognition. And it makes the story's central claim literal: *the shape was
> already there; Claradix moved it into position.* See
> [`04_story_seed_to_bridge.md`](04_story_seed_to_bridge.md) §4.3.

### Slope rejection

`maxSlopeDeg: 46`. A candidate seed on steeper ground is re-rolled, up to eight
attempts, then falls back to the nearest valid point.

Particles on a near-vertical cliff face look *stuck to* it rather than *resting
on* it, and when they lift they appear to peel off a wall.

### `downhillBias`

`0.42`. Seeds drift toward locally lower terrain, as loose objects would.

Because `TERRAIN.corridor` carves the ground beneath the bridge, "locally lower"
usually means "toward the bridge's line" — so this reinforces the concentration
along the corridor **for free**. See [`17_terrain.md`](17_terrain.md) §17.4.

---

## 24.5 The schedule

Two absolute times per particle, both baked at init.

### Lift time

```
liftAt(u) = 1.200 + pow(1 − u, 1.6) × 4.400 + random(±0.090)
```

| `u` | `liftAt` |
|---|---|
| 1.00 | T+1.200 |
| 0.75 | T+1.578 |
| 0.50 | T+2.652 |
| 0.25 | T+3.968 |
| 0.00 | T+5.600 |

**The exponent `1.6` front-loads the wave.** Half of all particles lift within
the first ~1.45s of the window, with a long thinning tail. At `1.0` the sweep is
linear and reads as a scanner line.

**The jitter softens the front.** ±90ms corresponds to roughly ±34 world units
of raggedness. Without it the wave is a ruler-straight edge crossing the ground.

### Seat time

```
seatAt(u, layer) = 5.400 + (1 − u) × 5.220 + layerOffset[layer] + random(±0.055)
```

```ts
ASSEMBLY.layerOffset = {
  piers:      0.000,
  towers:     0.145,
  deck:       0.290,
  mainCables: 0.435,
  hangers:    0.522,
  railing:    0.580,
}
```

**Boundary check:**

| Extreme | Calculation | Result |
|---|---|---|
| First seat — pier at `u = 1` | `5.400 + 0 + 0.000` | **T+5.400** ✓ |
| Last seat — railing at `u = 0` | `5.400 + 5.220 + 0.580` | **T+11.200** ✓ |

Exactly matching `TIMELINE.phase3_assemblyStart` and
`TIMELINE.phase4_completionStart`.

### Flight duration is derived

```
flightDuration = seatAt − liftAt
```

| `u` | `liftAt` | `seatAt` (deck) | Duration |
|---|---|---|---|
| 1.00 | 1.200 | 5.690 | **4.490s** |
| 0.75 | 1.578 | 6.995 | **5.417s** |
| 0.50 | 2.652 | 8.300 | **5.648s** |
| 0.25 | 3.968 | 9.605 | **5.637s** |
| 0.00 | 5.600 | 10.910 | **5.310s** |

**All in a 4.5–5.7s band.** The river reads as one current at one speed.

### The safety clamp

```ts
FLIGHT.minDuration = 2.000
```

If jitter ever produces a gap shorter than this, **`liftAt` is pulled earlier** —
never `seatAt` pushed later, because `seatAt` is a hard deadline and the phase
boundary depends on it.

---

## 24.6 Why the two orderings compose

The spatial sweep takes **5.220s**. The layer sequence at any one point takes
**0.580s**.

So the layers are a **fast local detail riding on a slow global wave** — a ratio
of about 9:1.

```
Time →   5.4        7.0        8.6        10.2      11.2
         │          │          │          │         │
u=1.0  ▐█▌          │          │          │         │      ← 580ms of layers
u=0.7    │  ▐█▌     │          │          │         │
u=0.4    │          │   ▐█▌    │          │         │
u=0.1    │          │          │      ▐█▌ │         │
u=0.0    │          │          │          │    ▐█▌  │

         ├──────────── 5220ms spatial sweep ────────┤
         ▐█▌ = 580ms of layer sequence at one point
```

That ratio is what makes the phase look like **watching real construction from a
distance**: a slow front advancing, with fast detailed activity happening within
it.

If the ratio were closer to 1:1 the two orderings would fight and neither would
read.

---

## 24.7 The rewind schedule

```
rewindAt(u, layer) = 32.400 + u × 6.900 + rewindLayerOffset[layer]
```

```ts
REWIND.layerOffset = {
  railing:    0.000,
  hangers:    0.058,
  mainCables: 0.145,
  deck:       0.290,
  towers:     0.435,
  piers:      0.580,
}
```

**Both orderings reversed.** Spatially near→far; structurally top-down.

Note the layer offsets are **not** simply the assembly offsets reversed in value
— they are reversed in *order* but compressed, because the rewind runs at 0.65×
and the whole layer sequence has to fit proportionally.

---

## 24.8 Determinism

Everything in this document uses a **seeded PRNG**. Same seed, same result,
every load, every device, forever.

```ts
TARGET.randomSeed = 0x1A3F7C29
```

This is non-negotiable:

- The reference frame was authored against one specific layout
- `npm run compare` diffs captures pixel by pixel
- The framing constraints in [`16_world_map.md`](16_world_map.md) §16.6 were
  verified against this exact target cloud
- A loop must produce identical cycles

> **Trap:** `Math.random()` anywhere in target generation, seeding, or schedule
> jitter. It will look fine in development and make every automated visual check
> fail intermittently — the worst possible failure mode, because it looks like
> flaky tests rather than like a bug.

---

## 24.9 Initialisation cost

| Step | Time (mid-range laptop) |
|---|---|
| Generate target cloud | ~48ms |
| Deduplicate | ~9ms |
| Seed particles (140k heightfield lookups) | ~6ms |
| Compute `u` per target | ~7ms |
| Compute schedules | ~4ms |
| Build attribute arrays | ~13ms |
| Upload to GPU | ~11ms |
| **Total** | **~98ms** |

Comfortably inside Phase 0's 1.2 seconds — one of the reasons Phase 0 exists.

> **Trap:** computing `u` by re-projecting each target onto the spline with a
> fine search costs ~340ms. Use the arc-length LUT with a binary search.

---

## 24.10 Failure modes

**1 · Particle count ≠ target count.**
Holes, or particles with no destination. Assert.

**2 · Seeds generated before targets.**
Flight durations scatter wildly; the river loses its single characteristic
speed; some particles cross the entire valley while others barely move.

**3 · Uniform seed distribution.**
Same symptom, plus the ground reads as generic dust instead of as something
arranged.

**4 · Proportional-to-area budget.**
Hangers break into visibly dotted lines. This is the first thing that looks
wrong and the last thing anyone suspects.

**5 · No deduplication.**
Hot dots in dense regions where two particles coincide.

**6 · `u` from the sampling parameter instead of `nearestU`.**
Assembly order goes subtly wrong near the towers — cables seating out of sequence
with the deck beneath them.

**7 · `Math.random()` anywhere.**
Intermittent failures in every visual check.

**8 · `seatAt` pushed later to satisfy `minDuration`.**
The last particle misses `T+11.200` and the completion pulse fires into an
unfinished bridge.

**9 · Layer offsets applied per-layer globally rather than per-particle.**
All towers finish before any deck begins, anywhere on the bridge. The far→near
sweep disappears.

---

## 24.11 Checklist

- [ ] Targets are generated **before** seeds.
- [ ] `particleCount === targetCount`, asserted at init.
- [ ] Particle count is **derived** from the deduplicated target count.
- [ ] Budget is disproportionate: hangers 20%, cables 16% — far above their
      surface area.
- [ ] Hangers read as continuous lines at `high` tier.
- [ ] Targets closer than 0.35u are merged.
- [ ] Each target carries `position`, `u`, `layer`, `normal`.
- [ ] `u` comes from `centreline.nearestU()`, not from the sampling parameter.
- [ ] Assignment is 1:1 and arbitrary — no optimisation pass.
- [ ] Seeds follow the bridge footprint, with visible tower concentrations.
- [ ] No seed on a slope steeper than 46°.
- [ ] All flight durations fall inside 4.5–5.7s.
- [ ] `liftAt` uses exponent 1.6 and ±90ms jitter.
- [ ] `seatAt` boundary check: first at exactly `T+5.400`, last at exactly
      `T+11.200`.
- [ ] `minDuration` violations pull `liftAt` **earlier**, never push `seatAt`
      later.
- [ ] Layer offsets are applied **per-particle**, composed with the spatial
      sweep.
- [ ] The spatial:layer ratio is ~9:1.
- [ ] Everything uses the seeded PRNG. **No `Math.random()` anywhere.**
- [ ] Initialisation completes in under ~150ms.

---

**Next:** [`25_camera.md`](25_camera.md) — framing, parallax, and push-in.
