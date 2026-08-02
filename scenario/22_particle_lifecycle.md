# 22 — PARTICLE LIFECYCLE

**The state machine, and what happens at every boundary.**

---

## 22.1 The five states

```
      ┌─────────┐   t ≥ aLiftAt    ┌─────────┐
      │ DORMANT │ ───────────────► │ LIFTING │
      └─────────┘                  └────┬────┘
           ▲                            │ t ≥ aLiftAt + 0.42
           │                            ▼
           │                       ┌─────────┐
           │                       │ GLIDING │
           │                       └────┬────┘
           │                            │ t ≥ aSeatAt − approachDuration
           │                            ▼
           │                     ┌─────────────┐
           │                     │ APPROACHING │
           │                     └──────┬──────┘
           │                            │ t ≥ aSeatAt
           │                            ▼
           │                       ┌─────────┐
           │                       │ SEATED  │
           │                       └────┬────┘
           │                            │ rewind only
           │                            ▼
           │                     ┌─────────────┐
           │                     │  DEPARTING  │
           │                     └──────┬──────┘
           │                            │
           │                            ▼
           │                     ┌─────────────┐
           └──────────────────── │  RETURNING  │
              t ≥ aLandAt        └─────────────┘
```

**Five states in a normal run.** Two more (`DEPARTING`, `RETURNING`) exist only
when `SCENE.loop` is enabled.

### State is derived, never stored

```glsl
if      (t <  aLiftAt)                    state = DORMANT;
else if (t <  aLiftAt + VERTICAL_PHASE)   state = LIFTING;
else if (t <  aSeatAt - approachDur)      state = GLIDING;
else if (t <  aSeatAt)                    state = APPROACHING;
else                                       state = SEATED;
```

Three comparisons per particle per frame. No memory, no transitions to manage,
no possibility of a particle being in the wrong state.

---

## 22.2 Property table

Everything that changes with state, in one place.

| Property | DORMANT | LIFTING | GLIDING | APPROACHING | SEATED |
|---|---|---|---|---|---|
| **Brightness** | 0.17 | 0.17→0.55 | 0.92 | 0.92→1.00 | 0.74 |
| **Size** | min | rising | high | peak | mid |
| **Trails** | ✗ | **✓** | **✓** | **✓** | ✗ |
| **Position source** | `aSeed` | ballistic | guide curve | blend to target | `aTarget` |
| **Speed** | 0 | 26→238 u/s | 238 u/s | 238→0 | 0 |
| **Barrel roll** | ✗ | fading in | full | damping out | ✗ |
| **Cursor response** | **none** | steer | steer | steer, reduced | displace + spring |
| **Idle motion** | shimmer | ✗ | ✗ | ✗ | breathe |
| **Feeds swarm light** | ✗ | ✓ | ✓ | ✓ | ✗ |

### The three rules hidden in that table

**1 · Dormant particles do not respond to the cursor.** They are part of the
ground. Airborne ones do. The transition is per-particle, so during Phase 1 the
cursor pushes aside flying particles and passes straight through the dormant
ones beneath them — which requires no explanation to a viewer.

**2 · Trails exist for exactly three states.** `LIFTING`, `GLIDING`,
`APPROACHING`. A `SEATED` particle that smears makes the finished bridge look
out of focus.

**3 · Cursor behaviour changes fundamentally at seating.** Flying particles are
**steered** (direction deflected, speed preserved — Law 4). Seated particles are
**displaced** (position offset, spring return — Law 5). These are genuinely
different mechanisms and must stay separate.

---

## 22.3 DORMANT

**`T+0.000` → `aLiftAt`**

Lying on the terrain at `aSeed`, oriented to `aSeedNormal`.

```ts
DORMANT_SHIMMER = {
  amplitude: 0.055,        // brightness varies 0.115 … 0.225
  frequencyHz: 0.13,
  phaseScatter: true,
  doubleRateFraction: 0.09,
}
```

**Position is completely static.** The shimmer is brightness only — no
movement. A dormant particle occupies exactly `aSeed` for its entire dormancy.

> **Why no positional idle:** moving dormant particles would make the ground
> look like it is already active, which pre-empts the awakening. They are
> asleep, and asleep things do not drift.

**Duration varies enormously.** A particle at `u = 1.0` is dormant for 1.2
seconds. A particle at `u = 0.0` is dormant for 5.6 seconds — nearly half the
intro.

