# 33 — RENDER PIPELINE

**Draw order, passes, blend modes, and where every pixel comes from.**

---

## 33.1 The full pipeline

Seven steps per frame.

```
┌─ 1 · SKY PASS ──────────────────────────────────────┐
│  Gradient + nebula + stars                          │
│  → sceneTarget            depthWrite: false         │
└─────────────────────────────────────────────────────┘
┌─ 2 · TERRAIN PASS ──────────────────────────────────┐
│  Heightfield, rim light, swarm lights, fog          │
│  → sceneTarget            depthWrite: TRUE          │
└─────────────────────────────────────────────────────┘
┌─ 3 · MIST PASS ─────────────────────────────────────┐
│  Valley-floor plane, soft depth fade                │
│  → sceneTarget            additive, depthWrite:false│
└─────────────────────────────────────────────────────┘
┌─ 4 · TRAIL ACCUMULATION ────────────────────────────┐
│  trailTarget *= 0.88                                │
│  draw LIFTING/GLIDING/APPROACHING particles         │
│  → trailTarget (half res)  additive                 │
└─────────────────────────────────────────────────────┘
┌─ 5 · PARTICLE PASS ─────────────────────────────────┐
│  All particles, current positions                   │
│  → sceneTarget   additive, depthTest:T, depthWrite:F│
└─────────────────────────────────────────────────────┘
┌─ 6 · COMPOSITE ─────────────────────────────────────┐
│  sceneTarget + trailTarget → bloomInput             │
└─────────────────────────────────────────────────────┘
┌─ 7 · POST CHAIN ────────────────────────────────────┐
│  bloom → aberration → vignette → grain → screen     │
└─────────────────────────────────────────────────────┘

  then, in the DOM above the canvas:
      text scrim (z 2)  →  UI (z 3)
```

---

## 33.2 Draw order and why it is fixed

### Sky first, with no depth write

The sky is infinitely distant. Writing depth would let it occlude things, and it
must never occlude anything.

Rendered as a **screen-space quad**, not a sphere — one full-screen triangle at
`gl_Position.z = 1.0`. Cheaper, and it cannot develop seams.

### Terrain second, writing depth

This is the **only pass that writes depth**, and everything downstream depends
on it.

Its depth buffer is what allows particles behind a mountain to be correctly
hidden — one of the five depth cues in
[`05_visual_language.md`](05_visual_language.md) §5.7.

### Mist third

Additive, no depth write. Must come **after** terrain so it can depth-test
against it and fade where the ground intersects it.

### Trails fourth, into their own target

Before the main particle pass, because the composite needs both.

### Particles fifth

```
depthTest:  true      ← terrain can hide them
depthWrite: false     ← they cannot hide each other
blending:   additive
```

> **These two settings look contradictory and someone will "fix" them by
> disabling both.** They do different jobs:
> - **test** = "can terrain hide me?" → yes
> - **write** = "can I hide other particles?" → no
>
> Turning off `depthTest` makes the bridge draw over the mountain in front of it.
> Turning on `depthWrite` makes particles occlude each other and destroys the
> additive glow that produces the density effect the whole scene relies on.

---

## 33.3 Additive blending is the scene

```
gl.blendFunc(gl.SRC_ALPHA, gl.ONE)
```

Overlapping particles **sum**. This single decision produces most of the scene's
visual character:

| Region | Density | Reads as |
|---|---|---|
| Tower legs | Very high | Solid bars of light |
| Cable curves | High | Continuous lines |
| Deck | Medium | A luminous plane |
| Hangers | Medium, thin | Fine lines |
| River fringe | Low | Individual sparks |
| Dormant ground | Very low | Texture |

**All the same particle, at the same brightness, in different amounts.**

It also produces hue variation for free: sums past 1.0 clamp toward
`--lime-core`, so the densest regions go near-white **automatically**. Nobody
paints a highlight. See [`06_art_direction.md`](06_art_direction.md) §6.3.

### Additive geometry and fog

```glsl
// WRONG for additive — ADDS the fog colour, brightening distant particles
color = mix(color, fogColor, factor);

// RIGHT — attenuates toward black
color *= (1.0 - factor);
```

> **The classic bug in this scene.** Get it wrong and the far end of the bridge
> is *brighter* than the near end — striking, confusing, and easy to misdiagnose
> as a lighting problem.

---

## 33.4 The trail buffer

Trails are what turn a stream of dots into a stream of light. They produce the
long sweeping streaks in the lower-left of the reference frame.

