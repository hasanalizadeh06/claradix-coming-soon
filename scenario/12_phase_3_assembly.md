# 12 — PHASE 3 · ASSEMBLY

**`T+5.400` → `T+11.200` · duration 5.800s · 348 frames at 60fps**

**The longest phase. The one the scene exists for.**

---

## 12.1 The one-line version

> Particles peel off the river and freeze at exact points in empty air. Starting
> at the far horizon and working back toward the viewer, structure accumulates —
> piers, then towers, then roadway, then cables, then hangers — until a bridge
> exists where there was nothing.

---

## 12.2 The two orderings

Assembly is governed by two orderings applied at once. Everything about how this
phase looks comes from their interaction.

### Ordering 1 — spatial: far → near

```
seatAt contribution = (1 − u) × ASSEMBLY.windowSpan       // 5.220s
```

| `u` | Location | Seats at |
|---|---|---|
| 1.00 | far horizon | `T+5.400` |
| 0.75 | past the far tower | `T+6.705` |
| 0.50 | mid-span | `T+8.010` |
| 0.25 | near approach | `T+9.315` |
| 0.00 | bottom-left of frame | `T+10.620` |

The construction front travels **toward the camera** at roughly `1624u / 5.22s`
≈ **311 world units per second** along the bridge.

### Ordering 2 — structural: load-bearing first

```ts
ASSEMBLY.layerOffset = {   // seconds, added on top of the spatial sweep
  piers:      0.000,
  towers:     0.145,
  deck:       0.290,
  mainCables: 0.435,
  hangers:    0.522,
  railing:    0.580,
}
```

At any point along the bridge, the structure builds bottom-up:

```
        railing      ← +0.580s   ┄┄┄┄┄┄┄┄┄┄┄┄┄
        hangers      ← +0.522s   │ │ │ │ │ │ │
        mainCables   ← +0.435s   ╲___________╱
        deck         ← +0.290s   ▀▀▀▀▀▀▀▀▀▀▀▀▀
        towers       ← +0.145s   ║           ║
        piers        ← +0.000s   ▓▓         ▓▓
```

**The whole layer sequence at one point takes 580ms.** The spatial sweep takes
5220ms. So the layers are a fast local detail riding on a slow global wave —
which is exactly what watching real construction from a distance looks like.

### Combined

```
seatAt(u, layer) = 5.400 + (1 − u) × 5.220 + layerOffset[layer] ± 0.055
```

```
Time →      5.4    6.4    7.4    8.4    9.4    10.4   11.2
            │      │      │      │      │      │      │
u=1.00  ████│      │      │      │      │      │      │   far end complete
u=0.85      │███   │      │      │      │      │      │
u=0.70      │  ████│      │      │      │      │      │   far tower done
u=0.55      │      │ ████ │      │      │      │      │
u=0.40      │      │      │████  │      │      │      │   main tower done
u=0.25      │      │      │      │ ████ │      │      │
u=0.10      │      │      │      │      │ ████ │      │
u=0.00      │      │      │      │      │      │██████│   last particle
```

> **Why obey structural order at all?** Nothing forces it. The particles are
> flying light; they could assemble in any sequence.
>
> But a viewer who has ever seen a building go up will *feel* the wrongness of a
> cable that exists before its tower, without being able to name it. The rule
> costs one lookup table and buys the scene its credibility.

---

## 12.3 What one particle does

### Stage A — the peel · last 22% of flight

`FLIGHT.approachFraction` = **0.22**.

The particle's state changes from `gliding` to `approaching`. Three things
happen at once:

1. **It leaves the river.** Its path blends from the shared guide curve toward
   a direct line to its own target. The blend uses `smoothstep`, so there is no
   corner where it departs.
2. **Roll damps to zero.** `FLIGHT.roll.dampenOverApproach` — the helix radius
   scales down, so the particle straightens out instead of wobbling in.
3. **It brightens.** `0.92` → `1.00`, the peak brightness of the entire
   lifecycle.

