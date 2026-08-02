# Performance

---

## 1. The numbers

| Metric | Value |
|---|---|
| Draw calls per frame | **14** |
| Particles drawn | 82,599 × **2 passes** = 165,198 vertex invocations |
| Terrain triangles | 294,338 |
| Mist triangles | 28,322 |
| Ground glow triangles | 8,234 |
| Total triangles | ~330,900 |
| `ShaderMaterial` instances | 9 |
| GLSL programs | 9 |
| Textures | **2** (frame table 512×4 RGBA32F, colour ramp 256×1 RGBA8) |
| Render targets | 7 (scene, trail A/B/scratch, 3 mips) |
| `THREE.Light` instances | **0** |

### Draw call breakdown

```
1   trail pass          particles only, half res
5   scene pass          sky, terrain, mist, groundGlow, particles
1   trail accumulate    fullscreen blit
1   trail add           fullscreen blit, additive
1   bloom prefilter
2   bloom downsample
2   bloom upsample
1   composite
──
14
```

---

## 2. Where the time goes

The cost model is **flat**. There is no LOD, no culling, no instancing — 82,599
vertex shader invocations per pass regardless of what is on screen.

### The vertex shader is the expensive part

Per particle, per pass:

- 4 texture fetches (`frameRow` × 4) in the glide branch
- ~2 more for the barrel roll's `centrelineNrm` / `centrelineBin`
- a `smoothstep`, an `easeInOutCubic`, two `sin`/`cos`, a `normalize`, a `mix`
- the interaction block (usually skipped: `uCursorStrength > 0.001`)
- the dispersion block (usually skipped: `uDisperse > 0.001`)

**Six texture fetches × 82,599 × 2 passes = ~991,000 vertex texture fetches per
frame.** Vertex texture fetch is the slowest thing in the shader and this is the
single biggest cost in the project.

### Fill rate

Particles are 0.6–14 px, typically ~2 px, additively blended with `depthWrite:
false` — so **every particle's fragments are blended, none are early-Z rejected.**
The `discard` in the fragment shader saves the ~36% of each quad outside the
circle.

The trail pass is at half resolution, so its fill is a quarter.

### The passes nobody counts

`setBloomMips()` and `setTrails()` both call `setSize()`, which **disposes and
reallocates every render target.** That is why the governor's hysteresis matters:
doing it every other window would itself be the performance problem.

---

## 3. Startup cost

| Step | Cost |
|---|---|
| Terrain heightfield (147,456 × 5 octaves) | ~120 ms |
| `computeVertexNormals()` on 294k triangles | ~40 ms |
| Target generation + separation grid | ~90 ms |
| Seed placement (82,599 × `heightAt` + rerolls) | ~6 ms **(cached)** |
| Fisher-Yates shuffle | <1 ms |
| Attribute writing | ~25 ms |
| Frame texture + ramp | <1 ms |
| **Total** | **~280 ms**, single-threaded, blocking |

> Seed placement was **400 ms** before the heightfield cache — re-running five
> octaves plus a `nearestU` search 140,000 times. It showed as a visible hitch
> before the scene started. Sampling the cache costs 6 ms.

All of this is behind `scheduleAfterLoad` (load event + `requestIdleCallback` with
a 1,200 ms timeout), so it never blocks first paint. **The headline is readable
before three.js is even downloaded.**

---

## 4. Memory

| | Bytes |
|---|---|
| Particle attributes (14 slots × 82,599) | ~7.6 MB |
| ⤷ of which `position` dummy zeros | 0.99 MB |
| Terrain geometry (position + normal + uv, 147,456 verts) | ~4.7 MB |
| Terrain height cache (`Float32Array`) | 0.59 MB |
| Mist geometry + `aDensity` | ~0.6 MB |
| Ground glow geometry | ~0.1 MB |
| Frame texture (512×4 RGBA32F) | 32 KB |
| Colour ramp (256×1 RGBA8) | 1 KB |
| **Geometry + textures** | **~13.6 MB** |

### Render targets at 1536×1024, DPR 1

| Target | Size | Format | Bytes |
|---|---|---|---|
| `sceneTarget` | 1536×1024 | RGBA16F | 12.6 MB |
| `sceneTarget.depthTexture` | 1536×1024 | UInt24 | 6.3 MB |
| `trailScratch` | 768×512 | RGBA16F + depth | 4.7 MB |
| `trailA` | 768×512 | RGBA16F | 3.1 MB |
| `trailB` | 768×512 | RGBA16F | 3.1 MB |
| `mips[0]` | 768×512 | RGBA16F | 3.1 MB |
| `mips[1]` | 384×256 | RGBA16F | 0.8 MB |
| `mips[2]` | 192×128 | RGBA16F | 0.2 MB |
| **Total** | | | **~33.9 MB** |

**At DPR 2 this is ~136 MB.** That is the dominant memory cost of the project by a
wide margin, and it is why `maxDPRByTier` caps at 2.0 and drops to 1.0 for
low-tier devices.

