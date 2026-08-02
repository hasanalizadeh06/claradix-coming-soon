# 40 — DECISION LOG

**What we tried, what we rejected, and why.**

---

## 40.1 Why this file exists

> **A rejected idea with no recorded reason will be re-proposed within a month.**

Most entries here are ideas that are **perfectly sensible on their face**. That
is exactly why they need recording — a bad idea gets rejected once and stays
rejected. A *reasonable* idea that happens to be wrong for this project comes
back every time someone new reads the spec.

### The format

```
D-nnn · Title
Status:    REJECTED | ACCEPTED | ACCEPTED WITH COST | OPEN
Date:      when
Proposed:  what was suggested
Tried:     was it actually built?
Outcome:   what happened
Decision:  what we do instead
Owner doc: where the rule now lives
```

### When to add an entry

- A rule was reversed
- An idea was built and then removed
- A reasonable-sounding proposal was declined
- A known cost was knowingly accepted

Adding an entry is **required** by the change protocol in
[`00_START_HERE.md`](00_START_HERE.md) §0.8.

---

## D-001 · Interaction driven by a fixed animation envelope

**Status:** REJECTED — *built, then removed*
**Owner doc:** [`26_interaction_rules.md`](26_interaction_rules.md) §26.4

### Proposed

Hovering over the bridge triggers a one-shot animation: disperse over 200ms,
hold 300ms, return over 500ms. Simple, cheap, easy to tune.

### Tried

Yes. It was built and shipped to internal review.

### Outcome

**It failed, and the failure was worse than "not as good".**

The envelope runs on its own clock, independent of where the cursor is. So it
begins rebuilding **while the viewer is still pointing at the bridge**. The
particles come back under a cursor that never moved, and the viewer — still doing
the thing that caused the effect — watches the effect undo itself.

Reviewers described it as a **flicker** and as **a bug**. Nobody described it as
a response.

### Decision

**Interaction state must be a pure function of distance.** No time term in the
field equation.

If the cursor has not moved, the field has not changed, and nothing can happen.
The failure mode becomes **structurally impossible** rather than merely avoided.

### Corollary

> **State must be distance-driven. Events may be one-shot.**

This is what permits the arrival ripple — a genuine one-shot triggered by a
discrete transition, guarded by `rearmRequiresExit` so it cannot become a
continuous emission.

### Note

This entry is inherited from the original draft pack, where it was recorded as a
revision note on `11_interaction_rules.md`. **It is the single most valuable
thing in that pack**, and preserving it is why this document exists.

**Verified by:** G7 assertion 5.5 — cursor held stationary for 10 minutes
produces zero change.

---

## D-002 · Shortening Phase 0 to 0.4 seconds

**Status:** REJECTED
**Owner doc:** [`09_phase_0_dormant.md`](09_phase_0_dormant.md) §9.2

### Proposed

1.2 seconds of a near-static frame is a long time on the web. Cut it to 0.4s to
"get to the action."

### Tried

Yes — `SCENE.timeScale` was left at 1.0 and `TIMELINE.phase1_awakeningStart` was
moved to `0.400`.

### Outcome

The scene stopped reading as *a place doing something* and started reading as
*an animation starting up*.

More specifically: viewers no longer registered that **there was no bridge**.
With only 0.4s of empty valley, the absence never became a fact, so the build
read as a reveal rather than as construction — and every downstream decision
(far→near direction, load-bearing order, the completion pulse) lost its
justification.

Also, initialisation takes ~135ms, so a 400ms Phase 0 left only ~265ms of
settled frames before the first lift.

### Decision

**Keep 1.2 seconds.** If the intro must be shortened, cut a phase — see
**D-004**.

### Counter-argument recorded

*"Users will bounce during a dead 1.2 seconds."*

They do not. The frame is not dead — it has depth, atmosphere, and a shimmer that
reads as *something is about to happen*. What causes bouncing is a blank screen
or a spinner, and this is neither.

---

## D-003 · Euler integration for particle motion

**Status:** REJECTED
**Owner doc:** [`21_anatomy_of_a_particle.md`](21_anatomy_of_a_particle.md) §21.5

### Proposed

Standard particle-system architecture: each particle has a velocity, forces are
applied, `pos += vel * dt`.

This is what every particle tutorial does and what anyone who has built a
particle system before will reach for.

### Tried

Partially — during early prototyping.

### Outcome

It breaks **four** things simultaneously:

| Breaks | How |
|---|---|
| **Determinism** | Floating-point accumulation differs per device; the reference frame can never be diffed |
| **Frame-rate independence** | A 30fps device and a 144fps device diverge |
| **Scrubbing** | `ticker.seek(10.5)` becomes impossible — you must simulate 10.5 seconds to get there |
| **Law 5** | Forces accumulate; a determined viewer can always push a particle somewhere it should not be |

The scrubbing loss is the most damaging. Without `seek()`, there is no capture
tooling, and without capture tooling there is **no verification of anything** —
gates G3, G4, G5, G6, and G10 all depend on it.

### Decision

**Position is a pure function of attributes and time.** Nothing is integrated.

```glsl
vec3 finalPosition = positionAt(t) + interactionOffset(t);
```

Interaction is an **additive offset on top of a scheduled position**, never a
force. The two terms never interact; the schedule always wins.

This is also what makes Law 5 structural rather than disciplinary: clamping the
offset clamps the deformation, absolutely.

---

## D-004 · Compressing all phases to shorten the intro

**Status:** REJECTED
**Owner doc:** [`36_CONFIGURATION.md`](36_CONFIGURATION.md) §36.19

### Proposed

The client may want a shorter intro. `SCENE.timeScale` scales everything from
one value — so set it to 0.4 and the intro runs in 5 seconds.

### Tried

Yes, at 0.40 and 0.55.

### Outcome

| `timeScale` | Result |
|---|---|
| 1.00 | 12.4s. As designed. |
| 0.75 | 9.3s. Slightly hurried but intact. |
| **0.55** | **6.8s. The floor.** Assembly is legible but tight. |
| 0.40 | 5.0s. **Assembly stops reading as construction and becomes a wipe.** |
| 0.30 | 3.7s. Individual particle arrivals are no longer resolvable. |

Below 0.55, the construction front moves faster than the eye can track the
layer ordering, so the load-bearing sequence — the thing that makes the build
credible — becomes invisible. All the work that produces it is still running and
nobody can see it.

### Decision

**`SCENE.timeScale` has a practical floor of 0.55.**

If a shorter intro is genuinely required, **cut a phase rather than compressing
all of them.** In order of what is safest to lose:

| Cut | Saves | Costs |
|---|---|---|
| Phase 4 (completion pulse) | 1.2s | The full stop. The UI transition becomes arbitrary. |
| Half of Phase 2 (glide) | 1.3s | The beauty shot. The scene becomes mechanical. |
| Phase 0 (dormant) | 1.2s | Everything. See **D-002**. Do not. |

---

## D-005 · Showing the UI before the build completes