---

## 22.4 LIFTING

**`aLiftAt` → `aLiftAt + 0.42s`**

```ts
LIFT = {
  releaseSpeed: 26,          // u/s
  verticalPhase: 0.42,       // s
  brightenDistance: 9.5,     // u
  maxTurnRate: 210,          // deg/s
}
```

### Position

Ballistic along `aSeedNormal`, decelerating:

```glsl
float e = t - aLiftAt;
vec3 pos = aSeed + aSeedNormal * (releaseSpeed * e - 0.5 * dragCoeff * e * e);
```

Covers roughly **9–11 world units** over the 0.42s.

### Brightening is by distance, not time

```glsl
float brightness = mix(0.17, 0.55,
    smoothstep(0.0, 9.5, distance(pos, aSeed)));
```

> **Why:** a particle on a steep slope travels less vertical distance in the
> same time. Tying brightness to distance means it brightens more slowly —
> correct, because it *is* moving more slowly against the terrain. The field
> brightens unevenly, following the landscape, and nobody authored that.

### The release puff

A brief brightening on the **ground it left**, not on the particle.

| Property | Value |
|---|---|
| Peak | 0.22 |
| Radius | 2.4u |
| Duration | 140ms |
| Curve | instant rise, `easeOutQuad` decay |
| Colour | `--moss` `#1D3A0A`, additive |

Individually invisible; collectively the wave front acquires a faint dusting of
light on ground it has just vacated.

> **Cheap version:** drop entirely on `low` and `minimal`. It is the most
> expendable effect in the scene and nothing depends on it.

### Trails begin here

Not at `GLIDING`. A rising particle already streaks, which is what makes the
wave front look like it is *steaming* rather than like dots changing position.

---

## 22.5 GLIDING

**`aLiftAt + 0.42s` → `aSeatAt − approachDuration`**

The longest state, and the one that produces the river.

### The bend into the glide

The first ~280ms of `GLIDING` is a turn: the velocity rotates from "away from
the ground" toward the guide curve, capped at `maxTurnRate` = 210 °/s.

Smooth arc, never a corner.

### Position

```glsl
float p = easeInOutCubic(flightProgress);
vec3 base = guideCurve(p);                       // shared path, see doc 23
vec3 roll = rollOffset(p, aRollPhase, aRollRadius, aRollTurns);
vec3 pos  = base + roll;
```

### Speed

Nominal `238 u/s`, modulated by `aSpeedVar` (±11%) and by
`easeInOutCubic` across the flight.

The `aSpeedVar` variation is what gives the river **internal shear** — faster
particles gradually overtake slower ones and the stream develops braided
structure over its length, for free.

### Brightness is 0.92 — higher than seated

The scene's central aesthetic inversion. Argued in
[`11_phase_2_glide.md`](11_phase_2_glide.md) §11.6.

### Feeds the swarm lights

Only `LIFTING`, `GLIDING`, and `APPROACHING` particles are binned into the five
swarm-light clusters. This is why the illumination fades as the bridge builds —
the population feeding it is shrinking.

---

## 22.6 APPROACHING

**`aSeatAt − approachDuration` → `aSeatAt`**

`FLIGHT.approachFraction` = **0.22**, so this is the final 22% of the flight —
roughly **1.0–1.25 seconds**.

Four things happen simultaneously.

### 1 · It leaves the river

Position blends from the guide curve toward a direct line to `aTarget`:

```glsl
float b = smoothstep(0.0, 1.0, approachProgress);
vec3 pos = mix(guideCurvePos, directToTargetPos, b);
```

`smoothstep` means there is **no corner** where it departs. Visually the river
continuously sheds particles from its underside — like sparks falling out of a
stream — concentrated wherever the construction front currently is.

### 2 · Roll damps to zero

```glsl
float rollScale = 1.0 - approachProgress;
```

Without this, particles arrive still spiralling and wobble into position. With
it, they straighten out and arrive cleanly.

### 3 · Deceleration — `easeOutQuint`

```
speed(a) = 238 × (1 − easeOutQuint(a))
```

| Approach progress | Speed |
|---|---|
| 0% | 238 u/s |
| 50% | 231 u/s |
| 80% | 162 u/s |
| 95% | 54 u/s |
| 100% | 0 |

**Aggressive on purpose.** The particle holds most of its speed for most of the
approach, then sheds it very fast.

