# 37 — IMPLEMENTATION PLAN

**What to build, in what order, and what to defer.**

---

## 37.1 The build order principle

> **Build the world before the bridge. Build the bridge before the particles.
> Build the particles before the choreography. Build the choreography before the
> polish.**

Each stage must **look finished on its own** before the next begins. The
temptation is to get particles flying on day one because that is the exciting
part — and then spend three weeks debugging a river that flows over terrain that
is still wrong.

---

## 37.2 The eight milestones

| # | Milestone | What "done" means | Est. |
|---|---|---|---|
| **M1** | **The valley** | A complete, believable dark landscape. No bridge, no particles. | 3d |
| **M2** | **The bridge, static** | Full target cloud rendered as static points. Looks like the reference frame minus trails. | 3d |
| **M3** | **Particles, dormant** | 140k points on the ground. Correct distribution, shimmer, no motion. | 2d |
| **M4** | **The flight** | Particles lift, glide, and seat. Correct schedule. Ugly but correct. | 4d |
| **M5** | **The look** | Trails, bloom, colour ramp, swarm lights. Now it looks like the reference. | 3d |
| **M6** | **Interaction** | Cursor, parallax, push-in, touch. Laws 4 and 5 verified. | 3d |
| **M7** | **The page** | UI, reveal choreography, countdown, form, accessibility. | 3d |
| **M8** | **Hardening** | Tiers, degradation, all acceptance scripts green. | 3d |

**~24 working days.** Sequential; each depends on the last.

---

## 37.3 M1 — The valley

**Docs:** [`16`](16_world_map.md) · [`17`](17_terrain.md) ·
[`18`](18_sky_and_atmosphere.md) · [`20`](20_lighting_design.md)

| Step | Output |
|---|---|
| 1 | `lib/config.ts` — every constant from doc 36, verbatim |
| 2 | `styles/tokens.css` — palette mirroring config |
| 3 | `scene/centreline.ts` — spline, arc-length LUT, parallel-transport LUT |
| 4 | `scene/elements/terrain.ts` — heightfield, 5 octaves, **corridor carve**, framing ridges |
| 5 | `scene/Atmosphere.ts` — sky gradient, nebula (2 layers), stars, fog |
| 6 | `gl/Stage.ts` — renderer, camera at base position, resize |
| 7 | Rim-light shader, ambient, key light |

### Done when

- [ ] A complete dark valley renders at 60fps
- [ ] Mountains are readable **from rim light only**
- [ ] The horizon **dissolves** — no seam between terrain and sky
- [ ] The corridor carve is visible: there is a valley where the bridge will go
- [ ] Framing constraints F1–F5 hold (with an empty bridge volume)
- [ ] `npm run fit` passes for camera framing
- [ ] The noise seed is fixed; the landscape is identical every reload

### Do not proceed until the valley looks finished

> This is the milestone most likely to be rushed, and rushing it is the most
> expensive mistake available. Everything downstream is composed against this
> landscape. Fixing the terrain at M5 means re-verifying every framing
> constraint, re-seeding every particle, and re-shooting every capture.

---

## 37.4 M2 — The bridge, static

**Docs:** [`19`](19_bridge_anatomy.md) · [`24`](24_target_assignment.md) §24.2

Set `SCENE.debugShowTargetsOnly = true` and build the target cloud.

| Step | Output |
|---|---|
| 1 | `elements/towers.ts` — both towers, legs, taper, cross-braces |
| 2 | `elements/deck.ts` — deck surface, camber, railing |
| 3 | `elements/structure.ts` — catenary cables, hangers, piers |
| 4 | Target budget split per doc 24 |
| 5 | Deduplication at 0.35u |
| 6 | `u`, `layer`, `normal` per target via `nearestU` |

### Done when

- [ ] The bridge renders as a static point cloud that reads as a bridge
- [ ] Cables are **catenaries**, sag ratio 0.094 — not parabolas
- [ ] Hangers read as **continuous lines**, not dotted
- [ ] Piers reach the terrain at their positions
- [ ] Target count ≈ tier count after dedup
- [ ] Visually comparable to the reference frame, minus trails and bloom

> **This milestone validates the geometry independently of the animation.** If
> the bridge does not look right standing still, no amount of choreography will
> rescue it.

---

## 37.5 M3 — Particles, dormant

**Docs:** [`09`](09_phase_0_dormant.md) · [`21`](21_anatomy_of_a_particle.md) ·
[`24`](24_target_assignment.md) §24.4

| Step | Output |
|---|---|
| 1 | `scene/density.ts` — seed generation **from targets** |
| 2 | `elements/particles.ts` — all 14 attributes |
| 3 | `scene/material.ts` — ShaderMaterial, additive, `depthWrite: false` |
| 4 | Procedural sprite with `discard` |
| 5 | Colour ramp texture |
| 6 | Dormant shimmer, phase-scattered |

