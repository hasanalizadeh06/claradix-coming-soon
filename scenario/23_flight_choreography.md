# 23 — FLIGHT CHOREOGRAPHY

**The paths particles travel, and the maths of the barrel roll.**

---

## 23.1 The problem this solves

140,000 particles have to travel from scattered points on the ground to precise
points on a bridge, and the result must read as **one river**, not as 140,000
independent journeys.

The naive approach — each particle flies straight from its seed to its target —
produces a diffuse cloud drifting upward. No current, no direction, no beauty.

The solution is a **shared path**. Every particle follows the same guide curve
for most of its flight and only peels off at the end.

```
NAIVE (wrong)                    GUIDE CURVE (correct)

  ○ → → → → ●                       ○ ↘
  ○  → → →  ●                        ○ ↘
  ○   → →   ●                         ○ ↘___________
  ○    →    ●                          ○ ══════════► ●●●●●
  ○   → →   ●                         ○ ↗            peel-off
  ○  → → →  ●                        ○ ↗
  ○ → → → → ●                       ○ ↗

  a cloud drifting               a river with a current
```

---

## 23.2 The guide curve

A single curve in world space that every particle follows.

```ts
RIVER = {
  heightAbove: 74,          // world units above the bridge centreline
  lateralOffset: 46,        // toward the camera (+Z side)
  taperStart: 0.72,         // u where both offsets fade to zero
}
```

### Definition

```
guideCurve(u) = centreline(u)
              + WORLD_UP        × heightAbove  × taper(u)
              + cameraSideNormal(u) × lateralOffset × taper(u)

taper(u) = u < taperStart ? 1.0
                          : 1.0 − smoothstep(taperStart, 1.0, u)
```

The river arcs **above and camera-side of** the bridge line for most of its
length, then converges exactly onto the bridge at the far end — where the
construction front is.

```
Cross-section at u = 0.4:              At u = 0.95:

        ░▒▓███▓▒░                          ░▒▓███▓▒░
           ▲                                   ║
           │ 74u                               ║ ~0u
           ▼                                   ▼
   ════════╪════════   deck              ══════╪══════
       ├───┤                                (converged)
        46u
```

### Why offset at all

Pure staging. It has no physical justification.

> The river must not obscure the assembly happening beneath it. If the stream
> ran exactly along the bridge line, the construction front would be permanently
> hidden behind the particles feeding it, and the scene's central event would be
> invisible.
>
> Offsetting it up and toward the camera means we see **both the stream and its
> destination simultaneously**, which is the entire compositional argument of
> the frame.

### Why it converges at the far end

Because the far end is where particles are actually landing early in Phase 3.
A river that stayed offset all the way would deposit its particles from 74u
away, and the peel-off would be a long visible drop rather than a gentle
shedding.

The taper starting at `u = 0.72` means the convergence happens across the far
approach — off to the right of frame, where it is compressed by perspective and
reads as the stream simply arriving.

---

## 23.3 A particle's flight, in three segments

```
 aSeed                                                        aTarget
   ●                                                             ●
   │                                                            ╱
   │ 1. ENTRY                                                  ╱ 3. PEEL
   │    ballistic + turn                                      ╱    smoothstep
   │    ~0.7s                                                ╱     22% of flight
   ╰──────────────► ═══════════════════════════════════════╱
                    2. THE RIVER
                       guide curve + barrel roll
                       ~78% of flight
```

### Segment 1 — entry `~0.70s`

Covered in [`22_particle_lifecycle.md`](22_particle_lifecycle.md) §22.4–22.5.
Ballistic rise along `aSeedNormal`, then a turn capped at 210 °/s onto the guide
curve.

**Where does it join?** At the guide-curve point nearest to the end of its
ballistic arc:

```
uJoin = centreline.nearestU(positionAtEndOfBallistic)
```

Because seeds are distributed along the bridge's footprint (see
[`24_target_assignment.md`](24_target_assignment.md)), a particle joins the river
roughly beneath where it was lying — **not** at the river's source.

> **This is what makes the river feed continuously along its whole length**
> rather than all flowing from one origin point. The stream thickens as it goes,
> because it keeps picking up particles.

### Segment 2 — the river `~78% of flight`

```glsl
float p = easeInOutCubic(flightProgress);
float u = mix(uJoin, uPeel, p);
vec3 base = guideCurve(u);
vec3 roll = rollOffset(p);
vec3 pos  = base + roll;
```

### Segment 3 — the peel `22% of flight`

```glsl
float b = smoothstep(0.0, 1.0, approachProgress);
vec3 pos = mix(guideCurvePos, directToTarget, b);
```

`smoothstep` at both ends means the departure has **no corner** — the particle's
path curves away from the river continuously.

---

## 23.4 The barrel roll

Every particle traces a slow helix around its own line of travel.

### The maths

