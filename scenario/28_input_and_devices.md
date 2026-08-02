# 28 — INPUT AND DEVICES

**Mouse, touch, keyboard, and everything that is not a desktop with a pointer.**

---

## 28.1 The input model

Every input resolves to one of **four channels**. Nothing else exists.

| Channel | What it drives | Available from |
|---|---|---|
| **Influence point** | Particle dispersion / steering | `T+0.000` (no effect until particles fly) |
| **Parallax vector** | Camera offset and rotation | `T+0.000` |
| **Dolly value** | Push-in and proximity dispersion | `T+12.400` |
| **UI focus** | Standard DOM interaction | `T+12.400` |

Every device maps its gestures onto these four. The scene itself has no
knowledge of mice, fingers, or gyroscopes.

```
   mouse move ──┬──► influence point
                └──► parallax vector

   touch hold ─────► influence point
   pinch ──────────► dolly value
   wheel ──────────► dolly value
   orientation ────► parallax vector
   keyboard ───────► UI focus only
```

---

## 28.2 Mouse

The reference input. Everything else is defined relative to it.

| Event | Channel | Behaviour |
|---|---|---|
| `pointermove` | influence + parallax | Both updated every event |
| `pointerdown` | — | No scene effect (UI only) |
| `wheel` | dolly | Phase 5+ only; swallowed before |
| `pointerleave` | influence | Influence fades out over `returnResponse`; ripple re-arms |

### One pointer drives two channels

A single mouse position updates **both** the influence point and the parallax
vector. They do not conflict because they act on different things — one moves
particles, one moves the camera — and their magnitudes are wildly different
(30u of particle displacement vs 22u of camera translation, at a 782u viewing
distance).

### `pointerleave`

When the cursor leaves the window entirely:

- Influence strength decays to zero over `returnResponse` (1.40s)
- Parallax eases back to centre at the normal `lerp` (0.045)
- The arrival ripple **re-arms**

It does not snap. A cursor leaving the window is the same as a cursor moving
far away.

---

## 28.3 Touch

There is no hover on touch. **Press-and-hold is the interaction.**

This was specified directly by the client, and it is the right mapping: it is
the only gesture with the same *sustained presence* semantics as hover.

| Gesture | Channel | Behaviour |
|---|---|---|
| **Press and hold** | influence | Acts exactly like cursor hover at that point. Particles disperse and **stay** dispersed for as long as the finger is down. |
| **Drag while held** | influence | The influence point follows the finger |
| **Release** | influence | Spring return over `returnResponse` = 1.40s |
| **Tap** | influence | A very short hold — ripple fires, brief dispersion, immediate return |
| **Pinch** | dolly | Push-in and proximity dispersion |
| **Two-finger drag** | — | Ignored |
| **Long press** | influence | Same as press-and-hold. Context menu suppressed. |

### The hold must actually hold

```ts
INTERACTION.touch = {
  holdBehaviour: 'sustained',
  minHoldForRipple: 0,        // ripple fires on touchstart
  releaseUsesReturnResponse: true,
}
```

A finger held on the bridge for thirty seconds keeps the particles pushed aside
for thirty seconds. Nothing decays, nothing re-fires.

This is **D-001 applied to touch**: the reaction is a function of where the
finger is, not of how long it has been there.

### Suppressed browser behaviours

Over the canvas only:

```css
canvas { touch-action: none; }
```

| Behaviour | Suppressed? | Why |
|---|---|---|
| Scroll on drag | **Yes** | The page does not scroll |
| Pinch-zoom (browser) | **Yes** | Pinch is the dolly gesture |
| Double-tap zoom | **Yes** | Interferes with tap |
| Long-press context menu | **Yes** | Long press is the hold gesture |
| Text selection | **Yes** | Nothing selectable on the canvas |

**Over the UI layer, none of these are suppressed.** Text must remain
selectable, the CTA must be tappable, and the subscribe form must behave like a
normal form. `touch-action: none` applies to the canvas element only.

### Parallax on touch

**Parallax is never driven by the touch point.**

```
finger  →  influence point  (dispersion)
NOT     →  parallax vector
```

> **Why:** the finger is already controlling dispersion. Having it also swing
> the camera makes both feel imprecise, and it means a viewer cannot disperse
> particles without also moving the view.

Parallax on touch comes from **device orientation**, or from nothing.

---

## 28.4 Device orientation

```ts
CAMERA.orientationParallax = {
  enabled: 'onPermission',
  maxTiltDeg: 22,             // device tilt that maps to full parallax
  lerp: 0.035,                // even heavier than mouse
  requirePermission: true,    // iOS 13+
}
```

