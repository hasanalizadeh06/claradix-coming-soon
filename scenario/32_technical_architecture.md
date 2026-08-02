# 32 — TECHNICAL ARCHITECTURE

**How this pack maps onto `src/`.**

---

## 32.1 The stack

| Layer | Technology |
|---|---|
| Build | Vite 5 |
| Language | TypeScript 5.6, strict |
| UI | React 18 |
| 3D | Three.js r176 |
| Fonts | Figtree Variable (self-hosted) |
| Prerender | Vite SSR + a Node pass |
| Testing | Playwright (visual capture, not unit tests) |

**No 3D framework.** No react-three-fiber, no drei, no post-processing library.

> **Why raw Three.js:** the scene is one particle system, one terrain mesh, and
> a three-pass post chain. A framework's abstraction over that is all cost and
> no benefit — and react-three-fiber's reconciler running against a 140,000-point
> `BufferGeometry` is precisely the wrong tool. React manages the DOM; Three
> manages the canvas; they never touch.

---

## 32.2 The module map

```
src/
├── entries/
│   ├── main.tsx           browser entry
│   └── mount.tsx          shared mount logic
├── App.tsx                UI tree
├── prerender.tsx          SSR entry (no canvas)
│
├── gl/                    ─── renderer plumbing ───
│   ├── Stage.ts           renderer, camera, resize, render loop
│   ├── PostFX.ts          bloom, vignette, grain, aberration, trails
│   └── glsl.ts            all shader source
│
├── scene/                 ─── the world ───
│   ├── BridgeScene.ts     assembly root; owns everything below
│   ├── centreline.ts      the spline — most-depended-upon module
│   ├── density.ts         seed distribution
│   ├── glyphAtlas.ts      particle sprite / colour ramp textures
│   ├── material.ts        the particle ShaderMaterial
│   ├── Atmosphere.ts      sky, nebula, stars, fog
│   └── elements/
│       ├── terrain.ts     heightfield, corridor carve, ridges
│       ├── towers.ts      tower target generation
│       ├── deck.ts        deck + railing target generation
│       ├── structure.ts   cables, hangers, piers
│       ├── particles.ts   attribute assembly, buffers
│       └── glyphs.ts      sprite generation
│
├── ui/                    ─── DOM layer ───
│   ├── SceneCanvas.tsx    canvas host; bridges React ↔ Stage
│   ├── KineticHeadline.tsx
│   ├── Countdown.tsx
│   ├── SubscribeForm.tsx
│   ├── Socials.tsx
│   └── icons.tsx
│
├── lib/                   ─── shared ───
│   ├── config.ts          ★ every constant from doc 36
│   ├── copy.ts            ★ every word from doc 31
│   ├── ticker.ts          the clock
│   ├── noise3d.ts         terrain noise
│   ├── capabilities.ts    device / tier detection
│   ├── analytics.ts
│   └── vitals.ts
│
└── styles/
    ├── tokens.css         ★ palette, mirrors config.ts
    └── app.css
```

★ = single source of truth. A value duplicated outside these three files is a
bug.

---

## 32.3 The dependency rule

```
    lib/config.ts
         │
         ▼
    scene/centreline.ts
         │
    ┌────┼────┬─────────┬──────────┐
    ▼    ▼    ▼         ▼          ▼
 terrain towers deck structure  density
    │    │    │         │          │
    └────┴────┴────┬────┴──────────┘
                   ▼
           scene/particles.ts
                   ▼
           scene/BridgeScene.ts
                   ▼
              gl/Stage.ts
                   ▼
            ui/SceneCanvas.tsx
```

**Strictly one-directional.** Nothing in `scene/` imports from `ui/`. Nothing in
`gl/` imports from `scene/elements/`.

`centreline.ts` is the hub — everything asks it questions and it asks nothing of
anyone.

---

## 32.4 `centreline.ts` — the critical module

The most-depended-upon file in the project.

```ts
export interface Centreline {
  positionAt(u: number): Vector3
  tangentAt(u: number): Vector3
  frameAt(u: number): { normal: Vector3; binormal: Vector3 }
  uAtDistance(d: number): number
  nearestU(p: Vector3): number
  readonly arcLength: number
}
```

**Six functions. Nothing else is exported.**

