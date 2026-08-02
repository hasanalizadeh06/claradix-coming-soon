# 38 — ACCEPTANCE CRITERIA

**How a build is judged. What makes it fail.**

---

## 38.1 The principle

> **A criterion that cannot be checked mechanically will not hold.**

This scene is procedural, there is no reference video, and every individual
change toward "more glow" or "more motion" is defensible in isolation. Taste
evaluates changes one at a time; taste cannot hold a ratio.

So the things that matter most are the things that are **measured by a script**.

---

## 38.2 The ten gates

Every one must pass. There are no advisory checks.

| # | Gate | Command | Blocks ship |
|---|---|---|---|
| **G1** | Type safety | `tsc --noEmit` | ✓ |
| **G2** | Production hygiene | `npm run hygiene` | ✓ |
| **G3** | No bridge before `T+5.400` | `npm run reveal-check` | ✓ |
| **G4** | Reference frame match | `npm run compare` | ✓ |
| **G5** | Colour ratio, all captures | `npm run palette` | ✓ |
| **G6** | UI layout, all breakpoints | `npm run fit` | ✓ |
| **G7** | Laws 4 and 5 | `npm run interact-check` | ✓ |
| **G8** | Form and autofill | `npm run autofill` | ✓ |
| **G9** | Accessibility | `npx axe ./dist` | ✓ |
| **G10** | Performance | `npm run perf` | ✓ |

Plus **five manual checks** in §38.13 that cannot be automated.

---

## 38.3 G1 — Type safety

```bash
tsc --noEmit
```

Zero errors. `strict: true`. No `@ts-ignore` without an adjacent comment naming
the reason.

---

## 38.4 G2 — Production hygiene

```bash
npm run hygiene
```

Greps the built bundle for things that must never ship.

| Check | Failure condition |
|---|---|
| Debug flags | Any `SCENE.debug*` is `true` |
| Time seeking | `ticker.seek(` appears outside `scripts/` |
| Non-determinism | `Math.random(` appears in `scene/` or `lib/` |
| Console | `console.log` in the production bundle |
| Duplicated constants | A number from `config.ts` appears literally elsewhere in `src/` |

> **`debugShowTargetsOnly` shipping is the single most damaging possible
> failure.** It renders the bridge from `T+0.000` and destroys the premise of the
> entire scene. It is checked first.

---

## 38.5 G3 — The bridge does not exist yet

```bash
npm run reveal-check
```

The most important negative requirement in the project.

**Method:** render two frames at `T+0.600` — one normal, one with the particle
system fully disabled — and compare mean luminance in four regions.

| Region | Screen extent |
|---|---|
| Main tower volume | `x 58–65%`, `y 30–76%` |
| Far tower volume | `x 77–83%`, `y 51–73%` |
| Deck path | the S-curve from doc 07 §7.6 |
| Cable span | `x 45–79%`, `y 36–66%` |

**Pass:** difference < **2%** in every region.

Repeated at `T+2.000` and `T+4.100`.

### Why this needs its own gate

Three real mechanisms make the bridge faintly visible, and all three are
invisible in casual review:

1. A blend factor returning `0.003` instead of `0` — with 140,000 additive
   particles that is a visible ghost
2. A surviving debug flag
3. Sub-threshold particle sums crossing the bloom threshold as a group

See [`09_phase_0_dormant.md`](09_phase_0_dormant.md) §9.10.

---

## 38.6 G4 — Reference frame match

```bash
npm run shoot && npm run compare
```

Diffs the `assembly-late` capture at **`T+10.500`** against
`assets-src/backdrop-source.png`.

| Metric | Threshold |
|---|---|
| Structural similarity (SSIM) | ≥ **0.86** |
| Mean absolute difference | ≤ **6%** |
| Main tower silhouette IoU | ≥ **0.92** |

### `T+10.500`, not `T+16.000`

The reference frame shows a complete bridge **with light trails still sweeping
through the foreground**. That state is `assembly-late` — the far bridge
finished, the near approach still arriving.

Comparing `settled` will always fail on the missing trails, **correctly**. See
[`07_reference_frame_analysis.md`](07_reference_frame_analysis.md) §7.11 note
**R-1**.

### The eight known differences

`compare.mjs` masks the regions covered by notes R-1 through R-8. A build that
matches the reference in those regions is *wrong*, not right.

---

## 38.7 G5 — The colour ratio

```bash
npm run palette
```

**The single most valuable check in the suite.**

Per-capture targets, tolerance **±3 points**:

