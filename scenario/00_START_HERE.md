# 00 — START HERE

**Claradix "Coming Soon" — Scene Production Bible**

Version 2.0 · Status: Active · Supersedes the 15-file draft pack (deleted)

---

## 0.1 What this is

This folder is the complete description of one thing: **a single web page that
contains one continuous animated scene.** Not a website with many pages. Not a
video file. One page, one scene, running live in the browser.

The scene shows a bridge being built out of light. Small glowing specks —
"particles" — lie scattered on the ground of a dark valley. They wake up, lift
into the air, fly in a long curving stream, and one by one they lock into place
until they have assembled a suspension bridge. When the last speck arrives, the
bridge is finished, and the page's text appears on top of it.

That is the whole scene. Everything in this folder exists to describe that
scene so precisely that two different people, working separately, would build
the same thing.

---

## 0.2 Who this is written for

**Assume the reader knows nothing.** Not "nothing about this project" —
nothing about 3D graphics, nothing about animation, nothing about web
development. Every document in this pack is written so that a person
encountering the words "shader", "catenary", or "easing" for the first time can
still follow along, because those words are explained the moment they appear
and again in [`01_GLOSSARY.md`](01_GLOSSARY.md).

This is deliberate. Three kinds of reader will open these files:

| Reader | What they need | Where they should start |
|---|---|---|
| **A newcomer** joining the project | The story and the shape of the thing | `00` → `02` → `04` → `08` |
| **A designer / art director** | Look, feel, colour, composition, timing | `00` → `06` → `07` → `08` → `29` |
| **A developer** implementing it | Exact numbers, module map, build order | `00` → `36` → `16` → `21` → `32` → `37` |
| **A reviewer / QA** | What "correct" means, how to fail a build | `00` → `38` → `39` → `07` |

If you read only one file after this one, read
[`02_ONE_PAGE_SUMMARY.md`](02_ONE_PAGE_SUMMARY.md). If you read only two, add
[`08_SCREENPLAY_FULL.md`](08_SCREENPLAY_FULL.md).

---

## 0.3 The scene in thirty seconds

> Darkness. A valley with hills and mountains, lit only by a faint green haze in
> the sky. Scattered across the ground, thousands of dim green specks sit
> motionless, like seeds thrown across a field.
>
> One by one, they wake. They lift off the ground and begin to fly, each one
> rolling as it goes, the way a stunt plane rolls. They form a long river of
> light that sweeps across the valley.
>
> The river reaches the far end of the valley first. There, the specks begin to
> stop — each one freezing at an exact point in mid-air. A tower appears. Then a
> roadway. Then cables. The construction moves toward the viewer, from far to
> near, until the last speck snaps into place.
>
> The bridge is complete. It pulses once. Then the page's text fades in over it.
>
> From that moment the scene is alive: moving the mouse shifts the view of the
> mountains, and pointing at the bridge pushes its particles aside — they scatter
> under the cursor and drift back when it leaves. The bridge is never destroyed,
> only disturbed.

---

## 0.4 The scene in three minutes

The scene runs in **seven phases**. Each phase has its own document in
Section 3.

| Phase | Name | Window | What happens |
|---|---|---|---|
| **0** | Dormant | `T+0.000` → `T+1.200` | The world exists. The bridge does not. Particles lie on the ground, dim and still. |
| **1** | Awakening | `T+1.200` → `T+2.800` | Particles lift off the ground in a spreading wave. They brighten as they rise. |
| **2** | The Glide | `T+2.800` → `T+5.400` | Particles fly in a convoy along a curving path, each spiralling (barrel-rolling) as it travels. They leave light trails. |
| **3** | Assembly | `T+5.400` → `T+11.200` | Particles arrive at the bridge and stop at their assigned coordinates. Construction runs **far end → near end**, and within each section **piers → towers → deck → main cables → hangers**. |
| **4** | Completion | `T+11.200` → `T+12.400` | The final particle lands. A single pulse of light travels the length of the bridge. |
| **5** | Living Scene | `T+12.400` → ∞ | The bridge breathes. Interaction is fully active. UI text reveals in sequence between `T+12.400` and `T+15.520`. |
| **6** | Rewind | *optional* | Only if `SCENE.loop === true`. Twenty seconds after completion, the whole build runs in reverse and the scene restarts. |

