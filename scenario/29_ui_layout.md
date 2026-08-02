# 29 — UI LAYOUT

**Every element, every measurement, every breakpoint.**

---

## 29.1 The UI is DOM, not canvas

Every word on this page is a real HTML element layered above the 3D canvas.
Nothing is drawn into WebGL.

| Reason | |
|---|---|
| **Accessibility** | Text drawn into a canvas is invisible to screen readers |
| **SEO** | The prerendered HTML must contain the copy |
| **Selection** | Users expect to be able to select and copy text |
| **Crispness** | DOM text is rendered at full device resolution; canvas text is not |
| **Resilience** | If WebGL fails, the page is still a complete page |

```
┌─────────────────────────────────┐
│  UI layer   (DOM, z-index 3)    │
├─────────────────────────────────┤
│  Text scrim (DOM, z-index 2)    │
├─────────────────────────────────┤
│  Canvas     (WebGL, z-index 1)  │
└─────────────────────────────────┘
```

---

## 29.2 The alignment axis

> **Every left-column element starts at `x = 5.3%`.**

Logo, eyebrow, all three headline lines, sub-headline, CTA button, social
icons, and the footer link row. **No exceptions.**

A single hard vertical edge is what makes the left side read as *composed*
rather than as *stacked*. Any element that does not start at `5.3%` is a bug.

```css
--gutter: 5.3%;   /* 81px at 1536px reference width */
```

`npm run fit` asserts every element's left edge against this value.

---

## 29.3 The vertical rhythm

At the 3:2 reference (`1536 × 1024`):

| Element | y top | y bottom | Height | Gap to next |
|---|---|---|---|---|
| Logo | 5.8% | 9.6% | 3.8% | — |
| *(void)* | | | | **9.9%** |
| Eyebrow | 19.5% | 21.2% | 1.7% | 0.3% |
| Headline 1 | 21.5% | 28.5% | 7.0% | 0 |
| Headline 2 | 28.5% | 35.5% | 7.0% | 0 |
| Headline 3 | 35.5% | 42.5% | 7.0% | 1.0% |
| Sub-headline | 43.5% | 46.0% | 2.5% | 4.2% |
| CTA | 50.2% | 55.4% | 5.2% | 2.1% |
| Socials | 57.5% | 62.5% | 5.0% | — |
| *(void)* | | | | **30.5%** |
| Footer | 93.0% | 95.5% | 2.5% | — |

### The two voids

| Void | Extent | Function |
|---|---|---|
| Upper | `9.6% → 19.5%` | Breathing room. Premium comes from restraint. |
| **Lower** | `62.5% → 93.0%` | **The bridge's approach.** 30.5% of frame height, no UI. |

> **The lower void is the most valuable space on the page and the most
> frequently attacked in review.** It is where the bridge sweeps in from the
> bottom-left. Something will be proposed for it — a tagline, a scroll hint, a
> second CTA. Refuse it. The bridge's approach through empty space is the visual
> argument of the page.

---

## 29.4 Element specifications

### 29.4.1 Logo

| Property | Value |
|---|---|
| Bounds | `x 5.3% → 14.2%`, `y 5.8% → 9.6%` |
| Mark | 32 × 32 px, `--lime` |
| Wordmark | "Claradix", `#FFFFFF`, 26px, weight 700 |
| Gap | 10px |
| Link | Home (currently `#`, non-navigating) |

### 29.4.2 Eyebrow

| Property | Value |
|---|---|
| Text | `COMING SOON` |
| Bounds | `x 5.3% → 21.8%`, `y 19.5% → 21.2%` |
| Size | 13px |
| Weight | 400 |
| Case | Uppercase |
| **Letter-spacing** | **0.35em** — the signature |
| Colour | `#D8DCDF` |

### 29.4.3 Headline

| Property | Value |
|---|---|
| Bounds | `x 5.3% → 40.0%`, `y 21.5% → 42.5%` |
| Line 1 | `Something new` — `#FFFFFF` |
| Line 2 | `is taking shape.` — `#FFFFFF` |
| Line 3 | `Coming soon` — **`--lime`** |
| Size | `clamp(2.6rem, 5.3vw, 5.1rem)` — ~80px at reference |
| Weight | 700 |
| **Line height** | **1.0** |
| Letter-spacing | −0.02em |
| Family | Figtree Variable |

**Each line is its own element** — required for the line-by-line reveal in
[`30_ui_reveal_choreography.md`](30_ui_reveal_choreography.md).

