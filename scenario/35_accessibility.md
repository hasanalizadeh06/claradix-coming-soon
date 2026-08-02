# 35 — ACCESSIBILITY

**The page for everyone who is not looking at a 12-second animation.**

---

## 35.1 The principle

> **Everything meaningful lives in the DOM. The canvas is decoration.**

The 3D scene carries **no information**. It is atmosphere. Every fact the page
communicates — the brand, the headline, the launch date, the way to sign up — is
real HTML text.

Delete the canvas entirely and the page still works, still ranks, still
converts. That is the test.

---

## 35.2 The canvas is hidden from assistive technology

```html
<canvas aria-hidden="true" tabindex="-1"></canvas>
```

| Attribute | Reason |
|---|---|
| `aria-hidden="true"` | Screen readers skip it entirely |
| `tabindex="-1"` | Never focusable — a keyboard trap over decoration would be indefensible |

**No `alt` text, no description, no live region.** There is nothing to describe
that is not already said better by the headline.

> **Trap:** the instinct is to add `aria-label="Animated bridge forming from
> particles"`. Do not. It announces a decorative element as if it were content,
> interrupts the reading of the actual page, and tells a screen-reader user about
> something they cannot access and do not need.

---

## 35.3 `prefers-reduced-motion`

A 12-second full-screen sweeping animation is **exactly** the kind of motion this
setting exists to prevent. Honouring it is mandatory.

```ts
A11Y.reducedMotion = {
  skipIntro: true,
  disableLoop: true,
  interactionScale: 0.25,
  disableCameraParallax: true,
  disableIdleBreathe: false,
}
```

### What happens

| Feature | Normal | Reduced motion |
|---|---|---|
| Intro (Phases 0–4) | 12.4s build | **Does not occur.** Final frame at `T+0.000` |
| UI reveal | 11-element stagger | **No reveal.** All visible immediately |
| Camera parallax | ±22u | **Removed** |
| Camera idle drift | ±7u | **Removed** |
| Push-in / dolly | Enabled | **Removed** |
| Loop | Per `SCENE.loop` | **Always disabled** |
| Cursor dispersion | 30u | **Kept at 25%** → 7.5u |
| Idle breathing | 0.9u | **Kept** |
| Nebula drift | 0.6 u/s | Kept |
| Star twinkle | On | Kept |

### Not a faster intro

The build either plays or it does not. A "quick version" is a compromise that
serves nobody — it is still sweeping motion, just less of it.

### Why interaction is damped rather than removed

**A completely dead scene reads as broken.** At 25% the page still answers when
touched — gentle, local, no sweep. The viewer learns the page is alive.

Idle breathing at `0.9u` is also kept. It is far below any vestibular threshold
(sub-pixel at normal viewing distance) and it is what stops the page feeling
frozen.

### Implementation

Both a media query and a JS check, because they serve different layers:

```css
@media (prefers-reduced-motion: reduce) {
  .reveal { animation: none; opacity: 1; transform: none; }
  .ring-arc { stroke-dashoffset: var(--arc-target); animation: none; }
}
```

```ts
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
if (reduce) ticker.seek(TIMELINE.phase5_livingStart)
```

**Listen for changes.** A user can toggle the OS setting while the page is open.

```ts
matchMedia('(prefers-reduced-motion: reduce)')
  .addEventListener('change', applyMotionPreference)
```

---

## 35.4 Contrast

All text must hold **4.5 : 1** at every frame — not just in the settled state.

| Element | Ratio | Required |
|---|---|---|
| Headline (white) | 19.6 : 1 | 4.5 |
| Headline line 3 (lime) | 12.8 : 1 | 4.5 |
| Sub-headline | 13.9 : 1 | 4.5 |
| Eyebrow | 16.4 : 1 | 4.5 |
| CTA text | 12.4 : 1 | 4.5 |
| Footer | 7.1 : 1 | 4.5 |
| Countdown numerals | 20.1 : 1 | 4.5 |
| **Countdown labels** | **5.6 : 1** | 4.5 |

### We hold 4.5 : 1 even where 3 : 1 is permitted

WCAG allows **3 : 1** for large text (≥24px bold or ≥18.66px). The headline
qualifies.

We hold 4.5 : 1 anyway, because **the background is animated**. Its local
luminance changes as the bridge builds, as the bloom rises, and as the viewer
disperses particles. A ratio measured on one frame is not a guarantee for the
next.

