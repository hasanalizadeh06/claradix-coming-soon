# 14 — PHASE 5 · THE LIVING SCENE

**`T+12.400` → ∞**

**The permanent state. Every visitor spends more time here than in all other
phases combined.**

---

## 14.1 The one-line version

> The bridge is finished but not frozen. It breathes, the camera answers the
> mouse, and putting the cursor on the structure pushes its particles aside —
> fast to scatter, slow to return, and never breakable.

---

## 14.2 What this phase is doing

Phases 0–4 are a film. Phase 5 is the product.

A visitor arriving on a slow connection, or returning to the tab, or landing
after the intro has already played, will experience **only this phase**. It must
work with no context whatsoever.

### It converts a viewer into a participant

The intro can only be watched. Phase 5 can be *touched*, and that difference is
what makes the page memorable rather than merely well-made. A person who moved
their cursor across the bridge and felt it give way remembers the page. A person
who watched a 12-second animation remembers that there was an animation.

### It has to survive indefinitely

There is no end state. A tab left open for four hours must look exactly as
intended in the fourth hour. This constrains almost everything in this document:
no accumulating drift, no unbounded buffers, no effect whose amplitude grows,
nothing whose period is short enough to become annoying.

---

## 14.3 Breathing

Every seated particle moves continuously, very slightly, forever.

```ts
PARTICLES.breathe = {
  amplitude: 0.9,          // world units
  frequencyHz: 0.21,       // one cycle every ~4.76s
  phaseScatter: true,      // per-particle, from hash(index)
}
```

| Property | Value |
|---|---|
| Amplitude | **0.9u** — against a 46u deck width, about 2% |
| Frequency | **0.21 Hz** |
| Direction | Along a per-particle fixed random unit vector, not radial |
| Phase | `hash(particleIndex) × TAU` |

### Phase scatter is not optional

If every particle breathes in phase, the entire bridge swells and contracts as
one — which is a **pulse**, and [`13_phase_4_completion.md`](13_phase_4_completion.md)
spends a whole section explaining why the scene gets exactly one of those.

With scattered phase, at any instant roughly half the particles are moving one
way and half the other. The structure holds its shape perfectly while its
surface shimmers.

> **The look:** heat haze over a road. Or a suspension bridge under load, which
> genuinely does move — real ones flex by metres. The reference is physical, not
> magical.

### Why 0.9u and not more

At `0.9u` the motion is below the threshold at which a viewer can identify
*what* is moving. They perceive that the bridge is not a static image; they
cannot point at a particle and say "that one is moving."

At `2u` individual particles become trackable and the bridge looks unstable — as
though it is barely holding together, which contradicts the completion the scene
just spent 12 seconds earning.

At `0.3u` it is imperceptible and the bridge reads as a still render.

---

## 14.4 The UI reveal

Runs concurrently with the start of this phase, `T+12.400` → `T+15.520`.

Fully specified in [`30_ui_reveal_choreography.md`](30_ui_reveal_choreography.md).
Summary here for continuity:

| Order | Element | Offset from `T+12.400` |
|---|---|---|
| 1 | Logo | +0.000 |
| 2 | Eyebrow `COMING SOON` | +0.300 |
| 3 | Headline line 1 | +0.550 |
| 4 | Headline line 2 | +0.750 |
| 5 | Headline line 3 (lime) | +0.950 |
| 6 | Sub-headline | +1.200 |
| 7 | CTA button | +1.450 |
| 8 | Social icons (60ms internal stagger) | +1.700 |
| 9 | Countdown ring (draws over 800ms) | +1.950 |
| 10 | Countdown units (70ms internal stagger) | +2.400 |
| 11 | Footer | +2.600 |

Each: opacity `0 → 1`, translateY `12px → 0`, **520ms**,
`cubic-bezier(0.16, 1, 0.3, 1)`.

**The scene is fully interactive from `T+12.400`** — the viewer does not have to
wait for the UI to finish before touching the bridge.

---

## 14.5 Cursor interaction — the core contract

This is the most important mechanism in the project.

### The rule

> **Proximity drives the reaction, and the reaction is held.**
>
> Approaching the bridge disperses it. Holding the cursor there keeps it
> dispersed — nothing re-fires, and nothing decays underneath a stationary
> cursor. Moving away lets it reassemble, slowly.

### The numbers

```ts
INTERACTION = {
  influenceRadius: 90,      // world units
  innerRadius: 26,          // full strength inside this
  maxDisplacement: 30,
  falloff: 'smoothstep',

  spring: { stiffness: 6.0, damping: 0.86 },

  riseResponse: 0.34,       // seconds to full displacement
  returnResponse: 1.40,     // seconds to settle back
}
```

### The displacement field