**The intro is over at `T+12.400`. The page is fully readable at `T+15.520`.**

Both of those numbers, and every other number in this pack, come from one
file: [`36_CONFIGURATION.md`](36_CONFIGURATION.md).

---

## 0.5 The Five Laws

These are non-negotiable. Every other rule in this pack is downstream of these
five. If a proposed change violates one of them, the change is wrong — not the
law.

### Law 1 — The world is not made of particles. Only the bridge is.

The ground, the hills, the mountains, the sky, the haze: these are **built
geometry and shading**. They are solid, continuous, and they exist from
`T+0.000`. Particles never form terrain, never form mountains, never form sky.

Particles have exactly one destination: **the bridge**.

The particles that lie on the ground in Phase 0 are *resting on* the terrain,
not *made of* it. Remove every particle from the scene and you should still see
a complete, believable valley.

> Why this matters: the tempting shortcut is to make everything out of particles
> because it looks uniformly "digital". That shortcut destroys the story. The
> story is that a *real place* grows a bridge. If the place is also made of
> specks, nothing is being transformed — it is just noise rearranging itself.

See [`17_terrain.md`](17_terrain.md) and [`21_anatomy_of_a_particle.md`](21_anatomy_of_a_particle.md).

### Law 2 — The world came first. The bridge grew into it.

The bridge must never look *placed*. It must look like the valley evolved
around it — the terrain dips where the bridge crosses, the mountains frame it,
the haze pools beneath it.

Practically: terrain is authored **with the bridge's path in mind**, not
generated randomly and then had a bridge dropped on top.

See [`03_brand_philosophy.md`](03_brand_philosophy.md), [`17_terrain.md`](17_terrain.md).

### Law 3 — The bridge is never fully solid.

It sits permanently between energy and matter. You can always see through it.
You can always see that it is *made of individual points*. It never becomes a
continuous, opaque, "finished" object.

Practically: no solid meshes in the bridge. Ever. Even at full assembly, the
bridge is a point cloud plus its glow.

See [`19_bridge_anatomy.md`](19_bridge_anatomy.md).

### Law 4 — A particle in flight never stops.

From the moment a particle leaves the ground until the moment it reaches its
target, it is moving. Nothing may halt it — not the cursor, not a touch, not a
collision, not another particle.

If the cursor is in its way, the particle **steers around** the cursor's
influence radius and keeps going. It curves; it does not brake.

This is the single most commonly violated rule in implementations, because the
naive way to write repulsion is to subtract from the particle's velocity, and
subtracting enough force will stall it. The correct implementation deflects the
velocity **direction** while preserving its **magnitude**.

See [`27_interaction_during_flight.md`](27_interaction_during_flight.md).

### Law 5 — Interaction disturbs; it never destroys.

The cursor pushes particles aside. Particles always return. The silhouette of
the bridge — its towers, its span, its curve — must remain legible at every
instant, even at maximum disturbance.

A viewer must never be able to "break" the bridge, wipe it away, or leave it
permanently deformed.

See [`26_interaction_rules.md`](26_interaction_rules.md).

---

## 0.6 Complete file map

Forty-one documents in ten sections. Each line: **file — what it answers.**

### Section 0 — Orientation

| File | Answers |
|---|---|
| `00_START_HERE.md` | *(this file)* What is this pack, how do I read it, what are the rules that outrank all other rules |
| [`01_GLOSSARY.md`](01_GLOSSARY.md) | What does every technical word in this pack mean, explained from zero |
| [`02_ONE_PAGE_SUMMARY.md`](02_ONE_PAGE_SUMMARY.md) | The entire scene on one page, for someone with two minutes |

### Section 1 — Story and creative direction

| File | Answers |
|---|---|
| [`03_brand_philosophy.md`](03_brand_philosophy.md) | Why does Claradix look like this; what is the brand actually claiming |
| [`04_story_seed_to_bridge.md`](04_story_seed_to_bridge.md) | What is the narrative; what is the emotional arc from second 0 to second 15 |
| [`05_visual_language.md`](05_visual_language.md) | What is allowed on screen, what is forbidden, what outranks what |
| [`06_art_direction.md`](06_art_direction.md) | Exact palette, glow character, grain, contrast ratios, the 85/10/5 rule |

### Section 2 — Reference