Visually the river continuously sheds particles from its underside along its
whole length — like sparks falling out of a stream — with the shedding
concentrated wherever the construction front currently is.

### Stage B — deceleration

Speed falls from glide speed (238 u/s) to zero across the approach.

```
speed(t) = glideSpeed × (1 − easeOutQuint(t))        t: 0→1 over the approach
```

`easeOutQuint` is aggressive: the particle holds most of its speed for most of
the approach, then sheds it very fast at the end.

| Approach progress | Speed |
|---|---|
| 0% | 238 u/s |
| 50% | 231 u/s |
| 80% | 162 u/s |
| 95% | 54 u/s |
| 100% | 0 |

> **Why not a gentle deceleration?** Because a linear or `easeInOut` slowdown
> makes 140,000 particles *drift* into position, and the phase reads as settling
> dust. `easeOutQuint` makes each arrival read as an **event** — the particle
> commits, then stops. Multiply by 140,000 staggered arrivals and the bridge
> acquires a granular, ticking quality, like something being fastened together.

### Stage C — the snap · 1 frame + 180ms

At the instant the particle reaches its target:

| Property | Value |
|---|---|
| Brightness | `1.00` held for **1 frame** (16.7ms) |
| Then | decays to `PARTICLES.brightness.seated` = `0.74` over **180ms**, `easeOutQuad` |
| Size | `×1.35` for the same 1 frame, then back to normal |
| State | `approaching` → `seated` |
| Trails | **stop immediately** |

The snap is small — one frame, one particle. But at peak assembly rate roughly
**700 particles seat per frame**, so the construction front carries a continuous
sparkle of arrivals.

> **Trap:** the snap must be exactly one frame. Two or three frames and the
> front develops a bright leading edge that reads as a scanning beam sweeping
> the bridge into existence. That is a completely different — and much more
> generic — idea.

### Stage D — seated

The particle is now structure. It:

- holds its target position
- breathes (`±0.9u`, `0.21 Hz`, scattered phase) — see
  [`14_phase_5_living_scene.md`](14_phase_5_living_scene.md)
- responds to the cursor with **displacement + spring return**, not steering
- emits no trail

---

## 12.4 The retreating deposit point

This is the most important thing to understand about how Phase 3 looks, and it
is the thing that reconciles the choreography with the reference image.

### The river gets shorter

The river is always fed from the **near** ground and always flows **away** from
the camera. But its *destination* — the construction front — starts at the far
horizon and retreats toward the viewer.

So the river shortens continuously.

```
T+5.4   ████████████████████████████████████████►│   full length
T+6.9   ███████████████████████████████►│              front has retreated
T+8.4   ██████████████████████►│
T+9.9   █████████████►│
T+11.0  ████►│                                          almost nothing left
        │
      NEAR                                            FAR
    (camera)                                       (horizon)
```

*Analogy: laying railway track. You carry material from the depot behind you to
the far end, build backwards toward yourself, and the distance you have to carry
it shrinks every hour.*

### This is why the reference frame has foreground trails

The reference image shows a **complete bridge** with **light streaks still
sweeping through the lower-left foreground**.

Under any other reading that is a contradiction: if the bridge is finished,
what is still flying?

Under this one it is exactly right. The reference frame is approximately
**`T+10.500`** — the far four-fifths of the bridge complete, and the last
particles still streaming in through the immediate foreground to finish the near
approach.

> This is logged as note **R-1** in
> [`07_reference_frame_analysis.md`](07_reference_frame_analysis.md) §7.11.
> At true rest (`T+16.000`) there are no trails at all, and a build that shows
> them then is wrong.

### The reveal is toward the viewer

Because the front moves toward the camera, the bridge grows **larger in frame**
as it builds. The far sections that complete first are small, distant, and
compressed by perspective; the near sections that complete last are huge and
sweep across the bottom of the frame.

