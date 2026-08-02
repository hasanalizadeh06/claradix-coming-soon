# 21 — ANATOMY OF A PARTICLE

**What a single particle is, what data it carries, and why each field exists.**

---

## 21.1 One particle

A particle is a **point**. It has no size in world space, no mesh, no rotation,
no material response. It is drawn as a small round sprite of light.

At `high` tier there are **140,000** of them, and every one of them is identical
in every way except for the values in its attribute record.

**There is only one particle system, one geometry, one material, one draw call.**

---

## 21.2 The complete attribute record

Everything a particle knows about itself. Set **once at initialisation**, never
written again.

```glsl
attribute vec3  aSeed;         // where it starts, on the terrain
attribute vec3  aTarget;       // where it belongs, on the bridge
attribute vec3  aSeedNormal;   // terrain normal at aSeed — its release direction
attribute float aU;            // 0..1 — its target's position along the bridge
attribute float aLayer;        // 0..5 — which structural layer it belongs to
attribute float aLiftAt;       // absolute scene time it leaves the ground
attribute float aSeatAt;       // absolute scene time it must arrive — a DEADLINE
attribute float aRollPhase;    // 0..TAU — starting angle of its barrel roll
attribute float aRollRadius;   // 0.4..1.2 — helix radius
attribute float aRollTurns;    // 1.6..3.4 — revolutions across the flight
attribute float aSizeVar;      // 0.85..1.15 — per-particle size multiplier
attribute float aSpeedVar;     // 0.89..1.11 — per-particle speed multiplier
attribute float aHash;         // 0..1 — stable per-particle randomness
attribute vec3  aBreatheDir;   // unit vector — idle motion direction
```

**14 attributes. 24 floats. 96 bytes per particle.**

At 140,000 particles: **13.4 MB** of GPU buffer. Uploaded once, never touched
again.

---

## 21.3 Why each field exists

### `aSeed` — vec3

Its resting place on the terrain.

Sampled from the terrain heightfield at init. Distribution is **not uniform** —
it follows the bridge's footprint, so a particle destined for the main tower
starts near the main tower's base. See
[`09_phase_0_dormant.md`](09_phase_0_dormant.md) §9.5.

Also the **return destination** during rewind. A particle always goes home to
the exact spot it left, which is what makes the loop exactly repeatable.

### `aTarget` — vec3

Its position in the finished bridge.

Generated from the bridge geometry by the sampler in
[`24_target_assignment.md`](24_target_assignment.md). Every target is occupied
by exactly one particle; every particle has exactly one target.

> **The counts must match exactly.** `particleCount === targetCount`. Fewer
> particles than targets leaves holes in the bridge; more leaves particles with
> nowhere to go. This is asserted at init.

### `aSeedNormal` — vec3

The terrain normal where it rests.

Its **release direction**: a particle lifts perpendicular to the ground it was
lying on, not straight up in world space.

> On a 30° hillside, particles lift at 30° off vertical. The hill appears to
> exhale. The same particles rising vertically look like gravity was switched
> off. This is one line of code and it is disproportionately responsible for
> Phase 1 feeling physical.

### `aU` — float

Normalised arc-length position of its **target** along the bridge.
`0` = near end, `1` = far end.

The single most important value in the system. It drives:

| Derived from `aU` | How |
|---|---|
| `aLiftAt` | `1.200 + pow(1 − u, 1.6) × 4.400` |
| `aSeatAt` | `5.400 + (1 − u) × 5.220 + layerOffset` |
| Rewind departure time | `32.400 + u × spatialSpan` |
| Which swarm light bin it feeds | `floor(u × 5)` |
| Which section of the completion pulse hits it | pulse position vs `u` |

### `aLayer` — float, 0..5

Which structural layer it belongs to.

```
0 = piers        3 = mainCables
1 = towers       4 = hangers
2 = deck         5 = railing
```

Used for the layer offset in `aSeatAt` — the load-bearing build order. Also used
for the reversed order during rewind.

> Stored as a `float` rather than an integer because WebGL attribute types are
> floats anyway, and comparing against `0.5`, `1.5`, `2.5` … avoids any integer
> conversion in the shader.

