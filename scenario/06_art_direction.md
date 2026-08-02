# 06 — ART DIRECTION

**The exact palette, the character of the glow, and the ratio that holds it all
together.**

---

## 6.1 The 85 / 10 / 5 rule

The most important number in this document.

Measured across the final frame, by pixel:

| Band | Share | Tolerance | Colours |
|---|---|---|---|
| **Near-black** | **85%** | ±3 | `#040610` – `#0B0F18` |
| **Deep green mid-tones** | **10%** | ±3 | `#1D3A0A` – `#41750F` |
| **Neon accent** | **5%** | ±3 | `#7CFC00` – `#D9FF9C` |

### It is enforced by a script, not by taste

```bash
npm run palette
```

`scripts/palette-check.mjs` buckets every pixel of a capture by luminance and
hue and asserts the distribution. It is a **hard acceptance criterion** — a
build that fails it does not ship. See
[`38_acceptance_criteria.md`](38_acceptance_criteria.md).

> **Why mechanically and not by eye:**
>
> Every individual change in this scene pushes toward more light. A brighter
> tower looks better in isolation. More bloom looks better in isolation. Warmer
> particles look better in isolation. Each one is defensible.
>
> Ten defensible changes produce a frame that is 20% neon and looks like every
> other tech landing page from the last decade. Taste cannot hold this line
> because taste evaluates changes one at a time. A ratio evaluates the whole.

### Per-capture targets

The 85/10/5 applies to the **settled** frame. Earlier phases are darker by
design — the scene has to have somewhere to go.

| Capture | `T+` | Near-black | Deep green | Accent |
|---|---|---|---|---|
| `dormant` | 0.600 | ~94% | ~5.5% | ~0.5% |
| `awakening` | 2.000 | ~91% | ~7% | ~2% |
| `glide` | 4.100 | ~87% | ~9% | ~4% |
| `assembly-early` | 6.400 | ~87% | ~9% | ~4% |
| `assembly-late` | 10.500 | ~85% | ~10% | ~5% |
| `complete` | 12.400 | ~86% | ~9.5% | ~4.5% |
| **`settled`** | **16.000** | **85%** | **10%** | **5%** |

> If `dormant` already meets 85/10/5, the opening is too bright and the build
> adds nothing.

---

## 6.2 The palette

Mirrored in `src/styles/tokens.css`. Changing one without the other is a bug.

> **Rebased on the real brand.** The values below originally came from eyeballing
> a JPEG of the reference frame. The codebase's `tokens.css` carries the actual
> Claradix Tailwind palette, lifted verbatim from the main site — **green.500 is
> `#7CFC00`**, and the dark ramp is blue-black rather than green-black. A brand
> token beats an estimate from an image. See
> [`40_decision_log.md`](40_decision_log.md) entry **D-017**.

### Darks — the 85%

| Token | Hex | Source | Used for |
|---|---|---|---|
| `--void` | `#040610` | `ink-900` | Page background, deepest black |
| `--ink` | `#070A13` | `ink-800` | Scene clear colour, fog colour |
| `--soil` | `#0B0F18` | `ink-700` | Terrain base albedo |

These three are nearly indistinguishable, and that is intentional. The darks are
not a gradient to be admired; they are the absence against which everything else
is measured.

**They are blue-black, not green-black**, and that turns out to matter: a green
accent sitting on a faintly blue dark is a *complementary* relationship, which is
what makes the lime read as emitted light rather than as a tint of the
background. A green accent on a green dark reads as a monochrome wash.

### Mid-greens — the 10%

| Token | Hex | Used for |
|---|---|---|
| `--moss` | `#1D3A0A` | Deep green mid-tone, release puffs |
| `--rim` | `#41750F` | Terrain rim light |

This band is where the landscape lives. It is the only thing that makes the
mountains readable, and it is the first band to disappear if the swarm lights
are turned down.

Both are new — the brand's dark ramp is blue-black, and terrain lit by a blue
rim would read as ice.

### Accents — the 5%