**Status:** ACCEPTED WITH COST
**Owner doc:** [`30_ui_reveal_choreography.md`](30_ui_reveal_choreography.md) §30.1

### The known cost

**No text is visible for the first 12.4 seconds.** Some visitors will leave
before seeing the headline. This is a real, accepted cost, not an oversight.

### Alternatives considered

| Option | Rejected because |
|---|---|
| Show the headline from `T+0.000` | Text competes with a 12-second build; neither wins. The animation becomes a background and the page becomes ordinary. |
| Show it at 50% opacity, then brighten | Worse than either extreme — illegible *and* distracting |
| Show it at `T+6.0`, mid-build | Arbitrary. Lands during assembly with nothing to punctuate it. |

### Why the cost is acceptable

**The copy is not actually delayed for anything that matters:**

| Consumer | When they get the copy |
|---|---|
| Search engines | Immediately — prerendered HTML |
| Social scrapers | Immediately — OG tags |
| Screen readers | Immediately — full DOM |
| JS disabled | Immediately |
| `prefers-reduced-motion` | Immediately — intro skipped entirely |

Only a sighted visitor with JS enabled and motion enabled waits — and for them,
the wait *is* the product demonstration.

### Mitigation

The prerender is **not deferrable**. It is listed as such in
[`37_implementation_plan.md`](37_implementation_plan.md) §37.12.

---

## D-006 · The Phase 2 interaction is undiscoverable

**Status:** ACCEPTED WITH COST
**Owner doc:** [`27_interaction_during_flight.md`](27_interaction_during_flight.md) §27.9

### The cost

Moving the cursor through the river during Phase 2 produces the most photogenic
interaction on the page — a clean void carved through flowing light, persisting
in the trail buffer for ~430ms.

**Most visitors will never see it**, because the UI does not exist during Phase 2
and nothing invites them to move their mouse.

### Alternatives considered

| Option | Rejected because |
|---|---|
| A "move your mouse" prompt | Instructional UI over a cinematic. Breaks the register completely. |
| An animated cursor hint | Adds an on-screen object; forbidden by doc 05 |
| Auto-demonstrating the effect | A phantom cursor moving on its own reads as a bug |

### Decision

**Accept it.** The interaction is a reward for curiosity, not a feature that must
be delivered.

Visitors who move their mouse during the build find it. Visitors who do not still
get the full interaction from `T+12.400`, when the page arrives and gives them a
reason to move.

---

## D-007 · `SCENE.loop` defaults to `false`

**Status:** ACCEPTED
**Owner doc:** [`15_phase_6_rewind.md`](15_phase_6_rewind.md) §15.2

### The question

The client explicitly asked for a loop toggle. Should it default on or off?

### Decision

**Off.**

### Reasoning

A landing page that repeatedly destroys itself while somebody is reading it is
hostile. With `holdAfterComplete = 20s`, a visitor gets **16 seconds** of a
readable page per cycle — enough to read the headline, not enough to read it,
decide, click *Get notified*, and type an email address.

It is also the least defensible use of GPU time in the project: a laptop on
battery running a permanent 41.6-second build/destroy cycle.

### What it is genuinely good for

Design review · showreel capture · kiosk and trade-show displays · social media
capture. All real uses — none of them "a person visiting the website."

### Guard

If enabled in production, the loop **must** suspend on input focus. Non-optional;
enforced by gate G8.

### If enabled on a live page

`holdAfterComplete` should be raised to **45s or more**.

---

## D-008 · One light per particle

**Status:** REJECTED — *not implementable*
**Owner doc:** [`20_lighting_design.md`](20_lighting_design.md) §20.4

### Proposed

The client asked for flying particles to illuminate the mountains. The physically
correct implementation: every particle is a light.

### Outcome

**Not possible.** Forward rendering caps around 8 lights; clustered deferred
handles hundreds, not 140,000. The scene is additively blended with no G-buffer,
so deferred is unavailable regardless.

### Decision

**Five point lights following particle-cluster centroids**, binned by `u` along
the river.

### Why this is not a compromise

At `distance: 320` and `decay: 2`, the falloff is so broad that moving a light by
±40u changes terrain illumination by under 1%. The individual positions of
28,000 particles within a bin are therefore **irrelevant** — only the centroid
and the count matter, and both are exactly what the approximation captures.

At these intensities the five-light version and the impossible 140,000-light
version produce **visually identical frames**.

---

## D-009 · Terrain LOD changing at runtime

**Status:** REJECTED
**Owner doc:** [`17_terrain.md`](17_terrain.md) §17.9

### Proposed

The adaptive tier system changes particle count, trail length, and bloom radius
at runtime. Terrain segments should follow the same pattern.

### Outcome

Rebuilding the heightfield mid-scene means **re-seeding every particle**, because
their `aSeed` positions were sampled from the old surface.

Particles either detach from the ground or sink into it, and any particle already
in flight has a seed it can no longer return to during rewind.

### Decision

**Terrain LOD is fixed at initialisation.** Tier changes affect terrain only on
reload.

This is an explicit exception to the adaptive-tier system, documented in
[`34_performance_budget.md`](34_performance_budget.md).

---

## D-010 · Reduced motion as a faster intro

**Status:** REJECTED
**Owner doc:** [`35_accessibility.md`](35_accessibility.md) §35.3

### Proposed

Rather than skipping the intro entirely under `prefers-reduced-motion`, play it
at 3× speed — so the user still gets the idea without the long sweep.

### Outcome

**It is still sweeping full-screen motion, just less of it.** The setting means
*stop*, not *hurry*. A 4-second sweep can cause the same vestibular discomfort as
a 12-second one, and arguably more, because it is faster.

### Decision

**The build either plays or it does not.** Under reduced motion the scene renders
its final frame at `T+0.000` with the UI immediately visible.

### What is retained, and why

| Kept | Reason |
|---|---|
| Idle breathing (0.9u) | Sub-pixel at normal viewing distance; well below any vestibular threshold |
| Cursor interaction at 25% | A completely dead scene reads as broken. The page must still answer. |
| Nebula drift (0.6 u/s) | Imperceptible |

---

## D-011 · Uniform particle seed distribution

**Status:** REJECTED
**Owner doc:** [`24_target_assignment.md`](24_target_assignment.md) §24.4

### Proposed

Scatter the dormant particles uniformly across the terrain. Simpler, and it
avoids "giving away" the bridge's shape before the build starts.

### Outcome

Flight durations scattered from **1.8s to 14s**. Particles seeded at the far edge
of the valley had to cross the entire world to reach a near-end target, while
others barely moved.

The river lost its single characteristic speed and stopped reading as one
current.

### Decision

**Generate targets first, then seed each particle beneath its own target's
footprint**, with 86u of scatter and a downhill bias.

All flight durations land in a **4.5–5.7s band**.

### On "giving away the shape"

The concern is unfounded. At `brightness 0.17` the pattern is far below the
threshold of conscious recognition — a viewer registers *texture*, not
*structure*.