| File | Answers |
|---|---|
| [`07_reference_frame_analysis.md`](07_reference_frame_analysis.md) | The target final frame, measured to the percent: every element's position, size, colour, and spacing |

### Section 3 — The screenplay *(the heart of this pack)*

| File | Answers |
|---|---|
| [`08_SCREENPLAY_FULL.md`](08_SCREENPLAY_FULL.md) | The whole scene written as a screenplay, beat by beat, start to finish |
| [`09_phase_0_dormant.md`](09_phase_0_dormant.md) | `T+0.000`–`T+1.200` — the sleeping world, frame by frame |
| [`10_phase_1_awakening.md`](10_phase_1_awakening.md) | `T+1.200`–`T+2.800` — lift-off, the wave, the brightening |
| [`11_phase_2_glide.md`](11_phase_2_glide.md) | `T+2.800`–`T+5.400` — the convoy, the barrel roll, the trails |
| [`12_phase_3_assembly.md`](12_phase_3_assembly.md) | `T+5.400`–`T+11.200` — construction order, snap behaviour, layer sequence |
| [`13_phase_4_completion.md`](13_phase_4_completion.md) | `T+11.200`–`T+12.400` — the last particle, the completion pulse |
| [`14_phase_5_living_scene.md`](14_phase_5_living_scene.md) | `T+12.400`→∞ — idle breathing, active interaction, the steady state |
| [`15_phase_6_rewind.md`](15_phase_6_rewind.md) | The optional loop: hold, reverse, restart |

### Section 4 — The world

| File | Answers |
|---|---|
| [`16_world_map.md`](16_world_map.md) | The 3D coordinate system, world scale, where everything sits in space |
| [`17_terrain.md`](17_terrain.md) | The valley: hills, ridges, the bridge corridor, materials, why it is not particles |
| [`18_sky_and_atmosphere.md`](18_sky_and_atmosphere.md) | Sky gradient, nebula haze, stars, fog, depth cueing |
| [`19_bridge_anatomy.md`](19_bridge_anatomy.md) | Every part of the bridge, its geometry, and how the target point cloud is generated |
| [`20_lighting_design.md`](20_lighting_design.md) | All light in the scene, including how flying particles illuminate the mountains |

### Section 5 — The particles

| File | Answers |
|---|---|
| [`21_anatomy_of_a_particle.md`](21_anatomy_of_a_particle.md) | What data a single particle carries, and what each field does |
| [`22_particle_lifecycle.md`](22_particle_lifecycle.md) | The state machine: dormant → lifting → gliding → approaching → seated |
| [`23_flight_choreography.md`](23_flight_choreography.md) | The flight path, the guide curves, the barrel-roll maths |
| [`24_target_assignment.md`](24_target_assignment.md) | Which particle goes where, and the stagger formula that produces far→near assembly |

### Section 6 — Camera and interaction

| File | Answers |
|---|---|
| [`25_camera.md`](25_camera.md) | Framing, parallax on mouse move, and dispersion when the viewer pushes in |
| [`26_interaction_rules.md`](26_interaction_rules.md) | The core interaction contract: proximity, hold, return |
| [`27_interaction_during_flight.md`](27_interaction_during_flight.md) | How a moving particle avoids the cursor without ever slowing down |
| [`28_input_and_devices.md`](28_input_and_devices.md) | Mouse, touch-and-hold, mobile, keyboard, gamepad-absent fallbacks |

### Section 7 — Interface

| File | Answers |
|---|---|
| [`29_ui_layout.md`](29_ui_layout.md) | Every UI element's position, size, and spacing, at every breakpoint |
| [`30_ui_reveal_choreography.md`](30_ui_reveal_choreography.md) | The order and timing in which the text appears after the bridge completes |
| [`31_content_and_copy.md`](31_content_and_copy.md) | The actual words, the language policy, and the open copy questions |

### Section 8 — Technical

| File | Answers |
|---|---|
| [`32_technical_architecture.md`](32_technical_architecture.md) | Module map, how this pack maps onto `src/`, data flow |
| [`33_render_pipeline.md`](33_render_pipeline.md) | Draw order, passes, post-processing, blend modes |
| [`34_performance_budget.md`](34_performance_budget.md) | Particle counts per tier, frame budgets, adaptive degradation |
| [`35_accessibility.md`](35_accessibility.md) | Reduced motion, contrast, keyboard, screen readers, the static fallback |
| [`36_CONFIGURATION.md`](36_CONFIGURATION.md) | **Every constant in the project, in one place. The single source of truth.** |

