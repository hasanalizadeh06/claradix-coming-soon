# 10 — PHASE 1 · AWAKENING

**`T+1.200` → `T+2.800` · duration 1.600s · 96 frames at 60fps**

---

## 10.1 The one-line version

> The ground lets go. Starting at the far horizon and spreading toward the
> viewer, the specks lift off the terrain, brightening as they rise — and for the
> first time, the mountains become visible.

---

## 10.2 What this phase is doing

### It establishes that the particles belong to this place

This is the narrative function, and it is the reason Phase 1 cannot be replaced
by particles simply flying in from off-screen.

If the particles arrive from outside the frame, the story becomes *"something
was delivered here."* If they rise out of the ground the viewer has already been
looking at, the story becomes *"this place transformed itself."*

Those are different stories, and only the second one is the brand argument. See
[`03_brand_philosophy.md`](03_brand_philosophy.md).

### It is the first light

Phase 0 set the darkness baseline. Phase 1 is the first time the frame gets
brighter. Every subsequent increase is measured against this moment.

### It reveals the landscape

The swarm lights fade in here. Ridges that were pure black silhouettes in Phase
0 begin to show a soft green wash as clusters of rising particles pass near
them. The viewer does not consciously notice this happening — they notice, later,
that they can see more of the valley than they could at the start.

---

## 10.3 The wave

### Direction: far to near

Lift-off begins at **`u = 1.0`** — the far end of the bridge's future path,
near the right horizon — and spreads toward the camera.

```
    T+1.20            T+1.67           T+2.65          T+3.97      T+5.60
      │                 │                │               │            │
      ▼                 ▼                ▼               ▼            ▼
  ┌───────────────────────────────────────────────────────────────────────┐
  │  u=0.00        u=0.25          u=0.50         u=0.75         u=1.00   │
  │  NEAR ◄────────────────────────────────────────────────────► FAR      │
  │  (bottom-left of frame)                        (right horizon)        │
  └───────────────────────────────────────────────────────────────────────┘
       ▲                                                            ▲
       │                                                            │
   lifts LAST                                                  lifts FIRST
```

**Why far first:** the far particles have the furthest to travel *and* they must
arrive first, because assembly runs far → near. The choreography is causally
honest — everything that happens early happens because of something that must
happen later.

### The formula

```
liftAt(u) = LIFT.windowStart
          + pow(1 − u, LIFT.curveExp) × LIFT.windowSpan
          + random(−LIFT.jitter, +LIFT.jitter)
```

```ts
LIFT.windowStart = 1.200
LIFT.windowSpan  = 4.400
LIFT.curveExp    = 1.6
LIFT.jitter      = 0.090
```

| `u` | `pow(1−u, 1.6)` | `liftAt` | Where in frame |
|---|---|---|---|
| 1.00 | 0.000 | **T+1.200** | far horizon, right edge |
| 0.90 | 0.025 | T+1.310 | |
| 0.75 | 0.086 | T+1.578 | just past the far tower |
| 0.60 | 0.187 | T+2.023 | between the towers |
| 0.50 | 0.330 | T+2.652 | mid-span |
| 0.40 | 0.427 | T+3.079 | near the main tower |
| 0.25 | 0.629 | T+3.968 | near approach viaduct |
| 0.10 | 0.834 | T+4.870 | close foreground |
| 0.00 | 1.000 | **T+5.600** | bottom-left corner |

### The wave outlives its phase

**Read that table again.** The lift-off window runs from `T+1.200` to
`T+5.600` — which is **4.4 seconds**, while Phase 1 is only **1.6 seconds
long**.

This is not an error. It is the central fact about how the phases work.

> **Phase 1 is named for the period when lift-off is the dominant visual event,
> not for the period when lift-off occurs.**

By `T+2.800` — the nominal end of Phase 1 — roughly **62%** of all particles
have left the ground. The remaining 38% keep rising throughout Phases 2 and 3.
The near ground is still releasing particles at `T+5.400`, when the far end of
the bridge has already started to assemble.

The consequence, which is essential to how the scene looks:

> **At almost every moment of the scene, particles exist in several different
> states at once.** At `T+4.000` the frame contains dormant particles in the
> foreground, lifting particles in the mid-ground, and a dense river of gliding
> particles overhead. That simultaneity is what makes it read as a *process*
> rather than as three animations played in sequence.

### `curveExp` — why 1.6

The exponent controls how the wave is distributed across the valley.