And on a second viewing, noticing that the bridge's footprint was always in the
ground is a **gift**, not a spoiler. It makes the story's central claim literal:
*the shape was already there; Claradix moved it into position.*

---

## D-012 · Fitting the whole bridge in frame

**Status:** REJECTED
**Owner doc:** [`25_camera.md`](25_camera.md) §25.2

### Proposed

The bridge runs off both edges of the frame. Pull the camera back so the whole
structure is visible.

### Outcome

Pulling back far enough drops the main tower below `y 38%`, breaking framing
constraint **F1**. The valley stops reading as a place and starts reading as a
**model on a table**.

### Decision

**The bridge does not fit, deliberately.** Visible width at the target depth is
~805u; the bridge spans 1040u.

We are looking at *part of a valley*, not at a diorama. Running off both edges is
what makes the world feel larger than the frame.

---

## D-013 · Particle colour reacting to interaction

**Status:** REJECTED
**Owner doc:** [`26_interaction_rules.md`](26_interaction_rules.md) §26.10

### Proposed

Particles near the cursor brighten or shift toward `--lime-core`, so the
interaction has more presence.

### Outcome

Two problems.

**It breaks the colour ratio.** The accent band is 5% ±3. A cursor-sized region
of `--lime-core` pushes it out of tolerance, and gate G5 fails on any capture
where the simulated cursor is over the bridge.

**It makes the cursor an object.** The scene has no on-screen cursor
representation by design — the cursor's presence is shown by *what the bridge
does*, not by a glow that follows the pointer.

### Decision

**Interaction is positional only.** No colour, no brightness, no size change.

---

## D-014 · Adding a second accent colour

**Status:** REJECTED
**Owner doc:** [`05_visual_language.md`](05_visual_language.md) §5.11

### Proposed

Variously: a cool blue for the countdown ring, a warm amber for the CTA, a
gradient on the headline.

### Outcome

Not built. Rejected on principle, and the principle is worth stating precisely:

> Neon-on-black is generic. Neon-on-black with **one colour and 85% darkness** is
> disciplined. The difference between this page and a hundred others is not the
> green — it is that there is nothing else.

### Decision

**Exactly one accent hue**, in three values (`--lime`, `--lime-bright`,
`--lime-core`).

### The one exception

**Red, on form errors, and nowhere else.** An error state that is lime-on-black
is not an error state, and errors signalled by colour alone fail accessibility
anyway.

---

## D-015 · Barrel roll radius large enough to see

**Status:** REJECTED
**Owner doc:** [`23_flight_choreography.md`](23_flight_choreography.md) §23.4

### Proposed

At 0.4–1.2u the roll is invisible on a single particle in a debug view. Raise it
to 4–6u so the effect is actually visible.

### Tried

Yes.

### Outcome

At 3–6u individual paths become followable and the river fragments into visible
strands. Above 8u it is confetti.

**The parameter was being evaluated in the wrong context** — one particle, zoomed
in, isolated. At 140,000 particles in motion at normal zoom, a 1u helix produces
exactly the shimmer it is supposed to.

### Decision

**Keep 0.4–1.2u.**

> The roll is never seen. It is only ever **felt**, as the reason the river
> shimmers instead of sliding.

**The test:** pause mid-glide and try to trace one particle's spiral. If you can,
it is too large.

---

## D-016 · Catenary cables

**Status:** REJECTED — *the pack was wrong, the code was right*
**Owner doc:** [`19_bridge_anatomy.md`](19_bridge_anatomy.md) §19.6

### Proposed

The pack specified that the main cables follow a **catenary** (`y = a·cosh(x/a)`)
and stated, in three separate documents, that a parabola "reads subtly wrong to
anyone who has looked at a real suspension bridge."

### Outcome

**It is the other way round.**

A catenary is the curve of a chain hanging under its **own** weight. A suspension
bridge's main cable carries the deck through its hangers, and that load — uniform
along the horizontal, and far heavier than the cable itself — makes the governing
curve a **parabola**. Golden Gate, Brooklyn, Akashi: all parabolic. An unloaded
suspension cable is not a thing.

### How it was caught

Not by review of the pack. The existing implementation in
`src/scene/centreline.ts` already used a parabola, with a comment saying so:

> *"A loaded suspension cable is a parabola, not a catenary — using the right
> curve is most of why this reads as a structure rather than as a swoosh."*

The pack was written without reading that file. The pack was wrong.

### Decision

**Parabola.** `19_bridge_anatomy.md`, `01_GLOSSARY.md` and
`36_CONFIGURATION.md` corrected; `01` now carries a full **Parabola** entry
alongside **Catenary** so the distinction is explained rather than merely stated.

### What this says about the pack

A specification written from a reference image and general knowledge will contain
confident errors, and the codebase may already know better. **Read the code
before writing the spec that governs it** — that ordering was skipped here and it
cost a wrong rule in three documents.

---

## D-017 · The accent palette was estimated from a JPEG

**Status:** REJECTED — *superseded by the real brand tokens*
**Owner doc:** [`06_art_direction.md`](06_art_direction.md) §6.2

### Proposed

The pack's entire palette — `--lime #A3E635`, `--lime-bright #C6F24E`,
`--lime-core #E9FFB0`, and a green-black dark ramp (`#050505` / `#070B05`) — was
derived by eyeballing the reference frame image.

### Outcome

`src/styles/tokens.css` already carried the real values, with a comment
recording where they came from:

> *"Values are inherited from the existing Claradix Tailwind config so this page
> and the main site are demonstrably the same brand — green.500 #7CFC00 and the
> dark ramp are lifted verbatim, not eyeballed."*

Two things were wrong, not one:

| | Pack (estimated) | Brand (actual) |
|---|---|---|
| Accent | `#A3E635` — yellow-lime | **`#7CFC00`** — pure green, `green-500` |
| Darks | `#050505` — neutral/green-black | **`#040610`** — blue-black |

The dark ramp mattered more than the accent. A green accent on a *blue*-black
dark is a complementary relationship, which is what makes the lime read as
**emitted light**. A green accent on a green dark reads as a monochrome wash —
which is what the pack would have produced.

### Decision

**Rebase on the brand.** The accent ramp is now
`#5FD800` / `#7CFC00` / `#A6FD3F`, three values straight from the Claradix
Tailwind palette, plus one new `--lime-core #D9FF9C` for the near-white that
dense particle regions clamp toward — the brand ramp stops at `green-400` and
has nothing that hot.

`--moss` and `--rim` are also new: the brand's darks are blue-black, and terrain
read from a blue rim light would look like ice.

93 hex substitutions across 15 documents.

### Same lesson as D-016

An estimate from an image lost to a value the codebase had already recorded, from
a source the pack did not know existed. Both corrections came from the same
omission: writing the specification before reading the implementation.

---

## D-018 · Three constants the pack declared and the code never read

**Status:** FIXED
**Owner doc:** [`36_CONFIGURATION.md`](36_CONFIGURATION.md)

### What was found