```
d = distance(particleTarget, cursorWorldPosition)

strength = 1 − smoothstep(innerRadius, influenceRadius, d)
         = 1.0                    when d ≤ 26
         = 0.0                    when d ≥ 90
         = smooth ramp between

displacement = normalize(particleTarget − cursor)
             × strength
             × maxDisplacement
```

The particle is pushed **directly away** from the cursor, along the line from
cursor to target.

```
                    cursor
                      ●
                   ／  │  ＼
                 ／    │    ＼          particles pushed radially outward
               ↙       ↓       ↘
        ○────○   ○───○   ○───○   ○────○
        ═══════════════════════════════   ← the deck, opened around the cursor
                 ├──26u──┤
        ├─────────── 90u ───────────┤
```

### The asymmetry — the single most important number pair

```
riseResponse   = 0.34s    (fast)
returnResponse = 1.40s    (slow)
                 ────────
ratio          ≈ 1 : 4
```

Particles scatter quickly and return slowly.

> **Why this matters more than anything else in the interaction:**
>
> A symmetric response — out and back at the same rate — reads as a **field
> effect**. Something abstract, weightless, like iron filings around a magnet.
>
> The 1:4 asymmetry reads as **matter**. Things that are easy to disturb and
> effortful to restore have mass. The bridge feels like it has weight, and it
> feels like reassembling costs it something.
>
> *"Rise is quick, return is unhurried: the effort of rebuilding is what reads
> as matter."*

This sentence survived from the original draft pack. It is the best line in it,
and it is correct.

### Holding still

**Nothing decays under a stationary cursor.**

Hold the cursor over the bridge for ten minutes: the particles stay pushed
aside, exactly as far as they were at second one. No drift, no oscillation, no
re-forming, no re-firing.

This is only possible because the displacement is a **pure function of
distance**. There is no time term in the field equation. A stationary cursor
produces a constant field, which produces a constant displacement.

### No envelopes — decision D-001

> **Interaction must never be driven by a fixed animation envelope.**

The rejected design: hovering triggers a one-shot animation — disperse over
200ms, hold 300ms, return over 500ms.

**Why it was rejected:** the envelope runs on its own clock, independent of
where the cursor is. So it begins rebuilding while the viewer is *still pointing
at the bridge*. The particles come back under a cursor that never moved, and the
viewer — who is still doing the thing that caused the effect — watches the
effect undo itself.

It reads as a flicker, or as a bug. It does not read as a response.

Distance-driven interaction **cannot** do this. If the cursor has not moved, the
field has not changed, and nothing can happen.

Full history: [`40_decision_log.md`](40_decision_log.md) entry **D-001**.

### The one exception — the arrival ripple

One genuinely one-shot effect survives.

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

It is armed once and can only be re-armed by the cursor **fully leaving** the
bridge. Moving around within the bridge does not re-fire it. Holding still does
not re-fire it.

> This is allowed because it is genuinely an *event* — a moment of arrival — and
> not a *state*. The rule that D-001 established is that **state** must be
> distance-driven. Events may be one-shot.

### Spring return

Once the cursor leaves, the particle returns to its target under a spring.

```ts
spring: { stiffness: 6.0, damping: 0.86 }
```

Tuned to be effectively critically damped: it approaches its target and **stops**,
with no visible overshoot and no oscillation.

> **Oscillation is forbidden.** A bouncing particle reads as jelly. `damping`
> below ~0.7 produces visible wobble; verify by displacing a particle to maximum
> and single-stepping the return.

**Settle time:** a maximally displaced particle (30u) returns within 1u of its
target in ≈ **1.4s**.

---

## 14.6 Law 5 — it cannot be broken

```
maxDisplacement  = 30u
main span length = 468u
ratio            = 6.4%
```

The silhouette survives **by construction**, not by discipline.

Even with the cursor held at the worst possible position — dead centre of the
main tower — the tower's particles move at most 30u. The tower is still a tower.
Its top is still at `y ≈ 217`. The cables still meet it.

There is **no cursor position, no dwell time, and no sequence of movements**
that leaves the bridge permanently deformed or unrecognisable.

### Verification

```
npm run interact-check
```

Sweeps a simulated cursor across a grid over the bridge, holds at each point for
3s, and asserts:

1. No particle exceeds `maxDisplacement` from its target
2. The bridge silhouette (rendered to a mask) retains ≥ 88% IoU against the
   undisturbed silhouette
3. After the cursor leaves, every particle returns within 1u inside 2.0s
4. No particle oscillates — displacement is monotonically decreasing during
   return

---

## 14.7 Camera parallax

```ts
CAMERA.parallax = {
  offsetX: 22,     // ±22u camera translation
  offsetY: 11,     // ±11u
  yaw: 2.4,        // ±2.4°
  pitch: 1.2,      // ±1.2°
  lerp: 0.045,     // heavy smoothing
}
```

Mouse position maps to a small camera offset. The mountains shift against each
other; near ridges move more than far ones.

