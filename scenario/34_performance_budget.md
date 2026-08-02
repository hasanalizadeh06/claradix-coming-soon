# 34 — PERFORMANCE BUDGET

**Frame budgets, device tiers, and how the scene degrades itself.**

---

## 34.1 The budget

| Target | Frame time | Devices |
|---|---|---|
| **60 fps** | **16.67ms** | Desktop, modern laptops, flagship phones |
| **30 fps floor** | **33.33ms** | Older phones, integrated graphics |
| Below 30 fps | — | Unacceptable. Degrade. |

### Where the 16.67ms goes

At `high` tier, mid-range discrete GPU, Phase 2 (the expensive phase):

| Pass | Budget | Notes |
|---|---|---|
| Sky | 0.3ms | One screen quad |
| Terrain | 1.8ms | 294k triangles, 5 lights |
| Mist | 0.4ms | One plane |
| **Trails** | **3.1ms** | Half res, but ~122k particles |
| **Particles** | **4.6ms** | Fill-bound |
| Composite | 0.5ms | |
| **Bloom** | **3.2ms** | 5 mips down + up |
| Aberration + vignette + grain | 0.9ms | |
| CPU | 0.5ms | |
| **Total** | **~15.3ms** | 1.4ms of headroom |

**Particles and bloom are 51% of the frame.** Everything else is noise.

---

## 34.2 Fill rate is the constraint

Not particle count. Not draw calls. Not triangles.

### Why

Additive particles are trivial to transform and expensive to *fill*. The scene
issues **one draw call** for 140,000 particles; the cost is entirely in how many
pixels get written.

### The concentration problem

```
tower legs:      ~0.4% of frame area,  ~14% of particles
→ those pixels written ~50× per frame
```

Average overdraw across the frame is modest. Peak overdraw, in the densest
regions, is severe — and the GPU is limited by the peak.

### The levers, ranked

| Lever | Effect on fill |
|---|---|
| **Particle size** | **Quadratic** |
| **DPR** | **Quadratic** |
| **Trail resolution** | **Quadratic** |
| Particle count | Linear |
| Terrain segments | Negligible (vertex-bound, not fill-bound) |

> **The two quadratic levers are the ones to reach for first.** Halving particle
> size saves more than halving particle count, and costs far less visually.

---

## 34.3 The five tiers

```ts
PARTICLES.countByTier = {
  ultra:   200_000,
  high:    140_000,
  medium:   90_000,
  low:      45_000,
  minimal:  16_000,
}
```

| Tier | Particles | DPR cap | Terrain | Swarm | Trails | Grain | Aberration |
|---|---|---|---|---|---|---|---|
| `ultra` | 200,000 | 2.0 | 384² | 5 | 26f | ✓ | ✓ |
| `high` | 140,000 | 2.0 | 384² | 5 | 26f | ✓ | ✓ |
| `medium` | 90,000 | 1.5 | 256² | 5 | 26f | ✓ | ✗ |
| `low` | 45,000 | 1.0 | 160² | 2 | 14f | ✗ | ✗ |
| `minimal` | 16,000 | 1.0 | 160² | 0 | ✗ | ✗ | ✗ |

### What is lost at each step

**`ultra` → `high`:** nothing perceptible. `ultra` exists for capture and for
`og.png` generation, not because anyone can see the difference.

**`high` → `medium`:** hangers begin to read as dotted rather than continuous.
The first visible loss, and it appears exactly where §34.5 predicts.

**`medium` → `low`:** the bridge is visibly sparse. Cables read as bead strings.
Swarm illumination stops sweeping smoothly and moves in two steps. Banding
appears in the sky.

**`low` → `minimal`:** no trails. **This is the largest single loss in the
scene** — the river becomes a cloud of separate dots with no current, and Phase 2
loses its entire character. The build still reads; the beauty does not.

> `minimal` is a "the page still works" tier, not a "the page still looks right"
> tier. It exists so a five-year-old budget phone gets a coherent page rather
> than a slideshow.

---

## 34.4 Tier selection

Two stages: a guess, then a measurement.

### Stage 1 — the initial guess

```ts
// src/lib/capabilities.ts
function guessTier(): Tier {
  const gl = probeContext()
  const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)
  const cores  = navigator.hardwareConcurrency ?? 4
  const memory = (navigator as any).deviceMemory ?? 4
  const mobile = matchMedia('(pointer: coarse)').matches
  const dpr    = window.devicePixelRatio

  if (mobile && dpr >= 3 && memory <= 4) return 'low'
  if (mobile)                            return 'medium'
  if (cores >= 8 && memory >= 8)         return 'high'
  if (cores >= 4)                        return 'medium'
  return 'low'
}
```

**The guess is deliberately conservative.** `ultra` is never guessed — it must
be earned by measurement, or set explicitly for captures.

