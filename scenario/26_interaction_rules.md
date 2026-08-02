# 26 — INTERACTION RULES

**The core contract. The most important mechanism in the project.**

---

## 26.1 The rule

> **Proximity drives the reaction, and the reaction is held.**
>
> Approaching the bridge disperses it. Holding the cursor there keeps it
> dispersed — nothing re-fires, and nothing decays underneath a stationary
> cursor. Moving away lets it reassemble, slowly.

Four clauses, each doing work:

| Clause | Means |
|---|---|
| *Proximity drives* | Distance is the **only** input. No timers. |
| *the reaction is held* | A stationary cursor produces a constant state, forever. |
| *nothing re-fires* | No repeating effects while the cursor is present. |
| *reassemble, slowly* | Return is deliberately much slower than displacement. |

---

## 26.2 The displacement field

```ts
INTERACTION = {
  influenceRadius: 90,
  innerRadius: 26,
  maxDisplacement: 30,
  falloff: 'smoothstep',
}
```

```glsl
float d = distance(aTarget, cursorWorld);

float strength = 1.0 - smoothstep(innerRadius, influenceRadius, d);
//   = 1.0            when d <= 26
//   = 0.0            when d >= 90
//   = smooth ramp    between

vec3 dir = normalize(aTarget - cursorWorld);
vec3 targetOffset = dir * strength * maxDisplacement;
```

```
                    cursor
                      ●
                   ╱  │  ╲
                 ╱    │    ╲
               ↙      ↓      ↘
        ○────○   ○───○   ○───○   ○────○
        ══════════════════════════════════  ← deck, opened around the cursor
                 ├──26u──┤
        ├──────────── 90u ────────────┤

        strength:  1.0    ramp    0.0
```

### Why an inner radius

Without `innerRadius`, `normalize(aTarget − cursorWorld)` has a singularity at
`d = 0` — a particle exactly under the cursor gets an undefined direction and
flickers between frames.

The 26u plateau also gives the void a **flat bottom** rather than a sharp cone,
which reads as a hand pressing rather than as a spike.

### There is no time term

The field equation contains `d` and nothing else. **This is the whole design.**

A stationary cursor produces a constant field, which produces a constant target
offset, which the spring settles into and holds. Hold the cursor for ten
minutes: nothing changes.

---

## 26.3 The asymmetry

```ts
riseResponse   = 0.34    // seconds to full displacement
returnResponse = 1.40    // seconds to settle back
                 ────
ratio          ≈ 1 : 4
```

**Particles scatter quickly and return slowly.**

This is the single most important number pair in the project.

> **Why it matters more than anything else in the interaction:**
>
> A symmetric response — out and back at the same rate — reads as a **field
> effect**. Something abstract and weightless, like iron filings around a magnet.
>
> The 1:4 asymmetry reads as **matter**. Things that are easy to disturb and
> effortful to restore have mass. The bridge feels like it weighs something, and
> reassembling feels like it costs something.
>
> *"Rise is quick, return is unhurried: the effort of rebuilding is what reads
> as matter."*

That sentence is inherited from the original draft pack. It is the best line in
it and it is exactly right.

### Implementation

Two different rates on the same spring, selected by whether the offset is
growing or shrinking:

```glsl
float rate = (length(targetOffset) > length(currentOffset))
           ? (1.0 / riseResponse)      //  2.94 /s
           : (1.0 / returnResponse);   //  0.71 /s

currentOffset += (targetOffset - currentOffset) * rate * dt;
```

---

## 26.4 No envelopes — decision D-001

> **Interaction must never be driven by a fixed animation envelope.**

### The rejected design

Hovering triggers a one-shot animation: disperse over 200ms, hold 300ms, return
over 500ms.

It was built. It was rejected.

### Why it failed

The envelope runs on **its own clock**, independent of where the cursor is. So
it begins rebuilding while the viewer is *still pointing at the bridge*.

The particles come back under a cursor that never moved, and the viewer — who is
still doing the thing that caused the effect — watches the effect undo itself.

**It reads as a flicker, or as a bug. It does not read as a response.**

### Why distance-driven cannot fail this way

If the cursor has not moved, the field has not changed, and nothing can happen.
The failure mode is **structurally impossible**, not merely avoided.

Full history: [`40_decision_log.md`](40_decision_log.md) entry **D-001**.

### The corollary

> **State must be distance-driven. Events may be one-shot.**

Which is what permits the one exception below.

---

## 26.5 The arrival ripple

The one genuinely one-shot effect.

```ts
INTERACTION.ripple = {
  enabled: true,
  speed: 340,               // u/s outward
  amplitude: 11,
  lifetime: 0.9,            // s
  rearmRequiresExit: true,
}
```

When the cursor **first arrives** over the bridge, a single ring travels outward
from the entry point.

| Property | Value |
|---|---|
| Speed | 340 u/s |
| Amplitude | 11u — about a third of `maxDisplacement` |
| Lifetime | 0.9s, so it travels ~306u before dissipating |
| Profile | A travelling band, `smoothstep` in and out, 40u wide |

