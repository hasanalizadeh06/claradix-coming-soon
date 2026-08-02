# 25 — CAMERA

**Framing, parallax, idle drift, and push-in.**

---

## 25.1 The base shot

```ts
CAMERA = {
  fov: 38,                        // vertical degrees
  near: 1,
  far: 4000,
  basePosition: [ 10,  96,  520],
  baseTarget:   [ 40,  70, -260],
}
```

| Property | Value |
|---|---|
| Distance to target | ~782u |
| Look direction | `(0.038, −0.033, −0.999)` — almost straight down `−Z`, tilted down ~1.9° |
| Vertical FOV | 38° |
| Horizontal FOV at 3:2 | ~54.6° |
| Visible width at target depth | ~805u |

### Why 38°

| FOV | Character | Verdict |
|---|---|---|
| 24° | Heavy telephoto. Depth crushed; the valley reads as a flat backdrop. | Too tight |
| **38°** | **Restrained cinematic. Compresses depth enough to feel composed, wide enough to hold the valley.** | ✓ |
| 55° | Standard. Neutral, unremarkable, "3D scene" default. | Too plain |
| 75° | Wide. Exaggerated perspective, edge distortion, aggressive. | Wrong register |

At 38° the two towers — 468u apart in world space — sit close together in frame,
which makes the main span read as a single graphic gesture rather than as two
separate objects. That compression is the shot.

### The camera never moves from this position

There is **no camera animation** in this scene. No dolly-in during the build, no
crane, no reframe at completion. The camera is placed once and holds.

> **Why:** a moving camera during the build would compete with the build. The
> particles are already travelling right-to-left across the frame; adding camera
> motion on top produces two competing vectors and the assembly stops being
> legible.
>
> It also keeps the whole scene deterministic and comparable — every capture is
> from the same viewpoint, so `npm run compare` means something.

The only camera motion is **parallax** (viewer-driven), **idle drift**
(imperceptible), and **push-in** (viewer-driven, Phase 5 only).

---

## 25.2 Framing constraints

These are the camera's real specification. They must hold at **every** aspect
ratio.

| # | Constraint | Value |
|---|---|---|
| **F1** | Main tower top | between `y 28%` and `y 38%` |
| **F2** | Main tower horizontal centre | between `x 55%` and `x 68%` |
| **F3** | Deck must exit **both** the left and right frame edges | — |
| **F4** | Horizon line | between `y 60%` and `y 70%` |
| **F5** | Countdown ring must not overlap the far tower | ring at `x 74.5–96.5%`, `y 12–45.5%`; far tower at `x 77–83%`, `y 51–73%` |

If any of these fail, the composition has broken.

`npm run fit` verifies F1–F5 at every breakpoint.

### The bridge does not fit in frame, deliberately

Visible width at target depth is ~805u. The bridge spans **1040u** in X.

The near end runs off the bottom-left; the far end runs off the right. **This is
what makes the world feel larger than the frame** — we are looking at part of a
valley, not at a diorama on a table.

> **Trap:** in review someone will ask to "fit the whole bridge in". Pulling
> back far enough to do that shrinks the main tower below `y 38%`, breaks F1, and
> turns a landscape into a model. The bridge running off both edges is the shot.

### The counterweight

```
     TEXT MASS                    TOWER MASS
     x 5–40%                      x 60–63%
     y 19–63%                     y 33–73%
        ██████                        ▲
        ██████            ←→          █
        ██████                        █
```

The headline block on the left is balanced by the main tower on the right. F2
exists to protect this: if the tower drifts left of `x 55%` it crowds the text;
right of `x 68%` and the frame's centre goes hollow.

---

## 25.3 Parallax

```ts
CAMERA.parallax = {
  offsetX: 22,     // ±22u camera translation
  offsetY: 11,     // ±11u
  yaw: 2.4,        // ±2.4°
  pitch: 1.2,      // ±1.2°
  lerp: 0.045,
}
```

Normalised mouse position (`−1 … +1` on each axis) maps linearly to a camera
offset and a small look-direction rotation.

### It is deliberately almost imperceptible

`lerp: 0.045` at 60fps means the camera closes only **4.5% of the remaining
distance per frame** — a time constant of roughly **0.36 seconds**. The camera
lags noticeably behind the cursor.

> **The intent:** it should be nearly impossible to notice you are controlling
> the camera. You should only notice that the scene is **not flat**.
>
> A 1:1 responsive camera turns the page into a toy and invites the viewer to
> whip the mouse around, which makes the scene feel weightless. A heavy, lagging
> camera reads as depth and as mass.

### Translation and rotation together

Translation alone produces a "sliding window" effect. Rotation alone produces a
turntable. Both together, at these small magnitudes, produce the sensation of
**leaning slightly in your chair** — which is the target.

The rotation is **into** the translation: moving the mouse right translates the
camera right *and* yaws it slightly right, so the far side of the valley opens
up. This is what a person does when they lean to see past something.

### What moves and what does not

| Element | Parallax response |
|---|---|
| Near framing ridge (`−760, 0, −300`) | Large — closest geometry |
| Terrain mid-ground | Medium |
| Bridge | Medium |
| Far ridges | Small |
| Nebula | Very small |
| **Stars** | **None** — rendered at infinite distance |