### Who asks it what

| Caller | Question |
|---|---|
| `terrain.ts` | "How far is this point from the bridge?" → corridor carve |
| `towers/deck/structure.ts` | "Where and which way at this `u`?" → target generation |
| `density.ts` | "Where should seeds concentrate?" |
| `particles.ts` | "What is this target's `u`?" → schedules |
| `Stage.ts` | "Nearest point to this ray?" → cursor depth |
| `PostFX.ts` | "Where is the pulse now?" |

### `u` is normalised arc length

Not the spline's raw parameter.

Built once at init as a **256-sample lookup table**, then queried by binary
search.

> **Trap:** using the raw parameter makes the assembly sweep speed up and slow
> down as it crosses control points — visible as a stutter in the construction
> front, and very hard to trace back to its cause.

### Parallel-transport frames, precomputed

`frameAt()` returns a rotation-minimising frame, baked into a
**512 × 4 RGBA32F texture** at init.

Naive `cross(tangent, up)` has a singularity when the tangent approaches
vertical, and every particle crossing that region snaps to a new roll
orientation on the same frame — a visible twist seam in the river.

See [`23_flight_choreography.md`](23_flight_choreography.md) §23.5.

---

## 32.5 The clock

```ts
// src/lib/ticker.ts
export interface Ticker {
  now(): number          // scene time in seconds, scaled
  raw(): number          // unscaled wall time since start
  phase(): Phase         // 0..6
  isPaused: boolean
  seek(t: number): void  // debug + capture only
}
```

**One clock. Everything reads from it.** No component keeps its own elapsed
time.

### Scene time is not wall time

```ts
sceneTime = (wallTime - startTime) * SCENE.timeScale
```

`SCENE.timeScale` scales the entire cinematic from one value — see
[`36_CONFIGURATION.md`](36_CONFIGURATION.md) §36.19.

### `seek()` exists for captures

Because particle position is a **pure function of time** (see
[`21_anatomy_of_a_particle.md`](21_anatomy_of_a_particle.md) §21.5), seeking is
free and exact:

```js
ticker.seek(10.5)
renderer.render()     // exactly the T+10.500 frame
```

This is what makes `npm run shoot` possible, and therefore what makes every
visual acceptance check possible.

> **`seek()` must never be called in production.** Asserted in the build.

### Background tabs

`requestAnimationFrame` stops when a tab is hidden. On return:

```
if (elapsed while hidden > 0.5s && phase < 5) {
    ticker.seek(TIMELINE.phase5_livingStart)
    crossFade(400)
}
```

Jump to Phase 5 rather than resuming mid-build — see
[`14_phase_5_living_scene.md`](14_phase_5_living_scene.md) §14.11.

---

## 32.6 React ↔ Three boundary

**They do not share state.**

```
┌────────────────────────────────────────┐
│  React                                 │
│  ├── owns: DOM, UI, copy, form state   │
│  └── reads: ticker.phase() for reveal  │
└────────────────┬───────────────────────┘
                 │  one-way, once
                 ▼
┌────────────────────────────────────────┐
│  Three (Stage)                         │
│  ├── owns: canvas, scene, render loop  │
│  └── reads: pointer, viewport          │
└────────────────────────────────────────┘
```

### The only crossing

```tsx
// SceneCanvas.tsx
useEffect(() => {
  const stage = new Stage(canvasRef.current)
  stage.start()
  stage.onSceneComplete = () => {
    document.documentElement.classList.add('scene-complete')
  }
  return () => stage.dispose()
}, [])   // ← runs once, never re-runs
```

**One callback, one class name.** All eleven UI reveal animations are CSS,
triggered by that single class — see
[`30_ui_reveal_choreography.md`](30_ui_reveal_choreography.md) §30.11.

### React never re-renders during the scene

The empty dependency array is load-bearing. React's job finishes at mount; the
canvas runs for the rest of the session with zero React involvement.

> **Trap:** driving the reveal from React state (`useState` + `setInterval`)
> puts a re-render on the main thread at the busiest moment of the scene. Use
> the class + CSS.

**The one exception:** `Countdown.tsx` re-renders once per second. It is four
text nodes and it is unavoidable.

---

## 32.7 Initialisation order