> A gentle `easeInOut` deceleration makes 140,000 particles *drift* into
> position and the phase reads as settling dust. `easeOutQuint` makes each
> arrival an **event** — the particle commits, then stops. Multiplied by 140,000
> staggered arrivals, the bridge acquires a granular, ticking quality, like
> something being fastened together.

### 4 · Cursor immunity ramps in

```ts
INTERACTION.flight.approachAvoidScale = 0.35
avoidStrength = base × 0.35 × (1 − approachProgress)
```

At 95% of the way to its target, a particle is effectively **immune** to the
cursor.

> **Why this is not a Law 5 violation.** Law 5 says interaction disturbs but
> never destroys. Letting a late-approach particle be pushed off course *would*
> destroy something — the bridge's guaranteed completion. Reduced avoidance
> protects the structure, which is what Law 5 is for.
>
> Visually it reads as **determination**: the particles nearest their
> destination are the hardest to deflect.

---

## 22.7 The seating transition

The single most important frame boundary in the system.

**On the exact frame `t ≥ aSeatAt`:**

| Change | Detail |
|---|---|
| Position | Snaps to exactly `aTarget` |
| Brightness | `1.00` held for **exactly 1 frame** |
| Size | `× 1.35` for the same 1 frame |
| Trails | **stop immediately** |
| Cursor model | steering → displacement |
| Idle motion | breathing fades in over 400ms |

**Then over the next 180ms:** brightness decays `1.00 → 0.74`, `easeOutQuad`.

### The snap must be exactly one frame

At peak assembly rate roughly **700 particles seat per frame**, so the
construction front carries a continuous sparkle of arrivals.

> **Trap:** two or three frames of flash and the front develops a bright leading
> edge that reads as a **scanning beam** sweeping the bridge into existence.
> That is a completely different — and far more generic — idea, and Phase 3
> works hard to avoid it.

### Trails must stop on the same frame

Because state is derived in the same shader invocation that computes position,
this is guaranteed. If state were stored on the CPU one frame late, a persistent
faint blur would accumulate exactly on the bridge's shape.

---

## 22.8 SEATED

**`aSeatAt` → ∞**

Position is `aTarget`, plus two offsets.

```glsl
vec3 pos = aTarget
         + aBreatheDir * sin(t * TAU * 0.21 + aHash * TAU) * 0.9
         + interactionOffset;
```

### Breathing

```ts
PARTICLES.breathe = { amplitude: 0.9, frequencyHz: 0.21, phaseScatter: true }
```

`aBreatheDir` is a **fixed random unit vector** per particle.

> **Why not radial or normal-based:** radial breathing makes the bridge inflate
> and deflate; normal-based makes surfaces ripple like water. A fixed random
> direction produces motion with **no collective structure at all** — the surface
> shimmers and the shape does not move.

**Phase scatter is mandatory.** Synchronised breathing makes the whole bridge
swell together, which is a **pulse** — and the scene gets exactly one of those,
at completion. See [`13_phase_4_completion.md`](13_phase_4_completion.md) §13.4.

### Interaction offset

```
d = distance(aTarget, cursorWorld)
strength = 1 − smoothstep(26, 90, d)
offset = normalize(aTarget − cursorWorld) × strength × 30
```

Applied with the spring asymmetry: `riseResponse` 0.34s out,
`returnResponse` 1.40s back. Clamped at `maxDisplacement` = 30u.

**The clamp is what makes Law 5 structural rather than disciplinary.** 30u
against a 468u main span is 6.4%. The silhouette survives by construction.

---

## 22.9 Rewind states

Only when `SCENE.loop === true`.

### DEPARTING

`rewindAt` → `rewindAt + 0.12s`

- Brightness `0.74 → 1.00` over 120ms — the same peak as arrival
- Lifts along the local structural normal (perpendicular to the deck, outward
  from a tower leg)
- Initial speed `34 u/s`
- Trails resume

### RETURNING

`rewindAt + 0.12s` → `aLandAt`

- A **simplified direct arc** back to `aSeed` — **not** a retrace of the
  outbound path
- Barrel roll at `aRollTurns × 0.6`
- Deceleration `easeOutQuad` — gentler than assembly's `easeOutQuint`
- Brightness falls `1.00 → 0.17` over the final 340ms

