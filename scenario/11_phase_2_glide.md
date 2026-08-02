# 11 — PHASE 2 · THE GLIDE

**`T+2.800` → `T+5.400` · duration 2.600s · 156 frames at 60fps**

---

## 11.1 The one-line version

> Thousands of separate ascents resolve into a single river of light that sweeps
> across the valley — every particle in it slowly rolling, every one trailing
> light behind it.

---

## 11.2 What this phase is doing

### It is the beauty shot

Phase 2 is the only part of the scene with no structural purpose. Nothing is
built. No information is delivered. It exists because the journey between
"scattered on the ground" and "assembled into a bridge" is the part worth
watching, and skipping it would reduce the scene to a transition.

If someone asks what this project's single strongest image is, it is this
phase.

### It converts a crowd into a current

At the end of Phase 1 the frame contains many individual rising particles. By
the middle of Phase 2 it contains **one thing** — a stream — that happens to be
made of particles.

That perceptual shift, from *many* to *one*, is the phase's real work. It is
achieved almost entirely by two mechanisms: shared guide curves (so everything
moves the same way) and trails (so the gaps between particles fill in).

### It is where the landscape is revealed

`LIGHTING.swarmLights` peak here, at **0.35**. This is the moment the most light
is in the air, so it is the moment the mountains are most visible. After this,
as particles seat and the river thins, the valley darkens again.

The viewer sees the landscape most clearly during the phase where they are least
likely to be looking at it. That is fine — it registers.

---

## 11.3 The river

### Shape

The river is not a tube. It is a broad, flattened, braided current — wider than
it is tall, frayed at its edges, dense at its core.

```
Cross-section of the river, mid-flight:

                 ░ ░
        ░  ░ ▒ ▒ ▓ ▒ ▒ ░  ░           ← thin upper fringe
    ░ ░ ▒ ▓ ▓ █ █ █ ▓ ▓ ▒ ░ ░
  ░ ▒ ▓ █ █ █ █ █ █ █ █ ▓ ▒ ░         ← dense core
    ░ ░ ▒ ▓ ▓ █ █ █ ▓ ▓ ▒ ░ ░
        ░  ░ ▒ ▒ ▓ ▒ ▒ ░  ░
                 ░ ░

  ├─────────── ~180u ───────────┤
                 ├─ ~70u ─┤ (vertical)
```

| Property | Value |
|---|---|
| Core width | ~90u |
| Full width including fringe | ~180u |
| Vertical extent | ~70u |
| Aspect | Roughly 2.5 : 1, flattened |

> **Why flattened:** a circular cross-section reads as a *pipe* or a *hose*. A
> flattened one reads as a *flow* — a river, a current of air, a shoal. The
> difference is significant and costs nothing to get right.

### Path

The river follows the **bridge centreline offset upward and outward**. It does
not follow it exactly, because a river that runs precisely where the bridge will
be would obscure the assembly happening beneath it.

```ts
export const RIVER = {
  /** Vertical offset above the bridge centreline. */
  heightAbove: 74,          // world units

  /** Lateral offset — the river runs slightly to the camera side of the
   *  bridge line, so assembly is never hidden behind it. */
  lateralOffset: 46,

  /** The offsets taper to zero at the far end, so the river converges onto
   *  the bridge exactly where construction is happening. */
  taperStart: 0.72,         // u value where the taper begins
} as const
```

The result: the river arcs **above and in front of** the bridge's line for most
of its length, then dives down onto it at the far end where the particles are
actually needed.

> This is a piece of pure staging, in the theatrical sense. It has no physical
> justification. It exists so that the camera can see both the source of the
> particles and their destination at the same time — which is the whole point of
> the composition.

### Speed

| Property | Value |
|---|---|
| Glide speed (nominal) | **238 u/s** |
| Variation between particles | ±11% |
| Speed easing | `easeInOutCubic` across the full flight |