```html
<h1 class="headline">
  <span class="line" data-reveal="headline-line-1">Something new</span>
  <span class="line" data-reveal="headline-line-2">is taking shape.</span>
  <span class="line accent" data-reveal="headline-line-3">Coming soon</span>
</h1>
```

> **Line height 1.0 is not a mistake.** At ~80px the descender of `g` in
> "Something" nearly meets the ascender of `k` in "taking". This near-collision
> is characteristic. Do not loosen it.

### 29.4.4 Sub-headline

| Property | Value |
|---|---|
| Text | `Claradix ideyanızla reallıq arasında körpüdür` |
| Bounds | `x 5.3% → 36.0%`, `y 43.5% → 46.0%` |
| Size | `clamp(1rem, 1.3vw, 1.25rem)` — ~19px |
| Weight | 400 |
| Colour | `#D8DCDF` |
| Highlight | `reallıq` in `--lime` |

```html
<p class="sub">Claradix ideyanızla <span class="accent">reallıq</span> arasında körpüdür</p>
```

Language question **Q-01** in [`31_content_and_copy.md`](31_content_and_copy.md).

### 29.4.5 CTA button

| Property | Value |
|---|---|
| Bounds | `x 5.3% → 18.2%`, `y 50.2% → 55.4%` |
| Size | 200 × 54 px |
| Radius | **10px** — a soft rounded rect, **not** a pill |
| Fill | `transparent` |
| Border | 1px `--lime` |
| Label | `Get notified` — `--lime`, 15px, weight 500 |
| Leading icon | Bell, 16px, `--lime` |
| Trailing icon | Arrow `→`, 16px, `--lime`, flush right |
| Padding | 18px both sides |
| Icon→label gap | 12px |

The arrow sits at the **far right**, separated from the label by flexible space
— not immediately after it. That asymmetry is what gives the button its width.

**States:**

| State | Change |
|---|---|
| Hover | Border → `--lime-bright`; arrow `translateX(4px)`; background `rgba(163,230,53,0.06)` |
| Focus-visible | 2px `--lime` outline, 2px offset |
| Active | `scale(0.985)` |
| Transition | 180ms `ease-out` |

### 29.4.6 Social icons

| Property | Value |
|---|---|
| Bounds | `x 5.3% → 17.0%`, `y 57.5% → 62.5%` |
| Count | 3 — LinkedIn, Twitter (legacy bird), Instagram |
| Shape | Circle, 44 × 44 px |
| Gap | 12px |
| Border | 1px `--hairline` |
| Icon | `#FFFFFF`, 18px |
| Hover | Border → `--lime`; icon → `--lime` |
| Target size | 44px meets the WCAG minimum exactly |

### 29.4.7 Countdown

**Ring:**

| Property | Value |
|---|---|
| Centre | `x 85.5%, y 28.0%` |
| Diameter | 340px |
| Bounds | `x 74.5% → 96.5%`, `y 12.0% → 45.5%` |
| Stroke | 1px `--lime`, `drop-shadow(0 0 6px rgba(163,230,53,0.4))` |

**The ring is an animated arc, not a static circle.**

The two lime dots in the reference frame at ~11 o'clock and ~4–5 o'clock are the
**endpoints of a progress arc**.

```
progress = 1 − (timeRemaining / totalCampaignDuration)
arcStart = −100°     (fixed, ≈11 o'clock)
arcEnd   = arcStart + progress × 340°
```

| Element | Rendering |
|---|---|
| Full circle track | `rgba(163,230,53,0.18)`, 1px |
| Progress arc | `--lime`, 1px, from `arcStart` to `arcEnd` |
| Head dot | 6px filled, at `arcEnd` |
| Tail dot | 6px filled, at `arcStart` |

Implemented as an inline SVG with `stroke-dasharray` — no canvas, no library.

**Grid (2 × 2):**

| Cell | Value | Label |
|---|---|---|
| Top-left | days | `DAYS` |
| Top-right | hours | `HOURS` |
| Bottom-left | minutes | `MINUTES` |
| Bottom-right | seconds | `SECONDS` |

| Property | Value |
|---|---|
| Numeral | 44px, weight 700, `#FFFFFF` |
| **Accent** | The **largest non-zero unit** is `--lime` |
| Label | 11px, uppercase, `0.12em`, `#8D9195` |
| Numeral→label gap | 6px |
| **Column divider** | 1px at `x ≈ 83.5%`, spanning `y 18% → 36%` |
| **Row divider** | **None** |

