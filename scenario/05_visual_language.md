# 05 — VISUAL LANGUAGE

**What is allowed on screen, what is forbidden, and what outranks what.**

---

## 5.1 The priority stack

```
1. WORLD          the valley, mountains, sense of place
2. ATMOSPHERE     haze, fog, depth, the quality of the darkness
3. BRIDGE         the structure
4. PARTICLES      the individual points
5. UI             the text
```

Read it as a conflict-resolution rule: **when two elements compete, the higher
one wins.**

This ordering was inherited from the original brief and it is correct. It is
also the least intuitive thing in the pack, so §5.2 works through what it
actually costs.

---

## 5.2 The stack, applied

Real decisions this ordering has already made.

| Decision | Conflict | Winner |
|---|---|---|
| Camera FOV 38° — wide enough to hold the valley rather than tight on the bridge | World vs Bridge | **World** |
| Swarm lights exist despite costing five dynamic lights of performance, and they light *only terrain* | World vs Particles | **World** |
| The bridge runs off both edges of frame instead of sitting neatly inside it | World vs Bridge | **World** |
| Phase 0 exists — 1.2s of place and nothing else | World vs everything | **World** |
| Bloom capped at 0.85 in Phase 5 even though more makes the bridge more impressive | Atmosphere vs Bridge | **Atmosphere** |
| Fog is strong enough to eat the far end of the bridge | Atmosphere vs Bridge | **Atmosphere** |
| Particles never occlude one another (`depthWrite: false`) — the structure reads as one mass, not as sorted dots | Bridge vs Particles | **Bridge** |
| Particle size is capped at 2.9px even though larger reads better on 4K | Bridge vs Particles | **Bridge** |
| UI appears only after the scene finishes | World vs UI | **World** |
| The left 45% of the frame is deliberately dark and structurally uninteresting | UI vs World — *see below* | **UI** |

### The one place UI wins

The text scrim.

`POSTFX.textScrim` darkens the left 52% of the frame to 86% black. It damages
the world — the left third of the valley is permanently underlit and its terrain
detail is buried.

It wins anyway, because **legibility and accessibility outrank the entire
stack.** There is no negotiation on contrast. A beautiful frame with unreadable
text is a failed page.

This is the only override, and it is stated explicitly so nobody has to
re-derive it.

---

## 5.3 What is allowed on screen

The complete list. Anything not on it needs a decision-log entry.

### In the 3D scene

| Element | Notes |
|---|---|
| Terrain mesh | Heightfield, near-black, rim-lit |
| Framing ridges | Three, placed compositionally |
| Sky gradient | Vertical, near-black to very dark green |
| Nebula haze | Upper right, low opacity, drifting |
| Stars | Sparse micro-points |
| Fog | Linear, sky-tinted |
| Mist plane | Valley floor, non-reflective |
| Particles | The only moving objects |
| Particle trails | Accumulation buffer, flight states only |
| Ground glow | Soft additive decal beneath the bridge |
| Swarm lights | Five, capped |

### In the UI layer

| Element | Notes |
|---|---|
| Logo (mark + wordmark) | |
| Eyebrow | Wide-tracked uppercase |
| Headline | Three lines, third in lime |
| Sub-headline | One lime word |
| CTA button | Outlined, bell + arrow |
| Social icons | Three circles, hairline borders |
| Countdown ring + 2×2 grid | |
| Footer row + copyright | |
| Text scrim | Gradient overlay |

### Post-processing

| Effect | Value |
|---|---|
| Bloom | Animated 0.30 → 1.15 → 0.85 |
| Vignette | 0.34 |
| Film grain | 0.035, animated |
| Chromatic aberration | 0.0012 |

**That is everything.** Twenty-seven elements. If a build contains a
twenty-eighth, it needs justifying.

---

## 5.4 What is forbidden

Each entry names *why*, because a ban with no reason gets overturned by the next
person with a good argument.

### Forbidden in the scene

| Forbidden | Why |
|---|---|
| **A second accent colour** | One hue is the entire discipline. Two makes it generic. |
| **Solid bridge geometry** | Law 3. The bridge is never fully matter. |
| **Wireframe lines between particles** | Turns a point cloud into a mesh. Also implies connections that do not exist. |
| **Grid floors** | Instant 1982. Not timeless. |
| **Scan lines, HUD frames, targeting reticles** | Implies a machine observing. There is no external agent in this story. |
| **Lens flares** | Implies a physical camera and a light source. There is no sun. |
| **Visible emitter or source point** | The particles were always here. A source point makes them delivered. |
| **Explosions or radial bursts** | Every motion in this scene is purposeful travel toward a destination. |
| **Reflections / water** | The valley floor is mist, not water. Reflections double the cost and imply a lake. |
| **God rays / volumetric shafts** | No light source to shaft from. Also very expensive. |
| **Text or symbols inside the particle stream** | This is not the Matrix. The river is light, not data. |
| **Any second structure** | One bridge. A skyline, a city, a second span all dilute the metaphor. |
| **Visible mouse-follow object** | No cursor glow, no orbiting sprite. The cursor's presence is shown by what the bridge does, not by an object. |