### The leak

⚠ `uFrameTex` and `uRamp` are `DataTexture`s created inside `createParticles` and
**never disposed.** `material.dispose()` does not dispose its textures. 33 KB
leaked per Stage. Irrelevant on a single-page site; a real bug on anything that
creates and destroys Stages.

---

## 5. The degradation ladder

`src/lib/perf.ts` (156 lines) + `Stage.applyQuality` + `BridgeScene.degrade`.

> Adaptive quality is the one system that can be fully specified, shipped, and
> **never once executed** — because it only fires on hardware that struggles, and
> nobody develops on hardware that struggles.

### Configuration

```ts
PERF = {
  targetFps: 60, floorFps: 30,
  sampleFrames: 90,
  downgradeMs: 22.0,      // ≈45fps
  upgradeMs: 11.5,        // ≈87fps
  upgradeWindows: 3,
  measureFromPhase: 2,
  blockChangesDuringPhases: [3, 4],
  thermalGuard: { windowSeconds: 60, degradationThreshold: 1.25 },
  degradation: ["chromaticAberration", "grain", "trailLength",
                "swarmLights", "bloomRadius", "terrainSegments",
                "particleCount"],
}
```

### Order is the design

Ranked by **visual cost per millisecond saved**, and particle count is LAST
because the particles are the scene and everything above them is atmosphere.

> A page that drops half its particles to keep its film grain has its priorities
> exactly inverted.

Measured order on a stressed run:

```
chromaticAberration → grain → swarmLights → bloomRadius → particleCount
```

`trailLength` and `terrainSegments` are skipped in that trace only because the
trace predates the trail buffer; `trailLength` is now actionable and sits third.

`terrainSegments` returns **false** and always will: the heightfield is baked at
construction and the seeds, piers, mist density and ground glow are all sampled
from it. Rebuilding it mid-scene would move the ground out from under the bridge.
Returning false is the honest answer — the governor takes the next rung instead of
crediting itself with a saving nothing made.

### Asymmetry

Downgrading takes **one** bad window. Upgrading takes **three** good ones in a row
*and* a higher bar (11.5 ms vs 22.0 ms).

> Oscillating between two tiers is far more visible than simply running at the
> lower one. A scene that keeps changing its mind reads as broken; a scene that
> quietly settled reads as fine.

### When it may act

**Not before Phase 2.** Phase 0 costs almost nothing and every device sails
through it, so measuring early hands a weak machine a high tier and then lets it
collapse in Phase 2, which is the peak.

**Never during Phases 3–4.** A particle count that changes mid-assembly is a
visible pop in the one sequence the entire page exists to show. Measurement still
accumulates so the decision is ready the moment it becomes safe to act.

### Median, not mean

```ts
const sorted = [...window].sort((a, b) => a - b);
meanMs = sorted[Math.floor(sorted.length / 2)];
```

One 400 ms stall while a texture uploads should not cost the device a quality
tier, and the mean cannot tell that stall apart from ninety frames of genuinely
being too slow.

### The thermal guard

```ts
const thermal = meanMs > best * 1.25;
```

A phone does not fall off a cliff; it slides. By the time the mean crosses
`downgradeMs` the visitor has watched it get worse for half a minute. Comparing
against the **best recent window** catches the slide while it is still a trend —
which is why it is a ratio rather than another absolute threshold.

After any downgrade, `best` is reset to `Infinity`: the device just changed, and
everything measured before that describes a scene that no longer exists.

### The clamp that would have hidden everything

The governor is fed **`frame.raw`**, the unclamped delta, not `frame.delta`. The
clamp exists so a tab restored after two minutes does not advance the scene by two
minutes — and it would hide exactly the long frames the governor is looking for. A
device stuttering at 200 ms per frame reports a healthy 50 ms once clamped.

### Particle count had to be made free first

`setDrawRange(0, k)` costs nothing and needs no rebuild, but buffer order was
spatial order, so truncating deleted a contiguous piece of bridge. The seeded
Fisher-Yates shuffle makes any prefix a uniform sample. **The span gets sparser;
it never gets shorter.**

Steps of 0.2, floor at 0.4 — so the ladder can take the population to 40% and no
further.

### Resolution is the last resort

`Stage` already dropped pixel ratio after 2.5 slow seconds, **on its own**. So the
first thing a struggling device gave up was *sharpness*, before it had given up so
much as the film grain — and once the ladder existed the two would have taken
turns, costing the visitor both.

It now waits for `governor.level() >= PERF.degradation.length`, and it is
**one-way**: dropping resolution is invisible until you compare, while restoring
it mid-session is a sudden sharpening that reads as a glitch.

---

## 6. Tier tables

