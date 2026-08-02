# 27 — INTERACTION DURING FLIGHT

**Law 4, in detail. How a moving particle avoids the cursor without ever slowing
down.**

---

## 27.1 The law

> **A particle in flight never stops.**
>
> From the moment it leaves the ground until the moment it reaches its target, it
> is moving. Nothing may halt it — not the cursor, not a touch, not a collision,
> not another particle.
>
> If the cursor is in its way, the particle **steers around** the cursor's
> influence radius and keeps going. It curves; it does not brake.

This is the most commonly violated rule in the project, because the obvious
implementation of repulsion breaks it.

---

## 27.2 Why the obvious implementation fails

### What everyone writes first

```glsl
// WRONG
vec3 repulsion = normalize(pos - cursor) * strength;
velocity += repulsion * dt;
pos += velocity * dt;
```

Add a repulsion force to velocity. It is what every particle tutorial does, and
it is correct for smoke, dust, and leaves.

### Why it is wrong here

**With enough force — or with the cursor held directly in a particle's path —
the repulsion cancels the forward velocity and the particle stalls.**

```
      particle heading →→→→→
                             ● cursor
      repulsion         ←←←←←

      net velocity:      ~0     ← particle hovers in place
```

It hangs there, motionless, until the cursor moves.

### Why a stall is damaging, not just wrong

A stalled particle **misses its `aSeatAt` deadline**.

`aSeatAt` is not a target — it is the time at which that particle must be part
of the bridge. A particle that arrives late seats **after the completion pulse**,
into a bridge that already looked finished.

The symptom at the page level: the build completes, the pulse fires, the UI
begins revealing — and stray particles are still trickling in behind the text.
It looks broken, and the cause is three files away from the symptom.

> This is why Law 4 is a law and not a preference.

---

## 27.3 The correct model — steering

**Deflect the direction. Preserve the magnitude.**

```glsl
vec3 heading = normalize(idealVelocity);          // where it wants to go
float speed  = length(idealVelocity);             // how fast — DO NOT TOUCH

vec3 away    = normalize(pos - cursorWorld);
float d      = distance(pos, cursorWorld);

float strength = 1.0 - smoothstep(0.0, avoidRadius, d);

// Take only the component of `away` perpendicular to the heading.
// The parallel component is what would slow the particle down.
vec3 lateral = away - heading * dot(away, heading);
lateral      = normalize(lateral + EPS);

// Rotate the heading toward `lateral`, capped at maxDeflection.
float angle    = radians(maxDeflection) * strength;
vec3 newHeading = normalize(heading * cos(angle) + lateral * sin(angle));

vec3 velocity = newHeading * speed;               // magnitude unchanged
```

### The key line

```glsl
vec3 lateral = away - heading * dot(away, heading);
```

This **removes the component of the repulsion that points backwards along the
heading** — which is precisely the component that would brake the particle.

What remains is pure sideways steering.

```
   BEFORE (naive repulsion)          AFTER (lateral only)

   heading  →→→→→→→→                 heading  →→→→→→→→
   away     ←←←←↖                    away     ←←←←↖
                                     lateral       ↑
   net:     slower, deflected        net:     same speed, deflected
```

### The deflection cap

```ts
INTERACTION.flight.maxDeflection = 62      // degrees
```

At full strength the heading rotates at most 62° from its ideal.

| Value | Result |
|---|---|
| 30° | Barely avoids. Particles pass visibly through the cursor. |
| **62°** | **A decisive, readable swerve. Reads as evasion.** |
| 85° | Particles turn almost perpendicular. The river fractures. |
| 90°+ | Paths become unrecoverable; deadlines start slipping. |

---

## 27.4 The speed floor

A second, independent guarantee.

```ts
INTERACTION.flight.speedFloor = 0.92
```

**A particle's speed may never drop below 92% of its nominal value, under any
circumstance.**

```glsl
float minSpeed = nominalSpeed * speedFloor;
speed = max(speed, minSpeed);
```

### Why have it if steering already preserves speed

Belt and braces. The lateral projection preserves magnitude *analytically*, but
in practice speed can still sag from:

- The recovery term pulling back toward the guide curve
- Floating-point error accumulating in `normalize()`
- Any future contributor adding a term that touches magnitude