```
each frame:
    trailTarget.rgb *= PARTICLES.trail.decay      // 0.88
    render LIFTING | GLIDING | APPROACHING particles into trailTarget, additive
```

| Property | Value |
|---|---|
| Resolution | **Half** the render target |
| Format | RGBA16F (needs HDR headroom for the composite) |
| Decay | 0.88 per frame |
| Visually significant length | 26 frames ≈ 430ms |
| Fully below 1% | ~36 frames ≈ 600ms |

### Why an accumulation buffer, not line geometry

| Approach | Cost at 140k |
|---|---|
| Per-particle line strips | 140,000 × 26 segments = **3.6M segments/frame** |
| **Accumulation buffer** | **One half-res additive pass** |

Not a close call.

### Half resolution is free

Trails are soft by nature. Nobody can tell, and it quarters the cost of the
scene's second-most-expensive pass.

### The state check must happen on the GPU

```glsl
bool emitsTrail = (state == LIFTING || state == GLIDING || state == APPROACHING);
if (!emitsTrail) { gl_Position = vec4(2.0); return; }   // cull off-screen
```

Because state is **derived in the same shader invocation** that computes the
position (see [`21_anatomy_of_a_particle.md`](21_anatomy_of_a_particle.md)
§21.6), there is no possibility of a one-frame lag.

> **The classic trail bug:** a CPU-side state check runs one frame late, so with
> 140,000 particles seating across a 5.8-second window, a persistent faint blur
> accumulates **exactly on the bridge's shape**. The bridge looks out of focus
> and nobody can find the cause.

### The buffer must be cleared

| When | Why |
|---|---|
| Scene start | Otherwise the first frame inherits garbage |
| Loop restart (`T+41.600`) | Otherwise ghosting accumulates across cycles |
| Tier change | Resolution changed |
| Resize | Resolution changed |

### It feeds bloom

The trails must **glow**, or they read as scratches. Step 6 composites the trail
target into the bloom input before the bloom pass runs.

---

## 33.5 Bloom

```ts
POSTFX.bloom = { threshold: 0.62, radius: 0.42, strength: /* animated */ }
```

### Implementation

A standard multi-pass down/up chain:

```
bloomInput (full res)
  → bright-pass (threshold 0.62)
  → downsample ×5  (½, ¼, ⅛, 1/16, 1/32)
  → upsample ×5 with tent filter, accumulating
  → combine with bloomInput at `strength`
```

Five mips. Fewer produces visible ringing at the glow's edge; more costs
bandwidth for spread nobody sees at `radius 0.42`.

### The threshold separates matter from light

| Element | Peak luminance | Blooms? |
|---|---|---|
| Terrain (rim-lit) | 0.09 | **No** |
| Terrain + swarm (clamped) | 0.27 | **No** |
| Stars | 0.22 | **No** |
| Dormant particle | 0.17 | **No** |
| Seated particle | 0.74 | **Yes** |
| Gliding particle | 0.92 | **Yes** |
| Snap / pulse | 1.00 | **Yes** |

**Terrain has 2.3× of headroom below the threshold.** This is what keeps the
landscape reading as solid matter next to objects made of light — the scene's
most basic visual distinction.

Re-verify after any change to `rimStrength`, swarm intensity, or the threshold.

### Strength is animated

| Phase | Strength |
|---|---|
| Dormant | 0.30 |
| Awakening | 0.46 |
| Glide | 0.62 |
| Assembly | 0.62 → 0.88 |
| **Completion** | **1.15** (200ms) |
| Living | 0.85 |

**The bloom curve is where most of the scene's sense of building energy comes
from** — more than any geometry change.

---

## 33.6 The rest of the post chain

Order matters.

```
bloom → chromatic aberration → vignette → grain → screen
```

### Chromatic aberration

```ts
POSTFX.chromaticAberration = 0.0012
```

~1.8px of channel separation at the extreme corners, zero at centre.

**After bloom**, so the glow itself gets the fringing — which is what makes it
read as lens character rather than as a filter.

Should never be identifiable. First thing cut in `PERF.degradation`.

### Vignette

```ts
POSTFX.vignette = { strength: 0.34, smoothness: 0.62 }
```

Two jobs: pulls the eye toward the centre-right where the bridge is, and hides
the boundary where the terrain mesh ends and fog takes over.

If a viewer can identify the vignette as an effect, it is too strong.

### Grain — last, and not optional

```ts
POSTFX.grain = { amount: 0.035, animated: true }
```