### Section 9 — Quality and process

| File | Answers |
|---|---|
| [`37_implementation_plan.md`](37_implementation_plan.md) | Build order, milestones, what to make first and what to defer |
| [`38_acceptance_criteria.md`](38_acceptance_criteria.md) | The checklist that decides whether a build passes |
| [`39_do_and_dont.md`](39_do_and_dont.md) | Concrete traps, with the reason each one is a trap |
| [`40_decision_log.md`](40_decision_log.md) | What we tried, what we rejected, and why — so nobody re-proposes a dead idea |

---

## 0.7 Conventions used throughout this pack

Every document follows these. If a document appears to break one, the document
is wrong.

### Time

Absolute scene time is written **`T+seconds.milliseconds`**, measured from the
first rendered frame of the scene.

```
T+0.000     scene start
T+1.200     Phase 1 begins
T+11.200    last particle seats
T+12.400    intro complete
```

Relative durations are written as plain seconds or milliseconds: `520ms`,
`2.6s`. Per-particle timings are always *relative to that particle's own
schedule*, and this is stated explicitly when used.

**Frame numbers** are only used where sub-frame precision matters, and always
assume **60 frames per second**, so one frame = `16.667ms`. A "frame 3 flash"
means roughly `50ms`.

### Space

The world uses **Three.js conventions**: right-handed, **+X right, +Y up, +Z
toward the viewer**. The camera looks in the **−Z** direction.

One **world unit** = **one metre**, conceptually. The bridge's main span is
therefore a plausible ~468 units, not an abstract 1.0.

Positions are written `(x, y, z)`, e.g. `(-40, 26, -150)`.

Full detail: [`16_world_map.md`](16_world_map.md).

### Screen positions

Positions on the final rendered image are given as **percentages of the
viewport**, measured from the **top-left corner**:

```
x 5.3%   →  5.3% of viewport width from the left edge
y 21.5%  →  21.5% of viewport height from the top edge
```

Percentages always refer to the **reference frame** described in
[`07_reference_frame_analysis.md`](07_reference_frame_analysis.md), which is
**1536 × 1024** (a 3:2 aspect ratio). Other aspect ratios are handled by the
rules in [`29_ui_layout.md`](29_ui_layout.md).

### Colour

Colours are written as hex with the token name:

```
--lime  #7CFC00
```

Where a colour is used with transparency it is written
`rgba(255, 255, 255, 0.12)`. Where a colour is used as a *light* (an emitter
rather than a surface), its linear intensity is given alongside.

The full palette lives in [`06_art_direction.md`](06_art_direction.md) and is
mirrored as tokens in `src/styles/tokens.css`.

### Numbers

**Every number that the implementation depends on lives in
[`36_CONFIGURATION.md`](36_CONFIGURATION.md).**

When another document quotes a number, it quotes it *with its constant name*:

> The influence radius is `INTERACTION.influenceRadius` = **90 world units**.

If you change a number, you change it in `36` and then update the quotes. If a
quoted number and `36` disagree, **`36` wins**.

### Callouts

Four callout types appear throughout:

> **Why:** the reasoning behind a rule. Read these — they are what stop the rule
> from being "cargo-culted" into a place it does not belong.

> **Trap:** a specific mistake that has been made or is very likely to be made.

> **Cheap version:** an acceptable simplification when performance or time is
> short, and exactly what is lost by taking it.

> **Open:** a question that has not been decided yet, with the options.

### Diagrams

Diagrams are ASCII art or Mermaid, embedded directly. There are no external
image dependencies — this pack is readable in a plain text editor with no
network connection.

---

## 0.8 How to change something

This pack is a contract. Changing it has a procedure, because the failure mode
of a large spec is drift: someone changes a number in one file, three other
files silently become wrong, and the build starts disagreeing with itself.

**The procedure:**

1. **Find the owning document.** Every fact has exactly one home. Timings live
   in `36` and are narrated in `09`–`15`. Colours live in `06`. Geometry lives
   in `19`. If you cannot tell which document owns a fact, that itself is a bug
   — say so.

2. **Change it there first.**

3. **Grep for the constant name** across the pack and update every quotation.