### Done when

- [ ] 140k particles rest on the terrain, oriented to its normals
- [ ] Distribution is **non-uniform**, concentrated on the bridge footprint
- [ ] None intersect the ground; none float
- [ ] None on slopes > 46°
- [ ] Shimmer is phase-scattered — the ground never brightens as a whole
- [ ] **No bridge is visible.** `npm run reveal-check` passes
- [ ] `particleCount === targetCount`, asserted
- [ ] Init completes in < 150ms

---

## 37.6 M4 — The flight

**Docs:** [`10`](10_phase_1_awakening.md) · [`11`](11_phase_2_glide.md) ·
[`12`](12_phase_3_assembly.md) · [`22`](22_particle_lifecycle.md) ·
[`23`](23_flight_choreography.md)

**The hardest milestone.** All of it lives in the vertex shader.

| Step | Output |
|---|---|
| 1 | `lib/ticker.ts` — one clock, `timeScale`, `seek()` |
| 2 | Schedule computation (`aLiftAt`, `aSeatAt`) |
| 3 | Derived state machine in the shader |
| 4 | Ballistic lift along `aSeedNormal` |
| 5 | Guide curve + taper |
| 6 | Barrel roll via the parallel-transport LUT |
| 7 | Approach blend, roll damping, `easeOutQuint` |
| 8 | Snap flash, one frame |

### Done when

- [ ] Every particle lifts, flies, and seats **on schedule**
- [ ] Last particle seats at exactly `T+11.200`
- [ ] **Zero** stragglers
- [ ] Assembly runs far → near
- [ ] Layers seat in load-bearing order
- [ ] Flight durations all fall in 4.5–5.7s
- [ ] Output is **identical at 30fps and 144fps**
- [ ] `ticker.seek(8.3)` renders exactly the `T+8.300` frame
- [ ] No twist seam in the river

> **It will look bad here.** No trails, flat colour, no bloom. That is expected —
> M4 proves the choreography is *correct*, not that it is beautiful.

---

## 37.7 M5 — The look

**Docs:** [`06`](06_art_direction.md) · [`33`](33_render_pipeline.md) ·
[`20`](20_lighting_design.md)

| Step | Output |
|---|---|
| 1 | `gl/PostFX.ts` — the seven-pass pipeline |
| 2 | Trail accumulation buffer, half res, GPU state check |
| 3 | Bloom chain, 5 mips |
| 4 | Animated bloom strength per phase |
| 5 | Swarm lights, binned, clamped |
| 6 | Vignette, grain, aberration |
| 7 | Completion pulse |
| 8 | Text scrim (DOM) |

### Done when

- [ ] `T+10.500` capture is **visually comparable to the reference frame**
- [ ] `npm run compare` passes within tolerance
- [ ] `npm run palette` passes at all seven capture points
- [ ] Trails are present in flight and **absent** at `T+16.000`
- [ ] No seated particle smears
- [ ] Terrain never blooms
- [ ] The completion pulse fires **once**
- [ ] No banding in the sky

> **This is the milestone where the scene becomes the thing.** Everything before
> it is scaffolding.

---

## 37.8 M6 — Interaction

**Docs:** [`25`](25_camera.md) · [`26`](26_interaction_rules.md) ·
[`27`](27_interaction_during_flight.md) · [`28`](28_input_and_devices.md)

| Step | Output |
|---|---|
| 1 | Pointer capture, stored not per-event |
| 2 | Cursor depth via `nearestU` |
| 3 | Seated displacement + asymmetric spring |
| 4 | Flight steering with lateral projection |
| 5 | Speed floor as a shader `max()` |
| 6 | Approach immunity ramp |
| 7 | Camera parallax + idle drift |
| 8 | Dolly + proximity dispersion, gated to `T+12.400` |
| 9 | Touch press-and-hold |
| 10 | Arrival ripple with exit re-arm |

### Done when

- [ ] `npm run interact-check` passes **all** assertions
- [ ] Cursor parked on the guide curve for 10s: every deadline still met
- [ ] Holding the cursor still for 10 minutes: **zero** change
- [ ] Silhouette IoU ≥ 88% under worst-case cursor
- [ ] No oscillation on return
- [ ] Touch hold behaves exactly like hover, and holds
- [ ] Wheel/pinch swallowed before `T+12.400`
- [ ] Rise 0.34s / return 1.40s asymmetry measurable

---

## 37.9 M7 — The page

**Docs:** [`29`](29_ui_layout.md) · [`30`](30_ui_reveal_choreography.md) ·
[`31`](31_content_and_copy.md) · [`35`](35_accessibility.md)

