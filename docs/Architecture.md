# Architecture

> This document is the entry point. Read it before any other file in `docs/`.

---

## 1. What this project is

A single-page "coming soon" site for **Claradix**. The page has one idea and the
entire build serves it:

> *Claradix is the bridge between your idea and reality.*

So the scene is not a decorative backdrop. It is that sentence rendered. A dark
valley wakes up, throws its light into the air, the light flies across the frame
and assembles itself into a suspension bridge, and then the page — headline,
form, countdown, footer — arrives on top of the finished bridge.

There is **no 3D model of a bridge anywhere in this project.** The bridge is
82,599 additively-blended points whose positions are computed procedurally from a
spline. Everything you see is generated at load time from constants.

---

## 2. Technology

| | |
|---|---|
| Build | Vite 5 |
| Language | TypeScript 5.6, `strict` |
| UI | React 18 |
| 3D | Three.js r176, **raw** — no react-three-fiber, no drei, no post-processing library |
| Styling | Hand-written CSS with custom properties. No framework. |
| Rendering | WebGL2 where available, WebGL1 fallback path |
| SSR | `renderToString` at build time into `index.html`, hydrated on the client |

There is no state management library, no animation library (GSAP/Framer), no
tweening library, and no physics engine. The animation system is described in
[`Animation.md`](Animation.md) and is roughly 40 lines of arithmetic.

### Bundle

```
dist/assets/three-*.js        470.51 kB │ gzip: 118.06 kB
dist/assets/react-*.js        141.67 kB │ gzip:  45.38 kB
dist/assets/BridgeScene-*.js   ~84 kB   │ gzip:  ~31 kB
dist/assets/Stage-*.js          18.71 kB │ gzip:   5.93 kB
dist/assets/index-*.js          24.07 kB │ gzip:   9.88 kB
dist/assets/index-*.css         12.75 kB │ gzip:   3.83 kB
dist/index.html                 11.4 kB  (prerendered)
```

Three.js and the scene are in **separate chunks from the page**, loaded after the
`load` event and an idle callback. The headline paints without any of it.

---

## 3. Folder tree

```
claradix-coming-soon/
├── index.html                    Shell. Contains the <!--app-html--> placeholder
│                                 and the inline `js` class script (see §7).
├── package.json
├── docs/                         ← you are here
├── claradix_creative_pack/       41 markdown documents, ~20k lines. The design
│                                 specification this implementation is built
│                                 against. `40_decision_log.md` records every
│                                 place the code and the pack disagree and why.
├── scripts/                      Acceptance checks. See Performance.md §8.
│   ├── verify.mjs                Runs all seven and reports all of them.
│   ├── hygiene-check.mjs         Static rules. No browser.
│   ├── palette-check.mjs         The colour ratio, seven captures.
│   ├── viewport-check.mjs        Colour ratio across four viewport sizes.
│   ├── interact-check.mjs        Cursor, touch, push-in.
│   ├── reveal-check.mjs          UI arrival order + no-JS + no-WebGL.
│   ├── loop-check.mjs            Rewind and cycle repeatability.
│   ├── perf-check.mjs            The degradation ladder.
│   ├── shoot.mjs / compare.mjs   Screenshot capture and diffing.
│   ├── fit-check.mjs             Layout overflow across viewports.
│   ├── autofill-check.mjs        Browser autofill styling.
│   ├── prerender.mjs             Injects SSR output into index.html.
│   ├── generate-og.mjs           Open Graph image.
│   ├── optimize-image.mjs
│   └── smoke.mjs
└── src/
    ├── entries/
    │   ├── main.tsx              Bootstraps. Imports styles, calls mount().
    │   └── mount.tsx             hydrateRoot vs createRoot decision.
    ├── prerender.tsx             SSR entry. renderToString(<App/>).
    ├── App.tsx                   Page shell. 112 lines.
    ├── lib/
    │   ├── config.ts             1,433 lines. THE SINGLE SOURCE OF TRUTH.
    │   ├── ticker.ts             The rAF loop and the scene clock.
    │   ├── perf.ts               The degradation governor.
    │   ├── reveal.ts             When the UI is allowed to appear.
    │   ├── rng.ts                Seeded PRNG (mulberry32).
    │   ├── capabilities.ts       One-shot GPU probe → quality tier.
    │   ├── copy.ts               All user-facing strings.
    │   ├── analytics.ts
    │   ├── vitals.ts
    │   ├── noise3d.ts            ⚠ DEAD CODE. Imported by nothing.
    │   └── glsl.ts               ⚠ DEAD CODE. Imported by nothing. (in gl/)
    ├── gl/
    │   ├── Stage.ts              Renderer, camera, input, frame loop, governor.
    │   ├── PostFX.ts             Trails, bloom, composite. 887 lines.
    │   └── glsl.ts               ⚠ DEAD CODE. Simplex, curl, hash, sprite.
    ├── scene/
    │   ├── BridgeScene.ts        The orchestrator. 580 lines.
    │   ├── centreline.ts         The spline everything is expressed against.
    │   ├── bridgeTargets.ts      Generates the 82,599 destination positions.
    │   └── elements/
    │       ├── sky.ts            Gradient, stars, nebula. One fullscreen quad.
    │       ├── terrain.ts        Heightfield mesh + CPU height lookup.
    │       ├── mist.ts           Valley floor sheet.
    │       ├── groundGlow.ts     Light the bridge casts on the ground.
    │       └── particles.ts      863 lines. The bridge.
    ├── ui/
    │   ├── SceneCanvas.tsx       Loads the scene, owns PostFX options.
    │   ├── KineticHeadline.tsx
    │   ├── Countdown.tsx
    │   ├── SubscribeForm.tsx
    │   ├── Socials.tsx
    │   └── icons.tsx
    └── styles/
        ├── tokens.css            Custom properties. Brand palette.
        └── app.css               906 lines. All layout.
```