The colour ratio was failing 6 of 7 captures. Three of the four causes were the
same defect: a value written here, exported from `config.ts`, and never wired to
anything.

| Constant | Declared | What the code did |
|---|---|---|
| `POSTFX.bloom.strengthByPhase` | a seven-point curve | pinned to one of them (`living`, 0.85) |
| `POSTFX.bloom.mips` | 3 | never read; `PostFX` used its own default of 5 |
| `LIGHTING.swarmLights.assembly` | 5th point of the curve | skipped; ramped `glide → completion` |

### Why it took so long to see

Each one looked like a tuning problem. The bloom curve in particular presented
as *two contradictory failures*: the glide frames ran ten points over their
deep-band budget while the settled frames ran three points **under** their accent
target. One constant failing in opposite directions at opposite ends of the film
is the signature of a missing curve, and it is not a signature anyone recognises
while they are still turning dials.

### Decision

Wire them. `SceneHandle` gains an optional `bloomStrength()` channel — the scene
REPORTS what it wants and the `Stage` applies it, because the Stage is the only
place that knows whether bloom is enabled on this device at all.

### Rule

**A constant that is exported but never imported is a bug, not documentation.**
`npm run hygiene` should fail on one.

---

## D-019 · The swarm falloff had no zero

**Status:** FIXED
**Owner doc:** [`20_lighting_design.md`](20_lighting_design.md)

### What was found

`LIGHTING.swarmLights` declared `distance: 150` and `decay: 2`, in the sense
Three.js gives those words — the range at which a light ends, and the exponent of
its falloff. The shader used neither. It applied `1 / (1 + d²)` with `distance`
as a scale factor, a curve that **never reaches zero**.

Swarm-lit terrain is deep-band by definition: the light's own colour has
luminance 0.87. So the question is not how bright the light is but how far its
tail stays above the 0.058 band edge. Solving for it:

```
0.87 · falloff · intensity < 0.058   →   falloff < 0.19   →   d > 310u
```

Five lights over a 1624u bridge sit **325u** apart. Every light reached every
other light's territory. The result was a flat valley-wide wash measured at 25
points of deep against a 10-point budget — while the comment in `config.ts`
claimed, in detail, that the pools were discrete and the light travelled with the
river.

### Decision

Windowed falloff, `(1 - x²)^decay`, which terminates exactly at `range: 260`.
Same near-field shape, and beyond the range a light contributes nothing at all.

This one change moved `awakening` from 74.4% near-black to 89.5% and `glide` from
61.0% to 77.0%.

### Also found, in the same term

`intensity` peaked at 0.35 against a `terrainClamp` of 0.18 — a ratio near two,
so a single light saturated across most of its footprint. The clamp had stopped
limiting a hotspot and started **producing** one: a flat disc of constant
brightness, which is the spotlight-on-a-ridge it exists to prevent, with
straighter edges. Intensities now sit below the clamp so the falloff curve is
what you see.

---

## D-020 · Reference distances do not survive a change of world scale

**Status:** FIXED
**Owner doc:** [`21_anatomy_of_a_particle.md`](21_anatomy_of_a_particle.md)

### What was found

`PARTICLES.sizeAttenuation: 320` is the distance at which a particle renders at
its nominal size. It was inherited from the 277-unit world this scene was scaled
out of. The bridge now sits 700–1500u from the camera, so `320/1100` shrank every
particle to 0.29× nominal: even a peak-brightness one rendered at **0.85 pixels**,
below the point-size floor.

The symptom was an accent band at 1.6% against a 5% target *while peak brightness
measured 0.96*. The light was all there, in far too few pixels to count.

### This is the second instance

The depth-of-field focus plane was 120u in the same 700–1500u world, and produced
an 18% mid-tone wash that read convincingly as bloom.

### Rule

**When the world's scale changes, every constant denominated in distance has to
move with it.** They do not announce themselves — each one keeps working, just
against nothing.

The corrected 900 was arrived at twice independently: geometrically from the
camera-to-span distance, and empirically from a size sweep that needed ~2.8×.

---

## D-021 · Area is expensive, brightness is cheap

**Status:** ADOPTED — *a rule, not a change*
**Owner doc:** [`06_art_direction.md`](06_art_direction.md) §6.1

### The pattern

The colour rule counts PIXELS IN A BAND. It is indifferent to how bright a pixel
is once it has crossed an edge. So every parameter splits into one of two kinds,
and they behave nothing alike:

| Sets an AREA — expensive | Sets a BRIGHTNESS — cheap |
|---|---|
| `bloom.mips` (5 → 3 was worth 7 points) | `bloom.strengthByPhase` (0.85 → 0.62 was worth 1) |
| `terrain.rimPower` (3.2 → 2.4 cost 5 points) | `terrain.rimStrength` (0.34 → 0.72 cost 2.7) |
| `swarmLights.range` | `swarmLights.intensityByPhase` |
| `sizeAttenuation` | `PARTICLES.brightness` |

Both times this was mistaken, the error was the same shape: a sweep of the cheap
parameter came back nearly flat, and the conclusion drawn was *"this element is
not the problem"* rather than *"this parameter is not the lever"*.

`bloom.radius` is the trap case. It reads like the halo's size and is not — it
widens the up-sample tent by a few texels while the mip depth decides how far a
bright pixel actually throws light. Sweeping it 0.42 → 0.10 moved the ratio by
under half a point.

### The diagnostic that works

A luminance HISTOGRAM, not three band counts. The bands hid the shape completely:
nine of the twelve excess deep-band points sat between 0.058 and 0.2 — barely
above the black edge — which is a wide dim haze and not the bright core the pack
asks for. Three numbers cannot tell those apart. `scripts/palette-check.mjs`
prints the distribution on failure now.

---

## D-022 · Near-black is not black

**Status:** ADOPTED
**Owner doc:** [`18_sky_and_atmosphere.md`](18_sky_and_atmosphere.md)

### The requirement that was being failed

The ground's existence must be established by the DESIGN, not by the particles.
The scene did the opposite: the opening frame's landscape *was* the 140,000
seeded particles, and the instant they lifted away to build the bridge the valley
went black.

### What did not work

Raising the terrain rim. It cost 2.7 points of the near-black budget and was not
visible in the composite at all. The rim only fires where a surface turns away
from the viewer, and a valley seen down its own length presents almost no such
surface — the floor faces the camera, so `1 - |dot(n, v)|` stays near zero across
the whole of it.

Rendering the terrain **in isolation** is what settled it: alone, the rim was
plainly working, rolling ridgelines across the whole right of the frame. The left
half is empty because the terrain's horizon runs off it, and that half is where
the headline sits and the text scrim darkens the frame anyway. The ground did not
need more light.

> Isolating an element answers *"is this broken"* in one screenshot. The
> composite can only ever answer *"something is"*.

### What did work

A mist sheet lying on the valley floor, thick in the hollows and thin over the
rises — density evaluated per-vertex against the real heightfield, never a second
copy of the noise. It draws the topography instead of shading it.

