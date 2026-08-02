# 09 — PHASE 0 · DORMANT

**`T+0.000` → `T+1.200` · duration 1.200s · 72 frames at 60fps**

---

## 9.1 The one-line version

> A dark valley that has always been here, with tens of thousands of dim specks
> lying on its ground, and **no bridge**.

---

## 9.2 Why this phase exists

Phase 0 contains no events. Nothing moves in any way a viewer could describe.
It is 1.2 seconds — 72 frames — of a still image with a faint shimmer in it.

It is also the phase most likely to be cut by someone trying to make the intro
"snappier", and cutting it is the single most damaging edit available.

**What it is doing:**

### It establishes the world as pre-existing

Everything after this point is a **change to a place**. For a change to read as
a change, the viewer needs to have seen the unchanged state. Without Phase 0,
the particles rising is the first thing that happens, and the scene reads as
*an animation starting up* rather than as *a place doing something*.

### It makes the absence of the bridge a fact

This is the load-bearing function. The entire premise — that the bridge is
*built* — depends on the viewer registering, at some level, that **there was no
bridge**. If they never see the empty valley, the build reads as a reveal
transition rather than as construction.

The viewer does not need to consciously notice. They need to have been shown.

### It sets the darkness baseline

The scene's whole visual argument is that it is dark, and that light is scarce
and precious. That argument is made by showing darkness first. If the first
frame already contains a river of light, the viewer's eye adapts to *that* as
normal, and the finished bridge reads as merely more of the same.

### It gives the page a moment to actually be loaded

A practical benefit. 1.2 seconds is enough for the first frames to stabilise,
for the GPU to warm its caches, and for any frame-time spike from initial
shader compilation to happen while nothing is moving.

> **Trap:** "the user will bounce during a 1.2s dead moment."
>
> They will not. The frame is not dead — it is atmospheric, it has depth, and
> the shimmer reads as *something is about to happen*. What causes bouncing is a
> blank white screen or a spinner, neither of which is what this is. See
> [`40_decision_log.md`](40_decision_log.md) entry **D-002**, where a 0.4s
> version of this phase was tried and rejected.

---

## 9.3 What exists at `T+0.000`

Everything in this list is at **full quality on the first rendered frame**.
Nothing in Phase 0 fades in, builds, or resolves.

| Element | State | Document |
|---|---|---|
| Terrain mesh | Complete, full resolution | [`17_terrain.md`](17_terrain.md) |
| Mountains / framing ridges | Complete | [`17_terrain.md`](17_terrain.md) |
| Sky gradient | Complete | [`18_sky_and_atmosphere.md`](18_sky_and_atmosphere.md) |
| Nebula haze | Complete, drifting | [`18_sky_and_atmosphere.md`](18_sky_and_atmosphere.md) |
| Stars | Complete, twinkling | [`18_sky_and_atmosphere.md`](18_sky_and_atmosphere.md) |
| Fog | Active | `WORLD.fogNear/fogFar` |
| Ambient + key light | Active at full value | [`20_lighting_design.md`](20_lighting_design.md) |
| Mist plane in valley floor | Active | `WORLD.mistPlaneY` = 6 |
| All particles | **Present**, dormant, on the ground | §9.5 |
| Camera | At base position, idle drift active | [`25_camera.md`](25_camera.md) |
| Bloom | Active at `0.30` | `POSTFX.bloom.strengthByPhase.dormant` |
| Vignette, grain | Active at full value | `POSTFX` |
| Text scrim | **Active** | §9.9 |

## 9.4 What does not exist at `T+0.000`

| Element | Why |
|---|---|
| **The bridge** — any part of it | The premise. See §9.10. |
| Bridge target point cloud, visible | Computed and held in memory, rendered at zero contribution |
| Light trails | Nothing is flying |
| Swarm lights | `intensityByPhase.dormant` = **0.00** |
| Ground glow under the bridge | There is no bridge to glow |
| Any UI text | Reveals at `T+12.400` |
| Interaction response | Cursor is tracked but has no effect. See §9.8. |

---

## 9.5 The dormant particles

### Count

The **full** particle count for the device tier. Every particle that will ever
be part of the bridge is already present, lying on the ground.

| Tier | Particles on the ground at `T+0.000` |
|---|---|
| `ultra` | 200,000 |
| `high` | 140,000 |
| `medium` | 90,000 |
| `low` | 45,000 |
| `minimal` | 16,000 |