```ts
maxDPRByTier:          { ultra: 2.0, high: 2.0, medium: 1.5, low: 1.0, minimal: 1.0 }
terrainSegmentsByTier: { ultra: 384, high: 384, medium: 256, low: 160, minimal: 160 }
swarmLightsByTier:     { ultra: 5,   high: 5,   medium: 5,   low: 2,   minimal: 0 }
countByTier:           { ultra: 200k, high: 140k, medium: 90k, low: 45k, minimal: 16k }
```

Tier is chosen from `capabilities.densityScale` — `high` at ≥0.9, `medium` at
≥0.6, `low` below. **`ultra` is never selected automatically**; it must be earned
by measurement or set explicitly for captures.

---

## 7. Measured frame rate

⚠ **There is no real-hardware frame-rate number in this project.** Every
measurement in the repository was taken under **SwiftShader** (software
rasterisation) in headless Chromium, where the scene runs at roughly a tenth of
real speed. That is fine for colour and geometry — those are deterministic — and
useless for performance.

The acceptance scripts are all written to wait on *values* rather than durations
precisely because of this.

**Nobody has profiled this on a real GPU.** No Chrome trace, no `EXT_disjoint_timer_query`,
no per-pass GPU timing. The cost estimates in §2 are derivations, not
measurements.

---

## 8. The acceptance suite

`npm run verify` runs all seven and reports all of them.

| Script | What it proves |
|---|---|
| `hygiene` | Static rules. Attribute budget, determinism, console capture, unused config exports. No browser. |
| `palette` | The 85/10/5 colour rule across seven captures. |
| `viewport` | Ratio drift across four viewport sizes. |
| `interact` | Cursor, touch, push-in — reading the real fields. |
| `reveal` | UI arrival order + no-WebGL + no-JavaScript. |
| `loop` | Rewind shape + cycle repeatability against a drift floor. |
| `perf` | The governor, driven with synthetic frame times. |

Current: **6 of 7 pass.** `palette` fails on two captures left failing on purpose
(decision log Q-05).

### Chained with `&&` was a bug

Two colour captures are deliberately failing, so the first link failed
permanently and **the other five never ran at all.** `verify.mjs` now spawns each
and summarises. *An open question should not be able to hide a regression.*

### Harnesses must fail on `console.error`

three.js reports a shader link failure through `console.error` and then draws
nothing. `palette-check` once reported a full set of plausible, self-consistent,
completely wrong numbers for a scene whose entire bridge was not being rendered —
and reported it as a **pass** on five of seven captures, because a frame with no
bridge in it is a very dark frame and the rule rewards darkness.

> A silent renderer failure moves the colour ratio in the direction the rule calls
> *good*. This one would never have announced itself.

---

## 9. Optimisation opportunities

Ranked by expected saving. **None of these have been measured on real hardware**,
which is itself the first item.

### 9.1 The trail pass doubles the vertex cost — HIGH

165,198 vertex invocations per frame instead of 82,599, for an effect that
contributes a smear at half resolution.

The trail pass could run at **quarter** resolution (the smear does not need
pixels), or — better — could skip the state machine entirely with a cheaper
dedicated shader that computes only the glide branch, since only three states
trail and all three are on the guide curve.

### 9.2 Vertex texture fetches — HIGH

~991,000 per frame. The barrel roll fetches `centrelineNrm` and `centrelineBin`
separately from the `guidePoint` call that already fetched `centrelineBin`.
Hoisting one `frameRow` call saves ~165,000 fetches per frame for free.

### 9.3 The `position` dummy — LOW effort, LOW gain

3 floats × 82,599 = 0.99 MB of zeros uploaded to describe a draw count. A
1-component attribute would do, saving 660 KB of VRAM and one attribute slot —
which matters given the 14-slot ceiling.

### 9.4 Render target memory at DPR 2 — MEDIUM

~136 MB. The trail targets could share `sceneTarget`'s depth buffer instead of
allocating their own; `trailScratch` needs depth, `trailA`/`trailB` do not and
correctly do not have it.

### 9.5 Terrain triangle count — MEDIUM

294,338 triangles for a static mesh that is 90% invisible (below the horizon,
behind the camera, or fogged to nothing). A displacement-mapped lower-resolution
mesh, or simply clipping the plane to the visible frustum footprint, would remove
most of it. The 384 segments exist for **silhouette** quality along the ridgelines,
which is a property of a small fraction of the mesh.

### 9.6 `computeVertexNormals` — LOW

~40 ms at startup on 294k triangles. The heightfield is already cached; normals
could be computed analytically from it in a fraction of the time.

### 9.7 Dead code — trivial

251 lines (`lib/noise3d.ts`, `gl/glsl.ts`) that ship in no bundle because nothing
imports them, but sit in the repository implying capability that is not there.

---

## 10. Budget the project set itself and did not verify

```ts
PERF.targetFps = 60
PERF.floorFps  = 30
```

There is no evidence anywhere in the repository that either has been achieved or
missed on real hardware. The degradation ladder exists to defend a budget that has
never been measured.