**And it cost zero points.** The band edge is 0.058; the mist contributes about
0.024 on top of terrain sitting around 0.03. Plainly visible on a dark screen,
still counted as near-black.

### The general form

**The colour rule constrains the histogram, not the visibility.** There is a
great deal of usable picture underneath the near-black edge, and the scene had
been treating that whole range as unavailable.

### Footnote on solving rather than dialling

The mist's first values worked out to a tenth of what was needed and rendered as
nothing. The arithmetic is four lines and is written into `config.ts`. The
difference between invisible and correct was an order of magnitude — many more
increments than anyone wants to sit through.

---

## D-023 · Interaction that cannot be verified by reading it

**Status:** FIXED — *and now gated by `npm run interact`*
**Owner doc:** [`27_interaction_during_flight.md`](27_interaction_during_flight.md),
[`28_input_and_devices.md`](28_input_and_devices.md)

### Three failures, none of them visible in the source

**1 · The cursor was an obstruction, not a disturbance.**
The push was plain radial: `pos += normalize(pos - cursor) * falloff`. That has a
component ALONG the direction of travel, so a cursor held in front of an oncoming
particle shoves it backwards down its own path. The requirement is the opposite —
the cursor may deflect a particle, it may **not** stop one.

Projecting the push onto the plane perpendicular to travel removes exactly that
component and nothing else, so progress along the path becomes untouchable by
construction and the particle steps *sideways* around the cursor. The direction
of travel was free: position is a pure function of time, so every state already
knows the curve it is riding — the guide tangent in flight, the seed normal on
the way up.

Seated particles stay exempt. They are structure, not traffic; there is no
progress left to protect, and a bridge that refuses to be pushed along its own
axis feels like it is on rails.

**2 · Touch press-and-hold produced no events at all.**
Input was bound to `pointermove` alone. On a touchscreen that fires only while a
finger is *sliding* — so pressing and holding, which is the entire gesture, did
nothing. The two devices also disengage on opposite signals: a mouse that stops
moving is still pointing at something, a finger that lifts is not.

**3 · Push-in was declared and unbuilt, then built and unreachable.**
`CAMERA.dolly` and `INTERACTION.proximityDispersion` were both dead constants
(see D-018). Once wired, the wheel listener was scoped to the scene container —
and the UI overlay covers most of the left half of the frame, so a wheel event
anywhere near the headline never reached it. Push-in silently did nothing exactly
where the cursor was most likely to be.

### Why a test, and why this kind of test

Every one of these was plausible-looking code. Two of them had explanatory
comments describing behaviour that was not happening. Reading harder was never
going to find them.

`scripts/interact-check.mjs` reads the actual fields — `__cursorStrength`,
`__dolly`, `__disperse` — rather than diffing screenshots, because a pixel diff
can only report that *something* moved. It also waits on **values, not
durations**: under a software rasteriser the frame rate is a tenth of real and
the return spring is 1.6 seconds of scene time, so a fixed wall-clock wait would
report a half-finished recovery as a failure.

---

## D-024 · Hydration mismatch on every dev load, for a year, in a comment node

**Status:** FIXED
**Owner doc:** [`32_technical_architecture.md`](32_technical_architecture.md)

`src/entries/mount.tsx` chose between hydrating and client-rendering with:

```ts
if (root.firstChild) hydrateRoot(root, tree);
else createRoot(root).render(tree);
```

The template's root is `<div id="root"><!--app-html--></div>`. That placeholder
is a **comment node**, and a comment node is a perfectly good `firstChild`. So
dev took the hydrate branch every single time, tried to reconcile the entire app
against an effectively empty root, and threw on every load.

`firstElementChild` is the whole fix.

### Why it survived

It is harmless in production, where the placeholder has been replaced by real
markup — so the bug only ever existed in the one environment where nobody reads
the console. And the comment sitting directly above it asserted the correct
behaviour in plain English:

> *"`vite dev` serves the raw template with an empty root, so fall back to a
> normal client render there."*

It was found because `interact-check` treats page errors as failures. Nothing
else in the project was looking.

---

## D-025 · The page arrived eleven seconds before the bridge did

**Status:** FIXED — *gated by `npm run reveal`*
**Owner doc:** [`30_ui_reveal_choreography.md`](30_ui_reveal_choreography.md)

### What was happening

The whole point of the opening is that the bridge builds across an empty valley
and only then does the page assemble on top of it. What actually shipped was the
reverse: the reveal ran off the PAGE-LOAD clock, so logo, headline, form,
socials and countdown were all fully visible about 1.3 seconds in — while the
bridge still had ten seconds of building left to do.

The one moment the animation exists to earn was being spent before it started.

The delays were also eleven bare millisecond literals typed into the markup
(`0`, `120`, `200`, `900`, `1020`, …) rather than read from `UI_REVEAL.sequence`,
which `config.ts` opens by declaring a bug:

> *"A magic number anywhere else in src/ is a bug."*

Nothing connected the sequence in config to the elements in the tree. Eleven
numbers scattered across a component tree cannot be read as an order by anyone,
including whoever wrote them — and one element, the masthead keyword rail, had no
slot in the documented sequence at all. It revealed at 120ms because somebody
typed 120. It is now `tagline`, the twelfth step in a list the pack says has
eleven.

### The hard part is not the gate

Gating readable text on a WebGL animation is a promise that the animation will
finish. It might not: no WebGL, a failed chunk, a context loss, a device so slow
the scene clock crawls. Any of those, taken literally, is a blank page forever.

The reveal therefore resolves on the first of **three** signals, two of which do
not involve the scene at all:

| | Signal | Why |
|---|---|---|
| 1 | scene clock reaches `uiRevealStart` | the intended path |
| 2 | reduced motion requested | immediately, no animation to wait for |
| 3 | a 20-second wall-clock deadline | regardless of what the scene is doing |

(3) is not only a failure path. A slow device *should* show its text early while
the scene is still building: the animation is the treat, the page is the point.

### And underneath that, a second one

The prerendered HTML has no clock, so it ships with every element marked
`enter--waiting`. If the rule that hides them were unconditional, the static
artefact would be a blank page for every crawler and every visitor with a script
blocker. The hiding rule is therefore gated on a `js` class set by an inline
`<head>` script — inline and in the head deliberately, because a deferred script
would let one frame of content paint before hiding it, which is a worse artefact
than the one it prevents.

`reveal-check` tests this against `dist/`, not the dev server: `vite dev` serves
the raw template with an empty root, so with scripts off there is nothing to
render and the check would pass or fail for reasons unrelated to what it is for.
The thing being tested only exists after prerendering.

### Headline: lines, not characters

`UI_REVEAL.sequence` names `headline-line-1/2/3` with their own offsets, which is
a per-line instruction. The component was revealing character by character.

Blocks are seen; lines are read. A character sweep asks the eye to track a moving
edge, which is the opposite of reading — and it now arrives twelve seconds into
an animation that has just finished doing something far more interesting. The
page should be settling at this point, not starting a second performance.

---

