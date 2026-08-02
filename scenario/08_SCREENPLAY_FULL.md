# 08 — THE SCREENPLAY

**The whole scene, start to finish, written out.**

---

## 8.0 How to read this document

This is the scene as a **screenplay**. It is written to be read straight
through, in order, the way you would read a script before a shoot — so that a
person who has read nothing else in this pack finishes it knowing what the
thing *is*.

It is deliberately narrative. Where a hard number matters it is given, but this
document does not attempt to be complete about numbers. The seven phase
documents (`09`–`15`) are the exhaustive versions; this one is the reading.

**Format conventions:**

```
T+0.000                    ← absolute scene time
──────────────
SHOT / BEAT NAME           ← what this moment is called

Prose describing what the viewer sees.

    > Direction to the implementer, indented.
      Numbers, mechanisms, and constraints.
```

**Cast of the scene** — there are only five characters:

| | |
|---|---|
| **THE VALLEY** | Terrain, mountains, ridgelines. Silent, permanent, present from the first frame. |
| **THE SKY** | Nebula haze, stars, fog. Provides the only ambient light. |
| **THE PARTICLES** | ~140,000 of them. The protagonist, collectively. |
| **THE BRIDGE** | Does not exist at the start. It is what the particles become. |
| **THE VIEWER** | Off-screen, but real. From `T+12.400` the scene responds to them. |

---

# ACT ONE — THE SLEEPING WORLD

---

```
T+0.000
──────────────
FADE UP FROM BLACK — but there is barely anything to fade up to.
```

Darkness. Not the flat black of an unloaded page — a **living** darkness, with
depth in it.

The first thing that resolves is the **sky**: a faint, cold green haze pooled in
the upper right of the frame, the colour of moss seen through fog. It is not
bright enough to be called light. It is bright enough to say *there is
atmosphere here*.

Beneath it, a **horizon**. Ridgelines, drawn only by the thinnest green edge
where they meet the sky. The mountains themselves are pure black — you do not
see their surfaces, only their outlines, the way you see hills at night.

The land falls away from the horizon toward the viewer into a **wide valley**.

> The entire environment — terrain, mountains, sky, fog — exists at full
> quality on frame one. Nothing about the world builds or fades in. This is
> **Law 1**: the world is not made of particles, and it is not assembled.
> It was always here.
>
> `POSTFX.bloom.strengthByPhase.dormant` = **0.30**. Low. The scene has not
> begun to glow yet.

And scattered across the valley floor, across the slopes, across every surface
that catches the eye: **specks**.

Thousands of them. Tens of thousands. Dim green points, so faint they read more
as texture than as objects — the way a field of frost reads at dusk. They lie
where they fell. They do not move.

They look like **seed thrown across a field**.

> `PARTICLES.brightness.dormant` = **0.17**. Barely above the terrain's own
> value. At this brightness a still frame looks almost like noise in the image,
> which is correct — the viewer should not immediately register them as
> *objects*.
>
> Particles rest on the terrain heightfield with a small random offset above the
> surface, and are oriented to the local normal. They are **on** the ground, not
> **in** it and not floating above it.

There is **no bridge**.

> This must be unmistakable. The region of frame where the bridge will
> eventually stand — `x 45%–95%`, `y 30%–75%` — is empty valley and empty sky.
> Not dim. Not faint. Not a ghost of the bridge waiting to be filled in.
> **Nothing.**
>
> The single most common failure of this scene is a build where the bridge is
> faintly visible from the start. It destroys the entire premise.

```
T+0.000 → T+1.200
──────────────
THE SCENE BREATHES
```

Nothing happens. Deliberately.

The specks shimmer very slightly — not in unison, each on its own rhythm, some
brightening while others dim. The haze drifts. That is all.

For 1.2 seconds the viewer is given a place, and nothing to do in it.

> This pause is doing work. It establishes the world as the baseline state, so
> that everything which follows reads as a **change to an existing place**
> rather than as an animation starting up.
>
> Cut this beat and the scene reads as a loading sequence.

---

# ACT TWO — THE WAKING

---

```
T+1.200
──────────────
FIRST LIGHT — at the far end of the valley
```

At the very back of the valley — the furthest visible point, near the right
horizon — one of the specks brightens.

Then another. Then thirty. Then a spreading front of them.

And they **lift off the ground**.

> Lift-off begins at `u = 1.0` — the far end of the bridge's future path — and
> spreads toward the camera. `LIFT.windowStart` = **1.200**.
>
> The far particles go first because they have the furthest to travel and must
> arrive first. The choreography is causally honest: everything that happens
> early happens because of something that must happen later.