> **`retraceExact` is `false` for a reason.** An exact reversal looks like video
> played backwards — the eye is extremely good at detecting time-reversed motion,
> and the moment it registers, the illusion that these are objects with agency
> collapses.

### Back to DORMANT

Lands at exactly `aSeed` — the same spot it left.

> **Same seed, not a new one.** If particles landed at fresh random positions
> each cycle, the ground's density pattern would drift and the second build would
> differ from the first. Returning home makes the loop exactly repeatable.

### Softer deadlines

```ts
REWIND.landingDeadlineSlack = 0.400      // vs 0.000 for assembly
```

A returning particle landing 200ms late costs nothing — it lands into an empty
valley and the restart delay absorbs it. Nothing is watching the ground.

---

## 22.10 Lifetime summary for one particle

A particle at `u = 0.5`, layer `deck`:

| State | From | To | Duration |
|---|---|---|---|
| DORMANT | `T+0.000` | `T+2.649` | 2.649s |
| LIFTING | `T+2.649` | `T+3.069` | 0.420s |
| GLIDING | `T+3.069` | `T+7.057` | 3.988s |
| APPROACHING | `T+7.057` | `T+8.300` | 1.243s |
| SEATED | `T+8.300` | ∞ | — |

And for one at `u = 1.0`, layer `piers`:

| State | From | To | Duration |
|---|---|---|---|
| DORMANT | `T+0.000` | `T+1.200` | 1.200s |
| LIFTING | `T+1.200` | `T+1.620` | 0.420s |
| GLIDING | `T+1.620` | `T+4.476` | 2.856s |
| APPROACHING | `T+4.476` | `T+5.400` | 0.924s |
| SEATED | `T+5.400` | ∞ | — |

**Note the second particle is seated by `T+5.400`** — before Phase 2 has
nominally ended. Phases describe the wave, not individual particles.

---

## 22.11 Failure modes

**1 · State stored instead of derived.**
One-frame trail lag → the finished bridge looks blurred.

**2 · Dormant particles responding to the cursor.**
The ground appears to be made of loose objects, pre-empting the awakening.

**3 · Snap flash longer than one frame.**
A scanning-beam leading edge on the construction front.

**4 · Roll not damping over the approach.**
Particles wobble into position instead of arriving.

**5 · Gentle deceleration instead of `easeOutQuint`.**
Arrivals read as settling dust rather than as events.

**6 · No cursor immunity during late approach.**
Stragglers arrive after the completion pulse.

**7 · Synchronised breathing.**
The bridge pulses forever — the forbidden heartbeat.

**8 · Breathing direction radial or normal-based.**
The bridge inflates, or its surfaces ripple.

**9 · Rewind landing at new random positions.**
The loop is not repeatable; cycle 2 differs from cycle 1.

**10 · Exact retrace on rewind.**
Unmistakably video-played-backwards.

---

## 22.12 Checklist

- [ ] Five states in a normal run, derived from three comparisons.
- [ ] No state is stored on the CPU.
- [ ] `DORMANT` particles are positionally static — shimmer is brightness only.
- [ ] `DORMANT` particles do **not** respond to the cursor.
- [ ] Lift is along `aSeedNormal`, not world-up.
- [ ] Brightening during lift is by **distance from seed**, not elapsed time.
- [ ] Trails begin at `LIFTING`, not at `GLIDING`.
- [ ] Trails cover exactly `LIFTING`, `GLIDING`, `APPROACHING`.
- [ ] The bend into the glide is capped at 210 °/s — a smooth arc, no corner.
- [ ] `brightness.gliding` (0.92) > `brightness.seated` (0.74).
- [ ] Approach departs the river via `smoothstep` — no visible corner.
- [ ] Roll damps to zero across the approach.
- [ ] Deceleration is `easeOutQuint`.
- [ ] Cursor avoidance scales to zero over the approach.
- [ ] Snap flash is **exactly one frame** at brightness 1.00, size × 1.35.
- [ ] Trails stop on the **same frame** a particle seats.
- [ ] Breathing fades in over 400ms; it does not snap on.
- [ ] `aBreatheDir` is a fixed random unit vector, phase-scattered.
- [ ] Interaction offset is clamped at 30u.
- [ ] Rewind returns every particle to its **original** `aSeed`.
- [ ] Rewind does **not** retrace outbound paths.

---

**Next:** [`23_flight_choreography.md`](23_flight_choreography.md) — the paths
themselves.