The phase therefore has a natural crescendo built into its geometry, with no
timing tricks required.

---

## 12.5 What is visible when

A viewer's read of the frame at each moment.

| `T+` | What is legible |
|---|---|
| **5.4 – 5.9** | Points of light hanging in the dark at the right horizon. **No shape yet.** Incomprehensible, and correctly so. |
| **5.9 – 6.4** | A vertical accumulation. The first pier resolves. First recognisable *object*. |
| **6.4 – 7.0** | The **far tower** grows leg by leg. First unmistakably architectural element. This is the moment the viewer understands what is being built. |
| **7.0 – 7.6** | Deck extends from the far tower toward mid-span. The line of the bridge is established. |
| **7.6 – 8.4** | Main cable sweeps between the towers in a catenary. The most beautiful single motion in the phase. |
| **8.4 – 9.0** | **Main tower** completes — the tallest, brightest object in the frame. Composition locks. |
| **9.0 – 9.6** | Hangers drop in rapid succession across the main span. High-frequency detail floods in. |
| **9.6 – 10.4** | Near approach viaduct: piers, then deck, sweeping toward the bottom-left. |
| **10.4 – 11.0** | Foreground deck fills the lower-left. The bridge now exits the frame. |
| **11.0 – 11.2** | Last railing particles in the immediate foreground. River is a thread. |

### The catenary sweep — `T+7.6` to `T+8.4`

Worth calling out separately.

The main cables seat along their length, so the catenary **draws itself** from
the far tower toward the main tower — a single continuous curve appearing over
about 800ms.

It is the only moment in the scene where a long, smooth, mathematically pure
curve is revealed as a curve. Everything else assembles as volume or as
repetition.

> Make sure the particle density along the cables is high enough that this reads
> as a *line* being drawn, not as a row of dots appearing. `BRIDGE` target
> distribution gives cables **16%** of the budget for two curves — deliberately
> generous relative to their surface area, for exactly this reason.

---

## 12.6 Frame-by-frame

| Frame | `T+` | Airborne | Seated | Bloom | Swarm | Front at `u ≈` |
|---|---|---|---|---|---|---|
| 324 | 5.400 | 97.3% | 0.0% | 0.620 | 0.350 | 1.00 |
| 336 | 5.600 | 97.6% | 1.8% | 0.629 | 0.339 | 0.96 |
| 348 | 5.800 | 96.1% | 4.2% | 0.638 | 0.328 | 0.92 |
| 360 | 6.000 | 93.6% | 7.1% | 0.647 | 0.317 | 0.89 |
| **384** | **6.400** | 87.4% | 14.0% | 0.665 | 0.295 | **0.81** · **capture `assembly-early`** |
| 408 | 6.800 | 80.3% | 21.6% | 0.683 | 0.273 | 0.73 · far tower completing |
| 432 | 7.200 | 72.7% | 29.7% | 0.701 | 0.251 | 0.66 |
| 456 | 7.600 | 64.8% | 38.1% | 0.719 | 0.229 | 0.58 · cable sweep begins |
| 480 | 8.000 | 56.6% | 46.7% | 0.737 | 0.207 | 0.50 |
| 504 | 8.400 | 48.3% | 55.5% | 0.755 | 0.185 | 0.42 · cable sweep completes |
| 528 | 8.800 | 40.1% | 64.2% | 0.773 | 0.163 | 0.35 · main tower completing |
| 552 | 9.200 | 32.0% | 72.7% | 0.791 | 0.141 | 0.27 · hangers flooding in |
| 576 | 9.600 | 24.3% | 80.8% | 0.809 | 0.119 | 0.19 |
| 600 | 10.000 | 17.2% | 88.2% | 0.827 | 0.097 | 0.12 |
| **630** | **10.500** | 9.6% | 94.8% | 0.849 | 0.070 | **0.04** · **capture `assembly-late`** |
| 648 | 10.800 | 5.4% | 97.4% | 0.862 | 0.055 | 0.01 |
| 660 | 11.000 | 2.1% | 99.1% | 0.871 | 0.044 | 0.00 |
| **672** | **11.200** | **0.0%** | **100%** | **0.880** | **0.040** | — · **Phase 4 begins** |

