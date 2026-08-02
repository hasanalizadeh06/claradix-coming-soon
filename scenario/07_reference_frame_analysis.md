# 07 — REFERENCE FRAME ANALYSIS

**The target final frame, measured.**

---

## 7.1 What this document is

There is exactly **one** authored image of this scene: a still of what it looks
like when everything is finished — the bridge complete, the text revealed, the
scene at rest.

That image is the **reference frame**. It is the only piece of ground truth in
the entire project that is not words. Everything in this pack either describes
how the scene arrives at this frame, or describes what happens after it.

This document measures that frame. Not "roughly" — to the percent, so that a
build can be compared against it numerically rather than by eye.

**Source:** `assets-src/backdrop-source.png`
**Reference resolution:** `1536 × 1024` (3:2)

> **Important:** the reference frame is a *composited design*, not a screenshot
> of a working build. Some elements in it are painted rather than simulated. This
> document notes every place where the reference and the buildable scene must
> differ, and why. See §7.11.

---

## 7.2 Coordinate convention

All positions are **percentages of the viewport**, measured from the **top-left
corner**.

```
(0%, 0%)                                          (100%, 0%)
    ┌─────────────────────────────────────────────────┐
    │                                                 │
    │                                                 │
    │              x increases →                      │
    │              y increases ↓                      │
    │                                                 │
    └─────────────────────────────────────────────────┘
(0%, 100%)                                      (100%, 100%)
```

Where a pixel value is given, it assumes the `1536 × 1024` reference. Convert:

```
px_x = pct_x × 15.36
px_y = pct_y × 10.24
```

---

## 7.3 Whole-frame layout map

```
 0%        20%        40%        60%        80%       100%
  ┌──────────┬──────────┬──────────┬──────────┬──────────┐  0%
  │ ◆ LOGO   │          │          │          │          │
  │          │          │          │   ╭───────────╮     │ 10%
  │          │          │          │  ╱             ╲    │
  │ COMING…  │          │          │ │   23 │ 14    │    │ 20%
  │ ┌──────────────┐    │          │ │  DAYS│HOURS  │    │
  │ │  Something   │    │          │ │──────┼─────  │    │ 30%
  │ │  new is      │    │   ▲      │ │   48 │ 36    │    │
  │ │  taking      │    │  ╱ ╲     │ │  MIN │ SEC   │    │ 40%
  │ │  shape.      │    │ │   │    │  ╲             ╱    │
  │ │  Coming soon │    │ │TWR│    │   ╰───────────╯     │
  │ └──────────────┘    │ │   │    │                     │ 50%
  │  sub-headline       │ │   │    │        ▲            │
  │ ┌────────────┐      │ │   │    │       ╱ ╲           │
  │ │Get notified│      │ │   │    │      │TWR│          │ 60%
  │ └────────────┘      │ │   │    │      │   │          │
  │  ◯ ◯ ◯         ═════╪═╪═══╪════╪══════╪═══╪═════     │ 70%
  │              ╱╱╱    │ └───┘    │      └───┘   ▲▲▲    │
  │           ╱╱╱  ╱╱   │          │           ▲▲▲▲▲▲    │ 80%
  │        ╱╱╱   ╱╱     │          │                     │
  │     ╱╱╱   ╱╱        │          │                     │ 90%
  │  ABOUT US • INNOVATION • …     │  © 2024 Claradix    │
  └──────────┴──────────┴──────────┴──────────┴──────────┘ 100%

  ═══  bridge deck        ╱╱╱  particle light trails
  TWR  tower              ▲▲▲  mountain silhouette
```

**Two zones:**

| Zone | Extent | Contains |
|---|---|---|
| **Content zone** | `x 0% – 45%` | All left-aligned UI. Protected by the scrim. |
| **Immersive zone** | `x 45% – 100%` | The bridge, mountains, sky. Only the countdown ring intrudes. |