**Must be the final pass**, applied after everything else, at full resolution.

> **Why it is mandatory:** 85% of the frame sits between `#040610` and
> `#0B0F18` — about **5 values out of 256**. Any gradient across that range bands
> visibly on 8-bit displays. The sky develops horizontal stripes.
>
> Grain dithers the quantisation. Noise at 3.5% is invisible; banding at 5 levels
> is glaring.

Grain applied **before** bloom would get blurred and stop dithering. It has to
be last.

**Animated** — the pattern changes every frame. Static grain reads as dirt on
the lens.

---

## 33.7 Render targets

| Target | Resolution | Format | Purpose |
|---|---|---|---|
| `sceneTarget` | full × DPR | RGBA16F | Sky + terrain + mist + particles |
| `trailTarget` | **half** × DPR | RGBA16F | Trail accumulation |
| `bloomChain[0..4]` | ½ … 1/32 | RGBA16F | Bloom mips |
| `bloomInput` | full × DPR | RGBA16F | Composite of scene + trails |

### HDR is required

`RGBA16F`, not `RGBA8`.

Additive blending routinely sums past 1.0 in dense regions. At 8-bit those sums
clip to white **before** the bloom's bright-pass sees them, so the brightest
regions lose all their headroom and the glow flattens.

Fallback if `EXT_color_buffer_half_float` is unavailable: RGBA8 with a 0.5
pre-scale and a 2× post-scale. Visibly worse, but functional.

### DPR is capped

```ts
renderDPR = Math.min(window.devicePixelRatio, PERF.maxDPR)
```

| Tier | `maxDPR` |
|---|---|
| `ultra` / `high` | 2.0 |
| `medium` | 1.5 |
| `low` / `minimal` | 1.0 |

> A phone at DPR 3 renders **nine times** the pixels of DPR 1. Since the scene
> is fill-rate bound, that is a 9× cost for a difference nobody can see on a
> 6-inch screen at arm's length.

---

## 33.8 Fill rate is the limit

Not particle count. Not draw calls. **Fill rate.**

### Why

Additive particles are trivial to transform — a few dozen shader ops — and
expensive to *fill*. A dense region like a tower leg has many particles
overlapping the same pixels, and each one writes.

### The numbers

At `high` tier, 140,000 particles averaging 2.0px diameter:

```
pixels per particle ≈ π × 1.0² ≈ 3.1
total writes/frame  ≈ 434,000
```

Trivial in isolation. But those writes are **concentrated**: the tower legs
occupy ~0.4% of the frame and receive ~14% of the particles, so those pixels are
written ~50× per frame.

### Consequences

| Lever | Effect on fill |
|---|---|
| Particle count | Linear |
| **Particle size** | **Quadratic** |
| DPR | Quadratic |
| Trail resolution | Quadratic |

**This is why `PARTICLES.sizePx.max` is capped at 2.9** even though larger reads
better on 4K. Going to 4px is a **1.9× increase** in the scene's dominant cost
for a barely perceptible gain.

### The `discard`

```glsl
float d = length(gl_PointCoord - vec2(0.5));
float alpha = 1.0 - smoothstep(0.24, 0.5, d);
if (alpha <= 0.0) discard;
```

A point sprite is a square; the visible dot is a circle. Without the `discard`,
the transparent corners — **~36% of the quad** — still write to the framebuffer.

36% of the scene's most expensive pass, for nothing.

---

## 33.9 Phase 2 is the expensive frame

Tier detection must measure **during Phase 2**, not earlier.

| Cost | Why Phase 2 peaks |
|---|---|
| Trails | ~87% of particles in trail-emitting states — the maximum |
| Overdraw | Particles concentrated into a narrow river; heavy screen-space overlap |
| Swarm lights | 5 point lights against a 384² terrain, at peak intensity |
| Bloom | Rising strength = larger effective kernel |

A device that passes on Phase 0's trivial load and then stutters through Phase 2
has been mis-tiered. See
[`34_performance_budget.md`](34_performance_budget.md).

---

## 33.10 Degradation

```ts
PERF.degradation = [
  'chromaticAberration',   // free to lose
  'grain',                 // only on low tiers — see caveat
  'trailLength',           // 26 → 14 frames
  'swarmLights',           // 5 → 2 → 0
  'bloomRadius',           // 0.42 → 0.28
  'terrainSegments',       // 384 → 256 → 160  (init only)
  'particleCount',         // last resort — this IS the scene
]
```