### Forbidden in the UI

| Forbidden | Why |
|---|---|
| **Glitch / typewriter / scramble text effects** | Cheap. Also delays legibility. |
| **Anything in the lower-left void** (`y 62.5% – 93%`) | That space is the bridge's approach. See `07` §7.4. |
| **A second CTA** | One action. |
| **Scroll indicators** | There is nothing to scroll to. |
| **Modal overlays on load** | Cookie banners aside, nothing may cover the scene. |
| **Drop shadows on text** | The scrim does that job. Shadows read as pasted-on. |
| **Rounded-pill CTA** | The reference is a soft rounded rect (~10–12px). A pill is a different, friendlier register. |

---

## 5.5 Motion vocabulary

The scene has exactly **four kinds of motion**. Anything that is not one of
these is out of vocabulary.

### 1 · Travel

Purposeful movement from a place toward a destination.

Particles lifting, gliding, approaching, returning. Always has a target. Always
completes.

> **Never:** wandering, orbiting, milling, drifting without destination.

### 2 · Settle

Arriving and coming to rest. Deceleration, the snap, the spring return.

Characterised by `easeOut` curves — fast approach, decisive stop.

### 3 · Breathe

Small, permanent, bounded, phase-scattered. Idle motion that proves the scene is
live.

`±0.9u`, `0.21 Hz`. Never synchronised.

> **Never:** growing amplitude, unison, or anything that could be described as a
> pulse.

### 4 · Drift

Very slow, imperceptible, atmospheric. Nebula movement, camera idle.

Measured in units per *second*, not per frame. Never noticed while it happens;
only noticed by its absence.

### Explicitly not in the vocabulary

| Motion | Why it is out |
|---|---|
| **Bounce / overshoot** | Reads as playful and as low-mass. Springs are damped to avoid it. |
| **Pulse / throb** | The scene gets exactly one pulse, at completion. |
| **Shake / jitter as an effect** | Jitter exists as *randomisation of timing*, never as visible shaking. |
| **Spin** | The barrel roll is a helix along a path, not rotation in place. |
| **Snap-to-grid / stepped motion** | Everything is continuous. |
| **Parallax scrolling** | There is no scroll. |

---

## 5.6 The density principle

The scene's most useful compositional tool, and the reason it works with only
one colour.

> **Brightness comes from density, not from brightness.**

Particles use additive blending with `depthWrite: false`. Overlapping particles
sum. So:

| Region | Particle density | Reads as |
|---|---|---|
| Tower legs | Very high | Solid bars of light |
| Cable curves | High | Continuous lines |
| Deck surface | Medium | A luminous plane |
| Hangers | Medium, thin | Fine lines |
| River fringe | Low | Individual sparks |
| Dormant ground | Very low | Texture |

**Nothing in this list is achieved by changing a colour or an intensity value.**
They are all the same particle, at the same brightness, in different amounts.

### Consequences

**Detail is bought with particles, not with materials.** If the hangers do not
read, the answer is more particles allocated to hangers — not a brighter hanger
colour. See `BRIDGE` target distribution in
[`36_CONFIGURATION.md`](36_CONFIGURATION.md) §36.5.

**Degradation is graceful and predictable.** Lowering the particle count thins
everything uniformly. The bridge does not lose *features*; it loses *solidity*,
in the order: hangers → railing → cables → deck → towers.

**Overdraw is the performance limit, not particle count.** Dense regions write
the same pixels many times. Doubling particle size quadruples the cost of the
towers. See [`34_performance_budget.md`](34_performance_budget.md).

---

## 5.7 Depth cues

The scene is very dark and single-hued, so it has fewer depth cues than a normal
3D image. Five carry the whole load. All five must be present.

| Cue | Mechanism | If missing |
|---|---|---|
| **Fog** | Linear, 420u → 2100u, sky-tinted | Far and near read at the same distance; the valley flattens |
| **Size attenuation** | Particles shrink with distance (`sizeAttenuation: 320`) | The river becomes a flat sheet of dots |
| **Occlusion** | Terrain hides particles behind it (`depthTest: true`) | Particles float over mountains; depth collapses |
| **Parallax** | Near ridges move more than far ones under camera motion | The scene reads as a painted backdrop |
| **Density gradient** | Distant regions are visually denser (compressed by perspective) | Free, but do not fight it |

> **Trap — the occlusion one.** `depthWrite: false` and `depthTest: true` look
> contradictory and someone will "fix" it by turning both off. That breaks
> terrain occlusion, and the bridge starts drawing over the mountain in front of
> it. Both settings are correct and they do different jobs:
> **test** = "can terrain hide me?" (yes), **write** = "can I hide other
> particles?" (no).

---

## 5.8 Composition rules

Full measurements in [`07_reference_frame_analysis.md`](07_reference_frame_analysis.md).
The principles:

### The alignment axis

**Every left-column element starts at `x = 5.3%`.** No exceptions. Logo,
eyebrow, all three headline lines, sub-headline, CTA, socials, footer.