The zones overlap visually — the scene runs full-bleed behind everything — but
nothing structurally important in the 3D scene may sit inside the content zone,
because the scrim will bury it.

---

## 7.4 The left content column

Every element in the left column shares one left edge.

> **The alignment axis is `x = 5.3%`** (81px at reference width).
>
> Logo, eyebrow, all three headline lines, sub-headline, CTA button, social
> icons, and the footer link row **all begin at exactly this x**. There are no
> exceptions. Any element that does not start at `5.3%` is a bug.

### Vertical rhythm of the left column

| Element | y (top) | y (bottom) | Height | Gap to next |
|---|---|---|---|---|
| Logo | 5.8% | 9.6% | 3.8% | — |
| *(large void)* | | | | **9.9%** |
| Eyebrow "COMING SOON" | 19.5% | 21.2% | 1.7% | 0.3% |
| Headline line 1 | 21.5% | 28.5% | 7.0% | 0 (leading) |
| Headline line 2 | 28.5% | 35.5% | 7.0% | 0 (leading) |
| Headline line 3 | 35.5% | 42.5% | 7.0% | 1.0% |
| Sub-headline | 43.5% | 46.0% | 2.5% | 4.2% |
| CTA button | 50.2% | 55.4% | 5.2% | 2.1% |
| Social icons | 57.5% | 62.5% | 5.0% | — |
| *(large void)* | | | | **30.5%** |
| Footer | 93.0% | 95.5% | 2.5% | — |

**Two deliberate voids:**

1. `9.6% → 19.5%` — between logo and eyebrow. Nearly 10% of frame height, empty.
   This is what makes the page feel premium rather than crowded.
2. `62.5% → 93.0%` — between the social icons and the footer. **30.5% of the
   frame height with no UI at all.** This is where the bridge lives. It is the
   single most important piece of negative space in the composition.

> **Trap:** the instinct in review is to "use" that lower-left space — add a
> tagline, a scroll hint, a second CTA. Do not. The bridge's approach sweeping
> through empty space is the entire visual argument of the page.

---

## 7.5 Element-by-element measurements

### 7.5.1 Logo

| Property | Value |
|---|---|
| Bounds | `x 5.3% → 14.2%`, `y 5.8% → 9.6%` |
| Mark size | ~32 × 32 px |
| Mark colour | `--lime` `#7CFC00` |
| Mark form | An "S"/spiral glyph with a detached dot at upper-left |
| Wordmark | "Claradix" |
| Wordmark colour | `#FFFFFF` |
| Wordmark size | ~26px |
| Wordmark weight | 700 (Bold) |
| Gap mark→word | ~10px |

### 7.5.2 Eyebrow

| Property | Value |
|---|---|
| Text | `COMING SOON` |
| Bounds | `x 5.3% → 21.8%`, `y 19.5% → 21.2%` |
| Size | ~13px |
| Weight | 400 |
| Case | Uppercase |
| Letter-spacing | **~0.35em** (≈ 5.5px) — extremely wide, this is the signature |
| Colour | `#D8DCDF` |

### 7.5.3 Headline

| Property | Value |
|---|---|
| Bounds | `x 5.3% → 40.0%`, `y 21.5% → 42.5%` |
| Line 1 | `Something new` — `#FFFFFF` |
| Line 2 | `is taking shape.` — `#FFFFFF` |
| Line 3 | `Coming soon` — **`--lime` `#7CFC00`** |
| Size | ~78–82px |
| Weight | 700–800 |
| Line height | **0.98 – 1.02** — extremely tight, lines nearly touch |
| Letter-spacing | ~ −0.02em (slightly negative) |
| Typeface | Geometric sans. Reference shows single-storey `g`, wide circular `o`, tall `x`-height. Project ships **Figtree Variable**. |

**Line-height note:** at ~80px type with 1.0 line-height, the descender of `g`
in "Something" nearly meets the ascender of `k` in "taking". This near-collision
is intentional and characteristic. Do not "fix" it by loosening leading.

