# 30 — UI REVEAL CHOREOGRAPHY

**How the page appears, after the bridge is finished.**

---

## 30.1 The principle

> **The scene finishes. Then the page arrives.**

No text is visible during the build. Not faded, not partial, not "already there
but dim". The first UI pixel appears at **`T+12.400`** — the frame after the
completion pulse resolves.

### Why the UI waits

**It would compete.** A 12-second build is asking for the viewer's full
attention. Text on top of it splits that attention and neither wins.

**It changes what the scene is.** UI present from frame one makes the animation
a *background*. UI arriving after makes the animation the *subject*, and the
text its conclusion.

**It gives the completion pulse a job.** The pulse punctuates the build; the UI
arriving is what the punctuation was for.

> **Trap:** "users will not wait 12 seconds to see the headline." Some will not,
> and that is accepted — logged as **D-005** in
> [`40_decision_log.md`](40_decision_log.md). The mitigation is not to show the
> text earlier; it is that the **prerendered HTML contains all the copy**, so
> search engines, social scrapers, and anyone with JavaScript disabled get it
> immediately. And `prefers-reduced-motion` skips straight to the finished
> state.

---

## 30.2 The sequence

All offsets relative to `TIMELINE.uiRevealStart` = **`T+12.400`**.

| # | Element | Offset | Absolute | Notes |
|---|---|---|---|---|
| 1 | Logo | +0.000 | T+12.400 | |
| 2 | Eyebrow | +0.300 | T+12.700 | |
| 3 | Headline line 1 | +0.550 | T+12.950 | |
| 4 | Headline line 2 | +0.750 | T+13.150 | |
| 5 | Headline line 3 | +0.950 | T+13.350 | The lime line |
| 6 | Sub-headline | +1.200 | T+13.600 | |
| 7 | CTA | +1.450 | T+13.850 | |
| 8 | Socials | +1.700 | T+14.100 | 60ms internal stagger |
| 9 | Countdown ring | +1.950 | T+14.350 | Draws over 800ms |
| 10 | Countdown units | +2.400 | T+14.800 | 70ms internal stagger |
| 11 | Footer | +2.600 | T+15.000 | |

**Last element completes at `T+15.520`.**

```
T+12.4   12.7   13.0   13.4   13.6   13.9   14.1   14.4   14.8   15.0   15.5
   │      │      │      │      │      │      │      │      │      │      │
  logo    │      │      │      │      │      │      │      │      │      │
       eyebrow   │      │      │      │      │      │      │      │      │
              line1  line2  line3    │      │      │      │      │      │
                            (0.55/0.75/0.95) │      │      │      │      │
                                   sub      │      │      │      │      │
                                          CTA      │      │      │      │
                                              socials     │      │      │
                                                       ring      │      │
                                                            units│      │
                                                                footer  │
                                                                     done
```

---

## 30.3 The base animation

Every element uses the same transition. There are no per-element variations.

```css
@keyframes reveal {
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: translateY(0); }
}

.reveal {
  animation: reveal 520ms cubic-bezier(0.16, 1, 0.3, 1) both;
  animation-delay: var(--reveal-delay);
}
```

| Property | Value |
|---|---|
| Duration | **520ms** |
| Easing | `cubic-bezier(0.16, 1, 0.3, 1)` |
| Opacity | 0 → 1 |
| Transform | `translateY(12px)` → `translateY(0)` |

### The easing curve

A strong "arrive and settle" — fast initial movement, long soft landing, **no
overshoot**.

```
1.0 ┤                    ╭────────────
    │                ╭───╯
    │            ╭───╯
0.5 ┤        ╭───╯
    │    ╭───╯
    │  ╭─╯
0.0 ┼──╯
    └────────────────────────────────►
    0ms                          520ms
```

At 100ms it is already 62% complete. At 300ms, 94%. The final 6% takes 220ms.

> **Why no overshoot:** the scene contains no bounce anywhere — see
> [`05_visual_language.md`](05_visual_language.md) §5.5. UI that bounces while
> the bridge does not would read as belonging to a different page.

### Why 12px and not more

Enough to read as *arriving*. Small enough that nothing appears to *fly in*.

At 24px the movement becomes the subject and the page acquires a "web
animation" quality that the scene does not have. At 4px it reads as a plain
fade.

### 520ms does not scale with `SCENE.timeScale`

The intro's timings scale together; the UI reveal's do not.

| Scales with `timeScale` | Does not |
|---|---|
| `UI_REVEAL.sequence[].offset` | `UI_REVEAL.duration` (520ms) |
| | `childStagger` values |

> **Why:** the offsets are choreography — part of the cinematic. The 520ms is
> **UI micro-interaction timing**, tuned to human perception of a control
> appearing. It is the same 520ms whether the intro took 8 seconds or 16.