## D-026 · The rewind, and the fifteenth attribute

**Status:** FIXED — *gated by `npm run loop`*
**Owner doc:** [`15_phase_6_rewind.md`](15_phase_6_rewind.md)

### Built

Eight seconds of choreography that was configured and never implemented, with
both of its orderings inverted from the build: spatially the disassembly front
runs `u` ascending so it travels AWAY from the camera, and structurally the
layers leave top-down — railing first, piers last. You cannot remove a tower
while a cable still hangs from it, for exactly the reason you could not hang the
cable before the tower existed.

Particles do not retrace their outbound paths. An exact reversal reads as video
played backwards — the eye catches time-reversed easing immediately — and the
moment it does, these stop being particles going home and become a recording
being scrubbed.

**The loop itself is one modulo**, because position is a pure function of time.
Nothing accumulates, nothing needs resetting, and particles return to their
ORIGINAL seeds, so the cycle is exactly repeatable rather than merely similar.

`SCENE.loop` also shipped as `true`, directly beneath a paragraph explaining why
it defaults to false. The rewind did not exist at the time, so the flag did
nothing and nobody noticed which way it pointed. It is a runtime uniform now,
not a compile-time branch — an animation nothing can exercise is one that will
be broken the next time somebody turns it on.

### And then the bridge disappeared

Adding `aRewindAt` took the particle system to fifteen vertex attributes. The
program failed to link — `Too many attributes (aHash)` — and three.js **skipped
the draw without throwing**. The entire bridge was absent from every frame.

Packing `(u, rewindAt)` into one `vec2` keeps the count where it was.

### Why it took so long, which is the actual finding

Everything inspectable was clean, because everything inspectable WAS clean:

| Checked | Result |
|---|---|
| every attribute, first and last element | finite, correct values |
| every uniform at the measured frame | correct |
| the generated vertex shader, in full | correct |
| the branch chain's structure | correct |
| bounding sphere, `frustumCulled`, scene membership | correct |
| blending, `depthTest`, `depthWrite`, `visible` | correct |
| forcing `pos` and `brightness` in-shader | no change |
| point size forced to the 14px cap | no change |

**None of those could find it, and the message was there the whole time.** Every
capture script listened for `pageerror` only, and a link failure is reported with
`console.error`.

`palette-check` reported a full set of plausible, internally consistent,
completely wrong numbers for a scene whose subject was not being rendered — and
it reported them as a PASS on five of seven captures, because a frame with no
bridge in it is a very dark frame and the rule rewards darkness.

### Rule

**A harness that measures rendering must fail on `console.error`.** Not log it —
fail. All four scripts do now, and `palette-check` counts page problems as a
failure ahead of the verdict, because a colour reading taken from a frame the
renderer refused to draw is not a colour reading.

> The corollary is worse than the rule: a silent renderer failure moves the
> colour ratio in the direction the rule calls *good*. This one would never have
> announced itself.

### Two tests that were wrong about a system that was right

Worth recording, because both were written confidently:

**"the rewind is taking it apart"** asserted that mid-rewind has less light.
Departure raises brightness from 0.74 to 1.00 — the same peak as arrival, since
leaving is acknowledged the way arriving was — so the frame is if anything
brighter. The light does not go away, it MOVES.

**"T and T+42 are identical"** asserted a pixel match. The sky's nebula drift and
the camera's idle drift both run on the WALL clock deliberately, so that no two
frames are ever identical. The test now establishes a drift floor from two
captures at the same scene time and requires the cycle comparison to come in
under it — which isolates the particle system, the thing actually claiming to
repeat.

---

## D-027 · The hygiene check, and what it found on its first run

**Status:** ADOPTED — `npm run hygiene`
**Owner doc:** [`38_acceptance_criteria.md`](38_acceptance_criteria.md)

Four static rules, each one added because the thing it forbids actually happened
in this project, cost real time, and gave no signal at the moment it was
introduced. None need a browser; all would have fired instantly.

| Rule | Prevents |
|---|---|
| **Vertex attribute budget** — 14 | D-026. A fifteenth attribute links a program that fails validation; three.js then skips the draw without throwing, and the subject of the scene is absent from every frame. |
| **No `Math.random()` in `scene/` or `lib/`** | A scene that renders differently per device makes every capture meaningless. |
| **Capture scripts must listen to `console`** | The detection failure in D-026. A link error is reported through `console.error` and nowhere else. |
| **Config exports must be read** | D-018, three times in one session. |

### What it found immediately

Two harnesses — `fit-check` and `autofill-check` — had never listened for page
errors of any kind, and `loop-check`, written the same afternoon as the rule,
had missed it too. All three now fail on one.

And `COLOUR_RATIO`: the 85/10/5 rule, sitting in `config.ts`, exported, imported
by nothing. `palette-check.mjs` carries its own copy of all four numbers plus the
per-capture targets that supersede them.

**Two copies of an acceptance criterion, one unread, is worse than one.**
Whichever is easier to find is the one that gets edited, and it is not the one
doing the enforcing. Removed rather than wired up — a `.mjs` script cannot import
a `.ts` config without a build step, and adding one to share four numbers with
their only consumer is not a trade worth making.

### Two false positives, both instructive

The first run flagged `Math.random()` inside the comment **forbidding**
`Math.random()`, and flagged its own source for mentioning `newPage` in the rule
about `newPage`. Both are now comment-stripped and match calls rather than
mentions.

> A checker that cannot tell code from prose will be ignored, and an ignored
> checker is worse than an absent one — it looks like coverage.

### Nested keys are notes, not failures

The heuristic cannot distinguish a dead key from one reached dynamically, so
those are reported for a person to judge. It would still have caught `mips` —
declared, never read, renderer silently using its own default, and worth seven
points of the colour ratio.

---

## D-028 · A suite that stops at the first failure is not a suite

**Status:** FIXED — `npm run verify`

The acceptance checks were chained with `&&`. Two colour captures are
deliberately left failing against a specification inconsistency nobody has ruled
on (Q-05), so the first link failed permanently and **the other five never ran
at all**.

`scripts/verify.mjs` runs every check, prints every output, and summarises. Each
still exits non-zero on its own; this only changes who decides to stop.

```
  PASS  hygiene    static rules, no browser needed
  FAIL  palette    colour ratio at the reference frame     <- Q-05, deliberate
  PASS  viewport   colour ratio across viewport sizes
  PASS  interact   cursor, touch and push-in
  PASS  reveal     the UI arrives after the bridge
  PASS  loop       rewind and cycle repeatability
```

> An open question should not be able to hide a regression. That is what a known
> failure costs when the suite is a chain.

---

## D-029 · The degradation ladder, and the system that can never be tested by using it

**Status:** BUILT — gated by `npm run perf`
**Owner doc:** [`34_performance_budget.md`](34_performance_budget.md)

### What was missing

`PERF` specified the entire adaptive system — sample window, downgrade and
upgrade thresholds, upgrade hysteresis, a thermal guard, the phases in which
measuring is meaningful and the phases in which changing anything is forbidden,
and an ordered list of what to give up first. Three tier-indexed tables were
read. **Nothing else was.**

