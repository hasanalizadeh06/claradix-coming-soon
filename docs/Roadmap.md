# Roadmap

One month, one senior creative developer. Ranked strictly by **impact on the
finished experience per day spent**, not by difficulty and not by how interesting
the work is.

The organising principle of this list:

> The engineering in this project is already award-tier. **Almost nothing on this
> list is an engineering problem.** The top five items are direction, and four of
> them are cheap.

---

## Tier 0 — Do these first. They change everything.

### 1. Re-frame the camera so the bridge reads as a bridge
**Impact: catastrophic if not done · Effort: 2 days · Risk: high (invalidates tuning)**

The camera looks almost straight down the bridge's own axis, so the 1,624-unit
span compresses into a horizontal band, the parabolic main cable is
indistinguishable from a straight line, and the towers are seen edge-on. The site's
one sentence is *"Claradix is the bridge between your idea and reality"* and the
object at the end of the film cannot be named.

Every other visual decision in the project is downstream of this. It is first.

**What to do.** Re-solve `CAMERA.basePosition` / `baseTarget` against a new
constraint set that replaces "percentages of frame height" with **legibility of
silhouette**:

- the main cable's parabola must subtend a measurable vertical sag on screen
  (target: ≥8% of frame height between the tower-top chord and mid-span)
- at least one tower must stand clear against sky for its full height
- the deck must present at ≥25° to the view axis, not ≤10°

Expect a three-quarter view, lower, closer to the deck line, camera roughly
perpendicular-ish to the span rather than along it.

**Consequences to budget for.** The type block will have to move or overlap the
scene. Every number in `palette-check`'s seven captures will shift, because the
bridge will occupy a different fraction of the frame. `CAMERA.framing` is dead and
must be rewritten. The `guidePoint` camera-side test (`binormal.z >= 0`) assumes
the camera is at +Z and must be re-derived.

Do this before anything else, because tuning anything against the current frame is
work that will be thrown away.

---

### 2. Sound
**Impact: enormous · Effort: 3 days · Risk: low**

The single highest-leverage item on this list per day spent. A scene entirely about
light, motion and assembly, in silence.

**What to build.**

| Layer | Trigger |
|---|---|
| Low drone bed | swells with `swarmIntensityAt(t)` — it already exists as a curve |
| Air / rush | amplitude follows the airborne population, which is derivable from the lift/seat schedules with no new state |
| Structural impact | one soft transient per **layer**, not per particle — six events, at the layer offsets already in `ASSEMBLY.layerOffset` |
| Completion tone | one resonant note at the pulse |
| Interaction | a quiet granular response to `cursorStrength`, which is already a smooth 0–1 |

Everything needed to drive this **already exists as a scalar**. `cursorStrength`,
`disperse`, `bloomStrengthAt(t)`, `swarmIntensityAt(t)` and the phase are all
computed per frame. Audio is a consumer of the existing model, not a new system.

Must be muted by default with a visible control, and must respect
`prefers-reduced-motion`.

---

### 3. Portrait / mobile composition
**Impact: high · Effort: 2 days · Risk: low**

`CAMERA.portrait` is fully specified — `fov: 46`, `basePosition: [30, 118, 430]`,
`baseTarget: [20, 82, -300]`, with the note *"portrait re-composes rather than
crops — a crop loses the sweep entirely"* — and **read by nothing.** There is no
aspect-ratio branch anywhere.

A large share of Awwwards judging traffic is mobile. Right now those visitors get
a composition solved for 1.5:1 rendered into 0.46:1, where a bridge deliberately
framed to run off both sides of a wide frame runs off both sides of a narrow one
even harder.

**What to do.** Branch on `width / height < 1` in `BridgeScene`, apply the portrait
constants, re-solve them against the new landscape framing from item 1, and add a
portrait row to `viewport-check.mjs` so it cannot silently regress.

---

### 4. A discoverable invitation to interact
**Impact: high · Effort: 1 day · Risk: none**

The best ideas in the project — Law 4 lateral avoidance, the asymmetric spring, the
push-in dispersion — are behind gestures nothing signals. The default OS cursor.
No hover state. No hint. No copy.

**What to do**, cheapest first:

1. A custom cursor that responds to proximity to the bridge — even a simple ring
   that scales with `1 - smoothstep(bestD, 0, influenceRadius * 2.2)`, a value the
   scene already computes every frame.
2. On first idle after the UI reveal, a single soft pulse of `cursorStrength`
   toward the pointer's position — the scene demonstrating itself once.
3. One line of copy near the scene edge. *"Touch the bridge."* Anything.
4. A scroll affordance for push-in, since scrolling on a page that does not scroll
   currently reads as "the page is broken".

---

### 5. Build the ripple
**Impact: high · Effort: 1.5 days · Risk: low**