> **One divider, not two.** The two rows are separated by whitespace alone. Easy
> to get wrong.

**Q-04:** the reference shows only `23 / DAYS` in lime. Implemented as
*largest non-zero unit*, so the accent migrates to HOURS when days reach zero.
An interpretation — flagged in [`31_content_and_copy.md`](31_content_and_copy.md).

**Tick behaviour:** numerals update once per second with **no animation**. A
flip or fade at 1 Hz becomes the most distracting thing on a page whose whole
argument is calm.

### 29.4.8 Footer

**Left:**

| Property | Value |
|---|---|
| Bounds | `x 5.3% → 45.0%`, `y 93.0% → 95.5%` |
| Items | `ABOUT US` · `INNOVATION` · `SPEED` · `RELIABILITY` · `YOU` |
| Separator | 4px `--lime` dot |
| Size | 11px, uppercase, `0.18em`, `#8D9195` |
| **Interactive** | **No** — see Q-05 |

**Right:**

| Property | Value |
|---|---|
| Text | `© {currentYear} Claradix. All rights reserved.` |
| Bounds | `x 78.0% → 94.7%`, `y 93.0% → 95.5%` |
| Size | 12px, `#8D9195`, right-aligned |

Year is generated. **Q-03** in the reference is stale.

---

## 29.5 The text scrim

```css
.scrim {
  position: fixed; inset: 0; z-index: 2; pointer-events: none;
  background: linear-gradient(
    to right,
    rgba(3, 5, 2, 0.86) 0%,
    rgba(3, 5, 2, 0.00) 52%
  );
}
```

**Active from `T+0.000`.** Not faded in with the UI — see
[`06_art_direction.md`](06_art_direction.md) §6.8.

`pointer-events: none` so it never blocks cursor interaction with the scene
beneath it.

---

## 29.6 Breakpoints

Four layouts.

| Name | Width | Layout |
|---|---|---|
| `wide` | ≥ 1440px | Reference |
| `desktop` | 1024 – 1439px | Reference, scaled |
| `tablet` | 768 – 1023px | Countdown relocates |
| `mobile` | < 768px | **Re-composed** |

### `wide` and `desktop`

Identical structure. Type scales with `clamp()`; the `5.3%` gutter is
proportional.

Countdown ring diameter: `clamp(240px, 22vw, 340px)`.

### `tablet` (768 – 1023px)

Portrait-ish proportions squeeze the right side.

| Change | |
|---|---|
| Countdown | Moves to **below the socials**, `y 68%`, left-aligned to the gutter |
| Ring diameter | 260px |
| Headline | `clamp(2.2rem, 6vw, 3.4rem)` |
| Scrim | Extends to 68% |
| Camera | Pulls back per `25_camera.md` §25.6 |

The countdown leaving the immersive zone is what preserves F5 (ring must not
overlap the far tower) once the frame narrows.

### `mobile` (< 768px)

**A re-composition, not a crop.**

```
┌─────────────────────┐  0%
│ ◆ Claradix          │  6%
│                     │
│ COMING SOON         │  22%
│ Something new       │
│ is taking shape.    │  26–44%
│ Coming soon         │
│                     │
│ Claradix ideyanız…  │  47%
│                     │
│ ┌─────────────────┐ │
│ │ Get notified  → │ │  53–59%
│ └─────────────────┘ │
│                     │
│  ◯  ◯  ◯           │  62–67%
│                     │
│  ╭───────────────╮  │
│  │ 23 │ 14       │  │  70–86%
│  │ 48 │ 36       │  │
│  ╰───────────────╯  │
│                     │
│      ╱╱╱▲╱╱╱        │  ← bridge, corner to corner
│                     │
│ ABOUT US • INNOV…   │  94%
└─────────────────────┘ 100%
```

| Change | Value |
|---|---|
| Gutter | `6.5%` (24px at 375px) |
| Headline | `clamp(1.9rem, 9vw, 2.6rem)`, line-height 1.05 |
| Eyebrow tracking | 0.28em (0.35em is too wide at small sizes) |
| CTA | **Full width** minus gutters; 52px tall |
| Socials | Centred, 48px circles |
| Countdown | Below socials, **ring becomes a horizontal 4-column row** |
| Footer | Two lines: items wrap, copyright below |
| Scrim | **Vertical** — dark at top, clear at bottom |
| Camera | FOV 46°, corner-to-corner framing |

**The countdown ring is dropped on mobile.** A 340px circle does not fit, and a
120px one is illegible. The four units become a simple row with the same
typographic treatment and the same accent rule.

