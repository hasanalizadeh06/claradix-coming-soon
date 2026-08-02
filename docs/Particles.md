# Particles

`src/scene/elements/particles.ts`, 863 lines. This is the scene.

---

## 1. The architectural decision

> **A particle's position at time `t` is a PURE FUNCTION of its attributes and
> `t`. Nothing is integrated; there is no previous frame.**

The instinct of anyone who has written a particle system is `pos += vel * dt`.
That breaks four things at once:

| | |
|---|---|
| **Determinism** | float accumulation differs per device, so the reference frame can never be diffed |
| **Frame-rate independence** | a 30fps and a 144fps device diverge |
| **Scrubbing** | `seek(10.5)` becomes impossible; you must simulate forward |
| **Law 5** | forces accumulate, so a determined viewer can always push a particle somewhere it should not be |

The scrubbing loss is the worst. Without `seek()` there is no capture tooling,
and without capture tooling **nothing about this scene can be verified**. Every
acceptance script in `scripts/` depends on it.

The cost is that interaction cannot be a force. It has to be a **displacement
applied on top of the computed position** — which turns out to be the feature
that makes Law 5 enforceable, because clamping an offset clamps the deformation
absolutely.

---

## 2. Counts

```ts
countByTier: { ultra: 200_000, high: 140_000, medium: 90_000,
               low: 45_000, minimal: 16_000 }
```

These are **nominal**. The actual count is what survives the separation grid in
`bridgeTargets`. At `high` the nominal 140,000 becomes **82,599** actual
particles. `particleCount === targetCount` is an invariant.

Tier selection (`BridgeScene.ts`):

```ts
tier = capabilities.densityScale >= 0.9 ? "high"
     : capabilities.densityScale >= 0.6 ? "medium"
     : "low";
```

`ultra` is never guessed — it must be earned by measurement or set explicitly for
captures. `minimal` is reachable only through the degradation ladder.

---

## 3. Attributes

**14 slots. This is a hard ceiling** (see [`Bridge.md`](Bridge.md) §9).

| Attribute | Size | Contents |
|---|---|---|
| `position` | 3 | **Dummy, all zeros.** Exists only so three.js knows the draw count. |
| `aSeed` | 3 | Resting position at T+0, on the terrain |
| `aTarget` | 3 | Destination position on the bridge |
| `aSeedNormal` | 3 | Terrain normal at the seed — the release direction |
| `aBreatheDir` | 3 | Fixed random unit vector for idle motion |
| `aUR` | **2** | **Packed `(u, rewindAt)`** |
| `aLiftAt` | 1 | Scene time this particle leaves the ground |
| `aSeatAt` | 1 | Scene time it arrives at its target |
| `aRollPhase` | 1 | Barrel-roll starting angle |
| `aRollRadius` | 1 | Barrel-roll radius, 0.4–1.2 |
| `aRollTurns` | 1 | Rotations over the flight, 1.6–3.4 |
| `aSizeVar` | 1 | Per-particle size multiplier, 0.85–1.15 |
| `aSpeedVar` | 1 | Per-particle roll-rate multiplier, 0.89–1.11 |
| `aHash` | 1 | Stable per-index hash from `hashIndex(i, 0x9e37)` |

All written once at init and **never touched again**. There are no per-frame
buffer uploads.

### Why three separate roll attributes

Deriving `aRollPhase`, `aRollRadius` and `aRollTurns` from one hash produces
visible correlation — every wide-radius particle also rolls at the same rate, and
the eye picks that out as banding in the stream.

### `aBreatheDir` is a fixed random unit vector

Not radial, not surface-normal. Radial breathing makes the bridge inflate and
deflate. Normal-based makes surfaces ripple like water. A fixed random direction
produces motion with **no collective structure at all**: the surface shimmers and
the shape does not move.

### The shuffled write order

The attribute buffers are written in a **seeded Fisher-Yates permutation** of the
target order.

Targets are generated layer by layer and section by section, so buffer order is
spatial order. That makes the cheapest performance lever — `setDrawRange(0, k)`,
which costs nothing and needs no rebuild — useless: truncating an ordered buffer
deletes a contiguous piece of bridge rather than thinning the whole of it.

Interleaved, dropping the count removes particles **evenly from everywhere**. The
span gets sparser; it never gets shorter. That is the difference between a device
quietly running at reduced density and one visibly missing its far end.

---

## 4. Uniforms

