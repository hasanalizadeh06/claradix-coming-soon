# 39 — DO AND DON'T

**The traps, with the reason each one is a trap.**

---

## 39.1 How to use this file

Every entry here is something that **will be proposed**, or **has been built and
was wrong**. A ban with no reason gets overturned by the next person with a good
argument, so every entry names the cost.

Organised by how the mistake happens, not by subsystem.

---

## 39.2 The five that will definitely happen

If this document is read once, read this section.

### 1 · "Let's show the bridge faintly from the start"

**Proposed as:** a hint, a ghost, a wireframe preview, "so people know what's
coming."

**Why it fails:** the entire premise is that the bridge is **built**. If it is
already there, nothing is being built — the scene silently becomes a *reveal*,
and every other decision (the far→near direction, the load-bearing layer order,
the completion pulse) stops making sense.

**Gate:** G3, `npm run reveal-check`.

### 2 · Repulsion added to velocity

**Proposed as:** the obvious way to make the cursor push particles.

```glsl
velocity += normalize(pos - cursor) * strength;   // WRONG
```

**Why it fails:** with the cursor held in a particle's path, the repulsion
cancels forward velocity and the particle **stalls**. It misses `aSeatAt` and
seats after the completion pulse — so the build finishes, the pulse fires, the
UI reveals, and stray particles are still trickling in behind the text.

**The fix:** project out the along-heading component. Deflect direction, preserve
magnitude. See [`27_interaction_during_flight.md`](27_interaction_during_flight.md).

**Gate:** G7 assertion 4.5.

### 3 · Everything gets brighter

**Proposed as:** ten separate, individually defensible changes. A brighter tower.
More bloom. Warmer particles. Stronger swarm lights.

**Why it fails:** each is fine; the sum is a frame that is 20% neon and looks
like every other tech landing page of the last decade. The difference between
this page and a hundred others is not the green — it is that there is **nothing
else**.

**Gate:** G5, `npm run palette`, per-capture targets.

### 4 · Something gets put in the lower void

**Proposed as:** a tagline, a scroll hint, a second CTA, a client logo strip.

**Why it fails:** `y 62.5% → 93.0%` — 30.5% of frame height — is where the
bridge sweeps in from the bottom-left. It is the most valuable space on the page.
The bridge's approach through empty space **is** the visual argument.

**Gate:** G6, `npm run fit`.

### 5 · A second accent colour

**Proposed as:** a cool blue for the countdown, a warm amber for the CTA, a
gradient on the headline.

**Why it fails:** one hue is the entire discipline. Neon-on-black is generic;
neon-on-black with **one colour and 85% darkness** is restrained. The first
second hue is the moment the design becomes ordinary.

**The only exception:** red, on form errors, and nowhere else. An error state
that is lime-on-black is not an error state.

---

## 39.3 Scene and story

| Don't | Do | Because |
|---|---|---|
| Make terrain out of particles | Build it as geometry | Law 1. A place made of specks cannot be *transformed* by specks. |
| Let particles fly in from off-screen | Rise them from this ground | The story becomes "something was delivered" instead of "this place transformed itself" |
| Build near→far | Build far→near | The bridge would grow *away* from the viewer. Departure, not arrival. |
| Assemble cables before towers | Load-bearing order | Anyone who has seen construction feels the wrongness without naming it |
| Make the bridge solid at completion | Keep it a point cloud forever | Law 3. Also, you cannot put your hand through a solid bridge. |
| Add a second structure | One bridge | A skyline or a second span dilutes the metaphor |
| Show an emitter or source point | Nothing enters the frame | An emitter means the particles were delivered, not activated |
| Cut Phase 0 to "get to the action" | Keep the 1.2s | Without a "before", nothing was transformed |
| Compress all phases for a shorter intro | Cut a phase | Below `timeScale 0.55` assembly becomes a wipe. **D-004**. |

---

## 39.4 Motion

| Don't | Do | Because |
|---|---|---|
| Let the bridge pulse rhythmically | One pulse, at completion, ever | A repeating pulse is a heartbeat — the structure reads as a creature |
| Synchronise idle breathing | Phase-scatter it | Unison breathing *is* a pulse, forever |
| Use bounce or overshoot easing | Damped springs, `easeOut` | Bounce reads as playful and low-mass. Nothing in the scene bounces. |
| Make roll radius visible | 0.4–1.2u | If you can trace one spiral, the river is confetti |
| Animate the camera during the build | Hold it | Camera motion competes with the assembly's own direction |
| Make parallax responsive | `lerp: 0.045` | A 1:1 camera turns the page into a toy |
| Let the snap flash last >1 frame | Exactly one | A bright leading edge reads as a scanning beam |
| Decelerate gently into targets | `easeOutQuint` | Gentle deceleration reads as settling dust, not as arrival |
| Retrace paths on rewind | Simplified return arc | Exact reversal looks like video played backwards |
| Animate countdown numerals | Plain swap | A 1 Hz flip is the most distracting thing on a calm page |