> **There is no emitter.** Particles are never created or destroyed during the
> scene. This is unusual for a particle system and it is deliberate: because the
> particle count exactly equals the bridge's target count, the bridge is
> **guaranteed** to complete perfectly, with no gaps and no leftovers.
>
> A spawning system would have to reconcile "how many have I made" against "how
> many do I need" every frame, and any drift shows up as holes in the finished
> structure.

### Distribution across the terrain

Particles are **not** scattered uniformly. Their density follows the same
distribution as their eventual targets, projected down onto the terrain.

```
Density map, viewed from above (■ dense · ▓ medium · ░ sparse · · empty)

        NEAR (u=0)                                    FAR (u=1)
    ┌──────────────────────────────────────────────────────────┐
    │ ·  ·   ░  ░   ·    ·     ·      ·        ·       ·      · │
    │  ░  ░ ░ ▓ ░ ░  ░    ░     ░      ░        ░      ░       │
    │ ░ ▓ ▓▓███▓▓ ▓ ░ ▓  ▓▓█▓▓  ▓   ░  ▓▓█▓▓  ░   ▓  ░    ░    │
    │ ▓███████████▓▓▓███████████▓▓▓██████████▓▓▓▓███▓▓▓░░░     │
    │ ░ ▓ ▓▓███▓▓ ▓ ░ ▓  ▓▓█▓▓  ▓   ░  ▓▓█▓▓  ░   ▓  ░    ░    │
    │  ░  ░ ░ ▓ ░ ░  ░    ░     ░      ░        ░      ░       │
    │ ·  ·   ░  ░   ·    ·     ·      ·        ·       ·      · │
    └──────────────────────────────────────────────────────────┘
                        ↑                    ↑
                   main tower           far tower
                  (dense cluster)     (dense cluster)
```

The band of highest density runs **along the bridge corridor**, with visible
concentrations beneath where the two towers will stand.

> **Why not uniform?**
>
> Two reasons, one aesthetic and one practical.
>
> **Aesthetic:** a uniform scatter reads as *dust*. A scatter with structure —
> denser here, thinner there — reads as *something arranged*, and it plants the
> shape of the bridge in the ground before anything happens. A viewer rewatching
> the scene will see that the bridge's footprint was always visible in the seed
> distribution. That is a gift to the second viewing, not a spoiler for the
> first, because at `brightness 0.17` the pattern is far below the threshold of
> conscious recognition.
>
> **Practical:** it shortens flight paths. A particle whose target is the main
> tower starts life near the main tower's footprint, so its journey is a rise, a
> curve, and a short traverse — not a trip across the entire valley. This keeps
> all flight durations in the tight 4.5–5.7s band that makes the river read as
> one coherent current.

**The scatter law:**

```
seedPosition(particle) =
    project onto terrain(
        target.xz
        + randomDisk(SEED.scatterRadius)          // lateral spread
        + towardValleyFloor(SEED.downhillBias)    // seeds settle in low ground
    )
    + terrainNormal × random(0.15, 0.55)          // small lift off the surface
```

```ts
export const SEED = {
  /** How far a particle's seed may sit from directly beneath its target. */
  scatterRadius: 86,          // world units

  /** Seeds drift toward locally lower terrain, as loose objects would.
   *  0 = ignore slope, 1 = fully settle into hollows. */
  downhillBias: 0.42,

  /** Height above the terrain surface. Particles rest ON the ground; they do
   *  not intersect it and they do not float. */
  surfaceOffset: [0.15, 0.55],

  /** Seeds are never placed on slopes steeper than this — they would visibly
   *  be "stuck" to a cliff face. */
  maxSlopeDeg: 46,
} as const
```

### Orientation

Each particle is oriented to the **terrain normal** at its seed point — that is,
they lie flat against the ground, following its contours.

This is invisible for a round point sprite, but it matters for the lift: a
particle's initial rise direction is *away from the surface it was resting on*,
not straight up in world space. On a sloped hillside they lift perpendicular to
the slope, which is what makes the awakening read as *the ground releasing
them* rather than as *gravity being switched off*.

### Appearance

| Property | Value |
|---|---|
| Brightness | `PARTICLES.brightness.dormant` = **0.17** |
| Colour | Sampled from `PARTICLES.colorRamp` at 0.17 → ≈ `#3A5613` |
| Size | `PARTICLES.sizePx.min` = **1.1px**, before perspective attenuation |
| Blending | Additive |
| Trails | **None** — `statesWithTrails` excludes `dormant` |