They rise slowly at first, almost hesitantly, straight up. As each one leaves
the ground it **brightens sharply** — from the dull ember of the dormant state
to something with real presence.

> `PARTICLES.brightness`: `dormant 0.17` → `lifting 0.55`. The brightening is
> tied to *altitude above the seed point*, not to time — so a particle that
> rises faster brightens faster, which reads as physical rather than scripted.
>
> `LIFT.releaseSpeed` = **26 u/s**, `LIFT.verticalPhase` = **0.42s** of
> near-vertical rise before the path begins to bend.

```
T+1.200 → T+2.800
──────────────
THE WAVE
```

The lift-off spreads across the valley like wind crossing a wheat field.

It is not a straight line. The front is **ragged** — some particles go early,
some late, some hold on to the ground a moment longer than their neighbours.

> `LIFT.jitter` = **±90ms**. Without it the wave is a ruler-straight edge
> sweeping the terrain, which reads as a scanner rather than as an awakening.
>
> `LIFT.curveExp` = **1.6**, which front-loads the wave: the far half of the
> valley empties quickly, and the near ground keeps releasing particles for
> several more seconds. The ground is never suddenly, uniformly bare.

As more of them rise, something changes in the environment: **the mountains
begin to be visible.**

Not brightly. But where a dense group of particles passes near a ridge, that
ridge briefly picks up a soft green wash, and its shape resolves out of the
black.

> This is the swarm lighting. `LIGHTING.swarmLights` — **five** point lights
> tracking the centroids of particle clusters, `intensityMax` **0.35**, hard
> terrain contribution clamp **0.18**.
>
> **This must stay subtle.** The brief is explicit. The effect should be
> *noticed in retrospect* — the viewer should realise afterwards that they could
> see more of the landscape than they could at the start, without having
> registered the moment it happened.
>
> If the mountains are obviously, evenly lit, the value is too high and the
> 85/10/5 colour ratio has already broken.

```
T+2.800
──────────────
THE PATHS BEND
```

The risen particles stop going up.

Their trajectories curve — smoothly, without a corner — and turn toward the
same direction. Not toward the viewer. **Along** the valley, following the line
where the bridge will be.

Within half a second, thousands of individual ascents have resolved into a
single **current**.

---

# ACT THREE — THE RIVER

---

```
T+2.800 → T+5.400
──────────────
THE GLIDE
```

What was a scattered lift-off is now a **river of light**.

It enters from the lower left of the frame, sweeps up and to the right across
the valley, and runs away toward the far horizon along the bridge's future path.
It is dense in the middle and frayed at the edges. It has a visible current —
you can see which way it is going without being told.

Every particle in it is **rolling**.

Each one traces a slow spiral around its own line of travel, the way a stunt
plane barrel-rolls down a runway. Not fast. Not wild. A steady, lazy rotation
that catches the light differently as it turns, so the river **shimmers**.

> `FLIGHT.roll` — radius **0.4 – 1.2 u**, **1.6 – 3.4** turns over the full
> flight, phase randomised per particle.
>
> **The roll radius is deliberately tiny.** The instinct is to make it large so
> the roll is legible. That is wrong. At radius above ~3u the river stops
> reading as a river and becomes confetti. If you can follow one particle's
> spiral with your eye, it is too big.
>
> The roll is meant to be perceived as **texture within a coherent stream**, not
> as individual acrobatics. It is why the river looks alive instead of looking
> like a fluid simulation.

Behind each particle, a **trail** — a short streak of fading light. Individually
they are nothing. Collectively they turn the river into the long, sweeping
light-streaks that dominate the lower-left of the reference frame.

> `PARTICLES.trail` — 26 frames of history (≈430ms), per-frame decay **0.88**.
>
> Implemented as an **accumulation buffer**, not as per-particle line geometry.
> 140,000 line strips is not affordable; a fading framebuffer produces the same
> read for a fraction of the cost. See
> [`33_render_pipeline.md`](33_render_pipeline.md).
>
> Trails render **only** for particles in `lifting` and `gliding` states. A
> seated particle that smears is a bug — it makes the finished bridge look
> motion-blurred.

The river is now the **brightest thing in the scene**.