At 238 u/s and a bridge arc length of 1624u, a particle travelling the full
length would take ~6.8s. Most travel less, which is why flight durations land in
the 4.5–5.7s band derived in [`36_CONFIGURATION.md`](36_CONFIGURATION.md) §36.8.

---

## 11.4 The barrel roll

Every particle in flight traces a slow helix around its own line of travel.

### The maths

```
// Given: position along the flight path (p), the path tangent (T),
// and two perpendicular basis vectors (N, B) forming a frame with T.

theta = roll.phase + roll.turns × TAU × flightProgress

offset = N × cos(theta) × radius(flightProgress)
       + B × sin(theta) × radius(flightProgress)

finalPosition = p + offset
```

```ts
FLIGHT.roll = {
  radius: { min: 0.4, max: 1.2 },     // world units, per particle
  turns:  { min: 1.6, max: 3.4 },     // revolutions over the whole flight
  phaseScatter: true,                  // starting angle randomised
  dampenOverApproach: true,            // radius → 0 during final approach
}
```

Each particle gets its own `radius`, `turns`, and starting `phase`, all
randomised within their ranges and derived from `hash(particleIndex)` so they
are stable across frames without costing memory.

### The frame problem

Constructing `N` and `B` from the path tangent naively — for example, by
crossing `T` with world-up — produces a frame that **flips** wherever the path
becomes vertical. Every particle passing that point snaps to a new roll
orientation simultaneously, producing a visible seam in the river.

**Use a parallel-transport frame** (also called a rotation-minimising frame):
carry the frame forward along the curve, rotating it only as much as the
tangent requires. The guide curves are fixed for the whole scene, so this can
be computed **once, at initialisation**, and baked into a lookup texture.

> Full derivation in [`23_flight_choreography.md`](23_flight_choreography.md)
> §"Parallel transport frames".

### Why the radius is so small

`0.4 – 1.2` world units, against a river core **90 units** wide. The helix is
roughly **1% of the width of the stream it lives in.**

This is deliberate and it is the most counter-intuitive number in the phase.

| Radius | Result |
|---|---|
| `0.4 – 1.2` (**correct**) | Shimmer. The river appears to have internal texture and life. No individual spiral is traceable. |
| `3 – 6` | Individual paths become followable. The river fragments into visible strands. |
| `> 8` | Confetti. The stream reads as chaos, not as flow. |

**The test:** pause the scene mid-glide and try to trace one particle's spiral
with your eye. If you can, the radius is too large.

> **Trap:** in isolation — one particle, zoomed in, on a debug view — a 1u helix
> looks like nothing at all, and the natural response is to increase it until the
> roll is clearly visible. That is testing the parameter in the wrong context.
> The roll is never seen; it is only ever *felt*, as the reason the river
> shimmers instead of sliding.

### Damping over the approach

`dampenOverApproach: true`. The roll radius scales to zero across the final
`FLIGHT.approachFraction` = **22%** of the flight.

Without this, particles arrive at their targets while still spiralling and
wobble into position. With it, they straighten out over the last fifth of the
journey and arrive cleanly.

---

## 11.5 Trails

Trails are what turn a stream of dots into a stream of light. They are the
mechanism responsible for the long sweeping streaks in the lower-left of the
reference frame.

### Implementation: accumulation buffer

Trails are **not** per-particle line geometry.

```
Each frame:
  1. Multiply the trail buffer by PARTICLES.trail.decay (0.88)
  2. Render all particles in `lifting` or `gliding` state into it, additively
  3. Composite the trail buffer under the current particle pass
```

A particle's contribution therefore persists for approximately

```
frames until below 1% = log(0.01) / log(0.88) ≈ 36 frames ≈ 600ms
```

with the *visually significant* portion being the first **26 frames ≈ 430ms**
(`PARTICLES.trail.lengthFrames`).

| Approach | Cost at 140k particles | Verdict |
|---|---|---|
| Per-particle line strips | 140,000 × 26 segments = 3.6M segments/frame | Not affordable |
| **Accumulation buffer** | **One full-screen pass** | ✅ |

### Rules