### 7.5.4 Sub-headline

| Property | Value |
|---|---|
| Text | `Claradix ideyanızla reallıq arasında körpüdür` |
| Bounds | `x 5.3% → 36.0%`, `y 43.5% → 46.0%` |
| Size | ~19–20px |
| Weight | 400 |
| Base colour | `#D8DCDF` |
| Highlight | The single word **`reallıq`** in `--lime` `#7CFC00` |
| Language | Azerbaijani — see **Q-01** in [`31_content_and_copy.md`](31_content_and_copy.md) |

### 7.5.5 CTA button

| Property | Value |
|---|---|
| Bounds | `x 5.3% → 18.2%`, `y 50.2% → 55.4%` |
| Size | ~200 × 54 px |
| Corner radius | ~10–12px (soft rounded rect — **not** a pill) |
| Fill | Transparent / near-black |
| Border | 1px, `--lime` |
| Text | `Get notified` — `--lime`, ~15px, weight 500 |
| Leading icon | Bell, `--lime`, ~16px, at left padding |
| Trailing icon | Arrow `→`, `--lime`, flush to right padding |
| Padding | left ~18px, right ~18px |
| Icon→text gap | ~12px |

The arrow sits at the **far right of the button**, separated from the text by
flexible space — not immediately after the label. This asymmetry is what gives
the button its width.

### 7.5.6 Social icons

| Property | Value |
|---|---|
| Bounds | `x 5.3% → 17.0%`, `y 57.5% → 62.5%` |
| Count | 3 |
| Order | LinkedIn, Twitter (legacy bird), Instagram |
| Shape | Circle, ~44 × 44 px |
| Gap | ~12px |
| Fill | Transparent |
| Border | 1px `--hairline` `rgba(255,255,255,0.12)` |
| Icon | `#FFFFFF`, ~18px |

### 7.5.7 Countdown

The most structurally complex element.

**Ring:**

| Property | Value |
|---|---|
| Centre | `x 85.5%, y 28.0%` |
| Diameter | ~340px → `x 74.5% → 96.5%`, `y 12.0% → 45.5%` |
| Stroke | 1px, `--lime`, with soft glow |
| Dot A | `x 76.5%, y 15.0%` — ≈ 11 o'clock |
| Dot B | `x 92.0%, y 37.5%` — ≈ 4–5 o'clock |
| Dot size | ~6px, `--lime`, filled |

> The two dots are the **endpoints of an animated progress arc**. In the static
> reference they read as decoration; in the build they are the head and tail of a
> stroke that advances. See [`29_ui_layout.md`](29_ui_layout.md) §"Countdown
> ring".

**Grid (2 × 2, inside the ring):**

| Cell | Number | Colour | Label |
|---|---|---|---|
| Top-left | `23` | **`--lime`** | `DAYS` |
| Top-right | `14` | `#FFFFFF` | `HOURS` |
| Bottom-left | `48` | `#FFFFFF` | `MINUTES` |
| Bottom-right | `36` | `#FFFFFF` | `SECONDS` |

| Property | Value |
|---|---|
| Numeral size | ~44px, weight 700 |
| Label size | ~11px, uppercase, letter-spacing ~0.12em |
| Label colour | `#8D9195` |
| Numeral→label gap | ~6px |
| Column divider | Vertical 1px line at `x ≈ 83.5%`, spanning `y 18% → 36%` |
| Row divider | **None** |

> **Only one column divider, no row divider.** This is easy to get wrong. The
> two rows are separated by whitespace alone.

**Q-04:** only `23 / DAYS` is lime. Implemented as **"the largest non-zero
unit is accented"**, so the accent migrates to HOURS when days reach zero. This
is an interpretation, not a certainty — flagged in
[`31_content_and_copy.md`](31_content_and_copy.md).

### 7.5.8 Footer

**Left row:**