### `aLiftAt` — float

Absolute scene time, in seconds, when this particle leaves the ground.

Baked at init from the formula plus its jitter. **Not** recomputed per frame —
the whole schedule is deterministic and known before the first frame renders.

### `aSeatAt` — float

Absolute scene time when it must arrive.

**This is a deadline, not a duration.**

If a particle falls behind — because the cursor deflected it, or because a frame
took too long — it **increases speed to meet its deadline**. It never arrives
late.

> Late arrivals are visible and damaging: a straggler seats after the completion
> pulse, into a bridge that already looked finished. See
> [`12_phase_3_assembly.md`](12_phase_3_assembly.md) §12.9.

### `aRollPhase`, `aRollRadius`, `aRollTurns` — float × 3

The barrel roll. Randomised per particle within the ranges in
`FLIGHT.roll`.

Three separate attributes rather than one derived from `aHash`, because all
three need independent distributions and deriving them from one hash produces
visible correlation — particles with a large radius all rolling at the same rate.

### `aSizeVar`, `aSpeedVar` — float × 2

Per-particle multipliers, `0.85–1.15` and `0.89–1.11`.

Without them, the river is perfectly uniform: every particle the same size,
travelling at the same speed. It reads as a texture scrolling rather than as a
population moving.

`aSpeedVar` is why the river has visible internal shear — faster particles
gradually overtake slower ones, and the stream develops braided structure over
its length **for free**.

### `aHash` — float, 0..1

Stable per-particle randomness for everything that does not deserve its own
attribute.

Used for: dormant shimmer phase, idle breathing phase, snap flash micro-jitter,
double-rate shimmer selection, trail opacity variation.

> **Why store it rather than compute `hash(gl_VertexID)` in the shader:**
> `gl_VertexID` is not available in WebGL 1, and hash quality from a small
> integer input is poor — visible patterning appears in the shimmer. One stored
> float, computed once on the CPU with a good generator, is both faster and
> better.

### `aBreatheDir` — vec3

A fixed unit vector: the direction this particle moves during idle breathing.

> **Why not radial or normal-based?** Radial breathing makes the bridge appear
> to inflate and deflate. Normal-based breathing makes surfaces ripple like
> water. A fixed random direction per particle produces motion with **no
> collective structure at all** — the surface shimmers and the shape does not
> move.

---

## 21.4 What a particle does *not* have

Listed because each absence is a decision.

| Missing | Why |
|---|---|
| **Velocity** | Position is computed from a schedule, not integrated from forces. See §21.5. |
| **Mass** | No forces exist to act on it. |
| **Rotation** | It is a round sprite. Rotating it does nothing. |
| **Colour** | Sampled from `PARTICLES.colorRamp` by brightness. All particles share the ramp. |
| **Age / lifetime** | It is never created or destroyed. It exists for the whole scene. |
| **State enum** | Derived from `time` vs `aLiftAt` / `aSeatAt` every frame. See §21.6. |
| **Neighbour awareness** | No flocking, no collision, no separation. Particles pass through each other. |
| **Normal / material** | Emissive. Nothing lights it. |

### No collision, no flocking

Particles pass straight through one another and no particle ever knows another
exists.

> **Why this is fine:** the river's coherence comes from **shared guide curves**,
> not from flocking rules. Every particle following the same path with slight
> variation produces exactly the look flocking would, at zero cost and with
> perfect determinism.
>
> Flocking would also break the schedule. A particle that gets pushed off course
> by a neighbour cannot guarantee its `aSeatAt` deadline, and the bridge stops
> being guaranteed to complete.

---

## 21.5 Position is computed, not simulated

**The most important architectural decision in the particle system.**

A particle's position at time `t` is a **pure function** of its attributes and
`t`. Nothing is integrated. There is no previous frame.

```glsl
vec3 positionAt(float t) {
    if (t < aLiftAt)  return dormantPosition(t);
    if (t >= aSeatAt) return seatedPosition(t);
    return flightPosition(t);
}
```

### What this buys