| Step | Output |
|---|---|
| 1 | `lib/copy.ts` |
| 2 | UI components at the `5.3%` axis |
| 3 | CSS reveal animations, one root class |
| 4 | Countdown with animated ring arc |
| 5 | Subscribe form, accessible |
| 6 | Four breakpoints, mobile re-composition |
| 7 | `prefers-reduced-motion` |
| 8 | Prerender |

### Done when

- [ ] `npm run fit` passes at all four breakpoints
- [ ] The lower void is empty
- [ ] Headline reveals **line by line**
- [ ] Reduced motion **skips the intro entirely**
- [ ] `axe` reports zero violations
- [ ] Keyboard-only and screen-reader passes done
- [ ] Prerendered HTML contains all copy
- [ ] No-JS and no-WebGL both render a complete page

---

## 37.10 M8 — Hardening

**Docs:** [`34`](34_performance_budget.md) · [`38`](38_acceptance_criteria.md)

| Step | Output |
|---|---|
| 1 | `lib/capabilities.ts` — tier guess |
| 2 | Frame-time measurement from Phase 2 |
| 3 | Degradation ladder |
| 4 | Thermal guard |
| 5 | Shader warm-up |
| 6 | Production assertions (no debug flags, no `seek()`, no `Math.random()`) |
| 7 | Full acceptance suite green |

### Done when

- [ ] 60fps on target hardware; 30fps floor on the weakest supported device
- [ ] Tier changes ≤ 2 per session
- [ ] No tier change during Phases 3–4
- [ ] All ten scripts in [`38`](38_acceptance_criteria.md) pass
- [ ] No debug flag ships

---

## 37.11 Dependency graph

```
M1 valley
  └─► M2 bridge (needs centreline + terrain)
        └─► M3 dormant (needs targets)
              └─► M4 flight (needs schedules + guide curve)
                    ├─► M5 look (needs states for trails)
                    │     └─► M8 hardening
                    └─► M6 interaction (needs states)
                          └─► M8

M7 page ──────────────────────────► can start any time after M1
```

**M7 is the only parallelisable milestone.** The UI layer shares nothing with
the scene except one class name, so it can be built by a second person from M1
onward.

---

## 37.12 What to defer

Not needed for a first shippable build.

| Defer | Why | When |
|---|---|---|
| `SCENE.loop` / rewind | Off by default; nobody sees it | After launch |
| `ultra` tier | Indistinguishable from `high` | With capture tooling |
| Device orientation parallax | Requires a permission decision (Q-08) | If ever |
| Chromatic aberration | Not identifiable | M5, if time |
| Release puff | The most expendable effect in the scene | M5, if time |
| `og.png` automation | A manual capture works | Before launch |
| Analytics | Not scene work | Any time |

### What must NOT be deferred

| Do not defer | Why |
|---|---|
| **The corridor carve** | Retrofitting it invalidates all seeds and captures |
| **`prefers-reduced-motion`** | An accessibility failure, not a feature gap |
| **The prerender** | LCP and SEO depend on it |
| **Deterministic seeding** | Every visual check depends on it |
| **`ticker.seek()`** | Without it there is no capture tooling and no verification |

---

## 37.13 Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Terrain reworked after M4 | Medium | **High** | Freeze M1 before M3 |
| Naive repulsion breaks Law 4 | **High** | High | `interact-check` assertion 5 from day one of M6 |
| Frenet frame twist seam | Medium | Medium | Parallel transport from the start; never "fix later" |
| Bloom drift breaks 85/10/5 | **High** | Medium | `palette-check` in CI from M5 |
| `Math.random()` creeping in | Medium | **High** | Lint rule banning it in `scene/` and `lib/` |
| Debug flag shipped | Medium | **Critical** | Build assertion |
| Intro duration changed late | **High** | Low | Already one scalar |
| Scope creep into the lower void | **High** | High | Doc 29 §29.3; refuse |

### The two to watch

**Naive repulsion.** It is what everyone writes first, it looks fine in casual
testing, and it fails only when someone holds the cursor still — which is exactly
what an engaged viewer does. Write the assertion before writing the feature.

**Bloom drift.** Every individual increase is defensible. Ten of them make the
page generic. `palette-check` in CI is the only thing that holds the line.

---

## 37.14 Definition of done

The build ships when:

- [ ] All eight milestones complete
- [ ] All ten acceptance scripts green
- [ ] 60fps on target hardware, 30fps floor on the weakest supported device
- [ ] `axe` zero violations; manual keyboard + screen-reader passes done
- [ ] Reduced motion verified
- [ ] No-JS and no-WebGL both render a complete page
- [ ] No debug flags, no `seek()`, no `Math.random()` in the bundle
- [ ] Open questions Q-01…Q-08 raised with the client (not necessarily resolved)
- [ ] `40_decision_log.md` updated with anything decided during the build

---

**Next:** [`38_acceptance_criteria.md`](38_acceptance_criteria.md) — how a build
is judged.