| Token | Hex | Source | Used for |
|---|---|---|---|
| `--lime` | `#7CFC00` | **`green-500`** | **The brand colour.** Logo, headline line 3, CTA, ring, seated particles |
| `--lime-bright` | `#A6FD3F` | `green-400` | Hover states, gliding particles, swarm light colour |
| `--lime-deep` | `#5FD800` | `green-600` | Deep accent |
| `--lime-core` | `#D9FF9C` | new | Hottest particle cores only — the snap flash, the completion pulse |

**One hue.** See [`05_visual_language.md`](05_visual_language.md) §5.11 — no
second hue exists anywhere in the design, with the single exception of red on
form errors.

### Text

| Token | Hex | Source | Used for |
|---|---|---|---|
| `--white` | `#FFFFFF` | `text-primary` | Headline, countdown numerals, wordmark |
| `--text-dim` | `#D8DCDF` | `text-secondary` | Sub-headline |
| `--text-muted` | `#8D9195` | `text-muted` | Countdown labels, footer |
| `--hairline` | `rgba(255,255,255,0.12)` | `border-subtle` | Social borders, dividers |

> `--text-muted` at **5.6 : 1** is the tightest margin in the design. It is used
> for the countdown labels, which sit in the upper right where the bridge glow is
> closest. **Re-measure this whenever bloom strength changes.**

---

## 6.3 The particle colour ramp

Particles do not have a fixed colour. Their colour is **sampled from a ramp by
their brightness**, so a hot particle is naturally whiter and a cold one is
naturally deeper green.

```ts
PARTICLE_COLOR_RAMP = [
  [0.00, '#16300A'],
  [0.35, '#4AA30C'],
  [0.62, '#7CFC00'],
  [0.85, '#A6FD3F'],
  [1.00, '#D9FF9C'],
]
```

```
brightness  0.00      0.35      0.62      0.85      1.00
            ▓▓▓▓      ▓▓▓▓      ████      ████      ████
          #16300A   #4AA30C   #7CFC00   #A6FD3F   #D9FF9C
            dark      mid       BRAND     bright    near-white
            
            ▲         ▲         ▲         ▲         ▲
         dormant    lifting   gliding  approach   snap /
          (0.17)    (0.55)    (0.92)    (1.00)    pulse
```

### Why a ramp and not a colour

Three things fall out of it for free:

**1 · Temperature reads as energy.** A rising particle is visibly cooler than a
gliding one, without anyone authoring a per-state colour.

**2 · The brand colour lands at the right place.** `--lime` sits at `0.62`,
which is between the seated value (`0.74`) and the lifting value (`0.55`). The
bridge at rest is *slightly* warmer than pure brand lime, which is what makes it
feel lit rather than flat.

**3 · Density produces hue variation.** With additive blending, overlapping
particles sum past 1.0 and clamp toward `--lime-core`. So the densest regions —
tower legs, cable anchors — go near-white **automatically**, purely from
density. Nobody paints a highlight.

> This is the mechanism that makes the reference frame's tower look like it has
> a hot core and cooler edges. It is not a gradient. It is 140,000 identical
> particles overlapping unevenly.

---

## 6.4 Bloom — the character of the glow

Bloom is the visual identity. Without it the scene is a field of hard green
dots; with it, the scene glows. Its *character* matters more than its strength.

```ts
POSTFX.bloom = {
  threshold: 0.62,
  radius: 0.42,
  strengthByPhase: { /* 0.30 → 1.15 → 0.85 */ },
}
```

### Threshold — 0.62

How bright a pixel must be before it glows.

| Value | Result |
|---|---|
| 0.35 | Everything glows, including the terrain rim. Image turns to mush. |
| **0.62** | **Only particles glow. Terrain stays crisp.** |
| 0.85 | Only the very densest cores glow. Scene looks flat and dotty. |

At `0.62`, seated particles (`0.74`) glow, dormant particles (`0.17`) do not,
and the terrain rim (`--rim`, luminance ~0.09) never does. That separation is
what keeps the landscape looking like solid ground next to objects made of light.

### Radius — 0.42

How far the glow spreads.

Tuned so a single isolated particle produces a halo roughly **4× its own
diameter**. Large enough that sparse regions read as glowing points rather than
as pixels; small enough that the bridge's silhouette stays legible.