### Deliberately almost imperceptible

`lerp: 0.045` at 60fps means the camera closes only 4.5% of the remaining
distance to its target position each frame — a time constant of roughly
**0.36 seconds**. The camera has mass and lags noticeably behind the cursor.

> **The intent:** it should be nearly impossible to notice you are controlling
> the camera. You should only notice that the scene is **not flat**.
>
> A 1:1 responsive camera turns the page into a toy and invites the viewer to
> whip the mouse around. A heavy, lagging camera reads as depth.

### Idle drift continues

```ts
CAMERA.idleDrift = {
  amplitudeX: 7, amplitudeY: 3.5,
  periodX: 23.0, periodY: 31.0,     // coprime → never visibly repeats
}
```

Runs forever, added on top of parallax. On a touch device with no orientation
permission, this is the only camera motion.

The coprime periods matter for the "four hours later" requirement: the combined
motion has a period of 713 seconds and never lands in a recognisable loop.

---

## 14.8 Push-in — proximity dispersion

**Enabled at `T+12.400`.** Disabled in every prior phase.

Scroll wheel on desktop, pinch on touch.

```ts
CAMERA.dolly = {
  range: [0, 1],
  travel: 340,              // world units toward baseTarget
  lerp: 0.070,
  autoReturnAfter: 2.4,     // s of no input
  autoReturnRate: 0.35,
}

INTERACTION.proximityDispersion = {
  startsAt: 0.55,           // dolly value where scattering begins
  maxRadius: 180,
  maxDisplacement: 64,
}
```

### What it feels like

Push in and, at first, nothing but a closer view. Past **55%** the bridge begins
to come apart — not violently; it loosens. Push further and the structure opens
into a cloud of moving points that is still, recognisably, a bridge.

Stop touching it and after 2.4 seconds the camera drifts back and the bridge
reassembles.

### What it means

> **The bridge is only solid from a distance.** Get close enough and you can see
> it was always just light.

This is the same statement Law 3 makes structurally, delivered as an
interaction. It is also, not incidentally, a decent metaphor for the brand.

### Why displacement is 64u here but 30u for the cursor

The cursor is a *local probe* — it should leave the structure legible while you
inspect it. Push-in is a *global change of relationship* — you have chosen to
get close, and the payoff is seeing the bridge stop being a bridge.

At maximum push-in the silhouette check in §14.6 does **not** apply. That is
intentional and it is the one place Law 5 is relaxed, because the effect is
fully under the viewer's control, immediately reversible, and requires
deliberate continuous input to sustain.

---

## 14.9 Touch devices

Fully specified in [`28_input_and_devices.md`](28_input_and_devices.md).
The essentials:

| Gesture | Behaviour |
|---|---|
| **Press and hold** | Acts exactly like cursor hover at that point. Particles disperse and **stay** dispersed for as long as the finger is down. |
| **Drag while held** | The influence point follows the finger. |
| **Release** | Spring return, `returnResponse` 1.40s. |
| **Pinch** | Dolly / proximity dispersion. |
| **Tap** | Treated as a very short hold — ripple fires, brief dispersion, immediate return. |

There is no hover state on touch, so **press-and-hold is the interaction**. This
was specified directly by the client and it is the right call: it maps the
desktop behaviour onto the only gesture that has the same "sustained presence"
semantics.

**Camera parallax on touch:** device orientation if permission is granted;
otherwise idle drift only. Parallax is never driven by the touch point — the
finger controls dispersion, and having it also swing the camera would make both
feel imprecise.

---

## 14.10 The steady state

What the scene does when nobody touches it, forever.

| System | Behaviour | Bounded? |
|---|---|---|
| Breathing | ±0.9u, 0.21 Hz, scattered phase | Yes — pure sine |
| Camera idle drift | ±7u / ±3.5u, coprime periods | Yes |
| Nebula drift | 0.6 u/s, wraps at 34s | Yes — wraps |
| Stars | Twinkle, per-star period 3–11s | Yes |
| Countdown | Ticks once per second | Yes |
| Bloom | Constant at 0.85 | Static |
| Trail buffer | **Empty and inactive** | — |
| Swarm lights | 0.04, effectively off | Static |

**Nothing accumulates. Nothing grows. Nothing drifts out of range.**

### The countdown

The only element that changes state on its own. It ticks every second, and the
ring's progress arc advances.

Q-04: only the largest non-zero unit is accented in `--lime`. When days reach
zero the accent migrates to hours, and so on. This is an interpretation of the
reference frame, flagged in [`31_content_and_copy.md`](31_content_and_copy.md).

### Performance in the steady state

Phase 5 is the **cheapest** phase:

- No trails — the buffer is inactive
- Swarm lights effectively off
- No state transitions
- Particle update is a fixed, branch-light shader path