`INTERACTION.ripple` is fully specified and **read by nothing**: speed 340,
amplitude 11, lifetime 0.9, bandWidth 40, `rearmRequiresExit: true`.

A travelling band radiating outward along `u` from where the cursor touched the
bridge is exactly the missing acknowledgement. Right now the interaction's honest
description is *"some of the dots wobble"*.

The mechanism already exists — the completion pulse is a band travelling along `u`
driven by a single uniform. A ripple is the same shader term with a different
trigger and a lifetime. Perhaps forty lines.

**Do this and item 4 together.** They are the same problem.

---

## Tier 1 — Substantial gains, moderate cost

### 6. A second beat in the timeline
**Impact: high · Effort: 2 days · Risk: medium**

Sixteen seconds of one monotonic gesture. Dark → lift → fly → assemble → done.

**What to add.** A *held moment*: the river arrives, fills the frame, and hangs for
~0.8 s before the first pier lands. Everything is already scheduled per-particle
from `liftAt`/`seatAt`, so this is an offset in `ASSEMBLY.windowStart` plus a
lengthened `LIFT.windowSpan` — a timing change, not a system.

The film currently promises a reveal and delivers "the light stops moving". A held
breath before the assembly is the cheapest possible second act.

---

### 7. A completion moment that earns eleven seconds
**Impact: high · Effort: 2 days · Risk: medium**

The bridge finishes at T+11.2, pulses at T+11.4, and the UI starts covering it at
T+12.4 — **one second of unobstructed screen time.**

**What to do:**

- Push `TIMELINE.uiRevealStart` to ~T+14.0. Two to three seconds of the finished
  bridge alone.
- Add the **only camera move in the film** at completion — a slow 1.5 s drift that
  reveals the span. The existing "no camera animation" rule is correct *during* the
  build, where it would compete with the particles; after the particles stop it is
  the opposite.
- Let the bloom peak (already 1.15 at completion) be accompanied by a brief
  exposure ride, which is currently a flat 1.0 and never animated.

---

### 8. Particle classes
**Impact: medium-high · Effort: 1.5 days · Risk: low**

Every particle is identical: one sprite, one ramp, one size distribution, ±15%
variance. The brief calls them "seed thrown on the ground" and they are uniform
dots.

**What to do.** Two or three classes, chosen at seed time and stored in the spare
bits of an existing attribute (**not a new one** — the 14-slot ceiling is hard):

| Class | Share | Treatment |
|---|---|---|
| Fine | 80% | as now |
| Coarse | 15% | 2× size, dimmer, slower roll — reads as debris |
| Ember | 5% | brighter, longer trail, rarer — reads as a spark |

Almost free, and it gives the frame the textural variety it badly lacks.

---

### 9. One volumetric element
**Impact: medium-high · Effort: 3 days · Risk: medium**

A scene about light travelling through a valley at night has **no visible light in
the air.** The swarm lights illuminate surfaces and never scatter.

**What to do.** Cheap analytic scattering along the five swarm lights in the mist
shader — the mist plane is already there, already has the light positions, already
has grazing-angle thickening. Adding an in-scattering term is a handful of lines
and would transform the sense of atmosphere.

Avoid full raymarching. The budget will not take it and the payoff does not need
it.

---

### 10. Type with a point of view
**Impact: medium-high · Effort: 2 days · Risk: low**

"Something new / is taking shape." set in a system-adjacent grotesque, one line
accented in lime. It could be any coming-soon page from the last eight years.
Every UI element is a shape describable in one word: circle, pill, circle, circle.

**What to do.** A display face with actual character for the headline. A real scale
relationship — the current step from headline to lead is conservative. One
proprietary graphic device that could appear on a business card, a slide and this
page and be recognised in all three. And rewrite the copy in a voice.

---

## Tier 2 — Correctness and hygiene

These are cheap, and several are latent failures rather than improvements.

### 11. Clear the unimplemented-constant backlog · 1 day
`INTERACTION.ripple` (6), `INTERACTION.flight` (5), `INTERACTION.spring` (2),
`INTERACTION.touch` (2), `CAMERA.portrait` (3), `CAMERA.orientationParallax` (3),
`CAMERA.parallax.yaw`/`pitch` (2), `A11Y.disableLoop`/`disableCameraParallax`/
`disableIdleBreathe` (3), `TERRAIN.material.roughness`/`metalness` (2),
`LOOP.rewind.uiFadeOutLeadTime`/`uiFadeOutDuration` (2).

**Thirty constants declared and read by nothing.** Build them or delete them. A
constant nothing reads is a lie about what the project does, and this codebase has
already been bitten three times by exactly that.

Strengthen `hygiene-check.mjs`'s nested-key audit, or accept that it cannot be done
statically and add a runtime "which config keys were read this session" probe.