At `brightness 0.17` against a terrain albedo of `#0B0F18`, a single particle is
barely separable from image noise. Tens of thousands of them together produce a
faint granular texture across the valley floor.

> **This is the correct look.** In review, someone will say the particles are
> "too dim to see". They are supposed to be. The viewer should register *texture*,
> not *objects*. The moment they resolve into countable dots, the awakening loses
> its surprise.
>
> Verification: at `T+0.600`, a human should be able to say "the ground has
> something on it" but should **not** be able to say "there are little lights on
> the ground".

---

## 9.6 The only motion in Phase 0

Three things move. All three are below the threshold of conscious notice, and
all three exist to prevent the frame from reading as a static image.

### 9.6.1 Particle shimmer

Each dormant particle's brightness oscillates slightly, on its own phase.

```ts
export const DORMANT_SHIMMER = {
  /** Brightness varies within this band around the 0.17 base. */
  amplitude: 0.055,          // → range 0.115 … 0.225

  /** Slow. Much slower than the seated "breathe" of Phase 5. */
  frequencyHz: 0.13,

  /** Each particle's phase from hash(index). Never in unison. */
  phaseScatter: true,

  /** A small fraction of particles shimmer at double frequency, which breaks
   *  up the otherwise uniform rhythm. */
  doubleRateFraction: 0.09,
} as const
```

> **Trap — unison.** If all particles shimmer together, the entire ground
> brightens and dims as one, and the valley appears to be breathing. That is a
> completely different, much more supernatural idea than the one we want. The
> ground is **inert**; the individual specks are the ones with life in them.

### 9.6.2 Nebula drift

The haze in the upper right moves very slowly.

| Property | Value |
|---|---|
| Drift speed | 0.6 u/s, direction `(+0.82, +0.11, −0.56)` normalised |
| Internal turbulence period | 34s |
| Visible displacement over Phase 0 | ~0.7u — imperceptible in isolation |

Its function is not to be seen moving during Phase 0. Its function is that the
frame is never *identical* between any two moments, which the eye detects even
when it cannot name it.

### 9.6.3 Camera idle drift

The camera is never perfectly still.

| Property | Value |
|---|---|
| Amplitude | ±7u horizontal, ±3.5u vertical |
| Period | 23.0s horizontal, 31.0s vertical |
| Displacement over Phase 0 | ~1.9u horizontal |

The two periods are **coprime**, so the combined motion never visibly repeats.

> **Why so slow?** At these amplitudes and periods, the drift produces roughly
> **0.03 pixels of parallax per frame**. It is not seen. It is the difference
> between "a photograph" and "a very still shot", which viewers detect
> immediately and cannot articulate.

---

## 9.7 Frame-by-frame

The complete phase, at 60fps. Values are the state *at the start of that frame*.

| Frame | `T+` | Particle brightness | Bloom | Swarm lights | Notes |
|---|---|---|---|---|---|
| 0 | 0.000 | 0.170 | 0.30 | 0.00 | First rendered frame. Full world. No bridge. |
| 6 | 0.100 | 0.170 ±shimmer | 0.30 | 0.00 | |
| 12 | 0.200 | " | 0.30 | 0.00 | |
| 18 | 0.300 | " | 0.30 | 0.00 | |
| 24 | 0.400 | " | 0.30 | 0.00 | |
| 30 | 0.500 | " | 0.30 | 0.00 | |
| 36 | **0.600** | " | 0.30 | 0.00 | **Capture point `dormant`** — see §9.11 |
| 42 | 0.700 | " | 0.30 | 0.00 | |
| 48 | 0.800 | " | 0.30 | 0.00 | |
| 54 | 0.900 | " | 0.30 | 0.00 | |
| 60 | 1.000 | " | 0.30 | 0.00 | |
| 66 | 1.100 | " | 0.30 | 0.00 | Last frame in which nothing has begun |
| **72** | **1.200** | " | 0.30 | 0.00 | **Phase 1 begins this frame.** First particles at `u≈1.0` begin their lift. |

**Nothing in this table changes.** That is the content of the phase.