4. **If the change reverses a previous decision, append to
   [`40_decision_log.md`](40_decision_log.md).** State what was there before,
   what it is now, and — most importantly — *what went wrong with the old
   version*. A rejected idea with no recorded reason will be re-proposed within
   a month.

5. **If the change affects what "correct" looks like, update
   [`38_acceptance_criteria.md`](38_acceptance_criteria.md).**

> **Why the decision log matters:** the draft version of this pack contained a
> rule saying hover triggers one reaction that then smoothly returns. It was
> built, and it was wrong — the fixed envelope began rebuilding while the viewer
> was still pointing at the bridge, so the reaction read as a flicker rather than
> a response. Without that written down, the "one-shot envelope" idea looks
> perfectly sensible and would be proposed again. It is preserved in
> [`40_decision_log.md`](40_decision_log.md) as entry **D-001**.

---

## 0.9 Things this pack deliberately does not decide

Listed here so their absence is not mistaken for an oversight.

- **The launch date the countdown counts to.** The countdown is driven by a
  configured target timestamp; the value is deployment configuration, not scene
  design. See `31_content_and_copy.md` §"Countdown target".
- **Where the email signup posts to.** The CTA opens a subscribe form; the
  backend endpoint is environment configuration (`.env`), not scene design.
- **Analytics events.** Tracked in `src/lib/analytics.ts`, out of scope here.
- **The final copy in every language.** The current mixed English/Azerbaijani
  state is flagged as an open question in `31_content_and_copy.md`, not silently
  ratified.

---

## 0.10 Current known open questions

These are tracked so they do not get lost. Each is expanded in its owning
document.

| ID | Question | Owner doc | Blocking? |
|---|---|---|---|
| **Q-01** | Headline is English, sub-headline is Azerbaijani. Intentional or incomplete localisation? | `31` | No — build with current copy |
| **Q-02** | "Coming soon" appears twice (eyebrow + headline line 3). Keep or cut? | `31` | No |
| **Q-03** | Copyright reads © 2024; current year is later. | `31` | No — trivial fix |
| **Q-04** | In the countdown, only "23 / DAYS" is lime while the other three are white. Is this "largest remaining unit" logic, or decorative? | `29` | No — implement as *largest non-zero unit*, flagged |
| **Q-05** | Footer items (`ABOUT US`, `INNOVATION`, `SPEED`, `RELIABILITY`, `YOU`) are styled like links but read like values. Links or labels? | `31` | No — implement as non-interactive labels, flagged |
| **Q-06** | Social icon for Twitter is the legacy bird, not the X mark. | `31` | No |
| **Q-07** | Total intro duration is set at 12.4s; the client has stated this may change. | `36` | No — all timings derive from one scalar so this is a one-line change |

---

## 0.11 Reading order, if you just want to be told

Read them in this order and nothing will reference something you have not yet
seen:

```
00  START HERE            ← you are here
02  One page summary
01  Glossary              (skim; return to it constantly)
04  Story
07  Reference frame       (what we are building toward)
08  Screenplay full       (the whole scene, once, in prose)
16  World map             (now the coordinates in 08 make sense)
19  Bridge anatomy
21  Anatomy of a particle
22  Particle lifecycle
09–15  Phase files        (the same scene again, but exhaustively)
36  Configuration         (every number, now that you know what they are for)
32  Technical architecture
37  Implementation plan
38  Acceptance criteria
```

Everything else is reference material to be opened when a specific question
comes up.

---

## 0.12 A note on the tone of this pack

These documents are long. That is intentional and it has a cost, so it should
be justified.

The scene being described is **procedural** — it is not a video that someone
can watch to check whether the build is right. There is no ground-truth footage.
The only ground truth is one still image of the final frame, plus this pack.
Everything between `T+0.000` and `T+12.400` exists nowhere except in these
words.

That means every ambiguity in this text becomes a difference in the built
result, and differences compound. "The particles rise" produces one thing;
"particles rise in a wave that starts at the far ridge and reaches the near
bank 640ms later, each particle's lift-off jittered by up to ±90ms so the wave
front is soft rather than a straight line" produces another. Only the second one
is buildable.

So: when a document seems to be over-explaining, it is because the alternative
is a build meeting where somebody says *"oh, I thought you meant the other
thing."*

---

**Next:** [`01_GLOSSARY.md`](01_GLOSSARY.md) — every technical term in this
pack, defined from zero.