---

## 39.5 Look

| Don't | Do | Because |
|---|---|---|
| Remove film grain | Keep 0.035, animated | 85% of the frame spans 5 values out of 256. Without grain, the sky bands. |
| Raise bloom radius above ~0.5 | 0.42 | Hangers merge into haze and the bridge loses its characteristic detail |
| Let terrain cross the bloom threshold | Peak 0.27 vs threshold 0.62 | Only particles glow. That separation is matter vs light. |
| Enable tone mapping | `NoToneMapping` | ACES or Reinhard lifts the blacks and breaks 85/10/5 immediately |
| Add lens flares or god rays | Neither | Both imply a light source. There isn't one. |
| Add reflections to the valley floor | Additive ground decal | It is mist, not water. A reflection implies a lake. |
| Paint highlights on dense regions | Let density do it | Additive sums clamp toward `--lime-core` automatically |
| Brighten the far tower "so it reads" | Leave it 40% fogged | A clear far end makes the valley look small |
| Make seated brighter than gliding | 0.74 vs 0.92 | The travel is the hero. The destination is calm. |
| Add scan lines, HUD frames, glitch | None of it | Wrong genre. Not timeless. |

---

## 39.6 Architecture

| Don't | Do | Because |
|---|---|---|
| `pos += vel * dt` | Compute position from a schedule | Integration breaks determinism, frame-rate independence, scrubbing, and Law 5 at once |
| Store particle state on the CPU | Derive it in the shader | A one-frame lag makes the finished bridge look blurred |
| Use `Math.random()` anywhere in the scene | Seeded PRNG | Every visual check fails intermittently — looks like flaky tests, not a bug |
| Generate seeds before targets | Targets first | Flight durations scatter; the river loses its single speed |
| Sample noise for seeding | Sample the built heightfield | ~400ms vs ~6ms. A visible startup hitch. |
| Build frames with `cross(T, up)` | Parallel transport | A twist seam appears in the river the moment a control point moves |
| Use the spline's raw parameter as `u` | Normalised arc length via LUT | The construction front stutters at every control point |
| Add flocking or collision | Neither | Deadlines become unguaranteeable; the bridge can finish with holes |
| Unify flying and seated interaction | Keep them separate | A unified force model is exactly what stalls flying particles |
| Drive UI reveal from React state | CSS + one class | Main-thread re-render at the busiest moment; also loses the reduced-motion media query |
| Update the scene inside the pointer handler | Store, consume once per frame | 1000 Hz mice waste 90%+ of the work |
| Change terrain LOD at runtime | Init only | Particles detach from a surface that no longer exists |
| Duplicate a constant outside `config.ts` | One source of truth | Two values diverge silently |

---

## 39.7 Performance

| Don't | Do | Because |
|---|---|---|
| Measure tier during Phase 0 | Measure in Phase 2 | Phase 0 is nearly free. Every device passes, then stutters where it matters. |
| Change tier during Phases 3–4 | Queue for Phase 5 | Particles pop out of a structure that should be gaining them |
| Use symmetric up/down thresholds | 1 window down, 3 windows up | Tier oscillation is more visible than the lower tier |
| Optimise particle count first | Optimise size and DPR | Those are quadratic; count is linear |
| Raise particle size for 4K | Cap at 2.9px | 4px is a 1.9× fill increase for a barely perceptible gain |
| Leave DPR uncapped | Cap per tier | DPR 3 is 9× the fill of DPR 1 |
| Omit the `discard` | Discard transparent corners | 36% wasted fill on the most expensive pass |
| Skip shader warm-up | Warm during init | A 200–400ms stall at `T+2.8` when trails first render |
| Optimise draw calls, triangles, or bundle size | Nothing | The scene is fill-bound. Everything else is not the bottleneck. |
| Measure the mean frame time | Measure P95 | Spiky frames pass a check a human would fail instantly |

---

## 39.8 Interaction