| Property | Value |
|---|---|
| Bounds | `x 5.3% → 45.0%`, `y 93.0% → 95.5%` |
| Items | `ABOUT US` · `INNOVATION` · `SPEED` · `RELIABILITY` · `YOU` |
| Separator | 4px `--lime` dot, centred between items |
| Size | ~11–12px |
| Case | Uppercase |
| Letter-spacing | ~0.18em |
| Colour | `#8D9195` |

**Right:**

| Property | Value |
|---|---|
| Text | `© 2024 Claradix. All rights reserved.` |
| Bounds | `x 78.0% → 94.7%`, `y 93.0% → 95.5%` |
| Alignment | Right |
| Size | ~12px |
| Colour | `#8D9195` |

**Q-03:** the year is stale. **Q-05:** the left items read as brand values, not
navigation; implemented as non-interactive labels.

---

## 7.6 The bridge, as it appears in frame

These are **screen-space observations of the reference image**. The world-space
truth lives in [`19_bridge_anatomy.md`](19_bridge_anatomy.md); this section
exists so a build can be visually compared against the reference.

### Deck path across the frame

The deck enters bottom-left and exits right, rising as it recedes:

| Screen point | Approx. position |
|---|---|
| Entry (off-frame) | `x 0%, y 100%` |
| | `x 20%, y 95%` |
| | `x 35%, y 88%` |
| | `x 50%, y 78%` |
| Passes main tower | `x 62%, y 72%` |
| | `x 75%, y 68%` |
| Passes far tower | `x 80%, y 66%` |
| Exit | `x 92%, y 64%` |

The path is a **continuous S-curve**, not a straight diagonal. It bows outward
(toward the bottom of frame) in the near third, then flattens as it recedes.

### Main tower

| Property | Screen value |
|---|---|
| Horizontal position | `x 60% – 63%` |
| Top | `y 33%` |
| Deck crossing | `y 72%` |
| Base | `y 73%` |
| Apparent height | **40% of frame height** |

It is the tallest and brightest object in the frame, and the compositional
counterweight to the headline block on the left.

### Far tower

| Property | Screen value |
|---|---|
| Horizontal position | `x 79% – 81%` |
| Top | `y 54%` |
| Base | `y 70%` |
| Apparent height | **16% of frame height** |

### Main cable

Classic catenary between the two towers, spanning `x 45% → 79%`, dipping to its
lowest point at approximately `x 68%, y 62%` — just above the deck.

Beyond the towers the cable angles down steeply toward the anchorages.

### Hangers

Fine vertical lines from cable to deck. High spatial frequency — this is the
element that most obviously reveals whether the particle count is sufficient.
At low particle counts the hangers break into disconnected dots and the bridge
loses its readability first here.

### Light trails (the river)

| Property | Value |
|---|---|
| Origin | Bottom-left, `x 0% – 15%`, `y 75% – 100%` |
| Concentration | `x 5% – 55%`, `y 65% – 100%` |
| Direction | Fan, converging up and right toward the deck |
| Character | Slightly divergent (perspective), not parallel |
| Detail | Scattered bright point highlights along the streaks |

> **This is the single most important thing to understand about the reference
> frame:** these trails are **not decoration and not "ground energy lines"**.
> They are the **flight paths of particles still arriving**.
>
> The reference frame is therefore *not* the state at `T+∞`. It is approximately
> the state at **`T+10.5`** — near the end of assembly, when the far bridge is
> complete but particles are still streaming in through the foreground to fill
> the near approach.
>
> At true rest (Phase 5), the trails are gone. See §7.11.

---

## 7.7 The environment

### Mountains

| Mass | Screen extent | Notes |
|---|---|---|
| Right ridge | `x 84% – 100%`, `y 60% – 85%` | Most defined; frames the composition |
| Mid, under bridge | `x 55% – 80%`, `y 68% – 82%` | Very dark, reads as valley wall |
| Left, faint | `x 0% – 20%`, `y 72% – 88%` | Barely separable from background |