> **Why not parse the GPU string?** `UNMASKED_RENDERER_WEBGL` is unreliable,
> increasingly privacy-restricted, and returns strings like
> `"ANGLE (Intel, Intel(R) UHD Graphics ...)"` that require a lookup table which
> is stale the day it is written. It is read for telemetry, not for decisions.

### Stage 2 — measurement

```ts
PERF = {
  sampleFrames: 90,          // 1.5s at 60fps
  downgradeMs: 22.0,
  upgradeMs: 11.5,
  upgradeWindows: 3,
}
```

- Average frame time above **22.0ms** for a full 90-frame window → **drop one
  tier**
- Average below **11.5ms** for **three** consecutive windows → **allow one
  upgrade**

**Downgrading is much easier than upgrading.** One bad window drops you; three
good windows are needed to climb. This asymmetry prevents oscillation between
tiers, which is far more visible than simply running at the lower tier.

### Measurement must happen during Phase 2

```ts
PERF.measureFromPhase = 2
```

> **Phase 0 costs almost nothing** — a static terrain and 140,000 dormant points
> with no trails. Every device passes.
>
> **Phase 2 is the peak** — ~87% of particles in trail-emitting states, maximum
> overdraw, swarm lights at full, bloom rising.
>
> Measuring early means weak devices get a high tier and then stutter through
> the phase that matters most.

### Changes are blocked during Phases 3 and 4

```ts
PERF.blockChangesDuringPhases = [3, 4]
```

A particle-count change mid-assembly is visible as a **pop** — particles
vanishing from a structure that is supposed to be gaining them.

Any downgrade decided during Phase 3 is **queued** and applied at `T+12.400`.

### Upgrades only in Phase 5

Phase 5 is the cheapest phase — no trails, swarm lights effectively off, no
state transitions. A device downgraded during the glide can earn its quality
back once the scene settles.

---

## 34.5 What breaks first

As quality drops, elements fail in a predictable order. **This is the diagnostic
sequence** — if you see the third symptom, you are two tiers below where you
think you are.

| Order | Element | Symptom |
|---|---|---|
| 1 | **Hangers** | Continuous lines → dotted lines |
| 2 | Railing | The deck's top edge loses its crispness |
| 3 | Main cables | Smooth catenary → bead string |
| 4 | Deck | The luminous plane becomes granular |
| 5 | Towers | The last to fail — highest density |

**Hangers first, always.** They are the thinnest, highest-frequency element:
0.4u diameter, 40u long, 66 of them.

This is why they get **20% of the particle budget** against ~2% of the surface
area — see [`24_target_assignment.md`](24_target_assignment.md) §24.2.

> **Diagnostic use:** if the hangers are dotted on a machine you expected to run
> `high`, the tier detection is wrong or the device is thermally throttled.
> Check before assuming the geometry is broken.

---

## 34.6 Memory

| Item | `high` | `minimal` |
|---|---|---|
| Particle attributes (24 floats) | 13.4 MB | 1.5 MB |
| Terrain geometry | 7.1 MB | 1.2 MB |
| `sceneTarget` @ 1920×1080 ×2 DPR, RGBA16F | 33.2 MB | 8.3 MB |
| `trailTarget` (half res) | 8.3 MB | — |
| Bloom chain (5 mips) | 11.1 MB | 2.8 MB |
| Textures (ramp, sprite, frame LUT) | 0.1 MB | 0.1 MB |
| **Total GPU** | **~73 MB** | **~14 MB** |

Comfortable. GPU memory is not a constraint for this scene at any tier.

---

## 34.7 Initialisation budget

| Step | Time |
|---|---|
| Config + tier detection | ~2ms |
| Centreline + LUTs | ~3ms |
| Terrain heightfield | ~34ms |
| Bridge target cloud | ~48ms |
| Deduplication | ~9ms |
| Seeding | ~6ms |
| Schedules | ~4ms |
| Attribute arrays | ~13ms |
| Buffer upload + shader compile | ~11ms |
| Post-process targets | ~5ms |
| **Total** | **~135ms** |

Inside Phase 0's **1.2 seconds** — one of the reasons Phase 0 exists.

### Two traps

**Seeding by re-evaluating the noise stack** instead of sampling the built
heightfield: ~400ms instead of ~6ms. A visible hitch before the scene starts.

**Computing `u` per target by fine spline search** instead of the arc-length
LUT: ~340ms instead of ~7ms.

Both are the kind of mistake that works correctly and is only wrong in its cost.

---

## 34.8 Shader compilation

The single largest source of first-frame jank in WebGL.

```ts
// Compile and warm every program during init, before the first real frame.
stage.warmShaders()
```

Draws one off-screen frame with every material bound. Costs ~30ms once; prevents
a 200–400ms stall the first time each pass runs.

> Without this, the stall lands at the *first frame of each phase* — including a
> visible hitch at `T+2.8` when trails first render, which is the worst possible
> moment.

---

## 34.9 Thermal throttling