### The tightest margin

**Countdown labels at 5.6 : 1.** They sit inside the ring in the upper right,
where the bridge's glow is closest.

> **Re-measure this whenever bloom strength or swarm intensity changes.** It is
> the first thing that will fail.

### The scrim is an accessibility feature

`POSTFX.textScrim` — 86% opaque black over the left 52% — exists **because of
contrast**, not because of taste.

It damages the world (the left third of the valley is permanently underlit) and
it wins anyway.

> **Legibility outranks the entire priority stack.** This is the only override
> of *World > Atmosphere > Bridge > Particles > UI*, and it is stated explicitly
> in [`05_visual_language.md`](05_visual_language.md) §5.2 so nobody has to
> re-derive it.

### Colour is never the only signal

| Signal | Also conveyed by |
|---|---|
| Headline line 3 in lime | Position (last line), content |
| `reallıq` in lime | Nothing — but it is emphasis, not information |
| Accented countdown unit | Position (largest unit is always first) |
| Footer dots in lime | Separators only |
| CTA border in lime | Border, label text, icons |

Nothing on this page requires distinguishing lime from white to understand it.

---

## 35.5 Keyboard

### Focus order

```
1. Skip link (visually hidden until focused)
2. Logo
3. CTA — "Get notified"
4. Social: LinkedIn
5. Social: Twitter
6. Social: Instagram
```

Six stops. The canvas is not one of them.

### The canvas is not keyboard-interactive

There is no way to drive particle dispersion or the camera from a keyboard, and
this is **a deliberate decision**, not an omission.

> There is nothing to *do* in the scene. The dispersion is decorative feedback,
> not functionality. Arrow-key control of a virtual cursor would create a
> keyboard trap over a decorative element and deliver nothing.

### Focus indicators

```css
:focus-visible {
  outline: 2px solid var(--lime);
  outline-offset: 2px;
  border-radius: 4px;
}
```

`:focus-visible`, not `:focus` — so a mouse click on the CTA does not leave a
ring behind.

**Never `outline: none`** without a replacement. The lime ring at 12.8 : 1
against the background is clearly visible.

### Skip link

```html
<a href="#main" class="skip-link">Skip to content</a>
```

Visually hidden until focused, then appears top-left at the `5.3%` gutter.

> A six-stop page barely needs one. It costs three lines and it is what a
> keyboard user reaches for first out of habit.

### Escape

Closes the subscribe form and returns focus to the CTA.

---

## 35.6 Screen readers

### Document structure

```html
<body>
  <a href="#main" class="skip-link">Skip to content</a>
  <canvas aria-hidden="true" tabindex="-1"></canvas>
  <div class="scrim" aria-hidden="true"></div>

  <main id="main">
    <header><a href="/"><img alt="Claradix"> Claradix</a></header>

    <p class="eyebrow">Coming soon</p>
    <h1>Something new is taking shape. Coming soon</h1>
    <p>Claradix is the bridge between your idea and reality.</p>

    <button>Get notified</button>

    <nav aria-label="Social links"> … </nav>

    <section aria-label="Time until launch"> … </section>
    <footer> … </footer>
  </main>
</body>
```

### One `<h1>`, containing all three lines

The visual line breaks are `<span>`s inside a single heading. A screen reader
reads one continuous heading:

> *"Something new is taking shape. Coming soon"*

Not three separate fragments.

### The eyebrow is a `<p>`, not a heading

`COMING SOON` above the headline is typographic decoration. Marking it `<h2>`
would put a heading above the `<h1>` in the outline.

Its uppercase presentation comes from CSS `text-transform`, and the source text
is sentence case — so a screen reader says *"Coming soon"*, not *"C-O-M-I-N-G"*.

> **Trap:** hard-coding `COMING SOON` in uppercase in the HTML causes some
> screen readers to spell it out letter by letter. Always `text-transform` in
> CSS.

The same applies to the countdown labels and footer items.

### The countdown

```html
<section aria-label="Time until launch">
  <div role="timer" aria-live="off">
    <span aria-hidden="true">23</span>
    <span class="sr-only">23 days</span>
    …
  </div>
</section>
```

**`aria-live="off"` is essential.** A live region updating once per second would
make the page unusable — the screen reader would announce a number every second,
forever, drowning out everything else.