| Property | Consequence |
|---|---|
| **No per-frame state** | Nothing to store, nothing to read back, no ping-pong buffers |
| **Frame-rate independent** | A 30fps device and a 144fps device show identical positions at identical times |
| **Scrubbable** | Jump to `T+8.3` instantly. Essential for `shoot.mjs` captures. |
| **Deterministic** | Every playback is pixel-identical. The reference frame can be diffed. |
| **No drift** | Nothing accumulates over four hours |
| **Trivially parallel** | Every particle independent. Perfect for a vertex shader. |

### What it costs

**Interaction cannot be integrated into the position.** The cursor's effect has
to be a *displacement applied on top* of the computed position, not a force that
changes a trajectory.

This turns out to be a feature rather than a limitation — it is exactly what
makes Law 5 enforceable. `maxDisplacement` is a hard clamp on an offset, so the
bridge is **structurally incapable** of being permanently deformed.

```glsl
vec3 finalPosition = positionAt(t) + interactionOffset(t);
```

The two terms never interact. The schedule always wins.

> **Trap:** the instinct of anyone who has written a particle system before is
> Euler integration — `pos += vel * dt`. It will be proposed. It breaks
> determinism, frame-rate independence, scrubbing, and Law 5 simultaneously.
> Log it if it comes up again.

---

## 21.6 State is derived, not stored

```glsl
float state;  // computed fresh every frame

if      (t <  aLiftAt)                       state = DORMANT;
else if (t <  aLiftAt + LIFT_VERTICAL_PHASE) state = LIFTING;
else if (t <  aSeatAt - approachDuration)    state = GLIDING;
else if (t <  aSeatAt)                       state = APPROACHING;
else                                          state = SEATED;
```

Five states, three comparisons, zero memory.

### Why this matters for trails

`PARTICLES.trail.statesWithTrails` = `['lifting', 'gliding', 'approaching']`.

Because state is derived **in the same shader invocation that computes the
position**, there is no possibility of a one-frame lag between a particle
seating and its trail stopping.

> That lag is the single most common trail bug: the state check happens on the
> CPU one frame late, so with 140,000 particles seating across a 5.8s window,
> a persistent faint blur accumulates exactly on the bridge's shape. The bridge
> looks out of focus and nobody can find the cause. See
> [`11_phase_2_glide.md`](11_phase_2_glide.md) §11.5.

---

## 21.7 Size

```ts
PARTICLES.sizePx = { min: 1.1, max: 2.9 }
PARTICLES.sizeAttenuation = 320
```

```glsl
float size = mix(sizePxMin, sizePxMax, brightness)
           * aSizeVar
           * (sizeAttenuation / viewDistance)
           * devicePixelRatio;
```

Three multipliers:

**Brightness** — brighter particles are larger. A gliding particle (0.92) is
visibly bigger than a dormant one (0.17), which reinforces the energy reading
without touching colour.

**`aSizeVar`** — ±15% per particle, so the river has grain.

**Distance attenuation** — the primary depth cue for the particle system. At
`320`, a particle at 320u renders at its nominal size; at 1280u it renders at a
quarter of it.

### Size is capped for a reason

`max: 2.9px` even though larger particles read better on 4K displays.

> **Fill rate is the real limit of this scene, not particle count.** Additive
> particles are cheap to transform and expensive to *fill*. Doubling particle
> size quadruples the pixels touched, and the dense regions — tower legs, cable
> anchors — already have heavy overdraw.
>
> Going from 2.9px to 4px is a **1.9× increase** in the scene's most expensive
> cost, for a barely perceptible visual gain. See
> [`34_performance_budget.md`](34_performance_budget.md).

---

## 21.8 The sprite

Particles are drawn as `gl_PointSize` points with a procedural round falloff —
**no texture**.

```glsl
float d = length(gl_PointCoord - vec2(0.5));
float alpha = 1.0 - smoothstep(0.24, 0.5, d);
if (alpha <= 0.0) discard;
```

| | |
|---|---|
| Core | Solid to `d = 0.24` |
| Falloff | `smoothstep` to `d = 0.5` |
| Edge | Fully transparent |