### Reading the table

**Airborne peaks at `T+5.600`, then falls for the rest of the phase.** The
crossover — where more particles are seated than flying — is at **`T+8.15`**,
almost exactly the midpoint. The phase is symmetrical in population even though
it is not symmetrical in what it looks like.

**Swarm lights fade from 0.350 to 0.040.** The valley gets *darker* as the
bridge is built, because the light that was illuminating it is landing and
settling. The mountains recede back into silhouette.

> That fade is not a technical consequence — it is a choice, and it is worth
> defending. The landscape is most visible during the journey and least visible
> once the destination is reached. The scene's attention narrows onto the bridge
> exactly as the bridge becomes worth attending to.

**Bloom rises 0.620 → 0.880** across the phase, which partly offsets the swarm
fade. Net frame luminance stays roughly flat; what changes is *where* the light
is.

---

## 12.7 Interaction during Phase 3

The most complex interaction state in the scene: the frame contains particles in
**four states**, with **three different behaviours**.

| State | Population at `T+8.0` | Cursor behaviour |
|---|---|---|
| `dormant` | ~1% | **None.** Part of the ground. |
| `lifting` | ~4% | Steering avoidance (speed preserved) |
| `gliding` | ~48% | Steering avoidance (speed preserved) |
| `approaching` | ~4% | Steering avoidance, **reduced** — see below |
| `seated` | ~47% | Displacement + spring return |

### Approaching particles: reduced avoidance

A particle in its final approach has a deadline. If the cursor deflects it too
far this close to its target, it cannot recover in time and it seats late — after
the completion pulse — which is visible as stragglers arriving into a finished
bridge.

```ts
INTERACTION.flight.approachAvoidScale = 0.35
```

Avoidance strength scales down by `0.35` during the `approaching` state, and
further toward zero as the particle nears its target:

```
avoidStrength = base × approachAvoidScale × (1 − approachProgress)
```

At 95% of the way to its target, a particle is effectively **immune** to the
cursor. It commits and lands.

> **Why this is not a violation of Law 5.** Law 5 says interaction disturbs but
> never destroys. Allowing a late-approach particle to be pushed off course
> *would* destroy something — the bridge's completion. The reduced avoidance
> protects the structure, which is what Law 5 is for.
>
> Visually this reads as *determination*. The particles nearest their
> destination are the hardest to deflect.

### The transition is per-particle

There is no moment where "the interaction model changes". Each particle switches
from steering to displacement at its own `seatAt`. During Phase 3 the cursor can
be over a region containing both, and it does both simultaneously — flying
particles curve around it while seated ones next to them are pushed aside and
spring back.

This looks completely natural and needs no special handling. It is worth
knowing only because it makes the interaction code branchy, and someone will be
tempted to unify it. Do not — the two behaviours are genuinely different, and
Law 4 depends on them staying separate.

### Dolly still disabled

Enabled at `T+12.400`. Pushing the camera into a half-built bridge produces
something indistinguishable from a bug.

---

## 12.8 Capture points

### `assembly-early` at `T+6.400`

**Must show:**

1. Far end of the bridge partially built — piers and the far tower rising
2. **Near two-thirds completely empty** — no structure, no ghost
3. A full river still flowing from the lower-left toward the far horizon
4. Sparkle of arrivals at the construction front
5. Ridges still fairly well lit (swarm at 0.295)

| Band | Share |
|---|---|
| Near-black | ~87% |
| Deep green | ~9% |
| Neon accent | ~4% |

### `assembly-late` at `T+10.500`

**The most important capture in the project.** This is the frame that is
compared against `assets-src/backdrop-source.png`.

**Must show:**