```
1. Read config, detect tier                    (capabilities.ts)   ~2ms
2. Build centreline + arc LUT + frame LUT      (centreline.ts)     ~3ms
3. Build terrain heightfield                   (terrain.ts)       ~34ms
4. Generate bridge target cloud                (elements/*)       ~48ms
5. Deduplicate targets                                             ~9ms
6. Seed particles from targets                 (density.ts)        ~6ms
7. Compute schedules                           (particles.ts)      ~4ms
8. Build attribute arrays                                         ~13ms
9. Upload buffers, compile shaders             (material.ts)      ~11ms
10. Build post-process targets                 (PostFX.ts)         ~5ms
11. First frame                                                  ─────
                                                          Total ~135ms
```

Comfortably inside Phase 0's **1.2 seconds** — one of the reasons Phase 0
exists.

### Order matters in two places

**Targets before seeds** (steps 4 → 6). Reversing them destroys the flight-time
distribution — see
[`24_target_assignment.md`](24_target_assignment.md) §24.4.

**Terrain before seeds** (steps 3 → 6). Seeds sample the built heightfield. Re-
evaluating the noise stack 140,000 times instead costs ~400ms and produces a
visible hitch.

---

## 32.8 The render loop

```ts
function frame(now: number) {
  ticker.update(now)

  // 1 · consume input (stored, not per-event)
  stage.applyPointer(pointerState.latest)

  // 2 · camera
  camera.update(ticker.now())

  // 3 · uniforms — the ONLY per-frame CPU→GPU traffic
  particleMaterial.uniforms.uTime.value   = ticker.now()
  particleMaterial.uniforms.uCursor.value = cursorWorld
  particleMaterial.uniforms.uPhase.value  = ticker.phase()

  // 4 · swarm light centroids (5 lights, CPU)
  swarm.update(ticker.now())

  // 5 · render passes
  postfx.render()

  requestAnimationFrame(frame)
}
```

**Under 1 KB of CPU→GPU traffic per frame.**

All 140,000 particle positions are computed in the vertex shader from
attributes that were uploaded once. The CPU never touches a particle.

### What the CPU does per frame

| Task | Cost |
|---|---|
| Ticker update | trivial |
| Camera lerp | trivial |
| 5 swarm centroids | ~0.3ms |
| Uniform writes | trivial |
| Draw call issue | ~0.1ms |
| **Total** | **< 0.5ms** |

The remaining ~16ms of the frame budget is GPU.

### Swarm centroids are the only per-frame CPU work on particles

Five bins, each needing a mean position. Rather than iterating 140,000
particles, the centroid is computed **analytically** from the guide curve and
the current phase — the bin's particles are known to lie along a known section
of a known curve.

> Iterating the full population per frame would cost ~4ms and is entirely
> avoidable.

---

## 32.9 Where each document's rules live

| Document | Implemented in |
|---|---|
| `16_world_map` | `lib/config.ts`, `scene/centreline.ts`, `gl/Stage.ts` |
| `17_terrain` | `scene/elements/terrain.ts`, `lib/noise3d.ts` |
| `18_sky_and_atmosphere` | `scene/Atmosphere.ts` |
| `19_bridge_anatomy` | `scene/elements/{towers,deck,structure}.ts` |
| `20_lighting_design` | `scene/BridgeScene.ts`, `gl/glsl.ts` |
| `21_anatomy_of_a_particle` | `scene/elements/particles.ts`, `scene/material.ts` |
| `22_particle_lifecycle` | `gl/glsl.ts` (vertex shader) |
| `23_flight_choreography` | `scene/centreline.ts`, `gl/glsl.ts` |
| `24_target_assignment` | `scene/elements/*`, `scene/density.ts` |
| `25_camera` | `gl/Stage.ts` |
| `26–27_interaction` | `gl/glsl.ts`, `gl/Stage.ts` |
| `28_input_and_devices` | `ui/SceneCanvas.tsx`, `gl/Stage.ts` |
| `29_ui_layout` | `ui/*.tsx`, `styles/*.css` |
| `30_ui_reveal` | `styles/app.css` (CSS animations) |
| `31_content_and_copy` | `lib/copy.ts` |
| `33_render_pipeline` | `gl/PostFX.ts` |
| `34_performance_budget` | `lib/capabilities.ts` |
| `35_accessibility` | `ui/*.tsx`, `styles/app.css` |
| `36_CONFIGURATION` | **`lib/config.ts`**, `styles/tokens.css` |