> **Note on frame 72:** the transition is not a cut. At `T+1.200` the *earliest
> scheduled* particles begin lifting — a few dozen out of 140,000, at the far end
> of the valley, near the right horizon, at the smallest apparent size in the
> frame. The visible change at the boundary is close to nil. Phase 1 becomes
> perceptible around `T+1.45`.

---

## 9.8 Interaction during Phase 0

**Cursor position is tracked. It has no visible effect.**

| Input | Phase 0 behaviour |
|---|---|
| Mouse move | Position recorded. **Camera parallax is active** — see below. |
| Cursor over particles | No dispersion. Dormant particles do not react. |
| Click | No effect (the CTA does not exist yet) |
| Scroll / wheel | Dolly is **disabled** until `T+12.400` |
| Touch | Position recorded; no dispersion |
| Pinch | Disabled |

### Camera parallax IS active from `T+0.000`

This is a deliberate exception, and the reasoning is worth stating.

Dispersion is off because there is nothing to disperse — dormant particles are
part of the ground, and having them scatter under the cursor would contradict
the "these are seeds lying in soil" reading before it has even been established.

But **parallax is on**, because it costs nothing and it tells the viewer, within
the first half second, that this is a **live 3D space and not a video**. That is
a valuable thing to communicate early, and it can only be communicated by
responding to input.

> A viewer who moves their mouse in the first second and sees the mountains
> shift has learned something true about the page. A viewer who moves their
> mouse and sees nothing has learned something false.

### Dolly is disabled until `T+12.400`

Camera push-in causes the bridge to scatter (`INTERACTION.proximityDispersion`).
There is no bridge yet, so the control has nothing to act on — and worse, pushing
in during the build would let a viewer fly into the middle of an incomplete
structure, which looks like a bug.

Wheel and pinch events during Phases 0–4 are **swallowed silently**. No scroll
of the page, no zoom of the browser, no visual response.

---

## 9.9 The text scrim in Phase 0

The left-side darkening gradient (`POSTFX.textScrim`) is **active from
`T+0.000`**, even though there is no text on top of it yet.

| Property | Value |
|---|---|
| From | `rgba(3, 5, 2, 0.86)` at `x = 0%` |
| To | `rgba(3, 5, 2, 0.00)` at `x = 52%` |

> **Why have it before the text exists?**
>
> Because if it fades in at `T+12.400` alongside the UI, the left third of the
> frame visibly darkens at that moment, and the viewer sees a *rectangle*
> appear. It reads as a UI panel sliding in, which is exactly the wrong
> impression for text that is meant to feel like part of the image.
>
> Having it present throughout means the left side of the valley is simply, and
> always, darker — which also happens to be good composition. The eye is pushed
> toward the right side of the frame, which is where the bridge will build.

**Consequence for Phase 0:** the dormant particles on the left third of the
frame are dimmer than those on the right. This is correct and should not be
compensated for.

---

## 9.10 The absence of the bridge — verification

This is the single most important negative requirement in the project, so it
gets its own procedure.

### What must be true

At every frame from `T+0.000` to `T+5.400`, the following regions of the frame
contain **no bridge geometry and no bridge particles**:

| Region | Screen extent |
|---|---|
| Main tower volume | `x 58% – 65%`, `y 30% – 76%` |
| Far tower volume | `x 77% – 83%`, `y 51% – 73%` |
| Deck path | the S-curve described in `07` §7.6 |
| Cable span | `x 45% – 79%`, `y 36% – 66%` |

### How it fails in practice

Three real mechanisms, in order of likelihood:

**1 · Non-zero base opacity on target particles.**
The particle shader computes a position between seed and target. If the blend
factor is not exactly 0 during Phase 0 — because of a `smoothstep` that returns
`0.003` instead of `0`, or an easing function evaluated slightly past its start
— particles sit *slightly* toward their targets. With 140,000 of them and
additive blending, "slightly" is visible as a ghost of the whole bridge.

> **Fix:** clamp hard. `if (t <= 0.0) position = seedPosition;` as an explicit
> branch, not as an interpolation that happens to evaluate to zero.

**2 · A debug flag surviving into a build.**
`SCENE.debugShowTargetsOnly` renders the target cloud statically. It is
extremely useful during development and catastrophic if shipped.

> **Fix:** `38_acceptance_criteria.md` includes an automated check that all
> `SCENE.debug*` flags are `false` in a production bundle.