### 12. Delete the dead modules · 1 hour
`src/lib/noise3d.ts` (115 lines) and `src/gl/glsl.ts` (136 lines), imported by
nothing. `glsl.ts` contains simplex 3D, curl noise and a hash library the project
does not use.

Extend hygiene to catch unimported modules, not just unread config exports.

### 13. Profile on real hardware · 1 day
**Every performance number in this repository was measured under SwiftShader.**
There is no evidence `targetFps: 60` has ever been met. The degradation ladder
defends a budget nobody has measured.

Minimum: a mid-range Android and a MacBook Air, with `EXT_disjoint_timer_query`
per-pass timings and a thermal soak. Publish the numbers in `Performance.md`.

### 14. Halve the particle vertex cost · 1 day
The trail pass runs the **full six-state machine a second time** to draw three
states — 165,198 vertex invocations and ~991,000 vertex texture fetches per frame.

A dedicated minimal shader computing only the glide branch would halve the most
expensive thing in the project. Also hoist the duplicated `frameRow` fetch: the
barrel roll re-reads `centrelineBin` that `guidePoint` already read.

### 15. Fix the frame-rate-dependent lerps · 1 hour
`camPos.lerp(target, 0.045)` and `dolly += (target - dolly) * 0.07` converge twice
as fast at 120 fps. Eight lines away, the pointer smoothing does it correctly with
`1 - Math.pow(0.0015, frame.delta)`. The project contains both the right and the
wrong version of the same idea.

### 16. Reset the completion-pulse latch · 1 hour
`pulseFired` survives both `seek()` and the loop. On the second cycle the bridge
completes with no pulse at all; scrubbing backwards past T+11.4 disarms it
permanently for the session.

### 17. Dispose the two `DataTexture`s · 15 minutes
`uFrameTex` and `uRamp` are created in `createParticles` and never released.
`material.dispose()` does not dispose textures.

### 18. Resolve Q-05 · 1 hour (a decision, not code)
Two colour captures fail deliberately because §6.1's per-capture targets are
non-monotone in a way the scene structurally is not — `assembly-early` is given the
same target as mid-glide despite being the densest instant in the film, and
`complete` is targeted *darker* than `assembly-late` despite being the bloom peak.

Somebody with authority over the specification needs to rule. What is wanted is a
ruling, not a quieter checker.

### 19. Terrain triangle count · 1 day
294,338 triangles for a static mesh that is largely below the horizon, behind the
camera, or fogged to nothing. The 384 segments exist for **silhouette** quality
along the ridgelines — a property of a small fraction of the mesh.

### 20. Camera ownership · 2 hours
Three places specify a FOV and one wins. `Stage`'s `far: 400` would clip the far
half of this world and works only because `BridgeScene` overwrites it immediately —
a trap for any future scene.

---

## Tier 3 — If there is time left

### 21. Sky that acknowledges the bridge
The pack says *"the sky never changes state"* and the implementation honours it.
Defensible, but it means the one element that fills half the frame never registers
that a hundred and forty thousand points of light just flew across it. Even a
0.02 lift in the nebula at the completion pulse would connect them.

### 22. A reflective valley floor
The metaphor already names a river. A dark, barely-reflective surface at
`WORLD.valleyFloorY` would give a scene made entirely of emissive light something
to bounce off — which is a large part of why it currently reads as flat. The
existing objection (wet ground in a dry valley raises a question) does not apply to
water that is explicitly a river.

### 23. Soft-particle depth fade
Particles currently intersect the terrain with a hard edge. The depth texture is
already bound to the composite; a fade in the particle fragment shader is cheap.

### 24. Velocity stretch on the sprite
Elongating fast particles along their travel direction is free and reads as speed.
The travel direction is already computed for Law 4.

### 25. Generative variation per visitor
The scene is seeded and identical for every visitor — deliberately and correctly,
because verification depends on it. But a *second* seed derived from the visitor,
with the reference seed pinned for captures, would mean nobody has an experience
anyone else did.

---

## The one-month plan

| Week | Work |
|---|---|
| **1** | Item 1 (re-frame) — then re-tune the colour ratio against the new composition. Item 3 (portrait) in parallel, since it depends on the same solve. |
| **2** | Items 2 (sound) and 5 (ripple) + 4 (invitation). This is the week the site becomes an experience rather than a demo. |
| **3** | Items 6 (second beat), 7 (completion moment), 8 (particle classes). Pacing and texture. |
| **4** | Items 9 (volumetrics) and 10 (typography), then the whole of Tier 2. Ship with hygiene clean. |

### What is deliberately not on this list

More particles. A bigger scene. More post-processing. More technical
sophistication of any kind.

**The engineering is not the constraint.** Adding to it would not move a single
one of the scores that matter, and this project's most likely failure mode is
spending another month making the invisible parts better.