The floor is a **hard assertion in the shader**. If anyone breaks the steering
maths later, particles get slower but never stall, and the bridge still
completes.

`npm run interact-check` verifies the floor holds under a full cursor sweep.

---

## 27.5 The avoid radius is smaller than the influence radius

```ts
INTERACTION.influenceRadius = 90     // seated particles
INTERACTION.flight.avoidRadius = 70  // flying particles
```

**A flying particle reacts later and less than a seated one.**

| | Reason |
|---|---|
| Seated | At rest. Any force moves it immediately. |
| Flying | Has momentum and a destination. Should read as *evading* — a late, decisive turn, not an early drift. |

### A second, structural reason

As particles seat during Phase 3, their influence radius grows from 70 to 90.
If the two values were equal there would be no transition — but the *behaviour*
still changes (steering → displacement), and a behaviour change with no
accompanying visual change reads as a glitch.

The radius change disguises the switch.

---

## 27.6 Recovery

After passing the cursor, the particle must return to its guide curve.

```ts
INTERACTION.flight.recoveryRate = 3.2      // 1/s
```

```glsl
offsetFromGuide *= exp(-recoveryRate * dt);
```

At `3.2/s`, ~96% of the offset is closed within one second.

### Exponential, not spring

A spring would overshoot, and an overshooting particle crosses its guide curve
and oscillates around it. In a stream of 140,000 that reads as turbulence, which
belongs to a different kind of scene.

Exponential decay is monotonic: the particle returns and stops returning.

### Deflection lengthens the path — and that is fine

A deflected particle travels further. Because speed is **derived** from
`pathLength / duration` (see
[`23_flight_choreography.md`](23_flight_choreography.md) §23.6), its speed rises
automatically to meet the same deadline.

**No correction logic is needed.** The deadline is met by construction.

This is the second reason the computed-position architecture matters: it makes
Law 4 self-enforcing.

---

## 27.7 The approach exception

A particle in its final approach has a deadline it can no longer recover from.

```ts
INTERACTION.flight.approachAvoidScale = 0.35
```

```glsl
float avoidStrength = base * approachAvoidScale * (1.0 - approachProgress);
```

| Approach progress | Avoidance strength |
|---|---|
| 0% | 35% of normal |
| 50% | 17.5% |
| 80% | 7% |
| 95% | **1.75% — effectively immune** |
| 100% | 0 |

**At 95% of the way to its target, a particle cannot be deflected at all.** It
commits and lands.

### Why this is not a Law 5 violation

Law 5 says interaction disturbs but never destroys.

Letting a late-approach particle be pushed off course **would** destroy
something — the bridge's guaranteed completion. Reduced avoidance protects the
structure, which is exactly what Law 5 is for.

### How it reads

**Determination.** The particles nearest their destination are the hardest to
deflect. A viewer sweeping the cursor through the construction front sees the
stream part around it, while the particles closest to landing push straight
through.

Nobody has to be told this. It looks like intent.

---

## 27.8 What flying particles never do

| Forbidden | Why |
|---|---|
| **Stop** | Law 4. Missed deadlines. |
| **Reverse** | Nothing in this scene moves backwards except during rewind. |
| **Orbit the cursor** | Reads as a toy. Also unrecoverable — an orbiting particle never reaches its target. |
| **Bunch up behind the cursor** | Would require particles to know about each other. They do not. |
| **Change colour on avoidance** | Interaction is positional only. |
| **Emit a trail spike** | The trail follows the position; it needs no special case. |
| **Collide with each other** | No neighbour awareness. Particles pass through one another. |

### No flocking, no collision

Particles never know another particle exists.

> **Why this is fine:** the river's coherence comes from **shared guide curves**,
> not from flocking rules. Every particle following the same path with slight
> per-particle variation produces exactly the look flocking would, at zero cost
> and with perfect determinism.
>
> Flocking would also break the schedule. A particle pushed off course by a
> neighbour cannot guarantee its deadline, and the bridge stops being guaranteed
> to complete.

---

## 27.9 What it looks like

### Phase 2 — the void in the river

Moving the cursor through the river opens a **moving void**. Particles curve
around it and close in behind, like a hand through smoke — except the flow never
slows, so the void has hard, fast edges rather than a turbulent wake.