The differential is the depth cue. Stars being completely parallax-immune while
the near ridge moves noticeably is what sells the scale.

### Active from `T+0.000`

Parallax is on from the first frame, before any particle has moved.

> **Why the exception:** dispersion is off during Phase 0 because there is
> nothing to disperse. But parallax costs nothing and tells the viewer, within
> the first half second, that this is a **live 3D space and not a video**.
>
> A viewer who moves their mouse in the first second and sees the mountains
> shift has learned something true about the page. A viewer who moves their mouse
> and sees nothing has learned something false.

---

## 25.4 Idle drift

```ts
CAMERA.idleDrift = {
  amplitudeX: 7,
  amplitudeY: 3.5,
  periodX: 23.0,
  periodY: 31.0,
}
```

A slow sinusoidal wander added on top of parallax, running forever.

### The periods are coprime

23 and 31 are both prime. The combined motion has a period of
**23 × 31 = 713 seconds** — nearly twelve minutes — and never lands in a
recognisable loop.

This matters for the "tab left open for four hours" requirement in
[`14_phase_5_living_scene.md`](14_phase_5_living_scene.md).

### It is an absolute function of time, not an accumulator

```glsl
// RIGHT
offset.x = sin(t / periodX * TAU) * amplitudeX;

// WRONG — accumulates floating-point error, drifts out of frame over hours
offset.x += velocity.x * dt;
```

> **Trap:** implemented as an accumulator, the framing is visibly wrong after
> twenty minutes and completely broken after an hour. Absolute functions of `t`
> cannot drift.

### Why 7u and 3.5u

At these amplitudes over these periods, the drift produces roughly **0.03 pixels
of movement per frame**. It is not seen.

It is the difference between "a photograph" and "a very still shot" — which
viewers detect immediately and cannot articulate. Remove it and the scene reads
as a render; keep it and the scene reads as a place.

On touch devices with no orientation permission, this is the **only** camera
motion.

---

## 25.5 Push-in and proximity dispersion

**Enabled at `T+12.400`. Disabled in every prior phase.**