---

## 30.4 The headline reveals line by line

The most important detail in this document.

```
T+12.950   Something new
T+13.150   is taking shape.
T+13.350   Coming soon        ← lime
```

**200ms between lines.**

> **Why line by line rather than as a block:**
>
> It makes the viewer **read** the headline rather than **see** it.
>
> A three-line block appearing at once is perceived as a shape — the eye takes in
> its mass and moves on. Lines arriving 200ms apart force sequential reading,
> because each line is the only new thing on screen when it lands.
>
> 200ms is roughly the duration of a single fixation. The rhythm matches how the
> sentence is actually read.

The third line is lime, arrives last, and is the payoff. Giving it its own 200ms
of isolation is the whole reason for the technique.

### This requires three elements

```html
<h1 class="headline">
  <span class="line" style="--reveal-delay: 550ms">Something new</span>
  <span class="line" style="--reveal-delay: 750ms">is taking shape.</span>
  <span class="line accent" style="--reveal-delay: 950ms">Coming soon</span>
</h1>
```

Not `::first-line`, not a split-text library, not per-character. Three spans.

---

## 30.5 Internal staggers

Two elements have children that stagger among themselves.

### Socials — 60ms

```
T+14.100  LinkedIn
T+14.160  Twitter
T+14.220  Instagram
```

Fast enough to read as one gesture, slow enough that the group has a direction.
At 0ms they appear as a block; at 150ms they become three separate events.

### Countdown units — 70ms

```
T+14.800  DAYS
T+14.870  HOURS
T+14.940  MINUTES
T+15.010  SECONDS
```

Reading order: left to right, top to bottom.

---

## 30.6 The countdown ring draws itself

The only element with a bespoke animation.

```css
.ring-arc {
  stroke-dasharray: var(--arc-length);
  stroke-dashoffset: var(--arc-length);
  animation: draw 800ms cubic-bezier(0.4, 0, 0.2, 1) 1950ms forwards;
}

@keyframes draw {
  to { stroke-dashoffset: var(--arc-target); }
}
```