| Rule | Reason |
|---|---|
| Trails render for `lifting`, `gliding` **and `approaching`** | A seated particle that smears makes the finished bridge look motion-blurred. Dropping `approaching` — as an earlier draft did — stops the river streaking for the final 22% of every flight, visible as the stream fading out a fifth of the way before each landing. |
| The buffer is at **half resolution** | Trails are soft by nature; nobody can tell. Halves the cost. |
| The buffer feeds bloom | The streaks must glow, or they read as scratches |
| Cleared to black at scene start and on rewind restart | Otherwise a loop accumulates ghosting across cycles |

> **Trap — the seated smear.** The most common trail bug: the state check is
> done on the CPU one frame late, so a particle contributes to the trail buffer
> for one frame *after* it seats. With 140,000 particles all seating over a 5.8s
> window, this produces a persistent faint blur exactly on the bridge's shape.
> It looks like the bridge is out of focus. Check the state on the GPU, in the
> same shader invocation that computes the position.

---

## 11.6 The brightness inversion

```ts
PARTICLES.brightness = {
  dormant:     0.17,
  lifting:     0.55,
  gliding:     0.92,   // ← brightest sustained state
  approaching: 1.00,   // ← brief peak
  seated:      0.74,   // ← DIMMER than gliding
}
```

**A particle in flight is brighter than a particle in the finished bridge.**

This is the single most important aesthetic decision in the scene, and it is the
opposite of what a first draft would do.

> **The obvious version:** particles are dim while travelling and blaze once they
> become part of the structure. The bridge is the achievement; the bridge should
> be the brightest thing.
>
> **What that produces:** a scene where the interesting part is the last two
> seconds, and everything before it is preamble. The build becomes a progress
> bar.
>
> **What we do instead:** the travel is the hero. Particles are at their most
> alive in transit and **calm down** once they become structure. The bridge is
> not a triumphant blaze; it is something that has settled.

This is not only aesthetics. It maps directly onto the brand argument in
[`03_brand_philosophy.md`](03_brand_philosophy.md): *the transformation is the
product, not the endpoint.* The scene says that with brightness values.

**Consequence for the composition:** during Phase 2 the brightest region of the
frame is the lower-left — the foreground river — and not the bridge line. The
eye is pulled toward the empty space where nothing has been built yet. That
tension is what makes the assembly satisfying when it starts.

---

## 11.7 The landscape at peak illumination

```ts
LIGHTING.swarmLights.intensityByPhase.glide = 0.35   // maximum for the scene
```

Five point lights, following the centroids of the five largest particle
clusters, now sitting high in the air along the river's path.

| Property | Value |
|---|---|
| Intensity | 0.35 (the hard cap, `intensityMax`) |
| Colour | `--lime-bright` `#A6FD3F` |
| Distance | 320u |
| Decay | 2 |
| Terrain contribution clamp | 0.18 |

Because the lights are now **above** the terrain rather than sitting on it, they
light ridge tops and upper slopes, leaving valleys dark. The landscape reads as
lit from a passing source — which is exactly what is happening.

### Moving light, moving shadow-shape

The clusters move at glide speed, so the illumination **sweeps** across the
landscape at roughly 238 u/s. Ridges brighten as the river passes and fall dark
behind it.

> This is the payoff of the swarm-light approach. A static approximation — one
> fixed fill light turned up during Phase 2 — would light the same amount of
> terrain but would not *move*, and the sweep is the entire reason the effect
> reads as caused by the particles.

### Still restrained

Even at peak, the terrain contribution is clamped at **0.18** luminance. The
mountains never become a lit stage; they become *legible*.

Colour distribution at the peak of Phase 2 is approximately:

| Band | Share |
|---|---|
| Near-black | ~87% |
| Deep green | ~9% |
| Neon accent | ~4% |

Still inside the 85/10/5 envelope. If a build exceeds 5% accent during Phase 2,
the swarm lights or the bloom are too strong.

---

## 11.8 What else is happening during Phase 2

Phase 2 is *named* for the glide, but three other things run concurrently.