> `PARTICLES.brightness.gliding` = **0.92** — higher than the seated value of
> `0.74`.
>
> This is a deliberate inversion of the obvious choice. You would expect the
> finished bridge to be the brightest thing. It is not. **The travel is the
> hero, not the destination.** The particles are at their most alive in transit,
> and they calm down once they become structure.
>
> `POSTFX.bloom` reaches **0.62** here. `LIGHTING.swarmLights` peak at **0.35** —
> this is the moment the mountains are most visible, because this is when the
> most light is in the air.

And still, behind the river, particles are **continuing to leave the ground**.
The near half of the valley is still releasing them. The river is being fed.

```
T+5.400
──────────────
THE HEAD OF THE RIVER ARRIVES
```

The leading edge of the current reaches the far end of the valley — the point
furthest from the viewer, near the right horizon.

And there, for the first time, a particle **stops**.

---

# ACT FOUR — THE BUILD

---

```
T+5.400 → T+11.200
──────────────
ASSEMBLY
```

It happens one particle at a time, and it happens **far to near**.

At the far end, particles begin peeling off the river and freezing in place.
Each one decelerates over the last fraction of its journey, arrives at a
specific point in empty air, and **stops dead** — with a single frame of extra
brightness as it seats.

> `ASSEMBLY.windowStart` = **5.400**, `windowSpan` = **5.220**.
> `seatAt(u) = 5.400 + (1 − u) × 5.220 + layerOffset`.
>
> The **snap flash** is one frame at `brightness 1.00`, decaying to the seated
> `0.74` over ~180ms. It is what makes each arrival feel like an *event* rather
> than a fade.

At first it is incomprehensible — points of light hanging in the dark with no
apparent relationship. Then a vertical line of them accumulates, and it is
obviously a **pier**. Then another beside it. Then a **tower** grows upward, leg
by leg. Then a flat plane of points extends outward from its base and becomes a
**roadway**.

The bridge is being built the way a bridge is actually built: **from the bottom
up, load-bearing first.**

> `ASSEMBLY.layerOffset`, in seconds, applied on top of the spatial sweep:
>
> | Layer | Offset |
> |---|---|
> | `piers` | 0.000 |
> | `towers` | 0.145 |
> | `deck` | 0.290 |
> | `mainCables` | 0.435 |
> | `hangers` | 0.522 |
> | `railing` | 0.580 |
>
> You cannot hang a cable from a tower that does not exist. The scene obeys
> this even though nothing forces it to, because a viewer who has ever seen
> construction will feel the wrongness if it does not — without being able to
> say why.

The construction front moves steadily **toward the viewer**.

This is the crucial motion of the entire scene: the finished section grows, the
river feeding it gets **shorter**, and the whole process advances out of the
distance and into the foreground.

> Think of laying track. You travel to the far end and build backwards toward
> yourself. Early on, the river runs the full length of the valley. By
> `T+9.000`, most of it is bridge and only the near quarter is still flowing.
> By `T+11.000` there is a last thin stream in the immediate foreground.
>
> **This is why the reference frame still shows light trails in the
> foreground.** The reference is not the final state — it is approximately
> `T+10.500`, with the far bridge complete and the near approach still
> arriving. See [`07_reference_frame_analysis.md`](07_reference_frame_analysis.md)
> §7.11, note **R-1**.

The far tower completes. Then the main cables sweep between the towers in a
long catenary curve, laid down point by point along their length. Then the
hangers drop from cable to deck — dozens of fine vertical lines, appearing in
quick succession, the highest-frequency detail in the scene.

> Hangers are where insufficient particle count first becomes visible. At
> `high` tier and above they merge into continuous lines. Below that they read
> as dotted, which is the expected and accepted degradation. See
> [`34_performance_budget.md`](34_performance_budget.md).

The bloom rises steadily as the structure accumulates.

> `POSTFX.bloom.strengthByPhase`: `assembly 0.62` ramping to `assemblyEnd 0.88`
> across the phase. The scene gets brighter because there is more of it, and
> because the glow is being allowed to spread further.

```
T+11.200
──────────────
THE LAST PARTICLE
```

In the immediate foreground, at the very bottom-left of the frame, one final
particle comes in off the last thread of the river, decelerates, and seats.

The river is gone. There is nothing left in the air.

The bridge is whole.

---

# ACT FIVE — COMPLETION

---

```
T+11.200 → T+12.400
──────────────
THE PULSE
```

For a moment — about a fifth of a second — nothing.

Then a **wave of brightness** travels the length of the bridge, from the far end
where construction began, down the whole span, to the near end where it
finished. Every particle it passes flares and settles.

The bloom swells with it and falls back.