```ts
CAMERA.dolly = {
  enabled: true,
  range: [0, 1],
  travel: 340,              // world units toward baseTarget
  lerp: 0.070,
  autoReturnAfter: 2.4,     // s of no input
  autoReturnRate: 0.35,
}

INTERACTION.proximityDispersion = {
  startsAt: 0.55,
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

> **The bridge is only solid from a distance. Get close enough and you can see it
> was always just light.**

This is the same statement Law 3 makes structurally, delivered as an
interaction — and not incidentally, a decent metaphor for the brand.

### Why 64u here and 30u for the cursor

| | Cursor | Push-in |
|---|---|---|
| `maxDisplacement` | 30u | **64u** |
| Silhouette must survive | **Yes** (Law 5) | No |
| Radius | 90u | 180u |
| Scope | Local probe | Global relationship |

The cursor is a *local probe* — it should leave the structure legible while you
inspect it. Push-in is a *global change of relationship* — you have chosen to get
close, and the payoff is watching the bridge stop being a bridge.

**At maximum push-in the silhouette check in
[`14_phase_5_living_scene.md`](14_phase_5_living_scene.md) §14.6 does not
apply.** This is the one place Law 5 is relaxed, because the effect is:

- fully under the viewer's control
- immediately reversible
- requires deliberate, continuous input to sustain

### Dispersion is driven by dolly value, not by distance

```
dispersionAmount = smoothstep(0.55, 1.0, dollyValue)
```

**Not** by actual camera-to-particle distance.

> **Why:** distance-driven dispersion would also trigger when the camera drifts
> or parallaxes, producing a bridge that shivers whenever the mouse moves.
> Dolly-driven means it only responds to the deliberate gesture.

### Auto-return

After **2.4 seconds** with no wheel or pinch input, the dolly eases back to 0 at
`0.35/s` — about 2.9 seconds to fully return.

Without auto-return, a viewer who scrolls once leaves the page in a scattered
state permanently, and every subsequent visitor to that tab sees a broken-looking
bridge.

### Disabled before `T+12.400`

| Phase | Dolly |
|---|---|
| 0 · Dormant | Disabled — nothing to disperse |
| 1 · Awakening | Disabled |
| 2 · Glide | Disabled |
| 3 · Assembly | Disabled — pushing into a half-built bridge looks like a bug |
| 4 · Completion | Disabled — would scatter the bridge during the completion pulse |
| **5 · Living** | **Enabled** |
| 6 · Rewind | Enabled |

Wheel and pinch events during Phases 0–4 are **swallowed silently**: no page
scroll, no browser zoom, no visual response.

> `T+12.400` is the earliest safe unlock. Enabling during Phase 4 would let a
> viewer trigger dispersion at the exact instant the bridge is supposed to read
> as whole.

---

## 25.6 Aspect-ratio behaviour

The reference is 3:2. Real viewports are not.

### Wider than 3:2 (e.g. 21:9)

- FOV held at 38° vertical
- Extra width reveals more sky and more of the far approach
- UI stays pinned to the `5.3%` axis
- Countdown ring stays right-anchored
- **F1–F5 hold unchanged**

### Narrower than 3:2 (e.g. 4:3)

- Camera **pulls back** along its look axis until F1 is satisfied
- Pull-back is computed, not authored:

```
requiredDistance = mainTowerHeight / (2 × tan(fov/2) × targetFrameFraction)
```

- At 4:3 this is roughly **+120u** of distance
- More terrain enters frame at top and bottom; the composition holds

### Portrait (mobile)

The layout **re-composes**. This is not the same shot cropped.

| Change | Detail |
|---|---|
| FOV | 38° → **46°** |
| Camera | Repositioned to `[30, 118, 430]`, target `[20, 82, -300]` |
| Bridge | Re-framed to run **corner to corner**, bottom-left to top-right |
| Main tower | Sits at `x 58%`, `y 30–62%` |
| Countdown | Moves **below the CTA** — out of the immersive zone entirely |
| Scrim | Becomes a **vertical** gradient, dark at top, clear at bottom |

Full spec in [`29_ui_layout.md`](29_ui_layout.md).

> **Why re-compose rather than crop:** a 3:2 shot cropped to 9:16 loses the
> horizontal sweep entirely — the bridge becomes a short diagonal stub. The
> corner-to-corner framing preserves the *gesture* even though it does not
> preserve the *shot*.

---

## 25.7 Resize behaviour

| Event | Response |
|---|---|
| Window resize | Recompute aspect, re-derive pull-back distance, update projection. **No animation.** |
| Orientation change (mobile) | Cross-fade over 300ms between the two compositions |
| Device pixel ratio change | Reallocate render targets; cap DPR per `34_performance_budget` |

Resize during the intro does **not** restart the scene. The scene's time
continues; only the projection changes.

> **Trap:** re-seeding particles on resize. Seeds are sampled from the terrain
> and have nothing to do with the viewport. Re-seeding mid-build teleports the
> whole population.

---

## 25.8 Reduced motion

```ts
A11Y.reducedMotion = {
  disableCameraParallax: true,
  // idle drift also disabled
}
```

| Feature | Reduced motion |
|---|---|
| Parallax | **Removed** |
| Idle drift | **Removed** |
| Push-in | **Removed** |
| Base framing | Unchanged |

The camera becomes completely static. Combined with `skipIntro`, the page
renders one still image with faintly breathing particles and damped cursor
interaction.

---

## 25.9 Failure modes

**1 · Camera animation during the build.**
Competes with the assembly's own directional motion; the build stops being
legible.

**2 · Parallax too responsive.**
`lerp` above ~0.15. The page becomes a toy and feels weightless.

**3 · Idle drift as an accumulator.**
Framing visibly wrong after twenty minutes.

**4 · Non-coprime drift periods.**
The motion loops recognisably — e.g. 20s and 30s repeat every 60s.

**5 · Stars parallaxing.**
Depth collapses; the sky reads as a nearby painted dome.

**6 · Dispersion driven by camera distance.**
The bridge shivers whenever the mouse moves.

**7 · Dolly enabled before `T+12.400`.**
A viewer can scatter a half-built bridge, or break the completion pulse.

**8 · No auto-return.**
The page is left permanently scattered.

**9 · Portrait handled by cropping.**
The bridge becomes a short diagonal stub with no sweep.

**10 · Re-seeding particles on resize.**
The whole population teleports mid-build.

**11 · Fitting the whole bridge in frame.**
Main tower drops below `y 38%`; the landscape becomes a model.

---

## 25.10 Checklist

- [ ] FOV is 38° vertical.
- [ ] The camera does **not** animate during the intro.
- [ ] F1: main tower top between `y 28%` and `y 38%`.
- [ ] F2: main tower horizontally between `x 55%` and `x 68%`.
- [ ] F3: the deck exits **both** frame edges.
- [ ] F4: horizon between `y 60%` and `y 70%`.
- [ ] F5: countdown ring does not overlap the far tower.
- [ ] `npm run fit` passes at every breakpoint.
- [ ] Parallax `lerp` is 0.045 — it should be hard to notice you are
      controlling it.
- [ ] Parallax combines translation **and** rotation.
- [ ] Parallax is active from `T+0.000`.
- [ ] Stars do not parallax.
- [ ] Idle drift is an **absolute function of `t`**, not an accumulator.
- [ ] Drift periods (23s, 31s) are coprime.
- [ ] Dolly is enabled **only** from `T+12.400`.
- [ ] Wheel and pinch are swallowed silently in Phases 0–4 — no page scroll, no
      browser zoom.
- [ ] Dispersion is driven by **dolly value**, not by camera distance.
- [ ] Dolly auto-returns after 2.4s of no input.
- [ ] Portrait **re-composes** with FOV 46° and corner-to-corner framing — it is
      not a crop.
- [ ] Resize does not restart the scene or re-seed particles.
- [ ] Under reduced motion, the camera is completely static.

---

**Next:** [`26_interaction_rules.md`](26_interaction_rules.md) — the core
interaction contract.