| Concurrent event | Detail |
|---|---|
| **Lift-off continues** | The lift window runs to `T+5.600`. At `T+2.800`, 62% of particles are airborne; at `T+5.400` it is ~97%. The near ground is still releasing throughout. |
| **The first particles begin their approach** | Particles targeting `u ≈ 1.0` enter `approaching` state around `T+5.0`, before Phase 3 nominally begins. |
| **Bloom ramps** | `0.460` → `0.620` across the phase. |

**The frame at `T+4.100` contains:** dormant particles in the near foreground, a
lift-off wave in the mid-ground, a full river overhead, and — in the last few
hundred milliseconds of the phase — the first particles beginning to decelerate
at the far horizon.

Four populations. Simultaneously. That is the texture of this scene.

---

## 11.9 Frame-by-frame

| Frame | `T+` | Airborne | Seated | Bloom | Swarm | Notes |
|---|---|---|---|---|---|---|
| 168 | 2.800 | 61.9% | 0 | 0.460 | 0.140 | River is forming — a current, not yet a stream |
| 180 | 3.000 | 67.4% | 0 | 0.478 | 0.176 | |
| 192 | 3.200 | 72.1% | 0 | 0.496 | 0.208 | Trails now dense enough to read as continuous streaks |
| 204 | 3.400 | 76.3% | 0 | 0.512 | 0.238 | |
| 216 | 3.600 | 80.0% | 0 | 0.528 | 0.264 | Right-hand ridges clearly readable |
| 228 | 3.800 | 83.2% | 0 | 0.542 | 0.288 | |
| 240 | 4.000 | 86.1% | 0 | 0.556 | 0.308 | **River at maximum density** |
| 246 | **4.100** | 87.4% | 0 | 0.562 | 0.316 | **Capture point `glide`** |
| 252 | 4.200 | 88.6% | 0 | 0.568 | 0.324 | |
| 264 | 4.400 | 90.8% | 0 | 0.580 | 0.338 | Swarm lights effectively at peak |
| 276 | 4.600 | 92.7% | 0 | 0.591 | 0.348 | |
| 288 | 4.800 | 94.3% | 0 | 0.600 | 0.350 | |
| 300 | 5.000 | 95.6% | 0 | 0.608 | 0.350 | First particles enter `approaching` at the far horizon |
| 312 | 5.200 | 96.6% | 0 | 0.615 | 0.350 | Visible deceleration at `u ≈ 1.0` |
| **324** | **5.400** | **97.3%** | **0** | **0.620** | **0.350** | **Phase 3 begins.** First seat. |

---

## 11.10 Interaction during Phase 2

Effectively the entire particle population is now airborne, so the cursor's
effect is at its most visible of any phase in the scene.

### What it looks like

Moving the cursor through the river opens a **moving void** in the stream.
Particles curve around it and close back in behind, like a hand through smoke —
except the flow never slows, so the void has hard, fast edges rather than a
turbulent wake.

Because trails are active, the void is drawn in the trail buffer too, so it
persists visually for ~430ms after the cursor has moved on. The result is a
smooth, sweeping channel carved through the light.

> This is, incidentally, the most photogenic interaction in the whole page. It
> is worth making sure a first-time visitor is likely to move their mouse during
> `T+2.8` – `T+5.4`. Nothing in the UI prompts them to — the UI does not exist
> yet — which is an accepted trade.

### The rules, restated

```ts
INTERACTION.flight = {
  avoidRadius: 70,
  speedFloor: 0.92,        // LAW 4
  maxDeflection: 62,       // degrees
  recoveryRate: 3.2,
}
```

**Direction is deflected. Speed is preserved.** A particle whose path is blocked
curves around the obstruction and continues at full speed. It never stalls,
never reverses, never hovers.

After passing the cursor it re-converges on its guide curve at `recoveryRate`
= 3.2/s, i.e. it closes ~96% of the remaining offset in one second.

### Why `avoidRadius` (70) is smaller than `influenceRadius` (90)