| Value | Behaviour | Reads as |
|---|---|---|
| `1.0` | Linear sweep, constant speed | A scanner line. Mechanical. |
| `1.6` | **Front-loaded.** Far half empties fast, near ground releases slowly | A wave that starts sharp and trails off. Natural. |
| `2.5` | Extremely front-loaded | Far end explodes, near ground barely moves. Uneven. |

At `1.6`, half of all particles have lifted by `u ≈ 0.42`, i.e. within the first
`~1.45s` of the window — but the tail runs on for another three seconds.

### Jitter — why the wave front must be ragged

`LIFT.jitter` = **±90ms**, which at wave-front speed corresponds to roughly
**±34 world units** of positional raggedness.

```
Without jitter (WRONG):          With jitter (CORRECT):

   ░░░░░│█████                      ░░░│░█░████
   ░░░░░│█████                      ░░░░│██░███
   ░░░░░│█████                      ░░│░█░█████
   ░░░░░│█████                      ░░░░│░████░
   ░░░░░│█████                      ░░░│██░████
        ▲                              ▲
   a straight edge                a soft, broken front
   sweeping the ground

   reads as: a machine scanning     reads as: wind crossing a field
```

> **Trap:** jitter is the sort of parameter that gets set to zero during
> debugging (to make the wave easier to observe) and then never restored. A
> straight-edged wave is one of the most immediately obvious "this looks cheap"
> failures in the scene.

---

## 10.4 What one particle does

The complete lift-off of a single particle, from the frame it wakes.

### Stage A — release · `0ms → ~30ms`

The particle's state changes from `dormant` to `lifting`.

- It gains an initial velocity of `LIFT.releaseSpeed` = **26 u/s**
- **Direction: along the terrain normal at its seed point** — not world-up.
- On flat valley floor these are the same. On a 30° hillside the particle
  lifts at 30° off vertical, away from the slope.

> **Why the normal and not straight up:** because it makes the ground read as
> *releasing* the particle rather than as *losing* it. A hillside full of
> particles all rising perpendicular to the slope looks like the hill is
> exhaling. The same particles rising vertically look like gravity was
> switched off.
>
> This is a small detail that costs nothing and is disproportionately
> responsible for the phase feeling physical.

### Stage B — the puff · `0ms → 140ms`

At the moment of release, a small, brief brightening appears **at the seed
point** — not on the particle, but on the ground it left.

| Property | Value |
|---|---|
| Peak intensity | 0.22 |
| Radius | 2.4u |
| Duration | 140ms |
| Curve | Instant rise, `easeOutQuad` decay |
| Colour | `--moss` `#1D3A0A`, additive |

Individually invisible. Collectively, the wave front acquires a faint dusting of
light *behind* it, on ground that has just been vacated. It reads as disturbed
dust.

> **Cheap version:** skip the puff entirely on `low` and `minimal` tiers. It is
> the single most expendable effect in the scene — it costs an extra additive
> pass and contributes almost nothing at small particle counts. Nothing else
> depends on it.

### Stage C — vertical rise · `0ms → 420ms`

`LIFT.verticalPhase` = **0.42s**.

The particle rises along its release direction, decelerating slightly, covering
roughly **9–11 world units**.

Its brightness climbs from `0.17` to `0.55` over this stage — and critically,
**brightness is a function of distance travelled from the seed point, not of
elapsed time**:

```
brightness = lerp(
    PARTICLES.brightness.dormant,      // 0.17
    PARTICLES.brightness.lifting,      // 0.55
    smoothstep(0, LIFT.brightenDistance, distanceFromSeed)
)

LIFT.brightenDistance = 9.5   // world units
```

> **Why distance and not time:** a particle released on a steep slope travels
> less vertical distance in the same time. Tying brightness to distance means it
> brightens more slowly — which is exactly right, because it *is* moving more
> slowly against the terrain. The whole field brightens unevenly in a way that
> follows the landscape, and nobody has to author that.

### Stage D — the bend · `420ms → ~700ms`

The trajectory curves. The particle's velocity rotates from "away from the
ground" toward its **guide curve** — the shared flight path described in
[`23_flight_choreography.md`](23_flight_choreography.md).

- The turn is a smooth arc, never a corner
- Turn rate is capped at `LIFT.maxTurnRate` = **210 °/s**
- Speed increases through the turn from 26 u/s toward glide speed

By the end of Stage D the particle's state changes to `gliding`, and it is part
of the river. Trails begin.

> **Trails start at Stage A, not Stage D.** `PARTICLES.trail.statesWithTrails`
> includes `lifting`. A rising particle already leaves a short streak — this is
> what makes the wave front look like it is *steaming* rather than like dots
> changing position.

