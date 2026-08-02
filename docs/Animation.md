# Animation

There is no animation library. No GSAP, no Framer Motion, no tween engine, no
timeline object. Every moving thing in this scene is an arithmetic expression
evaluated fresh each frame from `sceneTime`.

---

## 1. The rule

> **Position is a pure function of `(attributes, t)`. Nothing is integrated.**

Consequences, all of them load-bearing:

| | |
|---|---|
| `seek(t)` renders exactly frame `t` | with no simulation, from a cold start |
| A 30 fps and a 144 fps device show the same thing | frame rate cannot accumulate error |
| Two devices render identically | float accumulation cannot diverge |
| Interaction is a displacement, not a force | which makes the deformation clamp absolute |

Any change that introduces `x += v * dt` anywhere in the scene breaks all four at
once and silently disables the entire acceptance suite.

---

## 2. Easing inventory

Every easing function in the project. There are five.

```glsl
easeInOutCubic(p)     // flight travel
smoothstep(0,1,p)     // the peel from river to target
easeOutQuad(k)        // the rewind return: 1 - (1-k)²
1 - (1-fade)³         // the intro fade-up (cubic ease-out)
decay * decay         // the seating snap decay (quadratic ease-in)
```

Plus `smoothstep` used as a general shaping tool in ~20 places (rim falloff, mist
edges, star fade, nebula mask, roll damping, bloom ramps).

There is **no `cubic-bezier`, no spring solver, no overshoot, no anticipation, and
no bounce anywhere in the 3D scene.** The only bezier is in CSS, for the UI
reveal: `cubic-bezier(0.16, 1, 0.3, 1)`.

---

## 3. What actually moves

### 3.1 Particles — five distinct motions

| Motion | Driver | Expression |
|---|---|---|
| Dormant shimmer | `t`, `aHash` | `sin(t·τ·0.13·rate + aHash·τ) · 0.055` — **brightness only, position static** |
| Lift | `t - aLiftAt` | `aSeed + aSeedNormal · max(26e - 9e², 0)` |
| Glide | `easeInOutCubic(p)` | `guidePoint(mix(aU+0.10, aU, p))` |
| Barrel roll | `p`, `aRollPhase/Turns/Radius`, `aSpeedVar` | `(nrm·cosθ + bin·sinθ)·radius·rollFade` |
| Seated breathe | `t`, `aHash` | `aBreatheDir · sin(t·τ·0.21 + aHash·τ) · 0.9 · fadeIn` |

**The roll fade** `smoothstep(0, 0.12, p) · (1 - smoothstep(0.78, 1, p))` starts
the helix after the particle has joined the river and ends it before the peel, so
neither transition inherits a rotation it has to unwind.

**The breathe amplitude is 0.9 units.** Sub-pixel at normal viewing distance. It
is not there to be seen; it is there so the finished bridge is not a still image.
`A11Y` deliberately does **not** disable it, on the grounds that 0.9u approaches
no vestibular threshold while a completely dead scene reads as broken.

### 3.2 Camera — three superimposed motions

See [`Camera.md`](Camera.md). Summary:

```ts
target = home
       + drift(elapsed)            // absolute function of time, never accumulated
       + parallax(pointer)         // ±22u X, ±11u Y
       + dollyDirection · 340 · dolly

camPos.lerp(target, 0.045)         // ~0.36s time constant
```

**Idle drift is an absolute function of time, never an accumulator** — an
accumulator drifts out of frame over hours. Periods 23.0 s and 31.0 s are
coprime, so the combined motion has a **713-second period** and never lands in a
recognisable loop.

### 3.3 Environment

| Element | Motion |
|---|---|
| Sky gradient | none |
| Stars | twinkle only, per-star period 3–11 s |
| Nebula | drift 0.6 u/s + turbulence period 34 s |
| Mist | two noise octaves shearing against each other |
| Terrain | **completely static** |
| Ground glow | appears/disappears with the construction front |
| Swarm lights | positions track the guide curve; intensity follows the phase curve |

### 3.4 Post-processing

| | Driver |
|---|---|
| Bloom strength | 7-point phase curve, per frame |
| Grain | `hash12(fragCoord + uTime·60)` |
| Dither | `hash12(...·131) - hash12(...·71)` |
| Intro fade | `1 - (1-fade)³` over 1.4 s |
| Trail accumulator | decays 0.88 per frame |

⚠ The grain and dither are driven by `elapsed` (wall clock) passed to
`post.render`. **They do not freeze when the scene clock is paused or seeked**,
which is correct for a lens artefact but means two captures at the same
`sceneTime` differ by the grain — the noise floor that `loop-check.mjs` has to
measure around.

---

## 4. Frame-rate independence

Three different techniques, used deliberately in three places.

### 4.1 Pure function of time — the scene

Everything in §3.1 and §3.3. Immune by construction.

### 4.2 Exponential smoothing — the interaction spring

```ts
cursorStrength += (proximity - cursorStrength) * (1 - Math.exp(-frame.delta / tau));
```