| Uniform | Type | Purpose |
|---|---|---|
| `uTime` | float | Scene time, **already wrapped** to one cycle by BridgeScene |
| `uFrameTex` | sampler2D | 512×4 RGBA32F centreline frames |
| `uRamp` | sampler2D | 256×1 colour ramp, sampled by brightness |
| `uPointScale` | float | `clamp(viewportHeight/900, 0.55, 1.5)` |
| `uCursor` | vec3 | Cursor resolved to a world point on the centreline |
| `uCursorStrength` | float | 0–1, asymmetric spring (see [`Interaction.md`](Interaction.md)) |
| `uDisperse` | float | Push-in dispersion, `smoothstep(dolly, 0.55, 1)` |
| `uDisperseOrigin` | vec3 | Where the view axis meets the bridge |
| `uLoop` | float | 1 when the rewind is armed. **A uniform, not a compile-time branch** — see §9 |
| `uTrailPass` | float | 1 during the particles-only accumulation pass |
| `uPulseU` | float | Completion pulse position, −1 when not firing |

---

## 5. Seeding

Seeds are generated **from targets, never independently.**

```
for each particle i:
    (tx, ty, tz) = target[shuffled(i)]
    for attempt in 0 .. SEED.maxRerolls:
        d = rng.disc(SEED.scatterRadius)
        candidate = (tx + d.x, tz + d.y)
        if slopeAt(candidate) acceptable:  accept
    seedY = terrain.heightAt(sx, sz) + normal.y * offset
```

A particle destined for the main tower starts near the main tower's footprint, so
its journey is a rise, a curve and a short traverse rather than a trip across the
whole valley. That keeps every flight duration inside a tight **4.5–5.7 s** band,
which is what makes the river read as one current at one characteristic speed.

Seeding independently scatters durations from ~1.8 s to ~14 s and the stream
stops reading as a stream.

`aSeedNormal` is the terrain normal at the seed. A particle lifts **perpendicular
to the ground it was lying on**, not straight up. On a 30° hillside the hill
appears to exhale; the same particles rising vertically look like gravity was
switched off. One line, disproportionately responsible for Phase 1 feeling
physical.

---

## 6. Schedule

Three pure functions on the CPU, evaluated once per particle at init.

### 6.1 Lift

```ts
liftAt(u, jitter) = LIFT.windowStart
                  + pow(1 - u, LIFT.curveExp) * LIFT.windowSpan
                  + jitter
```

```ts
LIFT = { windowStart: 1.2, windowSpan: 4.4, curveExp: 1.6, jitter: 0.09,
         releaseSpeed: 26, verticalPhase: 0.42, brightenDistance: 9.5 }
```

Lift-off begins at the **far** end and spreads toward the camera, because far
particles have the furthest to travel and must arrive first. The choreography is
causally honest: everything that happens early happens because of something that
must happen later.

The window is 4.4 s long while Phase 1 is only 1.6 s. **Not an error.** The phase
is named for when lift-off is the *dominant visual event*, not for when it
occurs. The near ground is still releasing particles at T+5.400, and that overlap
is what makes the scene read as a process rather than as three animations played
one after another.

### 6.2 Seat

```ts
seatAt(u, layer, jitter) = ASSEMBLY.windowStart
                         + (1 - u) * ASSEMBLY.windowSpan
                         + ASSEMBLY.layerOffset[layer]
                         + jitter
```

```ts
ASSEMBLY = {
  windowStart: 5.4, windowSpan: 5.22, jitter: 0.055,
  layerOffset: { piers: 0.0, towers: 0.145, deck: 0.29,
                 mainCables: 0.435, hangers: 0.522, railing: 0.58 },
}
```

Two orderings at once: spatially **far → near**, and within any cross-section
**bottom-up in load-bearing order**. You cannot hang a cable from a tower that
does not exist yet. Nothing forces the scene to obey that, but a viewer who has
ever seen construction feels the wrongness without being able to name it.

The layer sequence takes 580 ms at any one point; the spatial sweep takes
5,220 ms. That **~9:1 ratio** is what makes the phase look like watching real
construction from a distance — a slow front advancing, with fast detail inside
it.

Boundary check: the first pier at `u=1` seats at `5.400 + 0 + 0 = 5.400`, exactly
the phase-3 start.

### 6.3 Rewind

```ts
rewindAt(u, layer) = REWIND_START
                   + u * LOOP.rewind.spatialSpan
                   + LOOP.rewind.layerOffset[layer]
```

The exact inverse of `seatAt` in **both** orderings:

- **Spatially** it runs `u` rather than `1 - u`, so the disassembly front travels
  *away* from the camera while the build travelled *toward* it. The two fronts
  move in opposite directions across the frame and are never mistaken for each
  other.
- **Structurally** the offsets are their own table, top-down: railing leaves
  first, piers leave last. You cannot remove a tower while a cable still hangs
  from it.

**No jitter.** Assembly jitter hides the seams in a front moving toward you;
moving away, the same jitter just reads as the front losing its edge.

### 6.4 The minimum-duration guard

```ts
if (seat - lift < FLIGHT.minDuration) lift = seat - FLIGHT.minDuration;
```