> **Trap:** larger radius looks more impressive on a still, and destroys the
> hangers. At `radius > 0.6` the fine vertical lines merge into a single
> luminous haze between cable and deck, and the bridge loses its most
> characteristic detail.

### Strength — animated across the scene

| Phase | Strength | Why |
|---|---|---|
| Dormant | **0.30** | The scene must start dark |
| Awakening | 0.46 | Rising with the first light |
| Glide | 0.62 | The river is the hero |
| Assembly | 0.62 → 0.88 | Grows as structure accumulates |
| **Completion** | **1.15** (200ms) | The single brightest moment |
| Living | **0.85** | Settled |

**The bloom is choreographed, not constant.** Most of the scene's sense of
building energy comes from this curve rather than from anything in the geometry.

### The one non-negotiable

> **The completion peak at 1.15 must last exactly 200ms.**

Longer and the frame blows out to white-green, `palette-check` fails at the
`complete` capture, and the moment reads as an explosion rather than as a
signal.

---

## 6.5 Film grain — not optional

```ts
POSTFX.grain = { amount: 0.035, animated: true }
```

Very subtle. **Removing it breaks the scene.**

### Why

85% of the frame sits between `#040610` and `#0B0F18` — a range of about **5
values out of 256** on an 8-bit display. Any gradient across that range
**bands**: the sky develops visible stripes, and the fog's transition to the
horizon becomes a series of steps.

Grain dithers the quantisation. The stripes become noise, and noise at 3.5%
amplitude is invisible while banding at 5 levels is glaring.

> **Trap:** grain is one of the first things cut for performance
> (`PERF.degradation` lists it second). On the low tiers this is accepted —
> those devices are usually phones with dithered panels where banding is less
> visible anyway. But **never remove it on desktop**, and never remove it as an
> aesthetic decision.

**Animated:** the noise pattern changes every frame. Static grain reads as dirt
on the lens; animated grain reads as film.

---

## 6.6 Vignette

```ts
POSTFX.vignette = { strength: 0.34, smoothness: 0.62 }
```

Darkens the corners by up to 34%.

Two jobs: it pulls the eye toward the centre-right where the bridge is, and it
hides the point where the terrain mesh ends and the fog takes over.

At `smoothness: 0.62` the falloff is broad enough that no edge is visible. If a
viewer can identify the vignette as an effect, it is too strong.

---

## 6.7 Chromatic aberration

```ts
POSTFX.chromaticAberration = 0.0012
```

Almost nothing. About **1.8 pixels of separation at the extreme frame corners**,
zero at the centre.

Its only job is to make the bloom feel like it came through glass rather than
out of a compositing program. It should never be identifiable.

> **Set it to 0 if it ever reads as a defect.** It is the first thing cut in
> `PERF.degradation` and nothing depends on it.

---

## 6.8 The text scrim

```ts
POSTFX.textScrim = {
  from: 'rgba(3, 5, 2, 0.86)',
  to:   'rgba(3, 5, 2, 0.00)',
  extent: 0.52,
}
```

A horizontal gradient from 86% opaque black at the left edge to fully
transparent at 52% of viewport width.

### It is a DOM overlay, not a post-process

It must sit **above the canvas and below the UI**. Reasons:

- It must not be affected by bloom
- It must not be captured in the trail buffer
- It must scale with CSS breakpoints, independently of render resolution
- It must be present even if WebGL fails to initialise

### It is active from `T+0.000`

Even though there is no text on it until `T+12.400`.

> If it faded in with the UI, the left third of the frame would visibly darken
> at that moment and a viewer would see a *rectangle* appear — reading as a UI
> panel sliding in, which is exactly wrong for text meant to feel like part of
> the image.
>
> Present throughout, the left side of the valley is simply always darker. Which
> is also good composition: the eye is pushed toward the right, where the bridge
> builds.

---

## 6.9 Lighting character

Full spec in [`20_lighting_design.md`](20_lighting_design.md). The art-direction
summary:

### There is no visible light source

No sun, no moon, no lamp. The sky glows faintly; the particles glow. That is all
the light in the world.