| Don't | Do | Because |
|---|---|---|
| Put a time term in the field equation | Distance only | **D-001.** The reaction decays under a stationary cursor and reads as a flicker. |
| Use a fixed animation envelope | Distance-driven state | Same |
| Make rise and return symmetric | 0.34s / 1.40s | Symmetric reads as a weightless field effect, not as matter |
| Let the spring overshoot | `damping: 0.86` | Bouncing particles read as jelly |
| Let the ripple re-fire | `rearmRequiresExit` | Continuous rings read as noise |
| Use a fixed cursor depth plane | Nearest point on the bridge | The same screen position behaves differently along the bridge |
| Let dormant particles respond | They are ground | Pre-empts the awakening |
| Enable dolly before `T+12.400` | Gate it | A viewer can scatter a half-built bridge or break the completion pulse |
| Drive parallax from the touch point | Orientation or nothing | The finger already controls dispersion; both become imprecise |
| Show a cursor glow or sprite | Nothing | The cursor's presence is shown by what the bridge does |
| Change colour on interaction | Position only | Breaks the single-hue discipline and the ratio |

---

## 39.9 UI and copy

| Don't | Do | Because |
|---|---|---|
| Show UI during the build | Reveal at `T+12.400` | Text competes with a 12-second build; neither wins |
| Reveal the headline as a block | Line by line, 200ms apart | Blocks are *seen*; staggered lines are *read* |
| Loosen headline line-height | 1.0 | The near-collision of descender and ascender is characteristic |
| Make the CTA a pill | 10px radius | A pill is a friendlier register than the reference |
| Turn footer items into links | `<span>` | `SPEED` and `YOU` are not pages. Styling a non-link as a link is a usability lie. |
| Hard-code uppercase in HTML | `text-transform` in CSS | Some screen readers spell it out letter by letter |
| Omit `lang="az"` | Set it | Azerbaijani read with English phonetics is unintelligible |
| Ship a Latin-only font subset | Include Latin Extended-A | `ı` renders as `.notdef` — invisible when testing in English |
| Add `aria-label` to the canvas | `aria-hidden` | Announces decoration as content |
| Make the countdown a live region | `aria-live="off"` | An announcement every second, forever |
| Force the countdown ring onto mobile | Use a row | 340px does not fit; 120px is illegible |
| Add a second CTA | One action | |
| Add a scroll indicator | Nothing to scroll to | |

---

## 39.10 Process

| Don't | Do | Because |
|---|---|---|
| Rush M1 (the valley) | Freeze it before M3 | Reworking terrain later invalidates every seed and every capture |
| Build particles before the bridge is right | M2 before M3 | If the bridge does not look right standing still, choreography will not rescue it |
| Defer `prefers-reduced-motion` | Build it in M7 | It is an accessibility failure, not a feature gap |
| Defer the corridor carve | M1 | Retrofitting invalidates all seeds |
| Defer deterministic seeding | M1 | Every visual check depends on it |
| Defer `ticker.seek()` | M4 | Without it there is no capture tooling and no verification at all |
| Make a gate advisory | All ten block | An advisory check is not a check |
| Reject an idea without logging it | Add to doc 40 | An unrecorded rejection gets re-proposed within a month |

---

## 39.11 Words we do not use

If a proposal is best described by one of these, it is out of scope **by
definition**, regardless of execution quality.

| Word | Why |
|---|---|
| **Wireframe** | Implies drawn edges between points. Ours is points only. |
| **Hologram** | Implies scan lines, flicker, blue-cyan. Wrong genre. |
| **Cyberpunk** | Explicitly rejected. Neon on black is not automatically cyberpunk; the difference is restraint. |
| **Glitch** | No digital artefacting. Texture comes from grain and bloom, not corruption. |
| **Matrix / data stream** | The river is light, not characters or code. |
| **HUD** | Implies a machine observing. There is no external agent. |
| **Explosion / burst** | Every motion is purposeful travel toward a destination. |
| **Dissolve** | The bridge never fades. In rewind it *disassembles* — slower, structural. |
| **Grid floor** | Instant 1982. |

---

## 39.12 The two tests

When a proposal does not obviously fall under any entry above:

> **1 · Does it make the transformation more legible, or the frame more
> impressive?**
> The first is always right. The second is almost always wrong.

> **2 · Would this still look right in five years?**
> *"Something new is taking shape"* would. *"AI-powered next-generation
> platform"* would not. The same test applies to visuals.

---

**Next:** [`40_decision_log.md`](40_decision_log.md) — what we tried and
rejected.