```glsl
vec3 rollOffset(float p) {
    float theta = aRollPhase + aRollTurns * TAU * p;
    float r     = aRollRadius * rollDamping(p);

    // N and B come from the parallel-transport frame at this u
    return N * cos(theta) * r + B * sin(theta) * r;
}

float rollDamping(float p) {
    // fades in over the first 12%, out over the last 22%
    return smoothstep(0.0, 0.12, p) * (1.0 - smoothstep(0.78, 1.0, p));
}
```

```ts
FLIGHT.roll = {
  radius: { min: 0.4, max: 1.2 },
  turns:  { min: 1.6, max: 3.4 },
  phaseScatter: true,
  dampenOverApproach: true,
}
```

### The radius is deliberately tiny

**0.4 – 1.2 world units, inside a river core 90 units wide.** The helix is about
**1% of the width of the stream it lives in.**

This is the most counter-intuitive number in the whole system.

| Radius | Result |
|---|---|
| **0.4 – 1.2** | **Shimmer.** The river has internal texture and life. No spiral is traceable. |
| 3 – 6 | Individual paths become followable. The river fragments into strands. |
| > 8 | Confetti. The stream reads as chaos, not as flow. |

**The test:** pause mid-glide and try to trace one particle's spiral with your
eye. If you can, it is too large.

> **Trap:** tested in isolation — one particle, zoomed in, on a debug view — a
> 1u helix looks like nothing at all, and the natural response is to increase it
> until the roll is clearly visible. That is testing the parameter in the wrong
> context.
>
> **The roll is never seen. It is only ever felt**, as the reason the river
> shimmers instead of sliding. Always evaluate it at 140,000 particles, at
> normal zoom, in motion.

### Three independent attributes

`aRollPhase`, `aRollRadius`, `aRollTurns` are stored separately rather than
derived from a single hash.

> Deriving all three from one value produces visible correlation: every
> wide-radius particle also rolls at the same rate, and the eye picks out the
> pattern as banding in the stream.

---

## 23.5 Parallel-transport frames

The hard part of the barrel roll, and the part that fails silently if done
naively.

### The problem

To offset a particle perpendicular to its direction of travel, you need two
perpendicular basis vectors `N` and `B`. The obvious construction:

```glsl
vec3 T = normalize(tangent);
vec3 N = normalize(cross(T, vec3(0.0, 1.0, 0.0)));   // ← WRONG
vec3 B = cross(T, N);
```

This is a **Frenet-like frame from world-up**, and it has a singularity: when
`T` becomes parallel to world-up, `cross(T, up)` approaches zero and `N` flips
to an arbitrary direction.

**Symptom:** every particle crossing that region of the curve snaps to a new
roll orientation on the same frame. A visible seam appears in the river — a
discontinuity where the whole stream twists at once.

The bridge centreline rises about 16u over 1624u — nowhere near vertical — so
this may never trigger on the current geometry. **It will trigger the moment
someone adjusts a control point**, and the cause will be extremely hard to find.

### The fix

A **parallel-transport frame** (also called a rotation-minimising frame). Carry
the frame forward along the curve, rotating it only as much as the tangent
change requires:

```
frame[0].N = any vector perpendicular to T[0]
frame[0].B = cross(T[0], N[0])

for i in 1..n:
    v      = P[i] − P[i−1]
    c1     = dot(v, v)
    Nl     = N[i−1] − (2/c1) * dot(v, N[i−1]) * v
    Tl     = T[i−1] − (2/c1) * dot(v, T[i−1]) * v
    v2     = T[i] − Tl
    c2     = dot(v2, v2)
    N[i]   = Nl − (2/c2) * dot(v2, Nl) * v2
    B[i]   = cross(T[i], N[i])
```

(The double-reflection method. It is standard and numerically stable.)

### Precompute it

The guide curve is **fixed for the entire scene**. So this is computed **once,
at initialisation**, and baked into a lookup texture:

```
Guide curve LUT: 512 × 4 texels, RGBA32F
  row 0: position    (x, y, z, u)
  row 1: tangent     (x, y, z, arcLength)
  row 2: normal N    (x, y, z, _)
  row 3: binormal B  (x, y, z, _)

Total: 32 KB
```

The vertex shader samples the LUT by `u`. Cost per particle per frame: **four
texture fetches**.

---

## 23.6 Speed

```ts
RIVER.glideSpeed = 238        // u/s nominal
```

Modulated by two things:

**`aSpeedVar`** — ±11% per particle, fixed at init.

**`easeInOutCubic` across the flight** — slow release, confident middle,
controlled arrival.

### `aSpeedVar` produces braiding for free

Faster particles gradually overtake slower ones. Over a 4–5 second flight, an
11% speed difference accumulates into roughly **100 world units** of relative
displacement.

The result is that the river develops **internal shear and braided structure**
over its length, without any flocking, turbulence, or noise field. It is the
cheapest good-looking thing in the entire scene.

### Speed is a consequence, not a control

A particle's *duration* is fixed by `aSeatAt − aLiftAt`. Its *path length* is
fixed by where it joins and where it peels off.

```
requiredSpeed = pathLength / duration
```

So `238 u/s` is not enforced — it is the **average that falls out** of the
schedule. `aSpeedVar` perturbs the easing curve, not the total.