This is why lens flares and god rays are banned — both imply a source, and there
isn't one.

### The terrain is read entirely from rim light

```ts
TERRAIN.material = {
  baseColor: '#0B0F18',
  rimColor: '#41750F',
  rimStrength: 0.34,
  rimPower: 3.2,
}
```

The mountains' interiors are essentially pure black. Their shape comes from a
thin green edge where their silhouette meets the sky.

> This is how hills genuinely look at night, and it is also extremely cheap. The
> terrain needs almost no shading work because almost none of it is lit.

### The swarm lights are the only dynamic light

Five point lights following particle clusters, capped at `intensityMax: 0.35`
with a terrain contribution clamp of `0.18`.

**The direction on restraint:** a viewer should not be able to identify the
moment the mountains became visible. They should only be able to say, afterwards,
that they can see more of the valley than they could at the start.

If the mountains are obviously and evenly lit, the value is too high and the
85/10/5 has already broken.

---

## 6.10 Reference images and what to take from them

The scene's visual family. Named so that "make it more like X" has a shared
vocabulary.

| Reference | Take | Do not take |
|---|---|---|
| Long-exposure night photography of bridges | Light trails as evidence of motion; near-black with sparse highlights | Warm sodium colour; visible light sources |
| Bioluminescence (plankton, fungi) | Cool light emerging from dark organic matter; the sense of a place glowing on its own | Blue-cyan palette; underwater softness |
| Architectural survey point clouds | Structure legible from discrete points; the beauty of density | Grey/technical colour; measurement UI |
| Night-time aerial photography | Sparse light in vast dark; the scale of a valley | City warmth; regular grids |
| Fireflies over a field | The awakening; scattered life rising from ground | Warm yellow; randomness — our particles have purpose |

> **Not references:** Tron, The Matrix, cyberpunk cityscapes, sci-fi HUDs,
> crypto/AI marketing. Named in [`39_do_and_dont.md`](39_do_and_dont.md).

---

## 6.11 Contrast requirements

All text over the animated scene must hold **4.5 : 1** at every frame — not just
in the settled state.

| Element | Ratio (settled) | Margin |
|---|---|---|
| Headline (white) | 19.6 : 1 | Huge |
| Headline line 3 (lime) | 12.8 : 1 | Large |
| Sub-headline | 13.9 : 1 | Large |
| Eyebrow | 16.4 : 1 | Large |
| CTA text | 12.4 : 1 | Large |
| Footer | 7.1 : 1 | Comfortable |
| Countdown numerals | 20.1 : 1 | Huge |
| **Countdown labels** | **5.6 : 1** | **Tightest — watch this one** |

Large text would legally permit 3 : 1. We hold 4.5 : 1 everywhere anyway,
because the background is animated and its local luminance changes.

---

## 6.12 Checklist

- [ ] `settled` capture meets **85 / 10 / 5** within ±3 points.
- [ ] Every capture meets its own per-phase target in §6.1.
- [ ] `dormant` is around 94% near-black — the scene starts genuinely dark.
- [ ] Exactly **one accent hue**. Three values of it, no more.
- [ ] Particle colour comes from the ramp, not from per-state constants.
- [ ] Dense regions go near-white **from density**, with no painted highlights.
- [ ] Bloom threshold 0.62 — terrain rim never glows.
- [ ] Bloom radius 0.42 — hangers stay legible as separate lines.
- [ ] Bloom strength is animated across phases, not constant.
- [ ] Completion peak is 1.15 for exactly 200ms.
- [ ] Film grain is present at 0.035 and **animated**. No banding in the sky.
- [ ] Vignette is not identifiable as an effect.
- [ ] Chromatic aberration is not identifiable at all.
- [ ] Text scrim is a DOM overlay, active from `T+0.000`.
- [ ] No visible light source anywhere in the scene.
- [ ] Terrain shape is read from rim light only.
- [ ] Swarm lighting is not identifiable as a moment.
- [ ] All text contrast ≥ 4.5 : 1, countdown labels re-measured after any bloom
      change.

---

**Next:** [`16_world_map.md`](16_world_map.md) — the space this all happens in.