### Arming

```
armed = true       when the cursor is fully outside all bridge geometry
fires              when the cursor first enters
armed = false      until the cursor fully exits again
```

**Moving around within the bridge does not re-fire it. Holding still does not
re-fire it.** Only a complete exit and re-entry.

> **Why this is allowed under D-001:** it is genuinely an *event* — a moment of
> arrival — not a *state*. The rule D-001 established is that state must be
> distance-driven. A one-shot triggered by a discrete transition is a different
> category.
>
> The `rearmRequiresExit` guard is what keeps it in that category. Without it,
> the ripple would re-fire as the cursor moved across the structure and become a
> continuous emission, which is a state, which is forbidden.

### It composes additively with displacement

The ripple is a positional offset added on top of the cursor displacement. They
never fight — one is radial from the cursor, the other is a travelling band.

---

## 26.6 The spring

```ts
spring: { stiffness: 6.0, damping: 0.86 }
```

Tuned to be effectively **critically damped**: the particle approaches its
target and stops, with no visible overshoot.

### Oscillation is forbidden

A bouncing particle reads as jelly, and 140,000 of them bouncing reads as a
substance rather than a structure.

| `damping` | Behaviour |
|---|---|
| 0.60 | Visible wobble. Two or three bounces. |
| 0.75 | Slight overshoot on fast releases. |
| **0.86** | **No visible overshoot at any release speed.** |
| 0.95 | Sluggish. The return loses its sense of effort. |

**Verification:** displace a particle to maximum, release, and single-step the
return. Displacement must be **monotonically decreasing** — never increasing on
any frame.

`npm run interact-check` asserts this.

### Settle time

A maximally displaced particle (30u) returns within 1u of its target in
**≈1.4 seconds**.

---

## 26.7 Law 5 — it cannot be broken

```
maxDisplacement  = 30u
main span length = 468u
ratio            = 6.4%
```

**The silhouette survives by construction, not by discipline.**

Even with the cursor held at the worst possible position — dead centre of the
main tower — the tower's particles move at most 30u. The tower is still a tower.
Its top is still at `Y ≈ 217`. The cables still meet it.

There is **no cursor position, no dwell time, and no sequence of movements**
that leaves the bridge permanently deformed or unrecognisable.

### Why this is structural

Because position is computed rather than simulated (see
[`21_anatomy_of_a_particle.md`](21_anatomy_of_a_particle.md) §21.5), interaction
is an **additive offset on top of a scheduled position**:

```glsl
vec3 finalPosition = positionAt(t) + interactionOffset;
```

The two terms never interact. The schedule always wins. Clamping the offset
clamps the deformation, absolutely.

> A force-based system could not guarantee this. Forces accumulate, and a
> sufficiently determined viewer could always find a way to push a particle
> somewhere it should not be.

### Verification

```bash
npm run interact-check
```

Sweeps a simulated cursor across a grid over the bridge, holds 3s at each point,
and asserts:

1. No particle exceeds `maxDisplacement` from its target
2. The bridge silhouette, rendered to a mask, retains **≥ 88% IoU** against the
   undisturbed silhouette
3. After the cursor leaves, every particle returns within 1u inside 2.0s
4. Displacement is monotonically decreasing during return — no oscillation

---

## 26.8 Which particles respond

The response depends entirely on lifecycle state.

| State | Response | Mechanism |
|---|---|---|
| `DORMANT` | **None** | Part of the ground |
| `LIFTING` | Steering | Direction deflected, speed preserved |
| `GLIDING` | Steering | Direction deflected, speed preserved |
| `APPROACHING` | Steering, scaled to zero | See below |
| `SEATED` | **Displacement** | Offset + spring return |

### Two genuinely different mechanisms

**Flying particles are steered.** Law 4: they never stop. The cursor deflects
their *direction*; their *speed* is preserved. Full derivation in
[`27_interaction_during_flight.md`](27_interaction_during_flight.md).

**Seated particles are displaced.** Law 5: they are pushed from their target and
spring back.

> **Do not unify these.** Someone will notice the code is branchy and try to
> express both as a single force. Law 4 depends on them staying separate — a
> unified force model is exactly the thing that stalls flying particles.

### Dormant particles do not respond

They are part of the ground. Having them scatter under the cursor would
contradict the "seeds lying in soil" reading before it has been established.

During Phase 1 the cursor pushes aside airborne particles and passes straight
through the dormant ones lying beneath them. **This looks correct and requires
no explanation to a viewer** — things in the air move when disturbed; things on
the ground do not.

---

## 26.9 Cursor depth — a 2D cursor in a 3D world

The cursor is a screen-space point. The bridge is a 3D object. Something has to
resolve the depth.

```ts
INTERACTION.cursorDepth = 'nearestBridgePoint'
```

**The cursor's world position is the point on the bridge nearest to the cursor
ray.**