> **This is why `aSeatAt` can be a hard deadline.** The particle is not moving at
> a speed and hoping to arrive; it is interpolating along a path with a known end
> time. Deflection by the cursor lengthens its path, so its speed rises to
> compensate — automatically, with no correction logic.

---

## 23.7 Interaction and the guide curve

Cursor deflection moves a particle **off** the guide curve. It must get back on.

```ts
INTERACTION.flight.recoveryRate = 3.2       // 1/s
```

```glsl
offsetFromGuide *= exp(-recoveryRate * dt);
```

At `3.2/s`, ~96% of the offset is closed within one second.

### Why exponential rather than a spring

A spring would overshoot, and an overshooting particle crosses its guide curve
and oscillates around it. In a stream of 140,000 that reads as turbulence, which
belongs to a different kind of scene.

Exponential decay is monotonic. The particle returns and stops returning.

### Deflection lengthens the path

A deflected particle travels further, so its required speed rises. This happens
automatically because speed is derived from `pathLength / duration`.

**No correction logic is needed**, and the deadline is still met — which is
exactly what Law 4 requires.

---

## 23.8 The rewind path

Different curve, deliberately.

```ts
REWIND.retraceExact = false
```

A returning particle takes a **single smooth arc** from its bridge position down
to `aSeed`:

```
returnPath(p) = quadraticBezier(
    aTarget,
    midpoint(aTarget, aSeed) + WORLD_UP * returnArcHeight,
    aSeed
)

REWIND.returnArcHeight = 48    // world units
```

Roll continues at `aRollTurns × 0.6`.

### Why not retrace

> An exact reversal looks like **video played backwards**. The eye is extremely
> good at detecting time-reversed motion — decelerations that should be
> accelerations, easing curves running the wrong way — and the moment it
> registers, the illusion that these are objects with agency collapses. They stop
> being particles going home and become a recording being scrubbed.
>
> A different, simpler return path preserves the fiction.

The return river is also **thinner and less organised** than the outbound one,
because particles depart from all along the structure rather than being funnelled
from one source. That asymmetry is correct and should not be "fixed".

---

## 23.9 Debug visualisation

```ts
SCENE.debugShowGuideCurves = false
```

When true, renders:

- The guide curve as a lime line
- The parallel-transport frame as `N`/`B` tick marks every 32 samples
- The taper region highlighted
- The bridge centreline as a dimmer line for comparison

**The single most useful debug view in the project.** Most river problems are
guide-curve problems, and they are invisible until the curve is drawn.

> Must be `false` in production. Asserted in
> [`38_acceptance_criteria.md`](38_acceptance_criteria.md).

---

## 23.10 Failure modes

**1 · Frenet frame from world-up.**
Silent until a control point is adjusted, then a visible twist seam appears in
the river. Use parallel transport.

**2 · Roll radius too large.**
Confetti. Always evaluated in isolation instead of at full population.

**3 · Roll parameters from a single hash.**
Visible correlation banding in the stream.

**4 · Roll not damping at the ends.**
Particles wobble as they join the river and as they arrive.

**5 · All particles joining the river at one point.**
The stream has a visible source and does not thicken along its length. Each
particle must join near where it was lying.

**6 · Guide curve not tapering.**
Particles deposit from 74u away; the peel-off becomes a long visible drop.

**7 · Speed enforced rather than derived.**
Deflected particles miss their deadline, and stragglers arrive after the
completion pulse.

**8 · Spring recovery instead of exponential.**
Particles oscillate around the guide curve; the river reads as turbulent.

**9 · Exact retrace on rewind.**
Unmistakably video played backwards.

**10 · Guide curve LUT recomputed per frame.**
Pure waste — the curve never changes.

---

## 23.11 Checklist

- [ ] All particles share one guide curve.
- [ ] The curve sits 74u above and 46u camera-side of the centreline.
- [ ] Both offsets taper to zero from `u = 0.72` to `u = 1.0`.
- [ ] Particles join the river **near where they were lying**, not at a common
      source.
- [ ] The river visibly thickens along its length.
- [ ] The frame is **parallel-transport**, not Frenet-from-up.
- [ ] The frame LUT is computed once at init and baked into a texture.
- [ ] Roll radius is 0.4–1.2u. No individual spiral is traceable at full
      population.
- [ ] Roll phase, radius, and turns are three independent attributes.
- [ ] Roll damps in over the first 12% and out over the last 22%.
- [ ] Speed is **derived** from `pathLength / duration`, never enforced.
- [ ] `aSpeedVar` at ±11% produces visible braiding in the stream.
- [ ] Deflection lengthens the path and raises speed automatically; deadlines
      are still met.
- [ ] Recovery onto the guide curve is **exponential**, not a spring. No
      oscillation.
- [ ] Peel-off uses `smoothstep` at both ends — no corner.
- [ ] Rewind uses a simplified arc, not a retrace.
- [ ] `SCENE.debugShowGuideCurves` is `false` in production.

---

**Next:** [`24_target_assignment.md`](24_target_assignment.md) — which particle
goes where.