| Capture | `T+` | Near-black | Deep green | Accent |
|---|---|---|---|---|
| `dormant` | 0.600 | 94% | 5.5% | 0.5% |
| `awakening` | 2.000 | 91% | 7% | 2% |
| `glide` | 4.100 | 87% | 9% | 4% |
| `assembly-early` | 6.400 | 87% | 9% | 4% |
| `assembly-late` | 10.500 | 85% | 10% | 5% |
| `complete` | 12.400 | 86% | 9.5% | 4.5% |
| **`settled`** | 16.000 | **85%** | **10%** | **5%** |

### Why per-capture and not one global target

If `dormant` already met 85/10/5, the opening would be as bright as the ending
and the build would add nothing. **The scene has to start dark and get
brighter**, and only per-capture targets encode that.

### Why this gate exists at all

> Every individual change in this scene pushes toward more light. A brighter
> tower looks better in isolation. More bloom looks better in isolation. Ten
> defensible changes produce a frame that is 20% neon and looks like every other
> tech landing page of the last decade.
>
> Taste evaluates changes one at a time. A ratio evaluates the whole. This is the
> only thing that keeps the work restrained over time.

---

## 38.8 G6 — UI layout

```bash
npm run fit
```

| Check | Assertion |
|---|---|
| Alignment axis | Every left-column element starts at `5.3%` (`6.5%` mobile), ±0.2% |
| Upper void | `y 9.6–19.5%` contains no UI |
| **Lower void** | **`y 62.5–93.0%` contains no UI** |
| F1 | Main tower top `y 28–38%` |
| F2 | Main tower centre `x 55–68%` |
| F3 | Deck exits both frame edges |
| F4 | Horizon `y 60–70%` |
| F5 | Countdown ring does not overlap the far tower |
| Contrast | Every text element ≥ 4.5 : 1 against its local background |
| Touch targets | ≥ 44 × 44px |

Run at all four breakpoints: `375`, `834`, `1280`, `1920`.

> **The lower-void assertion is the one that matters most over time.** It is the
> most valuable space on the page and the most frequently attacked in review.

---

## 38.9 G7 — Laws 4 and 5

```bash
npm run interact-check
```

### Law 4 — flight

| # | Assertion |
|---|---|
| 4.1 | No particle's speed drops below `nominal × 0.92` under a full cursor sweep at four speeds |
| 4.2 | No particle misses `aSeatAt` by more than one frame |
| 4.3 | Heading deflection never exceeds `maxDeflection` (62°) |
| 4.4 | Offset from the guide curve decays monotonically — no oscillation |
| **4.5** | **Cursor parked on the guide curve for 10s: every particle still passes, every deadline met** |

**4.5 is the direct test of Law 4** and the one that catches naive repulsion.

### Law 5 — seated

| # | Assertion |
|---|---|
| 5.1 | No particle exceeds `maxDisplacement` (30u) from its target |
| 5.2 | Silhouette IoU ≥ **0.88** against undisturbed, under worst-case cursor |
| 5.3 | Every particle returns within 1u inside 2.0s after the cursor leaves |
| 5.4 | Displacement is monotonically decreasing during return |
| **5.5** | **Cursor held stationary for 10 minutes: zero change after settling** |

**5.5 is the D-001 test.** Any time term in the field equation fails it.

---

## 38.10 G8 — Form

```bash
npm run autofill
```

| Check | |
|---|---|
| Browser autofill populates the email field | `autocomplete="email"` |
| Invalid email shows an error with `role="alert"` | |
| Focus moves to the error on failed submit | |
| Valid submit reaches the endpoint | mocked |
| Success is announced via `role="status"` | |
| `Escape` closes and returns focus to the CTA | |
| **Loop suspends while the input is focused** | if `SCENE.loop` is true |

---

## 38.11 G9 — Accessibility

```bash
npm run build && npx axe ./dist
```

**Zero violations.** Not "zero criticals" — zero.

Plus scripted assertions:

| Check | |
|---|---|
| Canvas is `aria-hidden` and `tabindex="-1"` | |
| Canvas has no `aria-label` | |
| Exactly one `<h1>`, containing all three lines | |
| Eyebrow is not a heading | |
| Sub-headline has `lang="az"` | |
| Countdown is `aria-live="off"` | |
| No uppercase hard-coded in the HTML source | |
| Social links have `aria-label` | |
| Footer items are `<span>`, not `<a>` | |
| `:focus-visible` outline present on all six focusables | |
| Prerendered HTML contains all 27 words | |

---

## 38.12 G10 — Performance

```bash
npm run perf
```

Runs the full intro on a throttled Playwright context.

| Metric | Threshold |
|---|---|
| P95 frame time, Phase 2 | ≤ **20ms** (`high` tier) |
| P95 frame time, Phase 5 | ≤ **14ms** |
| Init time | ≤ **200ms** |
| First frame | ≤ **400ms** |
| Tier changes per session | ≤ **2** |
| Tier change during Phases 3–4 | **0** |
| GPU memory | ≤ 120 MB |