The visible numerals are `aria-hidden`; a screen-reader-only sentence carries the
meaning, read **on demand** when the user navigates to it.

### The sub-headline is translated for the accessible name

The visible text is Azerbaijani. The `lang` attribute is set correctly so a
screen reader pronounces it with the right voice:

```html
<p lang="az">Claradix ideyanızla <span class="accent">reallıq</span> arasında körpüdür</p>
```

**The `lang="az"` attribute is required.** Without it, a screen reader in an
English locale reads Azerbaijani text with English phonetics — unintelligible.

Since the rest of the page is English, `<html lang="en">` with a local override
on this one element is correct.

> This connects to open question **Q-01** in
> [`31_content_and_copy.md`](31_content_and_copy.md). If the language mix is
> intentional, the `lang` attributes must be right. If it is incomplete
> localisation, the whole document's `lang` should change.

### Social links

```html
<a href="…" aria-label="Claradix on LinkedIn">
  <svg aria-hidden="true">…</svg>
</a>
```

Icon-only links need accessible names. The SVG is hidden; the label carries it.

### Footer items

Rendered as `<span>`, not `<a>` — see **Q-05**. They are brand values, not
navigation. As spans they cost no tab stops and make no false promise.

---

## 35.7 The subscribe form

The only real interactive flow, and therefore the only place where accessibility
failures actually cost something.

```html
<form novalidate>
  <label for="email">Email address</label>
  <input id="email" type="email" name="email"
         autocomplete="email" inputmode="email"
         required aria-describedby="email-error">
  <p id="email-error" role="alert" hidden>Please enter a valid email address.</p>
  <button type="submit">Notify me</button>
</form>
```

| Requirement | Detail |
|---|---|
| Real `<label>` | Not a placeholder. Placeholders disappear on focus. |
| `type="email"` | Correct mobile keyboard |
| `autocomplete="email"` | Browser autofill works — verified by `npm run autofill` |
| `role="alert"` on errors | Announced when it appears |
| `aria-describedby` | Links the input to its error |
| Focus moves to the error | On failed submit |
| Success is announced | `role="status"` |

### Errors are not colour-only

A failed field gets a red-tinted border **and** visible text **and** an alert
role. The border alone would be invisible to a colour-blind user and to a screen
reader.

> Red is the **only** non-lime colour permitted anywhere in the design, and it
> appears only on form errors. This is a deliberate exception to the single-hue
> rule in [`05_visual_language.md`](05_visual_language.md) §5.11 — an error state
> that is lime-on-black is not an error state.

### The loop guard

```
if (document.activeElement is an input || subscribeFormOpen) suspendLoop()
```

**Mandatory whenever `SCENE.loop` is `true`.** A viewer typing an email address
while the page dismantles itself behind them is a cognitive-load failure as much
as an aesthetic one.

---

## 35.8 Without JavaScript

The prerendered HTML contains **all copy**, correctly structured, with no canvas.

| Consumer | Experience |
|---|---|
| JS disabled | Full text on the dark background. No animation. The form degrades to a `mailto:` fallback. |
| Slow connection | Text renders before the 3D loads |
| Search engines | Full copy, no JS execution needed |
| Screen readers | Full DOM immediately |

The canvas is inserted by JS. If JS never runs, there is simply no canvas — and
the page is a complete, readable, accessible page.

---

## 35.9 If WebGL fails

```ts
if (!gl) {
  document.documentElement.classList.add('no-webgl', 'scene-complete')
  return
}
```

| Change | |
|---|---|
| No canvas | Removed from the DOM |
| Background | A static CSS gradient approximating the scene's palette |
| UI | Visible immediately — `scene-complete` is applied |
| Scrim | Kept, for contrast |

**No error message.** A visitor whose GPU is blocklisted does not need to be told
their browser failed; they need the page.

---

## 35.10 Cognitive load

Less formal than the rest, and worth stating.

| Choice | Effect |
|---|---|
| **One action** | The CTA. No competing choices. |
| **27 words** | The entire page. Readable in under 10 seconds. |
| **No modals on load** | Nothing covers the content. |
| **No autoplay audio** | The page is silent. |
| **Countdown does not animate on tick** | A flip or fade at 1 Hz becomes the most distracting thing on a page whose argument is calm. |
| **Loop off by default** | Nothing changes underneath a reader. |
| **No scroll** | One screen. Nothing hidden below the fold. |