A flying particle reacts **later and less** than a seated one.

- A seated particle is at rest and any force moves it immediately.
- A flying particle has momentum and a destination; it should read as *evading*,
  which implies a late, decisive turn rather than an early drift.

The 70/90 split also prevents a subtle problem at the phase boundary: as
particles seat during Phase 3, their influence radius grows from 70 to 90. If
the two values were equal there would be no transition, but the *behaviour*
still changes (steering → displacement), and the radius change disguises the
switch.

### Dolly

Still **disabled**. Enabled at `T+12.400`.

---

## 11.11 Capture point — `glide` at `T+4.100`

**What it must show:**

1. A single continuous river of light sweeping from the lower-left of frame up
   and to the right
2. Visible **flow direction** — the viewer can tell which way it is going
3. Long, smooth trail streaks in the lower-left, matching the fan in the
   reference frame (`07` §7.6)
4. Internal shimmer, with **no traceable individual spirals**
5. Right-hand ridges faintly but clearly lit
6. Some particles still on the ground in the near foreground
7. **Still no bridge**
8. The river is the brightest region of the frame — brighter than anywhere the
   bridge will be

**Colour distribution:**

| Band | Share |
|---|---|
| Near-black | ~87% |
| Deep green | ~9% |
| Neon accent | ~4% |

---

## 11.12 Performance note

Phase 2 is the **most expensive phase in the scene**, and it therefore sets the
performance tier.

Why:

| Cost | Reason |
|---|---|
| Maximum simultaneous trails | ~87% of particles in trail-emitting states — more than any other moment |
| Maximum overdraw | Particles are concentrated into a narrow river, so they overlap heavily in screen space. Fill rate, not particle count, is the limit. |
| Swarm lights at peak | Five point lights against a 384×384 terrain |
| Bloom rising | Larger effective kernel as strength climbs |

> **Tier selection must be measured during Phase 2**, or a device will pass on
> Phase 0's trivial load and then stutter through the phase that matters.
>
> `PERF.blockChangesDuringPhases` = `[3, 4]` — changes are blocked during
> assembly and completion because a particle-count change mid-assembly is visible
> as a pop. **Phase 2 is deliberately not blocked.** It is where downgrades are
> expected to happen.

See [`34_performance_budget.md`](34_performance_budget.md).

---

## 11.13 Phase 2 checklist

- [ ] The river reads as **one thing**, not as many particles.
- [ ] Cross-section is flattened (~2.5:1), not circular.
- [ ] The river runs **above and camera-side of** the bridge line, tapering
      onto it at `u ≈ 0.72`.
- [ ] Barrel roll radius is **0.4–1.2u**. No individual spiral is traceable by
      eye.
- [ ] Roll uses a **parallel-transport frame**. No visible seam where the path
      approaches vertical.
- [ ] Roll radius damps to zero over the final 22% of each flight.
- [ ] Trails are an **accumulation buffer**, not line geometry.
- [ ] Trails render for `lifting` / `gliding` / `approaching`. **No seated
      particle smears.**
- [ ] The trail buffer feeds the bloom pass.
- [ ] `brightness.gliding` (0.92) is **greater than** `brightness.seated`
      (0.74). The inversion is present in the shipped build.
- [ ] Swarm lights peak at **0.35** and terrain contribution never exceeds
      **0.18**.
- [ ] Illumination visibly **sweeps** across ridges as the river passes.
- [ ] Lift-off is still occurring in the near foreground throughout the phase.
- [ ] At `T+5.400` approximately **97%** of particles are airborne, and
      **zero** are seated.
- [ ] Cursor carves a clean void through the river; no particle stalls.
- [ ] Speed floor of **0.92** holds under all cursor positions —
      `npm run interact-check`.
- [ ] Dolly is still disabled.
- [ ] Colour distribution ~87 / 9 / 4.
- [ ] Performance tier is measured during this phase, not earlier.

---

**Next:** [`12_phase_3_assembly.md`](12_phase_3_assembly.md) — the build.