**P95, not the mean.** A build averaging 15ms with regular 45ms spikes feels far
worse than a steady 20ms, and only P95 catches it.

---

## 38.13 The five manual checks

Cannot be automated. Required before every ship.

### M1 — Reduced motion

Enable in OS settings, reload.

- [ ] **No intro plays.** Not a faster one — none.
- [ ] UI is visible immediately
- [ ] Camera is completely static
- [ ] Cursor interaction still responds, gently
- [ ] Toggle the setting **while the page is open** — it responds

### M2 — Keyboard only

Unplug the mouse.

- [ ] Skip link works
- [ ] Six focus stops, in order
- [ ] The canvas is never focused
- [ ] The form can be reached and submitted
- [ ] Focus is always visible

### M3 — Screen reader

VoiceOver and NVDA.

- [ ] The canvas is not announced
- [ ] The headline reads as one continuous sentence
- [ ] The sub-headline is pronounced as Azerbaijani
- [ ] The countdown does **not** announce every second
- [ ] Form errors are announced

### M4 — Graceful failure

- [ ] JS disabled → complete readable page
- [ ] WebGL disabled → complete page on a CSS gradient, **no error message**
- [ ] Offline after load → the scene keeps running
- [ ] 200% browser zoom → no horizontal scroll, nothing clipped

### M5 — The four-hour test

Leave the page open for four hours.

- [ ] Framing is unchanged — no camera drift
- [ ] No trail ghosting
- [ ] No memory growth
- [ ] Frame time is unchanged
- [ ] Breathing amplitude is unchanged

> **M5 catches accumulator bugs**, which are invisible in every other check
> because they need hours to become visible. Camera idle drift implemented as
> `offset += velocity * dt` instead of `sin(t / period)` fails here and nowhere
> else.

---

## 38.14 What is NOT a criterion

Stated so nobody spends time on them.

| Not checked | Why |
|---|---|
| Unit test coverage | There is almost no testable logic — it is shaders and geometry |
| Bundle size | ~180 KB gzipped is fine for this page |
| Lighthouse performance score | Penalises the canvas in ways that do not reflect experience. LCP, CLS, and INP are checked directly. |
| Draw call count | Already one for particles |
| Triangle count | Vertex-bound at a level nothing notices |
| Cross-browser pixel-identity | GPUs differ. SSIM ≥ 0.86 is the standard. |

---

## 38.15 CI

```yaml
on: [push, pull_request]

jobs:
  gate:
    steps:
      - tsc --noEmit                 # G1
      - npm run build
      - npm run hygiene              # G2
      - npm run shoot                # captures for G3–G5
      - npm run reveal-check         # G3
      - npm run compare              # G4
      - npm run palette              # G5
      - npm run fit                  # G6
      - npm run interact-check       # G7
      - npm run autofill             # G8
      - npx axe ./dist               # G9
      - npm run perf                 # G10
```

**All ten on every push.** They take ~4 minutes because `ticker.seek()` makes
every capture instant — no waiting 12 seconds per frame.

### The captures are artefacts

`shots/` is uploaded on every run. A reviewer can see exactly what the build
looked like at all seven timestamps without running anything.

> This is the closest thing the project has to a reference video, and it is worth
> more than any written description in a PR.

---

## 38.16 Failure triage

When a gate fails, the likely cause:

| Gate | First thing to check |
|---|---|
| G3 | A debug flag, or a blend factor not hard-clamped to 0 |
| G4 | Compared `settled` instead of `assembly-late` |
| G5 | Bloom strength raised, or swarm intensity raised |
| G6 | Something added to the lower void |
| G7 · 4.5 | Naive repulsion — force added to velocity |
| G7 · 5.5 | A time term in the interaction field |
| G10 | Tier measured during Phase 0, or DPR uncapped |
| M5 | An accumulator instead of an absolute function of time |

---

## 38.17 Checklist

- [ ] All ten gates pass in CI on every push.
- [ ] `reveal-check` runs at three timestamps.
- [ ] `compare` diffs `assembly-late` at `T+10.500`, with R-1…R-8 masked.
- [ ] `palette` uses **per-capture** targets, not one global target.
- [ ] `fit` asserts the lower void is empty at all four breakpoints.
- [ ] `interact-check` includes assertions 4.5 and 5.5.
- [ ] `axe` reports **zero** violations.
- [ ] `perf` measures **P95**, not the mean.
- [ ] All five manual checks completed, including the four-hour test.
- [ ] `shots/` is uploaded as a CI artefact.
- [ ] No gate is advisory.

---

**Next:** [`39_do_and_dont.md`](39_do_and_dont.md) — the traps, with reasons.