A phone running this scene for several minutes will throttle. Frame time can
degrade **40%+** with no code change.

```ts
PERF.thermalGuard = {
  windowSeconds: 60,
  degradationThreshold: 1.25,     // 25% slower than the first minute
  action: 'downgradeOneTier',
}
```

If the rolling 60-second average is 25% worse than the first minute's baseline,
drop a tier — even if the absolute frame time is still acceptable.

> Catching the trend early prevents the visible collapse that happens when
> throttling finally crosses the 22ms threshold. And because Phase 5 is the
> cheapest phase, a throttled device settles rather than getting worse.

---

## 34.10 Measurement

### What to measure

```ts
// src/lib/vitals.ts
{
  fps:            rolling 90-frame average
  frameTimeP95:   95th percentile — spikes matter more than the mean
  tier:           current
  tierChanges:    count — more than 2 in a session is a bug
  initMs:         total initialisation
  firstFrameMs:   time to first rendered frame
}
```

**P95, not the mean.** A scene that averages 15ms but spikes to 45ms every
second feels far worse than one that runs steadily at 20ms.

### What not to do

**Do not use `performance.now()` deltas alone** to measure GPU work. They measure
when the CPU *submitted* the frame, not when the GPU *finished* it. Use
`EXT_disjoint_timer_query_webgl2` where available, and treat CPU deltas as a
lower bound.

### Web Vitals

| Metric | Target | Note |
|---|---|---|
| LCP | < 1.5s | The prerendered headline — **not** the canvas |
| CLS | 0 | The layout never shifts; the UI fades in place |
| INP | < 100ms | Only the CTA and the form are interactive |

> **LCP is measured against the prerendered text**, which is in the HTML from
> the first byte. The canvas is `aria-hidden` decoration and does not count.
>
> This is why the prerender matters for more than SEO.

---

## 34.11 What we deliberately do not optimise

| Not optimised | Why |
|---|---|
| Draw call count | Already one for particles, ~5 total |
| Triangle count | Terrain is vertex-bound at a level nothing notices |
| Texture memory | 0.1 MB total |
| JS bundle size | ~180 KB gzipped including Three.js — fine for this page |
| Particle transform cost | Trivial next to fill |
| Culling | Everything is on screen by construction |

**Optimising any of these is wasted effort.** The scene is fill-bound; work
anywhere else moves a number that is not the bottleneck.

---

## 34.12 Failure modes

**1 · Tier measured during Phase 0.**
Every device passes; weak ones stutter through Phase 2.

**2 · Symmetric upgrade/downgrade thresholds.**
Tier oscillation, which is more visible than the lower tier would be.

**3 · Tier change during Phase 3.**
Particles pop out of a structure that is supposed to be gaining them.

**4 · Uncapped DPR.**
9× fill cost on a DPR-3 phone.

**5 · Particle size raised for 4K.**
Quadratic cost for a marginal gain.

**6 · Optimising particle count before particle size.**
Linear lever pulled instead of quadratic.

**7 · No shader warm-up.**
A 200–400ms stall at the first frame of each phase, including at `T+2.8`.

**8 · Seeding by re-evaluating noise.**
~400ms init hitch.

**9 · No thermal guard.**
A phone collapses visibly after two minutes instead of settling gracefully.

**10 · Measuring the mean instead of P95.**
Spiky frames pass a check that a human would fail immediately.

**11 · Terrain LOD changed at runtime.**
Particles detach from a surface that no longer exists. Init only.

---

## 34.13 Checklist

- [ ] 60 fps target, 30 fps floor.
- [ ] Frame budget accounted: particles + bloom ≈ 51%.
- [ ] Fill rate is understood as the constraint, not particle count.
- [ ] Five tiers with the counts and caps in §34.3.
- [ ] The initial guess is conservative; `ultra` is never guessed.
- [ ] GPU renderer string is used for telemetry only, never for decisions.
- [ ] Tier is measured over 90-frame windows.
- [ ] Downgrade at 22.0ms after one window; upgrade at 11.5ms after **three**.
- [ ] **Measurement begins in Phase 2**, not earlier.
- [ ] No tier change during Phases 3 or 4; downgrades are queued for Phase 5.
- [ ] Upgrades happen only in Phase 5.
- [ ] DPR is capped per tier.
- [ ] Terrain LOD is fixed at initialisation.
- [ ] Shaders are warmed during init.
- [ ] Init completes in ~135ms, inside Phase 0.
- [ ] Seeds sample the heightfield; `u` comes from the arc-length LUT.
- [ ] Thermal guard drops a tier on a 25% rolling degradation.
- [ ] P95 frame time is tracked, not just the mean.
- [ ] More than 2 tier changes in a session is treated as a bug.
- [ ] LCP is measured against the prerendered text.
- [ ] CLS is 0 — the layout never shifts.

---

**Next:** [`35_accessibility.md`](35_accessibility.md) — the page for everyone
else.