1. Bridge complete from `u = 1.0` down to `u ≈ 0.04` — visually, complete
2. **Light trails still present in the lower-left foreground**, in the fan
   described in `07` §7.6
3. Main tower fully built, at `y 33%–73%` of frame
4. Far tower fully built
5. Catenary cables and hangers all present
6. A last thin thread of river in the immediate foreground
7. **No UI**

| Band | Share |
|---|---|
| Near-black | ~85% |
| Deep green | ~10% |
| Neon accent | ~5% |

> `npm run compare` diffs this capture against the reference image. Comparing
> `settled` (`T+16.000`) instead will always fail on the missing trails —
> correctly. See `07` §7.12.

---

## 12.9 Failure modes specific to this phase

**1 · Particles arriving after `T+11.200`.**
Causes: cursor deflection late in approach (mitigated by
`approachAvoidScale`), a frame-time spike stretching a particle's schedule, or
jitter exceeding its budget. Symptom: stragglers trickling in after the
completion pulse.
**Fix:** `seatAt` is an absolute deadline, not a duration. A particle behind
schedule increases speed to meet it. It must never miss.

**2 · The construction front reads as a straight line.**
Causes: `ASSEMBLY.jitter` set to zero, or layer offsets not applied.
Symptom: a hard vertical edge sweeping the bridge — the "scanning beam" look.
**Fix:** jitter ±55ms and the 580ms layer spread together soften the front into
a zone roughly 200u deep.

**3 · Cables appear before towers.**
Cause: layer offsets not applied, or applied per-layer globally instead of
per-particle.
Symptom: subtly wrong in a way reviewers notice but cannot name.

**4 · The snap flash lasts more than one frame.**
Symptom: a bright leading edge on the construction front — the scanning beam
again, from a different cause.

**5 · Seated particles still emitting trails.**
Symptom: the finished sections look out of focus. See
[`11_phase_2_glide.md`](11_phase_2_glide.md) §11.5.

**6 · Performance downgrade mid-phase.**
`PERF.blockChangesDuringPhases` = `[3, 4]`. A particle-count change during
assembly is visible as a pop — particles vanishing from a structure that is
supposed to be gaining them. Queue any downgrade for Phase 5.

---

## 12.10 Phase 3 checklist

- [ ] Assembly runs **far → near** (`u = 1` → `u = 0`).
- [ ] Within any section, layers seat in order: piers → towers → deck →
      mainCables → hangers → railing.
- [ ] No cable exists before its tower, at any moment.
- [ ] The construction front is a **soft zone**, not a hard line.
      `ASSEMBLY.jitter` is non-zero.
- [ ] Particles peel off the river over the final **22%** of their flight,
      with no visible corner at the departure.
- [ ] Roll damps to zero over the approach. No particle wobbles into position.
- [ ] Deceleration uses `easeOutQuint` — arrivals read as events, not as
      drifting.
- [ ] The snap flash is **exactly one frame**.
- [ ] Seated particles stop emitting trails **immediately**, with no one-frame
      lag.
- [ ] The river **shortens** across the phase as the deposit point retreats
      toward the camera.
- [ ] Trails are still visible in the foreground at `T+10.500`.
- [ ] Swarm lights fade 0.350 → 0.040; the landscape recedes as the bridge
      builds.
- [ ] Bloom rises 0.620 → 0.880.
- [ ] **Every** particle is seated by `T+11.200`. No stragglers.
- [ ] `seatAt` is treated as a deadline — a delayed particle speeds up to meet
      it.
- [ ] Late-approach particles are effectively immune to the cursor.
- [ ] Flying and seated particles coexist under the cursor with their own
      distinct behaviours.
- [ ] No performance tier change occurs during this phase.
- [ ] Dolly remains disabled.
- [ ] `npm run compare` at `T+10.500` matches the reference frame within
      tolerance.

---

**Next:** [`13_phase_4_completion.md`](13_phase_4_completion.md) — the pulse.