A weak device therefore had no way to retreat. It stuttered at full quality until
the visitor left.

> Adaptive quality is the one system that can be fully specified, shipped, and
> never once executed — because it only fires on hardware that struggles, and
> nobody develops on hardware that struggles.

### Order is the design

Ranked by visual cost per millisecond saved, and particle count is LAST, because
the particles are the scene and everything above them is atmosphere.

```
  aberration → grain → trails → swarm lights → bloom radius → terrain → count
```

A page that drops half its particles to keep its film grain has its priorities
exactly inverted. Measured order on a stressed run:

```
  chromaticAberration → grain → swarmLights → bloomRadius → particleCount
```

`trailLength` and `terrainSegments` return **false** — the trail buffer is not
built, and the heightfield is baked at construction with the seeds, the piers,
the mist density and the ground glow all sampled from it, so rebuilding it
mid-scene would move the ground out from under the bridge. Returning false is the
honest answer: the governor takes the next rung instead of crediting itself with
a saving nothing made.

### Particle count had to be made free first

`setDrawRange` costs nothing and needs no rebuild, but buffer order was spatial
order — targets are generated layer by layer — so truncating deleted a
contiguous piece of bridge rather than thinning the whole of it.

The attributes are now written in a seeded Fisher-Yates order, so any prefix is a
uniform sample. **The span gets sparser; it never gets shorter.** That is the
difference between a device quietly running at reduced density and one visibly
missing its far end.

### Two degradation systems were fighting

`Stage` already dropped pixel ratio after 2.5 slow seconds, on its own. So the
first thing a struggling device gave up was SHARPNESS — before it had given up so
much as the film grain — and once the ladder existed the two would have taken
turns, costing the visitor both.

Resolution is now the last resort, after the ladder is spent, and it stays
one-way: dropping it is invisible until you compare, while restoring it
mid-session is a sudden sharpening that reads as a glitch.

### The clamp that would have hidden everything

The governor is fed `frame.raw`, a new unclamped field on `FrameInfo`, not
`frame.delta`. The clamp exists so a tab restored after two minutes does not
advance the scene by two minutes in one step — and it would have hidden exactly
the long frames the governor is looking for. A device stuttering at 200ms per
frame reports a healthy 50ms once clamped, and nothing ever fires.

Windows are reduced by MEDIAN, not mean, so one 400ms stall while a texture
uploads does not cost a device a quality tier.

### Tested by driving the governor, not the knobs

`window.__perfStress(frameMs, windows, phase)` feeds synthetic frame times into
the real decision path. Reaching past it to the knobs would only prove that knobs
turn; the logic worth testing is the part that decides when.

Eight checks: silence before the measuring phase, one rung per bad window, the
cheapest thing first, sustained retreat in the specified order, frozen during
assembly, one good window not being enough, and sustained good frames recovering.

---

## D-030 · The trails, and the two bugs that only the dormant frame could find

**Status:** BUILT
**Owner doc:** [`22_particle_lifecycle.md`](22_particle_lifecycle.md)

### How it works

An extra half-resolution pass of the particles alone, accumulated across frames:

```
  accum = previous * decay + this frame
```

At the specified decay of 0.88 a streak is down to 3.6% after 26 frames — which
is where `lengthFrames: 26` comes from. The two numbers are the same fact stated
twice.

Half resolution is deliberate. This is the most fill-bound pass in the scene and
the particles are drawn again in full on top of it every frame; the accumulator
only carries the smear, and a smear does not need pixels. It also softens the
streak for free, which a full-resolution version would have to spend a blur on.

The particles-only pass uses a **camera layer**, not a second scene: one graph,
one set of matrices, nothing that can drift apart. Only three states streak —
lifting, gliding, approaching. Dormant particles have not moved, and seated ones
are structure: a bridge that smears looks out of focus, and it would look that
way for the entire time anyone is reading the page.

### Bug 1 — the accumulator was eating the sky

`renderer.render` clears with `scene.background` when one is set, so the trail
pass began each frame filled with the fallback sky colour. The accumulator then
summed it geometrically: 1/(1 - 0.88) = **8.3x**, a flat lift of ~0.11 luminance
across the whole frame, in a scene whose entire near-black band lives below
0.058. Two points of near-black lost at every capture.

**The dormant frame is what gave it away.** Every particle is suppressed there,
so a trail effect cannot possibly change it — and it had changed by 2.6 points.
Whatever was brightening the frame was not the trails.

### Bug 2 — a zero-size point is a request, not an instruction

Suppression set `gl_PointSize = 0.0`. Not every driver clamps below one, and this
one did not: dormant still lost a point of near-black and gained a measurable
accent band. Moving the vertex outside the clip volume is defined behaviour
everywhere. Dormant then returned to **exactly** its pre-trail number.

> A capture in which nothing should change is the most sensitive instrument in
> the set. Both of these were invisible in the frames where the effect was
> supposed to be doing something.

### The clamp is what made it free

Unclamped, a pixel the river crosses slowly — the far end, where perspective
compresses the stream — receives contribution after contribution and converges
on 8.3x. Those regions saturated to white, the green went out of them, and the
river read as a solid bar of light rather than as particles.

`min(accum, 1.0)` — a streak may never be brighter than the particle that made
it. With it, `glide` measures **84.6% near-black: identical to the same frame
with trails switched off.** The blow-out was the entire cost of the feature.

Lowering `trailStrength` from 0.55 to 0.35 first moved the ratio by nothing at
all, which is D-021 again: the cost was in the AREA the saturation covered, not
in the brightness of the streak.

### And it unblocks a rung

`trailLength` was the one step of the degradation ladder returning false for want
of an implementation. It is now a real saving — an entire extra pass over 82,000
points — sitting third, because the streak is what makes the river read as one
current rather than as a cloud of separate dots.

---

## D-031 · The composition re-solve, and the frame that rose sideways

**Status:** IMPLEMENTED — first iteration under the v2.0 protocol

### The change

Centreline and camera re-solved as one problem against **silhouette**
constraints (cable sag ≥5.5% of frame height on screen, towers crossing the
horizon into sky, deck entering the left edge low, both ends off frame) instead
of frame-percentage constraints. The previous solve placed everything correctly
by percentages and produced an unnameable object, because the camera stood at
deck height and looked 46° off the span's axis.

Achieved: view axis to main span 89.7°, sag on screen 8.0%, main tower top at
(0.36, 0.42) clear of the text column, far tower 0.80× its height at (0.93,
0.48), deck entry at the left edge y 0.82, horizon 0.64. `sizeAttenuation`
moved 900 → 700 with the subject distance. The text scrim was narrowed to the
text column — the old stack was sized against a bridge that lived right of
centre and dimmed the new frame's own subject to near-invisibility.

### The bug the re-authoring exposed