Horizon line sits at **`y ≈ 62% – 68%`**, sloping slightly.

Mountains are visible only by their **rim light** — a thin green edge along
ridgelines. Their interiors are essentially pure black.

### Sky and haze

| Property | Value |
|---|---|
| Nebula extent | `x 55% – 100%`, `y 0% – 35%` |
| Character | Very low-opacity green-grey cloud, soft-edged |
| Stars | Sparse micro-points, mostly upper third |
| Base | Near-pure black `#040610` |

### Ground glow

A diffuse pool of green light beneath the bridge, `x 55% – 90%`, `y 72% – 88%`.
Reads as light scattering off the valley floor.

> It is **not water**. It never reflects, never ripples, never mirrors the
> bridge. If a build produces a reflection here, that is a defect.

---

## 7.8 Colour distribution audit

Measured across the reference frame:

| Band | Share | Colours |
|---|---|---|
| Near-black | **~85%** | `#040610` – `#0B0F18` |
| Deep green mid-tones | **~10%** | `#1D3A0A` – `#41750F` |
| Neon accent | **~5%** | `#7CFC00` – `#D9FF9C` |

This is the **85/10/5 rule**. It is enforced by `scripts/palette-check.mjs` and
is a hard acceptance criterion — see
[`38_acceptance_criteria.md`](38_acceptance_criteria.md).

**Tolerance:** ±3 percentage points per band.

> **Why it is a hard rule rather than a guideline:** every individual change in
> this scene pushes toward *more* glow. More bloom looks better in isolation. A
> brighter tower looks better in isolation. Ten such changes, each defensible,
> produce a frame that is 20% neon and looks like every other generic
> "tech/AI/cyber" landing page. The ratio is the thing that keeps it restrained,
> so it is measured mechanically rather than judged by eye.

---

## 7.9 Contrast verification

Text sits over an animated background. Contrast must hold at every frame, not
just this one.

| Element | Foreground | Local background after scrim | Ratio | Required |
|---|---|---|---|---|
| Headline (white) | `#FFFFFF` | ~`#080A06` | **19.6 : 1** | 4.5 |
| Headline line 3 (lime) | `#7CFC00` | ~`#080A06` | **12.8 : 1** | 4.5 |
| Sub-headline | `#D8DCDF` | ~`#0A0C07` | **13.9 : 1** | 4.5 |
| Eyebrow | `#D8DCDF` | ~`#080A06` | **16.4 : 1** | 4.5 |
| CTA text | `#7CFC00` | ~`#0A0D06` | **12.4 : 1** | 4.5 |
| Footer | `#8D9195` | ~`#090B06` | **7.1 : 1** | 4.5 |
| Countdown numerals | `#FFFFFF` | ~`#060804` | **20.1 : 1** | 4.5 |
| Countdown labels | `#8D9195` | ~`#060804` | **5.6 : 1** | 4.5 |

All pass. The tightest margin is the countdown labels at **5.6 : 1** — and they
sit inside the ring in the upper right, where the bridge's glow is closest.
**This is the element to re-measure whenever bloom strength changes.**

---

## 7.10 Aspect-ratio behaviour

The reference is 3:2. Real viewports are not.

| Viewport | Strategy |
|---|---|
| Wider than 3:2 (e.g. 21:9) | Camera FOV held; extra width reveals more sky and more of the far approach. UI stays pinned to the `5.3%` axis. Countdown ring stays right-anchored. |
| Narrower than 3:2 (e.g. 4:3) | Camera pulls back slightly so the main tower stays within `y 30% – 75%`. Bridge is the framing anchor, not the frame edges. |
| Portrait (mobile) | **Layout re-composes.** Countdown moves below the CTA; bridge is re-framed to run corner to corner. Full spec in [`29_ui_layout.md`](29_ui_layout.md). |