### Dead code

`src/lib/noise3d.ts` (115 lines) and `src/gl/glsl.ts` (136 lines) are imported by
**nothing**. `glsl.ts` contains a full simplex 3D implementation, curl noise, a
hash library and a point-sprite helper — none of which the current shaders use;
they each define what they need inline. `noise3d.ts` is a class-based 3D noise
that the terrain does not use (terrain uses its own 2D value noise).

251 lines of dead code. The hygiene check does not catch this because it only
audits `config.ts` exports.

---

## 4. The dependency graph

```
                        ┌──────────────┐
                        │  config.ts   │  ← every arrow below points here
                        └──────────────┘
                               ▲
      ┌──────────┬─────────────┼─────────────┬──────────────┐
      │          │             │             │              │
  ticker.ts   perf.ts    capabilities.ts  reveal.ts     rng.ts
      ▲          ▲             ▲             ▲              ▲
      │          │             │             │              │
      └────┬─────┘             │             │              │
           │                   │             │              │
      ┌────┴──────┐            │        ┌────┴────┐    ┌────┴────────┐
      │  Stage.ts │◄───────────┘        │ App.tsx │    │ centreline  │
      └────┬──────┘                     └─────────┘    │ bridgeTargets│
           │                                            │ particles    │
      ┌────┴──────┐                                     └──────────────┘
      │ PostFX.ts │
      └───────────┘
           ▲
           │  (options only)
      ┌────┴──────────┐
      │ SceneCanvas   │
      └───────────────┘
           │  factory
      ┌────┴──────────┐
      │ BridgeScene   │──► centreline ──► (frame texture, GLSL)
      └───────────────┘──► terrain ──────► heightAt() consumed by:
                        │                    bridgeTargets (pier footings)
                        │                    particles     (seed placement)
                        │                    mist          (pooling density)
                        │                    groundGlow    (decal elevation)
                        ├─► bridgeTargets ─► particles
                        ├─► sky
                        ├─► mist
                        ├─► groundGlow
                        └─► particles
```

**`config.ts` has no imports.** It is a leaf. Everything else reads from it. The
project's stated rule is *"a magic number anywhere else in `src/` is a bug"*, and
`hygiene-check.mjs` enforces the inverse (a constant nothing reads is also a bug).

### Construction order is load-bearing

`BridgeScene.ts` builds in this order and it cannot be changed:

```
  centreline  →  terrain  →  targets  →  particles
```

- **terrain before targets**, because pier footings are sampled down to the
  ground with `terrain.heightAt()`.
- **targets before particles**, because a particle's *seed* (its resting place at
  T+0) is generated from its *target*. Reversing this scatters flight durations
  from a tight 4.5–5.7s band to 1.8–14s, and the river stops reading as one
  current at one characteristic speed.
- **mist and groundGlow after terrain**, because both sample the heightfield they
  lie on.

---

## 5. Lifecycle

### 5.1 Page load

```
index.html served (prerendered HTML already inside #root)
   │
   ├─ <head> inline script adds `js` class to <html>          ← before first paint
   │
   ├─ CSS loads. Headline paints. Page is readable.
   │
   └─ main.tsx → mount.tsx
        │
        ├─ root.firstElementChild exists?  → hydrateRoot
        │                          no      → createRoot
        │     (firstElementChild, NOT firstChild — the template's
        │      <!--app-html--> placeholder is a comment node and
        │      counts as a firstChild, which made dev hydrate against
        │      an empty root on every single load)
        │
        ├─ initAnalytics()
        └─ initVitals()
```

### 5.2 Scene load

`SceneCanvas.tsx` runs in a `useEffect`:

```
detectCapabilities()                    one WebGL probe, one context, released
   │
   ├─ tier === "static"  → render CSS gradient fallback, STOP
   │
   └─ scheduleAfterLoad(...)            waits for `load`, then requestIdleCallback
        │                               (1200ms timeout)
        │
        └─ dynamic import: Stage + BridgeScene       ← three.js enters here
             │
             └─ new Stage({ container, capabilities, factory, post, ... })
                  │
                  ├─ WebGLRenderer                   antialias off, alpha off
                  ├─ PerspectiveCamera
                  ├─ PostFX                          allocates render targets
                  ├─ factory(ctx) → BridgeScene      builds the whole world
                  ├─ createGovernor(...)             degradation ladder
                  ├─ ticker.onSeek(clearTrails)
                  ├─ input listeners
                  └─ ticker.add(frame => this.render(frame))
```

### 5.3 Per frame

See [`Renderer.md`](Renderer.md) §4 for the full pass list and
[`Animation.md`](Animation.md) for what moves.

```
ticker fires
  ├─ pointer smoothing            lerp toward target
  ├─ dolly auto-return            after 2.4s of no wheel
  ├─ handle.update(frame, ptr)    ← BridgeScene: the entire scene state
  ├─ post.setBloomStrength(...)   ← scene reports, Stage applies
  ├─ governor.sample(frame.raw)   ← UNCLAMPED delta
  ├─ intro fade (first 1.4s)
  ├─ post.render(scene, cam, elapsed, trailLayer)
  └─ pixel-ratio fallback         only if the ladder is exhausted
```

### 5.4 Teardown

`Stage.dispose()` removes every listener, unsubscribes from the ticker and the
seek channel, disposes the scene handle and PostFX, then traverses the scene
graph disposing geometry and materials. The ticker stops its rAF when its last
callback is removed.

`webglcontextlost` is **not** recovered from — it calls `dispose()` and sets
`data-context-lost` on the container, which reveals the CSS fallback. The
reasoning recorded in the source is that a coming-soon page does not justify
context-restore machinery.

---

## 6. Module responsibilities

| Module | Owns | Does NOT own |
|---|---|---|
| `config.ts` | Every constant | Any behaviour |
| `ticker.ts` | rAF loop, **scene time**, phase, seek | Rendering |
| `Stage.ts` | Renderer, camera object, input, governor, frame loop | Scene contents |
| `PostFX.ts` | Render targets, trail accumulator, bloom chain, composite | What is in the scene |
| `BridgeScene.ts` | Scene graph, camera *motion*, interaction resolution | Renderer, post |
| `centreline.ts` | The spline, arc-length table, parallel-transport frames | Anything visual |
| `bridgeTargets.ts` | 82,599 destination positions + layer + `u` | Timing |
| `particles.ts` | Attributes, the vertex shader, the state machine | Where the bridge is |
| `terrain.ts` | Heightfield, CPU lookup, terrain shader | Anything above ground |
| `perf.ts` | The decision to degrade | The knobs themselves |
| `reveal.ts` | When the UI may appear | What the UI is |