### Permission is required and must not be requested on load

On iOS 13+, `DeviceOrientationEvent.requestPermission()` requires a user
gesture and shows a system dialog.

**We do not ask on page load.** A permission prompt appearing over a coming-soon
page before the visitor has done anything is hostile and will mostly be denied.

**Where it is requested:** nowhere, currently. Orientation parallax is enabled
only if permission has *already* been granted (which happens on Android and on
iOS where the user has previously allowed it for the origin).

> **Open question Q-08:** should there be a subtle affordance offering
> orientation parallax? Current answer: no. The idle drift is sufficient, and
> the cost of a denied prompt is worse than the benefit of a granted one.

### Fallback

If orientation is unavailable or denied, **idle drift is the only camera
motion**.

```ts
CAMERA.idleDrift = {
  amplitudeX: 7, amplitudeY: 3.5,
  periodX: 23.0, periodY: 31.0,
}
```

This is why idle drift is not optional. On the majority of mobile sessions it is
the entire camera system.

---

## 28.5 Keyboard

The canvas is **not keyboard-interactive**. There is no way to drive particle
dispersion or the camera from a keyboard, and this is a deliberate accessibility
decision rather than an omission.

| Key | Behaviour |
|---|---|
| `Tab` | Moves through UI focus order (see below) |
| `Enter` / `Space` on CTA | Opens the subscribe form |
| `Escape` | Closes the subscribe form |
| Everything else | No scene effect |

### Focus order

```
1. Skip link (visually hidden, "Skip to content")
2. Logo (if linked)
3. CTA — "Get notified"
4. Social: LinkedIn
5. Social: Twitter
6. Social: Instagram
7. Footer copyright (if it contains a link)
```

The canvas is `aria-hidden="true"` and `tabindex="-1"`. It is never focusable.

### Why not make the scene keyboard-drivable

Because there is nothing to *do* in it. The dispersion is decorative feedback,
not functionality. Adding arrow-key control of a virtual cursor would create a
keyboard trap over a purely decorative element and add nothing.

**Everything meaningful on this page is in the DOM.** See
[`35_accessibility.md`](35_accessibility.md).

---

## 28.6 Devices without a pointer or touch

| Device | Behaviour |
|---|---|
| **Screen reader** | Canvas hidden; reads the DOM text layer normally |
| **TV / remote** | D-pad moves UI focus; no scene interaction |
| **Print** | Canvas omitted; UI printed on white. See §28.9 |
| **Search-engine crawler** | Prerendered HTML; no canvas at all |

---

## 28.7 Input during each phase

| Phase | Influence | Parallax | Dolly | UI |
|---|---|---|---|---|
| 0 · Dormant | tracked, no effect | **✓** | ✗ swallowed | ✗ |
| 1 · Awakening | ✓ airborne only | ✓ | ✗ | ✗ |
| 2 · Glide | ✓ | ✓ | ✗ | ✗ |
| 3 · Assembly | ✓ mixed | ✓ | ✗ | ✗ |
| 4 · Completion | ✓ | ✓ | ✗ | ✗ |
| 5 · Living | ✓ | ✓ | **✓** | **✓** |
| 6 · Rewind | ✓ | ✓ | ✓ | fading |

### Swallowed, not ignored

During Phases 0–4, `wheel` and pinch events are **`preventDefault()`ed and
discarded**.

| | |
|---|---|
| Page does not scroll | There is nothing to scroll to |
| Browser does not zoom | Pinch is reserved for the dolly gesture |
| No visual response | The dolly is disabled |

> **Trap:** simply not handling the event lets the browser scroll the page,
> which on mobile moves the fixed canvas and produces a visible jump.

---

## 28.8 The subscribe form

The one piece of real UI interaction.

| Step | Behaviour |
|---|---|
| CTA clicked/tapped | Form expands in place — no modal, no navigation |
| Input focused | **If `SCENE.loop` is enabled, the loop suspends** — see below |
| Submit | POST to the configured endpoint; inline success/error |
| Escape / outside click | Collapses |

### The loop guard

```
if (document.activeElement is an input || subscribeFormOpen) suspendLoop()
```

**Mandatory whenever `SCENE.loop` is `true` in production.**

A viewer typing an email address while the page dismantles itself behind them is
the worst possible moment for the rewind, and it is entirely avoidable. Listed in
[`38_acceptance_criteria.md`](38_acceptance_criteria.md).

### Scene interaction continues while the form is open

The bridge still responds to the cursor. Only the loop is suspended.

> A form that freezes the background reads as a modal. The form is meant to be
> part of the page, not on top of it.

---

## 28.9 Print