`liftAt` is pulled **earlier**, never `seatAt` pushed later. `seatAt` is a hard
deadline: the phase boundary depends on the last particle landing exactly at
T+11.200.

---

## 7. Velocity

There is no velocity attribute and no velocity variable. Motion is the
*derivative of a position function nobody ever takes*.

Speed is therefore an emergent property of `(distance, schedule)`:

- **Lifting** — ballistic along `aSeedNormal`, `26 * e - 9 * e²`, decelerating.
  The `9` is a hard-coded gravity term inside the shader.
- **Gliding** — `easeInOutCubic(p)` along the guide curve, where
  `p = (t - aLiftAt) / flightSpan`. The characteristic speed is
  `RIVER.glideSpeed = 238` u/s but that number is descriptive, not used.
- **Approaching** — `smoothstep(0,1,approachP)` blend from guide curve to target
  over the final `FLIGHT.approachFraction = 0.22` of the flight.
- **Returning** — `easeOutQuad`, gentler than assembly's easing.

`aSpeedVar` (0.89–1.11) is applied to the **roll rate**, not the travel rate.
±11% means faster particles gradually overtake slower ones and the stream
develops braided internal shear over its length — for free, with no flocking, no
turbulence and no noise field.

---

## 8. Where the joining point comes from

```glsl
float u = mix(clamp(aU + 0.10, 0.0, 1.0), aU, p);
```

A particle joins the river **0.10 u ahead of its own target** and slides back to
its target's `u` over the flight. So particles enter the stream near where they
were lying rather than at a common source, which is what makes the stream feed
continuously along its whole length and visibly thicken as it goes, rather than
pouring from one point.

---

## 9. The loop is a uniform, not a `#define`

```glsl
float returnDur = 1.51;
bool isDeparting = uLoop > 0.5 && t >= aRewindAt && t < aRewindAt + returnDur;
bool hasLanded   = uLoop > 0.5 && t >= aRewindAt + returnDur;
```

Baking the flag into the shader source makes the rewind untestable whenever it is
switched off — which is the default — and **an animation nothing can exercise is
one that will be broken the next time somebody turns it on**. The comparison is
uniform across the whole draw, so it costs nothing measurable.

`window.__scene.loop(bool)` flips it at runtime; `loop-check.mjs` uses that.

---

## 10. GPU vs CPU split

| On the CPU, once at init | On the GPU, every frame |
|---|---|
| Spline, arc-length table, frames | Position (all five states) |
| 82,599 target positions | Brightness |
| Seed placement (140k `heightAt` calls) | Colour ramp lookup |
| All schedules | Point size |
| Fisher-Yates shuffle | Fog attenuation |
| Colour ramp texture | Cursor displacement |
| Frame texture | Push-in dispersion |
| | Sprite alpha |

| On the CPU, every frame | |
|---|---|
| Cursor ray march (25 steps against the centreline) | ~25 `nearestU` calls |
| Swarm light positions | 5 `guidePoint` calls, **analytical** |
| Camera drift + parallax + dolly | |
| Phase → bloom strength, swarm intensity | |

The swarm lights are computed analytically from the guide curve rather than by
reducing over the population: 140,000 reductions per frame costs ~4 ms and is
entirely avoidable, because a bin's particles are known to lie along a known
section of a known curve.

---

## 11. Memory

| Buffer | Bytes |
|---|---|
| Attributes (14 slots, 82,599 particles) | ~7.6 MB |
| `position` dummy (3 × 4 × 82,599) | 0.99 MB (of the above) |
| Frame texture 512×4 RGBA32F | 32 KB |
| Colour ramp 256×1 RGBA8 | 1 KB |
| Terrain heightfield cache (385²  Float32) | 0.59 MB |
| Terrain geometry (385² verts, position+normal) | ~3.6 MB |

Render targets are the larger cost — see [`Performance.md`](Performance.md) §4.

The `position` dummy is ~1 MB of zeros uploaded to the GPU for no reason other
than to tell three.js the draw count. It could be a 1-component attribute; it is
not, and that is a real if small waste.

---

## 12. What is NOT here

Things a reader may expect and will not find:

- **No curl noise, no flow field, no turbulence.** The braided look comes
  entirely from `aSpeedVar` and the barrel roll.
- **No flocking, no separation, no cohesion.** Particles never see each other.
- **No collision.** Nothing tests anything against anything.
- **No GPGPU ping-pong.** Position is not stored in a texture; it is recomputed
  from scratch every frame.
- **No sorting.** Additive blending is order-independent.
- **No soft particles.** No depth-buffer fade at intersections.
- **No sprite texture.** The round sprite is four lines of maths in the fragment
  shader; a texture fetch per particle per frame is real bandwidth for a shape
  that does not need one.

`src/gl/glsl.ts` contains simplex 3D, curl noise and a hash library that **the
project does not use.** It is dead code.