`buildFrames` seeded the parallel-transport frame with "the world axis the
tangent is least aligned with" — which made the frame's orientation an
accident of the centreline's heading. Every consumer treats `normal` as UP
(towers climb it, cables rise along it) and `binormal` as LATERAL (deck width,
rail offset, the flight guide). One re-authored curve later, the normal came
out near-horizontal and **every tower in the scene rose sideways**, capping the
superstructure at Y≈67 against an expected 217 — while every schedule, count
and colour stayed perfectly valid.

Found via a new DEV probe (`window.__targets()`, per-layer min/max Y) that
answers "was it ever generated?" in one call — the difference between a
rendering problem and a generation problem.

**Fix:** the frame is now seeded with world-up projected off the tangent, so
normal ≈ gravity is guaranteed rather than happened upon. Towers rise along
gravity; the frame must promise it.

### Deliberately NOT touched (deferred, in protocol order)

- **Lighting/exposure** — the new frame runs far over the colour budget
  (deep band ~22%); the whole ratio must be re-tuned against the new
  composition, as predicted before the change.
- **The river's glide path** — the guide curve now sits at camera height and
  reads as a dead-straight bar across the horizon; belongs to the flight
  staging iteration.
- **The crossing basin** — broadside, the corridor carve reads shallow; the
  gap the bridge exists to cross needs deepening under the main span
  (Environment/Terrain).
- **Nebula position** — authored for the old frame's upper right.
- Verified unharmed: interaction 8/8, build + prerender green.

---

## 40.2 Open — not yet decided

Tracked in [`31_content_and_copy.md`](31_content_and_copy.md) §31.3.

| ID | Question | Current behaviour |
|---|---|---|
| **Q-01** | English headline, Azerbaijani sub-headline — deliberate or incomplete? | Ships as-is |
| **Q-02** | "Coming soon" appears twice | Both kept |
| **Q-03** | Copyright year | Generated |
| **Q-04** | Only one countdown unit accented | Largest non-zero unit |
| **Q-05** | Two §6.1 targets look authored per-frame rather than as a curve | Left failing on purpose — see below |
| **Q-06** | The colour ratio drifts ~2.2 points with viewport height | Bounded and gated by `npm run viewport`; mechanism not fully identified |

### Q-06 · Viewport drift

```
  1152x768   82.0% near-black   6.3% accent
  1440x900   83.5%             4.7%
  1536x1024  83.5%             5.0%     <- the reference frame
  1920x1080  84.2%             3.8%
```

Monotone with height: **smaller frames come out brighter.** 2.2 points of
near-black across the range, against the rule's 3-point tolerance — real, but a
drift rather than a failure.

**First diagnosis was wrong and is retracted.** An earlier reading claimed the
scene *collapsed* on short viewports — accent 0.1% against a 4–5% target. That
measurement was taken while the particle program was failing to link (D-026), so
the bridge was not being drawn at any size at all, and the number described the
harness rather than the scene.

**Second diagnosis also wrong.** The obvious mechanism is the one-fragment
rasterisation floor: once the dimmest particles fall under a pixel they keep an
absolute footprint while the frame shrinks around them, so their share climbs.
Raising `PARTICLES.sizePx.min` from 1.1 to 1.6 to test it moved the near-black
spread by **nothing** — 2.1 points before and after. Reverted; a constant whose
justification did not survive measurement is worse than no change.

The remaining candidate is the bloom chain: mip count is fixed, so the prefilter
runs at a resolution that is a constant fraction of the frame while the sprites
inside it are not, and how much of a sprite's energy survives the downsample
therefore depends on the absolute pixel size. Not verified.

`scripts/viewport-check.mjs` bounds it at 2.5 points so a regression is caught
even though the cause is open. That threshold is set from measurement, which
Q-05 explicitly refuses to do for §6.1 — the difference is that §6.1's numbers
are a specification with an author, and this one is a regression guard with none.
Fitting a guard to observed behaviour is what a guard is for; fitting a
specification to it destroys the only independent check there is.

### Q-05 · The two captures that will not meet their targets

```
        dormant  awaken  glide  asm-early  asm-late  complete  settled
target    94      91      87       87         85        86       85
actual    93.5    89.1    84.3     82.3       82.5      82.8     83.2
                                    FAIL                 FAIL
```

The scene's own sequence is smooth and monotonic — it darkens into the build,
bottoms out at the densest moment, and recovers as the light lands. The target
row is not: it steps 87 → 87 and then back **up** to 86 after 85.

**`assembly-early`** is given the same 87% as mid-glide. T+6.4 is the densest
instant in the film: the airborne population is at its maximum *while* the seated
population is already accumulating, so both light sources run at once. Mid-glide
had one of them and a nearly empty sky.

**`complete`** is targeted darker than `assembly-late` despite being the frame
where bloom peaks at 1.15 — the brightest moment by construction. It passed
before the ground glow was built, by **0.2 points against a 3-point tolerance**.
A target with that much margin is not a target the scene is meeting; it is one
the scene is standing next to.

**Neither fixed, and neither target edited to match.** Bloom is the only lever
with enough authority over these frames and it is already taken as far as it goes
without gutting the identity; the remaining alternative is changing the lift
schedule, which changes the film's timing and is not an implementation decision.

> A test that fails honestly is worth more than one edited to pass. What is
> wanted here is a ruling on §6.1, not a quieter checker.
| **Q-05** | Footer items: links or labels? | Non-interactive labels |
| **Q-06** | Twitter bird vs X mark | Bird, per the reference |
| **Q-07** | Intro duration may change | One scalar; floor at 0.55 |
| **Q-08** | Offer device-orientation parallax? | No prompt |

---

## 40.3 Template

```markdown
## D-nnn · Title

**Status:** REJECTED | ACCEPTED | ACCEPTED WITH COST | OPEN
**Owner doc:** [`nn_name.md`](nn_name.md) §n.n

### Proposed
What was suggested, and why it seemed reasonable.

### Tried
Was it built? If so, for how long?

### Outcome
What actually happened. Be specific — "it looked worse" is not useful.

### Decision
What we do instead.

### Counter-argument recorded
The strongest case for the rejected option, so nobody has to reconstruct it.
```

---

## 40.4 End of the pack

Forty-one documents. `00`–`40`, plus `36` as the constant store.

**The three files that matter most, in order:**

| | Why |
|---|---|
| [`36_CONFIGURATION.md`](36_CONFIGURATION.md) | Every number. If the pack and the code disagree, this file wins. |
| [`08_SCREENPLAY_FULL.md`](08_SCREENPLAY_FULL.md) | The whole scene in one reading. What we are actually making. |
| **This file** | Why the obvious answers were wrong. What stops the work from drifting back. |

**The thing to remember:**

> The scene is procedural and real-time. There is no reference video. The only
> ground truth is one still image of the final frame plus these documents — so
> every ambiguity in the writing becomes a difference in the build.
>
> That is why the pack is long, and why the gates are mechanical rather than
> tasteful.

---

**Back to:** [`00_START_HERE.md`](00_START_HERE.md)