> `POSTFX.bloom.strengthByPhase.completion` = **1.15**, a 200ms peak, settling
> to `living 0.85`.
>
> The pulse travels `u = 1 → u = 0`, in the same direction the build ran. It is
> the structure acknowledging itself — a signal running the length of something
> that is now continuous, which it was not a second ago.
>
> **One pulse. Never repeated.** A bridge that pulses rhythmically is a
> heartbeat, and a heartbeat is a different, much cheaper idea than the one this
> scene is telling.

And then it is quiet.

The bridge hangs in the dark valley, made of light, made of points, obviously
not solid — you can see the mountains through it — and completely, structurally
whole.

---

# ACT SIX — THE PAGE

---

```
T+12.400 → T+15.520
──────────────
THE TEXT ARRIVES
```

Now, and only now, the page appears.

Each element fades up and rises very slightly into place, one after another,
in a rhythm slow enough to be read as a sequence rather than as a group:

> The logo, top left.
>
> Then, after a beat, the small wide-spaced line: **COMING SOON**.
>
> Then the headline, **one line at a time**:
> *Something new* … *is taking shape.* … and then, in lime, *Coming soon*.
>
> Then the sub-headline beneath it.
>
> Then the outlined button — *Get notified* — with its bell and its arrow.
>
> Then the three social circles, in quick succession.
>
> Then, in the upper right, a thin lime arc **draws itself** into a ring —
> and inside it, the countdown numbers appear: days, hours, minutes, seconds.
>
> And last, along the bottom, the footer.

> `UI_REVEAL` — every element: opacity `0 → 1`, translateY `12px → 0`, duration
> **520ms**, easing `cubic-bezier(0.16, 1, 0.3, 1)`. Offsets from `T+12.400` in
> [`36_CONFIGURATION.md`](36_CONFIGURATION.md) §36.13.
>
> The headline reveals **line by line**, not as a block. This is what makes the
> viewer read it rather than see it.
>
> Total: last element completes at **`T+15.520`**.

The page is now exactly the reference frame — except that the light trails are
gone, because nothing is flying any more.

---

# ACT SEVEN — THE LIVING SCENE

---

```
T+12.400 → ∞
──────────────
IT DOES NOT STOP
```

The bridge is finished but it is not frozen.

Every particle in it moves very slightly, continuously — a fraction of a metre,
slowly, each on its own rhythm. The structure has a faint permanent shimmer,
like heat over a road, or like something holding still under tension.

> `PARTICLES.breathe` — amplitude **0.9u**, frequency **0.21 Hz**, phase
> scattered per particle by a hash of its index.
>
> The phase scatter is not optional. If every particle breathes in unison the
> whole bridge swells and shrinks together, which reads as a pulse — and we have
> already spent our one pulse.

And now the scene is **listening**.

**Move the mouse**, and the view shifts. Not much — the mountains slide a little
against each other, the parallax between the near ridge and the far one opens
and closes, the whole frame tilts by a degree or two. It feels less like moving
a camera and more like leaning slightly in your chair.

> `CAMERA.parallax` — ±22u translation, ±2.4° yaw, ±1.2° pitch, smoothing
> **0.045**. Very heavy. The camera has mass.
>
> It should be almost impossible to notice you are controlling it. You should
> only notice that the scene is not flat.

**Move the cursor over the bridge**, and the particles get out of the way.

They push outward from the cursor, opening a soft void beneath it, the structure
bending around your pointer like sand under a finger. Hold still and they
**stay** pushed aside — no flicker, no bounce, no re-forming while you are still
there.

Move away and they come back. Slowly. Noticeably slower than they left.

> `INTERACTION` — `influenceRadius` **90u**, `maxDisplacement` **30u**,
> `riseResponse` **0.34s**, `returnResponse` **1.40s**.
>
> **The asymmetry is the whole point.** Fast to scatter, slow to rebuild. That
> ratio — roughly 1:4 — is what makes the bridge read as *matter* rather than as
> a field of dots. Effortless return would make it feel weightless.
>
> **Distance alone drives the reaction.** There is no timer, no envelope, no
> animation that plays out. This is decision **D-001** in
> [`40_decision_log.md`](40_decision_log.md) — an envelope-based version was
> built and rejected, because it began rebuilding while the viewer was still
> pointing at the bridge, and read as a flicker rather than as a response.

And however hard you push, **the bridge is still a bridge.** The towers are
still towers. The span still spans. You can disturb it; you cannot break it.