---

## 35.11 Testing

### Automated

```bash
npm run build && npx axe ./dist        # zero violations required
npm run fit                            # includes contrast assertions
npm run autofill                       # form autofill behaviour
```

### Manual — required before ship

| Test | How |
|---|---|
| Keyboard-only | Unplug the mouse. Reach and submit the form. |
| Screen reader | VoiceOver (macOS/iOS) and NVDA (Windows) |
| Reduced motion | Enable in OS settings, reload, confirm **no intro** |
| Reduced motion toggled live | Toggle while the page is open |
| 200% browser zoom | No horizontal scroll, nothing clipped |
| Forced colours | Windows High Contrast mode |
| No JS | Disable in devtools |
| No WebGL | `chrome://flags` → disable WebGL |
| `lang="az"` | Confirm the sub-headline is pronounced correctly |

### Forced colours

```css
@media (forced-colors: active) {
  canvas, .scrim { display: none; }
  /* system colours take over; lime accents map to Highlight */
}
```

The scene is hidden entirely. Forced-colours mode exists for people who need
maximum contrast; a dark atmospheric render is the opposite of that.

---

## 35.12 Failure modes

**1 · `aria-label` on the canvas.**
Announces decoration as content and interrupts the page.

**2 · Reduced motion not honoured.**
The most serious accessibility failure available to this page. A 12-second
sweeping animation can cause genuine physical discomfort.

**3 · Reduced motion implemented as a faster intro.**
Still sweeping motion. The setting means *stop*, not *hurry*.

**4 · Countdown as a live region.**
An announcement every second, forever.

**5 · Uppercase hard-coded in HTML.**
Some screen readers spell it out letter by letter.

**6 · Missing `lang="az"`.**
Azerbaijani read with English phonetics — unintelligible.

**7 · `outline: none` with no replacement.**
Keyboard users cannot see where they are.

**8 · Placeholder used instead of a label.**
The field's purpose disappears the moment it is focused.

**9 · Errors signalled by colour only.**
Invisible to colour-blind and screen-reader users.

**10 · Canvas focusable.**
A keyboard trap over decoration.

**11 · Loop running while an input is focused.**
The page dismantles itself while someone types.

**12 · No JS fallback.**
A blank page for crawlers and for anyone with JS blocked.

---

## 35.13 Checklist

- [ ] All meaning is in the DOM. Deleting the canvas loses nothing.
- [ ] Canvas is `aria-hidden="true"` and `tabindex="-1"`, with **no** label.
- [ ] `prefers-reduced-motion` **skips the intro entirely** — not a faster
      version.
- [ ] Reduced motion disables parallax, drift, dolly, and the loop.
- [ ] Reduced motion keeps interaction at 25% and keeps idle breathing.
- [ ] The media-query change event is listened to for live toggling.
- [ ] All text ≥ 4.5 : 1, including where 3 : 1 would be permitted.
- [ ] Countdown labels re-measured after any bloom or lighting change.
- [ ] Colour is never the only signal.
- [ ] One `<h1>` containing all three headline lines.
- [ ] The eyebrow is a `<p>`, not a heading.
- [ ] Uppercase comes from CSS `text-transform`, never from the source text.
- [ ] Countdown is `aria-live="off"` with an sr-only sentence.
- [ ] Sub-headline has `lang="az"`.
- [ ] Social links have `aria-label`; their SVGs are `aria-hidden`.
- [ ] Footer items are `<span>` — no tab stops.
- [ ] Form has a real `<label>`, `autocomplete="email"`, and `role="alert"`
      errors.
- [ ] Focus moves to the error on failed submit.
- [ ] Errors are signalled by border **and** text **and** role.
- [ ] `:focus-visible` outline is present everywhere.
- [ ] Skip link is present.
- [ ] Loop suspends on input focus.
- [ ] Prerendered HTML contains all copy; no-JS is a complete page.
- [ ] WebGL failure degrades silently to a CSS gradient with UI visible.
- [ ] `forced-colors: active` hides the canvas.
- [ ] `axe` reports zero violations.
- [ ] Manual keyboard, VoiceOver, and NVDA passes completed.

---

**Next:** [`37_implementation_plan.md`](37_implementation_plan.md) — what to
build, in what order.