| Property | Value |
|---|---|
| Start | `T+14.350` |
| Duration | **800ms** |
| Easing | `cubic-bezier(0.4, 0, 0.2, 1)` — smooth, no overshoot |
| Direction | Clockwise from `arcStart` (≈11 o'clock) |
| End | The arc's true progress position |

**The dots:**

| Dot | Behaviour |
|---|---|
| Tail (at `arcStart`) | Fades in over the first 200ms |
| Head (at `arcEnd`) | **Travels with the stroke's leading edge** |

The head dot moving as the arc draws is what makes it read as *being drawn*
rather than as *wiping in*.

The track circle (`rgba(163,230,53,0.18)`) fades in with the standard 520ms
reveal at the same offset, so the arc draws along a visible path.

> **After the draw completes, the arc never animates again.** It advances by
> imperceptible amounts as the countdown ticks. There is no repeating sweep.

---

## 30.7 The scene stays interactive throughout

**From `T+12.400`, everything responds** — the viewer does not wait for the UI
to finish.

| Available at `T+12.400` |
|---|
| Cursor dispersion |
| Camera parallax |
| **Dolly / push-in** |
| Idle breathing |

A viewer who starts moving their cursor the instant the bridge completes gets
full interaction while the text is still arriving. That overlap is intentional —
it prevents a dead 3-second window.

**Elements become clickable as they finish**, not before. The CTA is
`pointer-events: none` until its animation completes at `T+14.370`.

> **Why:** a button that is 30% faded in is clickable but not readable. Someone
> clicking it does not know what they clicked.

---

## 30.8 Reduced motion

```ts
A11Y.reducedMotion.skipIntro = true
```

**The reveal does not occur.** All UI is present and fully visible at
`T+0.000`, with no animation, alongside the finished bridge.

```css
@media (prefers-reduced-motion: reduce) {
  .reveal { animation: none; opacity: 1; transform: none; }
  .ring-arc { stroke-dashoffset: var(--arc-target); animation: none; }
}
```

Not a faster reveal. Not a cross-fade. **No reveal.**

---

## 30.9 Late arrivals

| Situation | Behaviour |
|---|---|
| Page loaded normally | Full sequence from `T+12.400` |
| Reduced motion | Everything visible at `T+0.000` |
| Tab backgrounded during intro | On return: jump to Phase 5, UI cross-fades in over 400ms **as a block** |
| WebGL fails | UI visible immediately over a static gradient background |
| JS disabled | Prerendered HTML, all copy present, no canvas |

**The backgrounded-tab case does not replay the stagger.** A viewer returning to
a tab has lost the context that made the sequence meaningful; a 3-second
staggered reveal would just feel slow.

---

## 30.10 The exit sequence

Only when `SCENE.loop === true`.

```ts
LOOP.rewind.uiFadeOutLeadTime = 0.900     // begins BEFORE the rewind
LOOP.rewind.uiFadeOutDuration = 0.600
```

| Property | Value |
|---|---|
| Start | `T+31.500` |
| Duration | 600ms |
| Animation | opacity `1 → 0`, `translateY(0 → −8px)` |
| Easing | `cubic-bezier(0.4, 0, 1, 1)` — ease-**in**, the mirror of the reveal |
| Order | **All elements together. No stagger.** |
| Complete | `T+32.100`, 300ms before the rewind begins |

### Why no stagger on exit

The reveal is staggered because the viewer is meant to **read** each element as
it arrives. The exit is not asking to be read — it is getting out of the way.
Staggering it would draw attention to a moment that should be unremarkable.

### Why it leads the rewind by 900ms

So nobody is reading text while the page dismantles itself underneath it. By the
time the first railing particle lifts, the text is gone and the frame is purely
the scene again.

---

## 30.11 Implementation notes

### CSS animations, not JavaScript

```css
.reveal { animation-delay: var(--reveal-delay); }
```

The delays are set once as custom properties when the reveal is triggered. The
browser handles the rest.

| | |
|---|---|
| Runs on the compositor | No main-thread cost during the busiest moment of the scene |
| Immune to frame drops | An animation driven by `requestAnimationFrame` competes with the particle system |
| Honours `prefers-reduced-motion` | Via a media query, with no JS branch |

### `animation-fill-mode: both`

Essential. Without it, elements are visible before their delay elapses.

```css
animation: reveal 520ms cubic-bezier(0.16, 1, 0.3, 1) both;
```

> **Trap:** `forwards` alone holds the end state but not the start state, so
> every element flashes visible for one frame before its delay begins. With 11
> elements this is very noticeable.

### Triggering

A single class is added to the root at `T+12.400`:

```js
document.documentElement.classList.add('scene-complete')
```

All eleven animations start from their CSS delays relative to that moment. One
DOM write; no per-element scheduling.

### `will-change`

```css
.reveal { will-change: opacity, transform; }
```

Removed on animation end, via `animationend`. Leaving it on 11 elements
permanently keeps 11 compositor layers alive for nothing.

---

## 30.12 Failure modes

**1 · UI visible during the build.**
The animation becomes a background and the scene loses its subject.

**2 · Headline revealing as a block.**
The viewer sees the headline instead of reading it. The lime payoff line loses
its isolation.

**3 · `animation-fill-mode` not `both`.**
All 11 elements flash for one frame before their delays begin.

**4 · Reveal driven by `requestAnimationFrame`.**
Competes with the particle system on the main thread at the busiest moment.

**5 · Overshoot in the easing.**
Bounce, which appears nowhere else in the scene.

**6 · Elements clickable before they finish.**
A 30%-visible CTA is clickable but not readable.

**7 · Ring arc animating repeatedly.**
A repeating sweep — the scene's forbidden pulse, in UI form.

**8 · Stagger on exit.**
Draws attention to a moment that should be invisible.

**9 · `will-change` never removed.**
11 permanent compositor layers.

**10 · Backgrounded-tab return replaying the stagger.**
Three seconds of reveal for a viewer with no context. Feels slow.

---

## 30.13 Checklist

- [ ] No UI is visible before `T+12.400`. Not dim, not partial.
- [ ] Eleven elements in the order and at the offsets in §30.2.
- [ ] Every element uses the same 520ms `cubic-bezier(0.16, 1, 0.3, 1)`.
- [ ] `translateY` is 12px.
- [ ] No overshoot anywhere.
- [ ] The headline reveals **line by line**, 200ms apart, as three elements.
- [ ] Socials stagger at 60ms; countdown units at 70ms.
- [ ] The ring **draws** over 800ms with a travelling head dot.
- [ ] The ring never animates again after its draw.
- [ ] Countdown numerals tick with **no animation**.
- [ ] `520ms` and the staggers do **not** scale with `SCENE.timeScale`; the
      offsets do.
- [ ] Full scene interaction — including dolly — is live from `T+12.400`.
- [ ] Elements become clickable only when their animation completes.
- [ ] Animations are CSS, triggered by one class on the root.
- [ ] `animation-fill-mode: both`.
- [ ] `will-change` is removed on `animationend`.
- [ ] Under reduced motion there is **no reveal** — everything is visible at
      `T+0.000`.
- [ ] A backgrounded tab returns with a 400ms block cross-fade, not a replay.
- [ ] Exit (loop only) is unstaggered, 600ms, beginning 900ms before the rewind.

---

**Next:** [`31_content_and_copy.md`](31_content_and_copy.md) — the actual words.