> **Law 5.** `maxDisplacement` is capped at **30u** against a main span of
> **468u** — about 6%. The silhouette survives by construction, not by
> discipline.

**Push the camera in** toward the bridge — scroll, or pinch on a phone — and the
whole structure begins to come apart in your hands. The closer you get, the more
it scatters, until you are inside a cloud of moving points that is still,
recognisably, a bridge.

Pull back, and it reassembles.

> `INTERACTION.proximityDispersion` — begins at dolly **0.55**, reaching radius
> **180u** and displacement **64u** at full push-in. Auto-returns after **2.4s**
> without input.
>
> This is the same disturbance as the cursor, applied globally instead of
> locally. The rule it expresses: **the bridge is only solid from a distance.**
> Get close enough and you can see it was always just light.

```
T+32.400   [only if SCENE.loop === true]
──────────────
THE REWIND
```

Twenty seconds after the bridge completed, if looping is enabled, the text fades
away — and then the bridge comes apart.

It is the build, exactly reversed. **Near to far** this time, and top-down:
railings first, then hangers, then the great cables, then the deck, then the
towers, and last the piers.

Each particle lifts out of its position, turns, and flies back down the valley
to the patch of ground it came from. The river runs the other way. The far end
holds longest, and then it too is gone.

The valley is empty again. The specks lie scattered on the ground, dim, still.

And after a moment, one of them brightens.

> `LOOP` — `holdAfterComplete` **20.000s**, `rewind.duration` **8.000s** (0.65×
> the build — a rewind that takes as long as the build reads as a mistake).
> UI fades out **900ms before** the rewind begins, so the viewer is never
> reading text while the page dismantles itself underneath it.
>
> `rewind.retraceExact` = **false**. Particles take a simplified return path
> rather than exactly reversing their flight. Exact retracing looks like video
> played backwards, which breaks the illusion that these are objects with
> agency.
>
> **`SCENE.loop` defaults to `false`.** A landing page that repeatedly destroys
> itself while someone is trying to read it is hostile. This exists so the
> client can enable it deliberately, not as the default experience.

---

## 8.1 The scene in one sentence

> **A valley wakes up, throws its light into the air, and builds a bridge out of
> it — starting at the far horizon and finishing at your feet — and then lets you
> put your hand through it.**

---

## 8.2 What every phase is *for*

Each phase earns its place. If a phase is cut for time, this is what is lost.

| Phase | Narrative job | If you cut it |
|---|---|---|
| **0 · Dormant** | Establishes the world as pre-existing | The scene reads as a loading animation |
| **1 · Awakening** | Establishes that the particles are *of* this place | The particles read as arriving from outside — the story becomes "something was delivered here" instead of "this place transformed" |
| **2 · Glide** | The beauty shot; also where the mountains become visible | The scene becomes a build with no journey — mechanical |
| **3 · Assembly** | The argument: idea → reality, made literal | There is no scene |
| **4 · Completion** | Punctuation. Tells the viewer it is over | The transition to UI feels arbitrary |
| **5 · Living** | Converts a viewer into a participant | The page is a video, and videos are not remembered |
| **6 · Rewind** | Optional. Demonstrates reversibility | Nothing — it is genuinely optional |

> If the intro must be shortened, **cut a phase; do not compress all of them**.
> Below `SCENE.timeScale = 0.55` the assembly stops reading as construction and
> starts reading as a wipe. See [`40_decision_log.md`](40_decision_log.md) entry
> **D-004**.

---

## 8.3 The three things most likely to go wrong

Stated here, at the end of the reading, because they are the notes most worth
carrying into a build.

**1 · The bridge is faintly visible at `T+0`.**
Usually because the target point cloud is instantiated with a low but non-zero
opacity, or because a debug flag survived. It destroys the premise completely —
if the bridge is already there, nothing is being built.

**2 · Interaction stops the particles.**
The naive repulsion implementation subtracts from velocity, and enough force
stalls a particle. **Law 4** forbids this. Deflect *direction*, preserve
*magnitude*. See [`27_interaction_during_flight.md`](27_interaction_during_flight.md).

**3 · Everything gets brighter.**
Every individual change pushes toward more glow, and each one is defensible in
isolation. Ten of them produce a generic neon landing page. The **85/10/5** ratio
is measured mechanically by `scripts/palette-check.mjs` precisely because it
cannot be defended by taste alone.

---

**Next:** [`09_phase_0_dormant.md`](09_phase_0_dormant.md) — the same scene
again, exhaustively, phase by phase.