Because trails are active, the void is drawn into the trail buffer too and
persists for ~430ms after the cursor has moved on. The result is a smooth,
sweeping channel carved through the light.

> This is the most photogenic interaction on the page. It is also the one least
> likely to be discovered, because the UI does not exist during Phase 2 and
> nothing invites the viewer to move their mouse. That is an accepted trade — see
> [`40_decision_log.md`](40_decision_log.md) **D-006**.

### Phase 3 — parting at the construction front

The cursor held near the construction front produces the scene's best moment:
the stream parts around it, while particles in their final approach push
straight through and land.

Two different behaviours, visible simultaneously, arising from one parameter.

### Phase 1 — passing through the ground

The cursor pushes aside rising particles and passes straight through the dormant
ones lying beneath them.

Looks correct, needs no explanation. Things in the air move when disturbed;
things on the ground do not.

---

## 27.10 Verification

```bash
npm run interact-check
```

For flight, it asserts:

| # | Assertion |
|---|---|
| 1 | **No particle's speed drops below `nominalSpeed × 0.92`** at any frame, under a full cursor sweep across the frame at 4 speeds |
| 2 | **No particle misses its `aSeatAt`** by more than 1 frame, under the same sweep |
| 3 | **Heading deflection never exceeds `maxDeflection`** |
| 4 | Offset from the guide curve decays monotonically after the cursor passes — **no oscillation** |
| 5 | With the cursor parked directly on the guide curve for 10s, **all particles still pass and all deadlines are met** |

Assertion 5 is the direct test of Law 4. It is the one that catches the naive
repulsion implementation.

---

## 27.11 Failure modes

**1 · Repulsion added to velocity.**
The canonical failure. Particles stall under a stationary cursor and arrive after
the completion pulse.

**2 · Speed floor missing.**
Steering maths is correct today; someone adds a drag term next month and
particles slow without stalling. Slow enough to miss deadlines, not slow enough
to be obvious.

**3 · No lateral projection.**
Using `away` directly instead of its perpendicular component. Particles are
pushed backwards along their heading and lose speed even when steering looks
correct.

**4 · `maxDeflection` too high.**
Above ~85° the river fractures and paths become unrecoverable.

**5 · Spring recovery instead of exponential.**
Particles oscillate around the guide curve. The stream reads as turbulent.

**6 · No approach exception.**
Stragglers arrive after the completion pulse whenever a viewer holds the cursor
near the construction front — which is exactly where an engaged viewer will put
it.

**7 · `avoidRadius` equal to `influenceRadius`.**
The steering→displacement switch at seating has no visual accompaniment and
reads as a glitch.

**8 · Flocking or collision added.**
Deadlines become unguaranteeable; the bridge can finish with holes.

**9 · Deflection driven by screen-space distance.**
Particles far behind or in front of the cursor in depth get deflected because
they are near it in 2D. Use world-space distance to the resolved cursor point.

---

## 27.12 Checklist

- [ ] Steering deflects **direction**; speed is preserved analytically.
- [ ] The lateral projection removes the along-heading component of the
      repulsion.
- [ ] `speedFloor` = 0.92 is enforced as a hard `max()` in the shader.
- [ ] `maxDeflection` = 62°, capped.
- [ ] `avoidRadius` (70u) is **smaller** than `influenceRadius` (90u).
- [ ] Recovery onto the guide curve is **exponential**, not a spring.
- [ ] Deflection lengthens the path; speed rises automatically to meet the
      deadline. No correction logic exists.
- [ ] `approachAvoidScale` = 0.35, scaling to zero across the approach.
- [ ] A particle at 95% approach progress is effectively immune to the cursor.
- [ ] Flying particles never stop, reverse, orbit, or bunch.
- [ ] No flocking. No collision. No neighbour awareness.
- [ ] Interaction never changes a flying particle's colour or brightness.
- [ ] Deflection uses **world-space** distance to the resolved cursor point.
- [ ] With the cursor parked on the guide curve for 10 seconds, **every particle
      still passes and every deadline is met.**
- [ ] All five `interact-check` flight assertions pass.

---

**Next:** [`28_input_and_devices.md`](28_input_and_devices.md) — mouse, touch,
and everything else.