Ordered by *visual cost per millisecond saved*.

### Caveats

**Grain** is cut second, but on desktop this causes banding. It is only
acceptable on low tiers, which are usually phones with dithered panels where
banding is less visible.

**Terrain segments** can only change at **initialisation**. Rebuilding the
heightfield mid-scene means re-seeding every particle, because their seeds were
sampled from the old surface. Tier changes affect terrain only on reload.

**Particle count is last** because it is the scene. Everything else is
atmosphere.

### Changes are blocked during Phases 3 and 4

```ts
PERF.blockChangesDuringPhases = [3, 4]
```

A particle-count change mid-assembly is visible as a **pop** — particles
vanishing from a structure that is supposed to be gaining them. Queue any
downgrade for Phase 5.

---

## 33.11 What is NOT in the pipeline

| Absent | Why |
|---|---|
| Shadow maps | The key light is at 0.16 intensity; a shadow is a 5-value difference |
| SSAO | Nothing is lit enough for occlusion to read |
| Reflections | The valley floor is mist, not water |
| Motion blur | Trails already do this, better and cheaper |
| Depth of field | Everything should be sharp; the bridge's point structure is the subject |
| Tone mapping | The scene is authored dark; a tone curve would lift the blacks |
| TAA / FXAA | Particles are round sprites with soft edges. Nothing to alias. |
| Volumetrics / god rays | No light source to shaft from |

**No tone mapping** is worth stating explicitly. Three.js defaults to
`NoToneMapping`, which is what we want. Enabling ACES or Reinhard lifts the 85%
near-black band and destroys the colour ratio immediately.

---

## 33.12 Failure modes

**1 · `depthTest` and `depthWrite` both disabled.**
The bridge draws over the mountain in front of it.

**2 · `depthWrite` enabled on particles.**
Particles occlude each other; the additive density effect disappears.

**3 · Fog `mix()`ed on additive geometry.**
The far end of the bridge is brighter than the near end.

**4 · Trail state check on the CPU.**
A one-frame lag; the finished bridge looks out of focus.

**5 · Trail buffer not cleared on loop restart.**
Ghosting accumulates until the frame is a smear.

**6 · Trails not fed into bloom.**
The streaks read as scratches rather than as light.

**7 · Grain before bloom.**
Blurred; stops dithering; banding returns.

**8 · RGBA8 targets.**
Dense regions clip before the bright-pass sees them; the glow flattens.

**9 · Uncapped DPR.**
9× fill cost on a phone.

**10 · Missing `discard`.**
36% wasted fill on the most expensive pass.

**11 · Tone mapping enabled.**
Blacks lift; the 85/10/5 ratio breaks immediately.

**12 · Tier measured during Phase 0.**
Every device passes; weak ones stutter through Phase 2.

**13 · Terrain LOD changed at runtime.**
Particles detach from a surface that no longer exists.

---

## 33.13 Checklist

- [ ] Seven passes in the order in §33.1.
- [ ] Sky is a screen-space quad with no depth write.
- [ ] Terrain is the **only** pass writing depth.
- [ ] Particles: `depthTest: true`, `depthWrite: false`. Both.
- [ ] Additive blending: `SRC_ALPHA, ONE`.
- [ ] Fog on additive geometry **attenuates toward black**.
- [ ] Trails are an accumulation buffer at **half resolution**.
- [ ] The trail state check happens **in the shader**.
- [ ] The trail buffer is cleared at start, on loop restart, on tier change, and
      on resize.
- [ ] The trail buffer feeds bloom.
- [ ] Bloom threshold 0.62; terrain peak 0.27 stays safely below it.
- [ ] Bloom strength is animated per phase; completion peaks at 1.15 for 200ms.
- [ ] Five bloom mips.
- [ ] Grain is the **final** pass, at full resolution, animated.
- [ ] Render targets are RGBA16F.
- [ ] DPR is capped per tier.
- [ ] The fragment shader `discard`s transparent sprite corners.
- [ ] `PARTICLES.sizePx.max` is 2.9 regardless of display resolution.
- [ ] **No tone mapping.** `NoToneMapping`.
- [ ] No shadows, SSAO, reflections, DOF, motion blur, TAA, or volumetrics.
- [ ] Tier is measured during **Phase 2**.
- [ ] No tier change during Phases 3 or 4.
- [ ] Terrain LOD is fixed at init.

---

**Next:** [`34_performance_budget.md`](34_performance_budget.md) — tiers and
frame budgets.