### The two capability channels

`SceneHandle` is the interface between `Stage` and any scene. Beyond
`update/resize/dispose` it has four **optional** members. A scene that implements
none of them still works; the features simply do not run.

```ts
atmosphere?:   THREE.ShaderMaterial          // a fullscreen pass with depth bound
bloomStrength?(): number | undefined         // scene REPORTS, Stage applies
degrade?(step): boolean                      // one rung of the ladder
restore?(step): boolean
trailLayer?:   number                        // camera layer to accumulate
```

The pattern throughout is **the scene reports, the Stage decides.** The scene
does not touch PostFX, because the Stage is the only place that knows whether
bloom is even enabled on this device.

---

## 7. The `js` class

`index.html` contains, inline in `<head>`:

```html
<script>document.documentElement.classList.add("js");</script>
```

The UI waits for the bridge before appearing, so the prerendered HTML ships with
every element marked `enter--waiting`. The CSS rule that actually hides them is
gated on `.js`:

```css
.js .enter--waiting { opacity: 0; visibility: hidden; animation: none; }
```

Without JavaScript, nothing is hidden and the page renders fully readable exactly
as the server sent it. Inline and in `<head>` deliberately: a deferred script
would let one frame of content paint before hiding it.

This is verified by `reveal-check.mjs` against `dist/`, not against the dev
server — `vite dev` serves the raw template with an empty root, so with scripts
off there is nothing to render and the check would pass or fail for reasons
unrelated to what it tests.

---

## 8. Determinism

Everything procedural is seeded. `hygiene-check.mjs` fails the build if
`Math.random()` appears anywhere in `src/scene/` or `src/lib/`.

| Consumer | Seed |
|---|---|
| Terrain noise | `TERRAIN.noiseSeed = 0x5eed1a3f` |
| Target generation | `TARGET.randomSeed` |
| Particle attributes | `TARGET.randomSeed ^ 0x5bf03635` |
| Per-particle hash | `hashIndex(i, 0x9e37)` |

The PRNG is mulberry32 (`lib/rng.ts`), exposing `next / range / jitter / disc /
int`. The same device always builds the same bridge, and two people looking at
the page are looking at the same picture. Without this, no visual acceptance
check would mean anything.

---

## 9. The one place state accumulates

**Every position in this scene is a pure function of `(attributes, time)`.**
Nothing is Euler-integrated. That is what makes `ticker.seek(10.5)` render
exactly the T+10.500 frame with no simulation, and every capture script depends
on it.

There is exactly one exception: the **trail accumulation buffer**
([`Shaders.md`](Shaders.md) §6). It remembers previous frames by design. It is
therefore explicitly cleared on `ticker.seek()` via the `onSeek` channel, or it
would drag a smear from the old clock position across the frame being measured.

---

## 10. Where to read next

| If you want to understand… | Read |
|---|---|
| How the bridge shape is produced | [`Bridge.md`](Bridge.md) |
| How 82,599 points know where to be and when | [`Particles.md`](Particles.md) |
| Every line of GLSL | [`Shaders.md`](Shaders.md) |
| The render pipeline | [`Renderer.md`](Renderer.md) |
| Terrain, sky, mist, glow | [`Environment.md`](Environment.md) |
| Lights and the colour rule | [`Lighting.md`](Lighting.md) |
| The clock and the phases | [`Timeline.md`](Timeline.md) |
| What moves and how | [`Animation.md`](Animation.md) |
| Cursor, touch, push-in | [`Interaction.md`](Interaction.md) |
| Particle states | [`StateMachine.md`](StateMachine.md) |
| Camera solve and motion | [`Camera.md`](Camera.md) |
| Every material | [`Materials.md`](Materials.md) |
| Cost and the degradation ladder | [`Performance.md`](Performance.md) |
| An honest assessment | [`Review.md`](Review.md) |
| What to do next | [`Roadmap.md`](Roadmap.md) |