> The ring is the element most likely to be forced onto mobile in review. It
> should not be. Its purpose is to intrude on the immersive zone, and on mobile
> there is no immersive zone to intrude on.

---

## 29.7 Type scale

| Element | Mobile | Tablet | Desktop | Wide |
|---|---|---|---|---|
| Headline | 30–42px | 40–54px | 58–72px | 80px |
| Sub | 15px | 17px | 18px | 19px |
| Eyebrow | 11px | 12px | 13px | 13px |
| CTA label | 15px | 15px | 15px | 15px |
| Countdown numeral | 32px | 38px | 40px | 44px |
| Countdown label | 10px | 10px | 11px | 11px |
| Footer | 10px | 11px | 11px | 12px |

CTA label stays 15px at every size — button text below 15px is uncomfortable to
read and the button is the page's only action.

---

## 29.8 Fonts

```
Figtree Variable — public/fonts/figtree.woff2
```

| Property | Value |
|---|---|
| Weights used | 400, 500, 700 |
| Subset | Latin + Latin Extended-A (for `ı`, `ə`, `ö`, `ü`) |
| Loading | `<link rel="preload" as="font" crossorigin>` |
| `font-display` | `swap` |
| Fallback | `system-ui, -apple-system, "Segoe UI", sans-serif` |

**Latin Extended-A is required.** The sub-headline contains `ı` (dotless i) and
`ö`, `ü`. A Latin-only subset renders them as `.notdef` boxes.

> **Trap:** this is invisible to anyone testing with English placeholder copy.
> Test with the real Azerbaijani string.

**FOUT:** with `swap`, the fallback shows first. Because the UI does not appear
until `T+12.400`, the font is always loaded by then in practice — but `swap` is
kept in case of a slow connection.

---

## 29.9 Z-index and stacking

```css
--z-canvas: 1;
--z-scrim:  2;
--z-ui:     3;
--z-form:   4;
```

Nothing else creates a stacking context. Four values, no `9999`.

---

## 29.10 Failure modes

**1 · An element not on the `5.3%` axis.**
The left column reads as stacked rather than composed. `npm run fit` catches it.

**2 · Something placed in the lower void.**
The bridge's approach is blocked. The page's central image is destroyed.

**3 · Headline line-height loosened.**
The type loses its density and reads as generic.

**4 · Headline as one element.**
The line-by-line reveal is impossible.

**5 · Countdown row divider added.**
Two dividers where the reference has one.

**6 · Countdown numerals animating on tick.**
The most distracting thing on a page whose argument is calm.

**7 · Ring forced onto mobile.**
Illegible at any size that fits.

**8 · Font subset missing Latin Extended-A.**
`.notdef` boxes in the sub-headline. Invisible in English testing.

**9 · CTA as a pill.**
A different, friendlier register than the reference's 10px radius.

**10 · Scrim blocking pointer events.**
The left half of the scene stops responding to the cursor.

**11 · Footer items made into links.**
They are brand values, not navigation. Q-05.

---

## 29.11 Checklist

- [ ] All UI is DOM. Nothing is drawn into the canvas.
- [ ] Every left-column element starts at exactly `5.3%`.
- [ ] The upper void (`9.6–19.5%`) is empty.
- [ ] **The lower void (`62.5–93.0%`) is empty.**
- [ ] Headline is three separate elements.
- [ ] Headline line-height is 1.0.
- [ ] Eyebrow letter-spacing is 0.35em at desktop.
- [ ] CTA radius is 10px, not a pill.
- [ ] CTA arrow is flush right, separated by flexible space.
- [ ] Social circles are 44px — WCAG minimum.
- [ ] Countdown ring is an **animated arc** with head and tail dots.
- [ ] Exactly **one** divider in the countdown, vertical, between columns.
- [ ] The largest non-zero unit is accented in `--lime`.
- [ ] Numerals update with **no animation**.
- [ ] Footer items are non-interactive labels.
- [ ] Copyright year is generated.
- [ ] Scrim is active from `T+0.000` with `pointer-events: none`.
- [ ] Mobile is a **re-composition**; the ring becomes a row.
- [ ] CTA label is 15px at every breakpoint.
- [ ] Font subset includes Latin Extended-A; tested with the real copy.
- [ ] Four z-index values, no magic numbers.
- [ ] `npm run fit` passes at all four breakpoints.

---

**Next:** [`30_ui_reveal_choreography.md`](30_ui_reveal_choreography.md) — how
it all appears.