---

## 32.10 The scripts

```
scripts/
├── shoot.mjs           capture the 7 timestamps → shots/
├── compare.mjs         diff a capture vs the reference image
├── fit-check.mjs       UI positions vs doc 29
├── palette-check.mjs   85/10/5 per capture vs doc 06
├── reveal-check.mjs    assert no bridge before T+5.400
├── interact-check.mjs  Law 4 + Law 5 assertions
├── autofill-check.mjs  form behaviour
├── generate-og.mjs     og.png from the T+10.500 capture
├── optimize-image.mjs
└── prerender.mjs
```

All Playwright-driven against a real build. **These are the acceptance
criteria** — see [`38_acceptance_criteria.md`](38_acceptance_criteria.md).

They work because `ticker.seek()` makes every frame exactly reproducible.

---

## 32.11 Build

```bash
npm run dev       # vite
npm run build     # tsc --noEmit && vite build && vite build --ssr && prerender
npm run preview
```

The build runs `tsc --noEmit` first. **Type errors fail the build.**

### Production assertions

The bundle must not contain:

| | |
|---|---|
| `SCENE.debug*` set to `true` | Any of them |
| `ticker.seek()` call sites | Outside `scripts/` |
| `Math.random()` | In `scene/` or `lib/` — everything uses the seeded PRNG |

`scripts/` contains a check for each.

---

## 32.12 Failure modes

**1 · A constant duplicated outside `config.ts`.**
Two sources of truth diverge silently.

**2 · `ui/` imported from `scene/`.**
Breaks the SSR prerender, which has no DOM.

**3 · `u` from the raw spline parameter.**
A stutter in the construction front at every control point.

**4 · Naive frame construction.**
A twist seam in the river, appearing only after a control point is moved.

**5 · React re-rendering during the scene.**
Main-thread work at the busiest moment.

**6 · Reveal driven by React state instead of CSS.**
Same, plus it stops honouring `prefers-reduced-motion` via media query.

**7 · Seeds generated before targets.**
Flight durations scatter; the river loses its single characteristic speed.

**8 · Seeds sampling noise instead of the heightfield.**
~400ms startup hitch.

**9 · Swarm centroids computed by iterating all particles.**
~4ms per frame, entirely avoidable.

**10 · `Math.random()` anywhere in the scene.**
Every visual check fails intermittently — the worst failure mode, because it
looks like flaky tests.

**11 · A debug flag shipped.**
`debugShowTargetsOnly` renders the bridge from `T+0.000` and destroys the
premise.

---

## 32.13 Checklist

- [ ] No 3D framework. Raw Three.js.
- [ ] React owns the DOM; Three owns the canvas. They share no state.
- [ ] Exactly one crossing: `onSceneComplete` → one class name.
- [ ] `SceneCanvas` effect has an empty dependency array and runs once.
- [ ] Only `Countdown` re-renders during the scene.
- [ ] Every constant lives in `lib/config.ts`; every word in `lib/copy.ts`;
      every colour in `tokens.css`.
- [ ] `tokens.css` and `config.ts` agree on the palette.
- [ ] Dependencies are one-directional. `scene/` never imports `ui/`.
- [ ] `centreline.ts` exports exactly six functions.
- [ ] `u` is normalised **arc length** via a LUT.
- [ ] Frames are **parallel-transport**, precomputed into a texture.
- [ ] One ticker. No component keeps its own elapsed time.
- [ ] `ticker.seek()` is never called in production.
- [ ] Init completes in under ~150ms.
- [ ] Targets are generated **before** seeds; terrain **before** seeds.
- [ ] Per-frame CPU→GPU traffic is under 1 KB.
- [ ] Per-frame CPU work is under 0.5ms.
- [ ] Swarm centroids are computed analytically, not by iteration.
- [ ] No `Math.random()` in `scene/` or `lib/`.
- [ ] No `SCENE.debug*` flag is `true` in the production bundle.
- [ ] `tsc --noEmit` passes; type errors fail the build.

---

**Next:** [`33_render_pipeline.md`](33_render_pipeline.md) — draw order and
passes.