**Why no texture:** one texture fetch × 140,000 particles × 60fps is real
bandwidth for a shape that is four lines of maths. The procedural version is
also resolution-independent — it stays crisp at any `gl_PointSize`.

**The `discard`** is important. Without it, the transparent corners of every
point sprite still write to the framebuffer, adding ~36% wasted fill on the
scene's most fill-bound pass.

---

## 21.9 Memory and upload

| Item | Size at 140k |
|---|---|
| Attribute buffer (24 floats) | 13.4 MB |
| Colour ramp texture (256 × 1, RGBA8) | 1 KB |
| Guide curve LUT (512 × 4, RGBA32F) | 32 KB |
| **Total** | **~13.5 MB** |

Uploaded **once**, at initialisation. Nothing is streamed, nothing is updated
per frame.

Per-frame CPU→GPU traffic is a handful of uniforms: current time, cursor
position, camera matrices, phase constants. **Under 1 KB per frame.**

### Initialisation cost

| Step | Time (mid-range laptop) |
|---|---|
| Build terrain heightfield | ~34ms |
| Generate bridge target cloud | ~48ms |
| Seed particles (140k heightfield lookups) | ~6ms |
| Compute schedules | ~4ms |
| Build guide curve LUT | ~2ms |
| Upload buffers | ~11ms |
| **Total** | **~105ms** |

Comfortably inside Phase 0's 1.2 seconds, which is one of the reasons Phase 0
exists.

> **Trap:** seeding by re-evaluating the noise stack 140,000 times instead of
> sampling the built heightfield costs ~400ms and produces a visible hitch
> before the scene starts. See [`17_terrain.md`](17_terrain.md) §17.8.

---

## 21.10 Failure modes

**1 · Particle count ≠ target count.**
Holes in the bridge, or particles with no destination. Assert at init.

**2 · Euler integration instead of a computed position.**
Breaks determinism, frame-rate independence, scrubbing, and Law 5.

**3 · State stored on the CPU.**
One-frame lag on trail cutoff → the finished bridge looks blurred.

**4 · Roll parameters derived from one hash.**
Visible correlation: all wide-radius particles rolling at the same rate.

**5 · `aBreatheDir` radial or normal-based.**
The bridge inflates, or its surfaces ripple like water.

**6 · Missing `discard` in the fragment shader.**
~36% wasted fill on the most expensive pass.

**7 · Particle size raised for 4K.**
Quadratic fill-rate cost for a marginal gain.

**8 · Seeding via noise re-evaluation.**
~400ms startup hitch.

---

## 21.11 Where this lives in code

```
src/scene/elements/particles.ts   ← attribute generation, buffer construction
src/scene/material.ts             ← the ShaderMaterial, uniforms, blending
src/gl/glsl.ts                    ← vertex and fragment shader source
src/scene/density.ts              ← seed distribution
src/scene/centreline.ts           ← aU computation
```

---

## 21.12 Checklist

- [ ] One particle system, one geometry, one material, **one draw call**.
- [ ] 14 attributes, set once at init, never rewritten.
- [ ] `particleCount === targetCount`, asserted.
- [ ] Position is a **pure function** of attributes and time. No integration.
- [ ] Identical output at 30fps and 144fps.
- [ ] The scene can be scrubbed instantly to any timestamp.
- [ ] State is **derived in the shader**, not stored on the CPU.
- [ ] Trails stop on the exact frame a particle seats — no lag, no smear.
- [ ] `aSeatAt` is treated as a deadline; a delayed particle speeds up.
- [ ] Interaction is an **additive offset** clamped at `maxDisplacement`, never
      a force.
- [ ] Roll phase, radius, and turns are three independent attributes.
- [ ] `aBreatheDir` is a fixed random unit vector — not radial, not normal.
- [ ] Particles lift along `aSeedNormal`, not world-up.
- [ ] Sprite is procedural with a `discard` on the transparent edge.
- [ ] Particle size capped at 2.9px regardless of display resolution.
- [ ] Per-frame CPU→GPU traffic is under 1 KB.
- [ ] Initialisation completes inside Phase 0's 1.2s.

---

**Next:** [`22_particle_lifecycle.md`](22_particle_lifecycle.md) — the state
machine.