A single hard vertical edge is what makes the left side feel composed rather
than stacked.

### The two voids

| Void | Extent | Function |
|---|---|---|
| Upper | `y 9.6% → 19.5%` | Breathing room. Premium comes from restraint. |
| **Lower** | `y 62.5% → 93.0%` | **The bridge's approach.** 30.5% of frame height, no UI. |

The lower void is the most valuable space on the page and the most frequently
attacked in review. Protect it.

### Asymmetric split

Content left, world right. The frame is not balanced; it is **weighted**, with
the headline block on the left counterweighted by the main tower on the right.

```
     TEXT MASS                    TOWER MASS
     x 5–40%                      x 60–63%
     y 19–63%                     y 33–73%
        ██████                        ▲
        ██████            ←→          █
        ██████                        █
```

If the main tower drifts outside `x 55% – 68%`, the composition unbalances. This
is a framing constraint on the camera, listed in
[`25_camera.md`](25_camera.md).

### The countdown intrudes deliberately

The ring sits at `x 74.5% – 96.5%` — inside the immersive zone, over the scene.
It is the only UI element that does. That intrusion is what stops the layout
from being two separate panels.

---

## 5.9 Typography rules

| Rule | Value |
|---|---|
| One family | Figtree Variable |
| Weights used | 400, 500, 700 — **three, no more** |
| Headline leading | 0.98–1.02. Extremely tight. |
| Headline tracking | ~ −0.02em |
| Eyebrow tracking | **~0.35em** — the signature |
| Label tracking | 0.12–0.18em |
| Body tracking | 0 |
| Case | Uppercase only for eyebrow, countdown labels, footer |
| Alignment | Left, always. Right only for the copyright. |
| **Never** | Italic, underline, justified text, letter-spaced body copy |

**The tracking contrast is the typographic idea.** Very tight headline against
very loose eyebrow and labels. Nothing sits in between. That gap is what makes
the type feel designed rather than defaulted.

---

## 5.10 The hierarchy of restraint

When something needs to be more prominent, escalate in this order. Stop as soon
as it works.

```
1. Change its POSITION        (move it into a void, or onto the alignment axis)
2. Change its SIZE            (scale within the existing type ramp)
3. Change its DENSITY         (more particles, for scene elements)
4. Change its WEIGHT          (400 → 500 → 700)
5. Change its COLOUR          (grey → white, or white → lime)
6. Change its BRIGHTNESS      (last resort)
```

**Never start at 6.** Brightness is the loudest and cheapest lever, it is the
one that breaks the 85/10/5 ratio, and it is the one everyone reaches for first.

If a build has drifted bright, the fix is almost always to walk back up this
list and solve the problem at step 1 or 2 instead.

---

## 5.11 The single-colour discipline

The scene uses **one accent hue**. Everything lime in the frame — the logo mark,
the headline's third line, one word in the sub-headline, the CTA, the countdown
ring, one countdown number, the footer dots, every particle, every glow — is the
same family:

```
--lime-deep     #5FD800    green-600
--lime          #7CFC00    green-500 — the brand
--lime-bright   #A6FD3F    green-400 — highlights, hot particles
--lime-core     #D9FF9C    hottest cores only
```

Four values of one hue, three of them straight from the Claradix Tailwind
palette. **No second hue exists anywhere in the design** — with one exception:
**red, on form errors, and nowhere else.** An error state that is lime-on-black
is not an error state, and errors signalled by colour alone fail accessibility
regardless. See [`35_accessibility.md`](35_accessibility.md) §35.7.

> **Why this is the whole game:** neon-on-black is generic. Neon-on-black with
> *one colour and 85% darkness* is disciplined. The difference between this page
> and a hundred others is not the green; it is that there is nothing else.
>
> The first proposal to add a second accent — a cool blue for the countdown, a
> warm amber for the CTA — is the moment the design becomes ordinary. It will be
> proposed. Refuse it, and log the refusal.

---

## 5.12 Checklist

- [ ] Priority stack is respected: World > Atmosphere > Bridge > Particles > UI.
- [ ] The only override is legibility, via the text scrim.
- [ ] Nothing on screen is outside the allowed list in §5.3.
- [ ] Nothing on the forbidden list in §5.4 appears.
- [ ] All motion belongs to one of the four types: travel, settle, breathe,
      drift.
- [ ] No bounce, no throb, no spin-in-place, no stepped motion.
- [ ] Brightness variation comes from **density**, not from per-element
      intensity.
- [ ] All five depth cues are active — especially terrain occlusion.
- [ ] `depthTest: true`, `depthWrite: false`. Both.
- [ ] Every left-column element starts at `x = 5.3%`.
- [ ] The lower void (`y 62.5% – 93%`) contains no UI.
- [ ] Main tower sits within `x 55% – 68%`.
- [ ] Three type weights only.
- [ ] Tracking contrast is extreme — tight headline, loose eyebrow.
- [ ] **Exactly one accent hue** in the entire design.

---

**Next:** [`06_art_direction.md`](06_art_direction.md) — the exact palette and
glow character.