### Summary

```
 0ms        140ms              420ms                    700ms
  │           │                  │                        │
  ▼           ▼                  ▼                        ▼
  ├─── puff ──┤
  ├──────── vertical rise ───────┤
  │                              ├────── the bend ────────┤
  │                                                       │
 release                                            joins the river
 0.17 bright                                        0.92 bright
 26 u/s                                             glide speed
 state: dormant → lifting                           state: → gliding
```

**Total: ~700ms from ground to river, per particle.**

---

## 10.5 The mountains appear

The swarm lights fade in during this phase. This is the first time the terrain
is lit by anything other than the flat ambient.

```ts
LIGHTING.swarmLights.intensityByPhase = {
  dormant:   0.00,
  awakening: 0.14,   // ← this phase
  glide:     0.35,   // peak
  assembly:  0.20,
  ...
}
```

Five point lights track the centroids of the five largest particle clusters.
During Phase 1 those centroids sit low, close to the terrain, and move with the
wave front — so the illumination sweeps across the landscape with the wave.

| Property | Value |
|---|---|
| Count | 5 |
| Colour | `--lime-bright` `#A6FD3F` |
| Intensity (this phase) | 0.14, ramping from 0.00 over the first 600ms |
| Distance | 320u |
| Decay | 2 (inverse square) |
| **Terrain contribution clamp** | **0.18** — hard limit, enforced in shader |

### The restraint requirement

The brief is explicit: *the particles should illuminate the mountains, but not
too brightly.*

**The test:** a viewer should not be able to identify the moment the mountains
became visible. They should only be able to say, in retrospect, that they can
see more of the valley than they could at the start.

If the mountains are obviously and evenly lit — if it looks like a light was
turned on — the intensity is too high, and the 85/10/5 colour ratio has already
broken. Check `npm run palette` at the `awakening` capture point.

> **Trap — one light per particle.** Someone will suggest it, because it is the
> physically correct thing. It is not possible: 140,000 dynamic lights is not a
> thing any renderer does. The five-centroid approximation is not a compromise
> that loses quality; at these intensities and distances it is
> **indistinguishable** from the correct answer, because the falloff is so broad
> that individual particle positions have no influence on the result.

---

## 10.6 Frame-by-frame

| Frame | `T+` | Airborne | Bloom | Swarm | Notes |
|---|---|---|---|---|---|
| 72 | 1.200 | ~0.0% | 0.300 | 0.000 | First lift. A few dozen particles at `u≈1.0`, at the smallest apparent size in frame. **Visually indistinguishable from Phase 0.** |
| 78 | 1.300 | 0.3% | 0.302 | 0.008 | |
| 84 | **1.400** | 1.1% | 0.306 | 0.020 | **First perceptible change.** A faint brightening at the right horizon. |
| 90 | 1.500 | 2.4% | 0.312 | 0.033 | |
| 96 | 1.600 | 4.2% | 0.321 | 0.046 | The wave front is now identifiable as a moving edge |
| 108 | 1.800 | 9.1% | 0.344 | 0.070 | Far tower footprint is visibly emptying |
| 120 | **2.000** | 15.8% | 0.372 | 0.091 | **Capture point `awakening`** |
| 132 | 2.200 | 24.0% | 0.402 | 0.108 | Mountains on the right are now faintly readable |
| 144 | 2.400 | 33.6% | 0.428 | 0.122 | First particles complete their bend and enter glide |
| 156 | 2.600 | 47.2% | 0.448 | 0.133 | The river is forming — a visible current, not yet a stream |
| **168** | **2.800** | **61.9%** | **0.460** | **0.140** | **Phase 2 begins.** |

> **"Airborne"** = particles in `lifting` or `gliding` state, as a percentage of
> total. It reaches 100% at `T+5.600`, well inside Phase 3.

### The first 200ms are invisible

Frames 72–84 contain real lift-off, but the particles involved are:

- at `u ≈ 1.0`, the furthest point in the scene
- therefore at maximum fog attenuation (`WORLD.fogFar` = 2100u)
- therefore at their smallest apparent size
- and there are only a few dozen of them

This is intentional. The phase boundary is not a cut. The viewer should
experience the awakening as *"…something is happening… over there…"* rather than
as a start signal.

---

## 10.7 Interaction during Phase 1

This is where the interaction model gets its first real complexity, because for
the first time the frame contains particles in **two different states with two
different behaviours**.