**The invariant across all ratios:**

> The main tower top must remain between **`y 28%` and `y 38%`**, and the deck
> must exit the frame at both edges. If either fails, the composition has broken.

---

## 7.11 Where the reference frame and the build must differ

The reference is a composited design. Some of it is not literally achievable,
and some of it should not be. Each difference is listed with its resolution, so
that nobody reports these as bugs.

| # | In the reference | In the build | Why |
|---|---|---|---|
| **R-1** | Light trails are present in the foreground | Trails exist **only during Phases 1–3**. At rest (Phase 5) they are gone. | The trails are flight paths. At rest nothing is flying. The reference captures ~`T+10.5`, not the final state. |
| **R-2** | Bridge appears partly solid at the towers | Bridge is **always** a point cloud | Law 3. The apparent solidity in the reference is dense particles plus bloom — which the build reproduces through density, not through geometry. |
| **R-3** | Hangers read as continuous thin lines | Hangers are dotted lines of particles | Same cause. At `high` tier and above the dots merge visually; below that they visibly separate, which is the expected degradation. |
| **R-4** | Ground glow under the bridge looks like a reflection | No reflection is computed | Reflections would double the fill-rate cost and imply water, which the scene does not have. Achieved with a soft additive ground decal instead. |
| **R-5** | Countdown ring is a complete circle | The ring is a **partial arc** that animates | The two lime dots in the reference are the arc's endpoints. A static full circle would waste the affordance. |
| **R-6** | Mountains are lit from an unclear source | Lit by rim light plus the five swarm lights | Reference is painted; build needs a defensible light model. |
| **R-7** | Trails are perfectly smooth streaks | Trails are a fading accumulation buffer | Per-particle line geometry at 140,000 particles is not affordable. The buffer approach gives the same read. |
| **R-8** | © 2024 | Current year, generated | Q-03. |

---

## 7.12 Numeric comparison procedure

How to check a build against this document mechanically, rather than by eye.

```bash
npm run shoot     # captures the scene at defined timestamps → shots/
npm run fit       # verifies UI element positions against §7.4 / §7.5
npm run palette   # verifies the 85/10/5 distribution against §7.8
npm run compare   # diffs a capture against assets-src/backdrop-source.png
```

**Capture timestamps** used by `shoot.mjs`:

| Label | Time | Verifies |
|---|---|---|
| `dormant` | `T+0.600` | No bridge exists; ground particles visible |
| `awakening` | `T+2.000` | Lift wave in progress |
| `glide` | `T+4.100` | River formed, trails visible |
| `assembly-early` | `T+6.400` | Far end building, near end empty |
| `assembly-late` | `T+10.500` | **Closest match to the reference frame** |
| `complete` | `T+12.400` | Bridge whole, no UI yet |
| `settled` | `T+16.000` | Full UI, no trails |

> `assembly-late` at `T+10.500` is the frame that should be diffed against the
> reference image. Comparing `settled` against the reference will always fail on
> the trails, correctly — see **R-1**.

---

## 7.13 Summary of what must be true

A build matches the reference when all of the following hold:

1. Every left-column element starts at `x = 5.3%`.
2. The two voids (`9.6–19.5%` and `62.5–93.0%`) are empty.
3. Main tower top is at `y 33% ± 3%`; its base at `y 73% ± 2%`.
4. The deck exits both the left and right edges of the frame.
5. Countdown ring centre is at `(85.5%, 28.0%) ± 1%`.
6. Colour distribution is 85/10/5 ± 3 points.
7. All text contrast ratios exceed 4.5 : 1.
8. At `T+16.000`, no light trails are present.
9. At `T+10.500`, light trails occupy the bottom-left fan described in §7.6.
10. The bridge is visibly composed of discrete points at 100% zoom.

---

**Next:** [`08_SCREENPLAY_FULL.md`](08_SCREENPLAY_FULL.md) — the whole scene,
written out.