```
ray = unproject(cursorNDC, camera)
cursorWorld = nearestPointOnBridge(ray)
```

### Why not a fixed depth plane

A plane at a constant distance means the cursor is "inside" the bridge in some
places and "outside" in others, so the same screen position produces different
effects depending on where you are.

### Why not raycast against particles

140,000 raycasts per frame is unaffordable, and the answer would flicker as
particles breathe.

### The implementation

The bridge centreline is already a spline with an arc-length LUT. Finding the
nearest point on it to a ray is a cheap 1D minimisation over `u` — about 32
samples plus a local refinement.

The result is then offset perpendicular to the deck by the cursor's screen-space
offset from the centreline, so the cursor can reach the cable tops and the pier
bases, not just the deck line.

### When the cursor is not over the bridge

If the nearest bridge point is more than `influenceRadius` from the cursor ray,
the field is zero everywhere and the ripple re-arms.

---

## 26.10 What interaction must never do

| Forbidden | Why |
|---|---|
| **Stop a flying particle** | Law 4. It misses its deadline and arrives after the completion pulse. |
| **Permanently deform the bridge** | Law 5. |
| **Oscillate** | Reads as jelly. |
| **Decay under a stationary cursor** | D-001. Reads as a flicker. |
| **Repeat while the cursor is present** | Same. |
| **Change colour** | Interaction is positional only. A colour response would break the single-hue discipline and the 85/10/5 ratio. |
| **Emit new particles** | The count is fixed and equals the target count. |
| **Show a cursor object** | No glow sprite, no orbiting ring. The cursor's presence is shown by what the bridge does. |
| **Affect terrain, sky, or fog** | Only particles respond. |
| **Trigger sound** | The page is silent. |

---

## 26.11 Interaction by phase

| Phase | Cursor on particles | Parallax | Dolly |
|---|---|---|---|
| 0 · Dormant | None (all dormant) | ✓ | ✗ |
| 1 · Awakening | Steering, on airborne only | ✓ | ✗ |
| 2 · Glide | Steering | ✓ | ✗ |
| 3 · Assembly | **Mixed** — steering and displacement simultaneously | ✓ | ✗ |
| 4 · Completion | Displacement (all seated) | ✓ | ✗ |
| 5 · Living | Displacement | ✓ | **✓** |
| 6 · Rewind | Mixed | ✓ | ✓ |

**Phase 3 is the interesting one.** The cursor can sit over a region containing
both flying and seated particles, and it does both things at once — flying ones
curve around it while seated ones beside them are pushed aside and spring back.

No special handling. The two mechanisms are independent and compose naturally.

---

## 26.12 Failure modes

**1 · A time term in the field equation.**
The D-001 failure. Particles drift back under a stationary cursor.

**2 · Oscillation on return.**
`damping` too low.

**3 · Unified force model for flying and seated particles.**
Flying particles stall. Law 4 broken.

**4 · No `innerRadius`.**
Particles directly under the cursor flicker between frames.

**5 · Symmetric rise and return.**
The bridge reads as weightless. This is the most damaging *subtle* failure —
everything works, and the scene is worse for reasons nobody can name.

**6 · Ripple re-firing.**
`rearmRequiresExit` not enforced. Continuous rings; reads as noise.

**7 · Fixed-depth cursor plane.**
The same screen position produces different effects at different points along
the bridge.

**8 · Dormant particles responding.**
The ground reads as loose objects, pre-empting the awakening.

**9 · Interaction changing colour or brightness.**
Breaks the single-hue discipline and the colour ratio.

**10 · A visible cursor object.**
The effect stops being "the bridge responds to you" and becomes "there is a tool
on screen".

---

## 26.13 Checklist

- [ ] The field equation contains **distance only**. No time term.
- [ ] Holding the cursor still for 10 minutes produces **zero** change.
- [ ] `innerRadius` = 26u plateau; no singularity under the cursor.
- [ ] Rise 0.34s / return 1.40s. The 1:4 asymmetry is present and measurable.
- [ ] Spring shows **no overshoot** at any release speed.
- [ ] Return displacement is monotonically decreasing.
- [ ] `maxDisplacement` = 30u, hard-clamped.
- [ ] Silhouette IoU ≥ 88% under worst-case cursor.
- [ ] Interaction is an **additive offset**, never a force.
- [ ] Flying particles are **steered**; seated particles are **displaced**. The
      two mechanisms are separate.
- [ ] Dormant particles do **not** respond.
- [ ] Cursor world position is the nearest point on the bridge to the cursor
      ray — not a fixed plane, not a particle raycast.
- [ ] The ripple fires once per entry and re-arms only on full exit.
- [ ] Interaction never changes colour, brightness, or particle count.
- [ ] No visible cursor object.
- [ ] Terrain, sky, and fog are unaffected.
- [ ] `npm run interact-check` passes all four assertions.

---

**Next:** [`27_interaction_during_flight.md`](27_interaction_during_flight.md) —
Law 4, in detail.