| Particle state | Responds to cursor? | Behaviour |
|---|---|---|
| `dormant` | **No** | Part of the ground. Unmovable. |
| `lifting` | **Yes** | Steering avoidance — see below |
| `gliding` | **Yes** | Steering avoidance |
| `seated` | — | None exist yet |

### The rule

> **A particle becomes interactive at the instant it leaves the ground, and not
> before.**

The transition is per-particle, so during Phase 1 the cursor moving across the
frame will push aside the airborne particles and pass straight through the
dormant ones lying beneath them.

**This looks correct and requires no explanation to a viewer.** Things in the
air move when you disturb them; things on the ground do not.

### Flight avoidance, not repulsion

Airborne particles obey **Law 4**: they never stop.

```ts
INTERACTION.flight = {
  avoidRadius: 70,       // smaller than the seated influenceRadius of 90
  speedFloor: 0.92,      // speed may NEVER drop below 92% of nominal
  maxDeflection: 62,     // degrees
  recoveryRate: 3.2,     // 1/s — how fast it returns to its guide curve
}
```

The particle's **direction** is deflected around the cursor's influence sphere.
Its **speed** is preserved. It curves around the obstacle and continues.

Full derivation and the shader implementation: [`27_interaction_during_flight.md`](27_interaction_during_flight.md).

> **The failure mode:** the obvious implementation adds a repulsion force to
> velocity. With enough force — or with the cursor held directly in a particle's
> path — the repulsion cancels the forward velocity and the particle **stalls**,
> hovering in place until the cursor moves.
>
> This breaks the scene in a specific and damaging way: a stalled particle
> misses its `seatAt` deadline, so it arrives after the completion pulse, and
> the bridge finishes with stragglers still trickling in. Law 4 exists to
> prevent exactly this.

### Camera parallax and dolly

| Input | Phase 1 |
|---|---|
| Parallax | **Active** (as in Phase 0) |
| Dolly / wheel / pinch | **Disabled** — swallowed silently |

---

## 10.8 Capture point — `awakening` at `T+2.000`

**What it must show:**

1. A clearly identifiable wave front, positioned around **`u ≈ 0.60`**
2. The front is **ragged**, not a straight line
3. Roughly **16%** of particles airborne
4. Ground behind the front is visibly emptier than ground ahead of it
5. Faint green rim light on the right-hand ridges — present but not obvious
6. Short trails on the rising particles
7. **Still no bridge** — the four regions from `09` §9.10 remain empty

**Colour distribution at `T+2.000`:**

| Band | Share |
|---|---|
| Near-black | ~91% |
| Deep green | ~7% |
| Neon accent | ~2% |

Rising from Phase 0's 94 / 5.5 / 0.5, on its way to the final 85 / 10 / 5.

---

## 10.9 Reduced motion

Phase 1 does not occur. See [`09_phase_0_dormant.md`](09_phase_0_dormant.md)
§9.12 — the entire intro is skipped, not accelerated.

---

## 10.10 Phase 1 checklist

- [ ] Lift-off begins at `u = 1.0` and spreads toward `u = 0`.
- [ ] The lift window is **4.4s long** and extends well past the end of the
      1.6s phase, into Phases 2 and 3.
- [ ] At `T+2.800`, approximately **62%** of particles are airborne — not
      100%.
- [ ] The wave front is **ragged**. `LIFT.jitter` is non-zero in the shipped
      build.
- [ ] Particles lift along the **terrain normal**, not world-up. Verified on a
      steep slope.
- [ ] Brightness is a function of **distance from seed**, not elapsed time.
- [ ] Trails are active from the `lifting` state, not only from `gliding`.
- [ ] The release puff appears on the ground, behind the front. (May be absent
      on `low` / `minimal` tiers.)
- [ ] Swarm lights fade from 0.00 to 0.14 across the phase.
- [ ] Terrain illumination from swarm lights never exceeds the **0.18** clamp.
- [ ] A viewer cannot identify the moment the mountains became visible.
- [ ] Dormant particles do **not** respond to the cursor. Airborne particles
      **do**.
- [ ] No airborne particle's speed drops below **92%** of nominal under any
      cursor position — verified by `npm run interact-check`.
- [ ] Dolly remains disabled.
- [ ] The bridge is still entirely absent.
- [ ] Frames 72–84 (`T+1.200` – `T+1.400`) contain real lift-off but are
      visually near-identical to Phase 0. The boundary is not a cut.

---

**Next:** [`11_phase_2_glide.md`](11_phase_2_glide.md) — the river.