A device that survives Phase 2 will run Phase 5 indefinitely.

> `PERF` upgrades — moving *up* a quality tier — are permitted here and nowhere
> else. A device that was downgraded during the expensive glide may earn its
> quality back once the scene settles. `PERF.upgradeWindows` = 3 makes this
> deliberately slow, to prevent oscillation between tiers.

---

## 14.11 Late arrivals

A visitor who loads the page with a cold cache, or switches back to a
backgrounded tab, may never see the intro.

| Situation | Behaviour |
|---|---|
| Page loaded normally | Full intro from `T+0.000` |
| `prefers-reduced-motion` | Final frame at `T+0.000`, no intro |
| Tab backgrounded during intro | `requestAnimationFrame` pauses. On return, the scene **jumps to Phase 5** rather than resuming mid-build. |
| Returning visitor (same session) | Intro plays once per page load. No suppression — it is short, and it is the point of the page. |

> **Why jump rather than resume:** a viewer returning to a tab has lost the
> context that made the build legible. Resuming at `T+7.2` shows them a
> half-built bridge with no explanation. Jumping to the finished state gives
> them a coherent page.
>
> The jump is a 400ms cross-fade, not a cut.

---

## 14.12 Failure modes

**1 · The reaction decays under a stationary cursor.**
The D-001 failure. Symptom: particles push aside, then drift back while you are
still pointing at them. Cause: a time term has entered the field equation.

**2 · Oscillation on return.**
`spring.damping` too low. Symptom: particles bounce past their targets. Reads
as jelly.

**3 · Breathing in unison.**
`phaseScatter` disabled or the hash is degenerate (e.g. hashing a float index
that quantises). Symptom: the whole bridge pulses — the forbidden heartbeat.

**4 · Parallax too responsive.**
`lerp` above ~0.15. Symptom: the page becomes a toy; viewers whip the mouse and
the scene feels weightless.

**5 · Camera drift accumulating.**
Symptom: after twenty minutes the framing is wrong. Cause: drift implemented as
an accumulating offset instead of an absolute function of time.

**6 · The ripple re-firing.**
`rearmRequiresExit` not enforced. Symptom: rings emitting continuously as the
cursor moves across the bridge. Reads as noise.

**7 · Trail buffer not cleared.**
Symptom: a faint permanent ghost of the bridge's build offset from the
structure. Cause: the buffer is still being composited despite no particle
writing to it.

---

## 14.13 Capture point — `settled` at `T+16.000`

**Must show:**

1. Complete bridge, at rest
2. **Full UI** — every element revealed
3. **No light trails anywhere**
4. Bloom at 0.850
5. Mountains near-silhouette
6. Bridge visibly a point cloud at 100% zoom

**Colour distribution — the canonical 85/10/5:**

| Band | Share | Tolerance |
|---|---|---|
| Near-black | 85% | ±3 |
| Deep green | 10% | ±3 |
| Neon accent | 5% | ±3 |

> This capture is the one that must satisfy the headline colour rule. Every
> other capture has its own targets — see
> [`38_acceptance_criteria.md`](38_acceptance_criteria.md).

---

## 14.14 Phase 5 checklist

- [ ] Breathing is active, ±0.9u at 0.21 Hz, **phase-scattered**.
- [ ] The bridge never pulses as a whole.
- [ ] Cursor displacement is a **pure function of distance**. No time term.
- [ ] Holding the cursor still for 10 minutes produces **zero** change.
- [ ] Rise 0.34s / return 1.40s — the asymmetry is present and measurable.
- [ ] Spring return shows **no overshoot** and no oscillation.
- [ ] The arrival ripple fires once and re-arms only on full exit.
- [ ] `maxDisplacement` 30u; silhouette IoU ≥ 88% under worst-case cursor —
      `npm run interact-check`.
- [ ] Camera parallax `lerp` = 0.045. It should be hard to notice you are
      controlling it.
- [ ] Camera idle drift periods are coprime; no visible repeat over an hour.
- [ ] Dolly is **enabled from `T+12.400`** and not before.
- [ ] Proximity dispersion begins at dolly 0.55, reaching 64u displacement.
- [ ] Dolly auto-returns after 2.4s of no input.
- [ ] Touch press-and-hold behaves exactly like cursor hover, and **holds**.
- [ ] Camera parallax is not driven by the touch point.
- [ ] Nothing accumulates: no buffer, no offset, no amplitude grows over hours.
- [ ] Trail buffer is inactive and contributes nothing.
- [ ] Tier upgrades are permitted here and only here.
- [ ] A backgrounded tab returns to Phase 5 via a 400ms cross-fade, not a
      mid-build resume.
- [ ] `settled` capture at `T+16.000` meets 85/10/5 ±3.

---

**Next:** [`15_phase_6_rewind.md`](15_phase_6_rewind.md) — the optional loop.