**3 · Bloom picking up sub-threshold contribution.**
Even at very low per-particle brightness, 140,000 additive particles occupying
the same screen region can sum past `POSTFX.bloom.threshold` and produce a
visible glow where the structure will be — a "pre-glow" of the bridge.

> **Fix:** this is the reason the bridge target cloud must not be rendered at
> all during Phase 0, rather than rendered at low opacity. Zero contribution
> means zero, including into the bloom pass.

### Automated check

```
npm run shoot          # captures T+0.600 as shots/dormant.png
npm run reveal-check   # asserts mean luminance in the four regions above
                       # is within 2% of the same regions in a control
                       # render with the particle system fully disabled
```

If the particle system being on or off changes those regions by more than 2%,
the bridge is visible and the build fails.

---

## 9.11 Capture point — `dormant` at `T+0.600`

The canonical still for this phase. `scripts/shoot.mjs` captures it.

**What it must show:**

1. A complete, believable dark valley — mountains, ridgelines, horizon, haze.
2. Faint granular texture across the ground where particles lie.
3. **Nothing** in the bridge regions.
4. Left third visibly darker than the right, from the scrim.
5. Correct colour distribution — see below.

**Colour distribution at `T+0.600`** — note this is *not* the 85/10/5 of the
final frame:

| Band | Phase 0 share | Final frame share |
|---|---|---|
| Near-black | **~94%** | ~85% |
| Deep green | **~5.5%** | ~10% |
| Neon accent | **~0.5%** | ~5% |

> The scene starts far darker than it ends. It has to — the 85/10/5 ratio is a
> statement about the *finished* image, and if the opening frame already meets
> it, the build adds no light and the whole sequence has nowhere to go.
>
> `scripts/palette-check.mjs` therefore applies **per-capture** targets, not one
> global target. See [`38_acceptance_criteria.md`](38_acceptance_criteria.md).

---

## 9.12 Reduced motion

When `prefers-reduced-motion: reduce` is set, **Phase 0 does not occur.**

The scene renders its final state at `T+0.000`: bridge complete, UI visible,
no build sequence. `A11Y.reducedMotion.skipIntro` = `true`.

The dormant particles are never seen. This is correct — there is no way to show
a 12-second build sequence to someone who has asked for reduced motion, and a
"faster build" is not an acceptable compromise. The build either plays or it
does not.

What is retained:

| Feature | Reduced motion |
|---|---|
| Idle breathing (`0.9u`) | **Kept** — below the motion threshold, and it stops the page feeling dead |
| Nebula drift | **Kept** — 0.6 u/s is imperceptible |
| Camera parallax | **Removed** — `disableCameraParallax: true` |
| Camera idle drift | **Removed** |
| Cursor dispersion | **Kept at 25% scale** — `interactionScale: 0.25` |
| Loop | **Removed** — `disableLoop: true` |

---

## 9.13 Phase 0 checklist

A build passes Phase 0 when all of these are true:

- [ ] The world is at full quality on frame 0. Nothing fades in.
- [ ] No bridge geometry or bridge particles are visible in any of the four
      regions in §9.10, verified by `npm run reveal-check`.
- [ ] Particle count on the ground equals the tier's full count — the same
      number that will be in the finished bridge.
- [ ] Particle density is **non-uniform**, concentrated along the bridge
      corridor with visible clusters at both tower footprints.
- [ ] Particles rest on the terrain surface, oriented to its normal. None
      intersect the ground; none float above it.
- [ ] No particle sits on a slope steeper than `SEED.maxSlopeDeg` = 46°.
- [ ] Dormant brightness is 0.17, and a viewer at `T+0.600` reads *texture*,
      not *individual lights*.
- [ ] Shimmer is present and **phase-scattered**. The ground never brightens or
      dims as a whole.
- [ ] Nebula drift and camera idle drift are both active.
- [ ] Camera parallax responds to the mouse from `T+0.000`.
- [ ] Cursor dispersion does **not** respond.
- [ ] Wheel and pinch are swallowed silently — no page scroll, no zoom.
- [ ] The text scrim is active, at full strength, with no UI on top of it.
- [ ] Colour distribution is ~94 / 5.5 / 0.5, not 85/10/5.
- [ ] No `SCENE.debug*` flag is `true` in the production bundle.
- [ ] Under `prefers-reduced-motion`, this phase does not occur at all.

---

**Next:** [`10_phase_1_awakening.md`](10_phase_1_awakening.md) — the ground lets
go.