**Correct at any frame rate.** The naive `x += (target - x) * 0.1` is not — it
converges four times faster at 240 fps than at 60.

### 4.3 Naive lerp — the camera and the dolly

```ts
camPos.lerp(target, CAMERA.parallax.lerp);       // 0.045
pointer.dolly += (dollyTarget - dolly) * 0.07;
```

⚠ **These are frame-rate dependent and they are wrong.** At 120 fps the camera
converges twice as fast as at 60. The effect is small — the motion is a lag, not a
position — but it is an inconsistency with the rest of the file, and it means the
camera's "0.36 s time constant" is only true at 60 fps.

The pointer smoothing, by contrast, is done correctly:

```ts
const smoothing = 1 - Math.pow(0.0015, frame.delta);
```

So the project contains both the right and the wrong version of the same idea,
eight lines apart.

---

## 5. The two clocks in animation

| Clock | Used by |
|---|---|
| `frame.sceneTime` (seekable, scaled, wrappable) | particles, ground glow, swarm intensity, bloom curve, UI reveal gate |
| `frame.elapsed` (wall, unscaleable) | camera idle drift, sky nebula drift, mist drift, grain, dither |

The split is deliberate: **choreography** is on the scene clock so it seeks and
loops; **ambient life** is on the wall clock so it keeps breathing even when the
scene clock is parked.

The consequence is that `T` and `T + 42` are *not* pixel-identical — the nebula
and camera drift have moved. `loop-check.mjs` handles this by establishing a
drift floor from two captures at the same scene time and requiring the cycle
comparison to come in under it. That isolates the particle system, which is the
thing actually claiming to be exactly repeatable.

---

## 6. Ordering inside `BridgeScene.update`

The order matters in three places.

```ts
1.  t = loopEnabled ? raw % CYCLE_LENGTH : raw       ← wrapped HERE and nowhere else
2.  particles.uTime = t
3.  mist.update(frame.elapsed)
4.  groundGlow.update(t)
5.  swarm positions (analytical) + intensity(t)
6.  completion pulse latch
7.  cursor ray march → uCursor, uCursorStrength
8.  push-in: disperse + uDisperseOrigin
9.  camera drift + parallax + dolly, then camera.lookAt()
10. sky.update(frame.elapsed, camera)               ← LAST, after the camera moved
11. dev hooks
```

- **(1)** — the particle shader, swarm lights, bloom curve and ground glow all
  read this clock. A wrap applied inside any one of them is a wrap the other
  three do not get.
- **(8) before (9)** — the dispersion origin is computed from *last* frame's
  `camAim`/`camPos`. With `dolly = 0` this is exactly zero difference; with dolly
  engaged it is one frame of lag on the origin, which is invisible.
- **(10) last** — the sky derives its horizon from the camera's own matrices.
  Updating it earlier paints this frame's sky with last frame's view, and the
  horizon trails the ridgeline by one frame of camera drift, which reads as the
  mountains sliding.

---

## 7. What does not animate and arguably should

An honest list.

- **Exposure.** Flat 1.0, never touched. A film would ride exposure through the
  build.
- **FOV.** Fixed at 38°. No breathing, no push at the completion moment.
- **Fog density.** Fixed. The valley never clears or thickens.
- **Sky.** The pack says explicitly "the sky never changes state", and the
  implementation honours it. Defensible, but it means the sky is the one element
  that never acknowledges the bridge exists.
- **Terrain.** Completely static. No wind on anything, because there is nothing
  for wind to move.
- **Vignette, grain, aberration.** All constant.
- **The completion pulse** fires once per page load, not once per cycle — see
  [`StateMachine.md`](StateMachine.md) §4.

---

## 8. The UI animation, separately

One CSS keyframe, applied to twelve elements with staggered delays.

```css
@keyframes rise {
  from { opacity: 0; transform: translate3d(0, 14px, 0); }
  to   { opacity: 1; transform: none; }
}

.enter {
  animation: rise var(--dur-base) var(--ease-out) forwards;
  animation-delay: calc(var(--enter-delay, 0) * 1ms);
}

.js .enter--waiting { opacity: 0; visibility: hidden; animation: none; }
```

`visibility` as well as `opacity`, because an opacity-0 element still takes focus
from the keyboard and is still announced. **A form field nobody can see but Tab
can reach is worse than one that is merely invisible.**

Delays come from `UI_REVEAL.sequence` via `lib/reveal.ts`, never from literals in
the markup. `reveal-check.mjs` reads the rendered `data-reveal` attributes and
computed `animation-delay` back out of the DOM and asserts the order is monotone,
so the config and the component tree cannot drift apart.

The headline reveals **line by line**, not character by character. The pack names
`headline-line-1/2/3` with their own offsets, which is a per-line instruction.
*Blocks are seen; lines are read.* A character sweep asks the eye to track a
moving edge, which is the opposite of reading — and it arrives twelve seconds into
an animation that has just finished doing something far more interesting.