```css
@media print {
  canvas { display: none; }
  /* UI on white, black text, no scrim */
}
```

Nobody prints a coming-soon page. It costs four lines and prevents a page of
solid black.

---

## 28.10 Reduced motion

```ts
A11Y.reducedMotion = {
  skipIntro: true,
  disableLoop: true,
  interactionScale: 0.25,
  disableCameraParallax: true,
  disableIdleBreathe: false,
}
```

| Channel | Reduced motion |
|---|---|
| Influence | **Kept at 25% scale** |
| Parallax | **Removed** |
| Dolly | **Removed** |
| UI | Unchanged |

### Why interaction is damped rather than removed

A completely dead scene reads as broken. At 25% the response is present but
gentle — the page still answers, and nothing sweeps.

Idle breathing (`0.9u`) is also kept: it is far below any motion threshold and
it stops the page feeling frozen.

---

## 28.11 Event handling notes

### Use Pointer Events

```js
canvas.addEventListener('pointermove', ...)
canvas.addEventListener('pointerdown', ...)
canvas.addEventListener('pointerup', ...)
```

One code path for mouse, touch, and pen. Do not maintain separate mouse and
touch handlers — they diverge and the touch path rots.

### Do not update the scene inside the event handler

```js
// RIGHT
onPointerMove(e) { pending.x = e.clientX; pending.y = e.clientY }
// ...then read `pending` once per frame in the render loop

// WRONG
onPointerMove(e) { updateAllParticles(e) }
```

Pointer events fire far more often than frames on high-polling-rate mice — up to
1000 Hz. Doing work per event wastes 90%+ of it.

**Store the latest value; consume it once per frame.**

### Coalesced events

`e.getCoalescedEvents()` is **not** used. We only ever need the latest position;
intermediate positions between frames are irrelevant because the influence point
is a state, not a stroke.

### Passive listeners

`pointermove` is registered `{ passive: true }`.
`wheel` and `touchstart` are **not** passive — they call `preventDefault()`
during Phases 0–4.

---

## 28.12 Failure modes

**1 · Touch hold that decays.**
D-001 on touch. The finger stays, the particles come back.

**2 · Parallax driven by the touch point.**
Dispersion and camera move together; both feel imprecise.

**3 · Orientation permission requested on load.**
A system dialog over a coming-soon page. Mostly denied, always hostile.

**4 · `touch-action: none` applied to the whole page.**
The UI stops scrolling, text stops being selectable, the form becomes hostile on
mobile. It belongs on the canvas only.

**5 · Wheel not prevented during Phases 0–4.**
The page scrolls; the fixed canvas jumps on mobile.

**6 · Separate mouse and touch code paths.**
The touch path diverges and rots.

**7 · Scene updated inside the pointer handler.**
90%+ wasted work on high-polling mice.

**8 · Loop running while an input is focused.**
The page dismantles itself while the visitor types an email address.

**9 · Canvas focusable.**
A keyboard trap over a decorative element.

**10 · Form opening as a modal that freezes the scene.**
Reads as a dialog on top of the page rather than as part of it.

---

## 28.13 Checklist

- [ ] All input resolves to four channels: influence, parallax, dolly, UI focus.
- [ ] Pointer Events only — one code path for mouse, touch, and pen.
- [ ] Events store their latest value; the scene consumes it **once per frame**.
- [ ] `pointermove` is passive; `wheel` and `touchstart` are not.
- [ ] Touch **press-and-hold** behaves exactly like cursor hover, and holds
      indefinitely.
- [ ] Touch release springs back over 1.40s.
- [ ] Tap fires the ripple and returns immediately.
- [ ] Pinch drives the dolly.
- [ ] `touch-action: none` is on the **canvas only**, never the UI.
- [ ] UI text stays selectable; the form behaves normally on mobile.
- [ ] Parallax is **never** driven by the touch point.
- [ ] Device orientation is used **only if already permitted**. No prompt on
      load.
- [ ] Idle drift is the fallback camera motion and is always present.
- [ ] Wheel and pinch are `preventDefault()`ed and discarded during Phases 0–4.
- [ ] The canvas is `aria-hidden` and `tabindex="-1"`. Never focusable.
- [ ] Focus order is skip link → logo → CTA → socials → footer.
- [ ] The subscribe form expands in place; the scene stays interactive.
- [ ] **If `SCENE.loop` is enabled, the loop suspends on input focus.**
- [ ] Print styles hide the canvas.
- [ ] Under reduced motion, influence is damped to 25% and parallax/dolly are
      removed.

---

**Next:** [`29_ui_layout.md`](29_ui_layout.md) — every element, every
breakpoint.
