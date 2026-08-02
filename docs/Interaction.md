# Interaction

Three gestures. Cursor hover, touch press-and-hold, and wheel push-in.

**There is no raycasting anywhere in this project.**

---

## 1. Input plumbing

`src/gl/Stage.ts`. All listeners are on `window`, not the container.

| Event | Handler | Passive |
|---|---|---|
| `pointermove` | `handlePointerMove` | ✅ |
| `pointerdown` | `handlePointerDown` | ✅ |
| `pointerup` | `handlePointerUp` | ✅ |
| `pointercancel` | `handlePointerUp` | ✅ |
| `pointerout` | `handlePointerOut` | ✅ |
| `wheel` | `handleWheel` | ❌ — needs `preventDefault` |

### Why `window` and not the container

The UI overlay sits above the canvas and covers most of the left half of the
frame. A wheel event over the headline never reached a container-scoped listener,
so **push-in silently did nothing wherever the visitor was most likely to have the
cursor.**

### A touch is a HOLD, a mouse is a HOVER

```ts
private handlePointerMove = (event: PointerEvent) => {
  if (event.pointerType !== "mouse" && !this.touchHeld) return;
  this.setPointerFrom(event);
  this.pointer.engaged = true;
};

private handlePointerDown = (event: PointerEvent) => {
  if (event.pointerType !== "mouse") this.touchHeld = true;
  this.setPointerFrom(event);
  this.pointer.engaged = true;
};

private handlePointerUp = (event: PointerEvent) => {
  if (event.pointerType === "mouse") return;
  this.touchHeld = false;
  this.pointer.engaged = false;
};
```

`pointermove` alone is a **mouse-only assumption**. On a touchscreen it fires only
while a finger is actually sliding, so pressing and holding — which is the whole
gesture — produced nothing at all. The scene was inert to the one input most of
its visitors have.

The two devices also disengage on **opposite signals**. A mouse that stops moving
is still pointing at something, so it stays engaged; a finger that lifts is no
longer touching anything, so it must not. Treating them alike either leaves the
disturbance frozen on screen after the finger is gone, or cancels it every time
the mouse rests.

`pointerout` with `relatedTarget === null` means the cursor has left the document
entirely.

### Release is not a snap

```ts
this.pointer.engaged = false;    // and nothing else
```

The scene's own return spring is deliberately slow. Cutting the input instead of
releasing it would throw that away at the last moment.

---

## 2. Resolving the cursor into the world

**No raycasting against geometry.** Three approaches were considered:

| Approach | Problem |
|---|---|
| Fixed depth plane | the same screen position behaves differently along the bridge |
| Raycast 82,599 particles | unaffordable, and would flicker as they breathe |
| **Nearest point on the centreline to the cursor ray** | cheap, stable, continuous |

```ts
_ndc.set(pointer.x, pointer.y, 0.5).unproject(camera);
_ray.subVectors(_ndc, camera.position).normalize();

let bestD = Infinity;
for (let i = 0; i <= 24; i++) {
  _tmp.copy(camera.position).addScaledVector(_ray, 120 + i * 60);
  const u = centreline.nearestU(_tmp);
  centreline.positionAt(u, _ndc);
  const d = _ndc.distanceTo(_tmp);
  if (d < bestD) { bestD = d; cursorWorld.copy(_ndc); }
}
```

**25 march steps from 120u to 1560u in 60u increments.** At each step, find the
nearest `u` on the centreline and keep the closest approach. The result is a point
*on the bridge line*, so the cursor's influence is always anchored to the
structure regardless of screen position or depth.

Cost: 25 `nearestU` calls per frame. `nearestU` is itself a coarse-to-fine search
over the arc table.

⚠ This resolves to the nearest point on the **centreline**, which is the deck
line. A cursor over the top of a 175-unit tower resolves to a point 175 units
below it. The tower legs therefore respond to the cursor as though it were at the
deck.

---

## 3. The field

```ts
const proximity = pointer.engaged
  ? 1 - THREE.MathUtils.smoothstep(bestD, 0, INTERACTION.influenceRadius * 2.2)
  : 0;

const tau = proximity > cursorStrength
  ? INTERACTION.riseResponse      // 0.34s
  : INTERACTION.returnResponse;   // 1.40s

cursorStrength += (proximity - cursorStrength) * (1 - Math.exp(-frame.delta / tau));
```

### It is HELD, not an envelope

`proximity` has **no time term**. A stationary cursor produces a constant field,
so nothing decays underneath it.

> An envelope-based version was built and rejected — it began rebuilding while the
> viewer was still pointing at the bridge and read as a flicker rather than as a
> response.

### Fast to scatter, slow to return

The 1:4 asymmetry (0.34 s rise, 1.40 s return) is what makes the bridge read as
**matter** rather than as a weightless field effect. *Things easy to disturb and
effortful to restore have mass.*

Exponential smoothing, so it is correct at any frame rate.

### Reduced motion damps rather than removes

```ts
uCursorStrength = cursorStrength * (reduced ? A11Y.reducedMotion.interactionScale : 1);
```

0.25. *A completely dead scene reads as broken.*

---

## 4. The displacement — Law 4

```ts
INTERACTION = {
  influenceRadius: 90,
  innerRadius: 26,
  maxDisplacement: 30,
}
```

```glsl
if (!isDormant && uCursorStrength > 0.001) {
  vec3 away = pos - uCursor;
  float d = length(away);
  if (d < 90.0 && d > 0.0001) {
    float s = 1.0 - smoothstep(26.0, 90.0, d);
    vec3 push = (away / d) * s * 30.0 * uCursorStrength;

    if (isLifting)       push -= aSeedNormal * dot(push, aSeedNormal);
    else if (!isSeated)  { vec3 travel = normalize(centrelineTan(aU));
                           push -= travel * dot(push, travel); }

    pos += push;
  }
}
```

### THE CURSOR MAY DEFLECT A PARTICLE. IT MAY NOT STOP ONE.

A plain radial push has a component **along the direction of travel**, so a cursor
held in front of an oncoming particle shoves it backwards down its own path. The
river visibly stalls under the pointer and then snaps forward when it leaves: the
cursor reads as an obstruction, and the scene stops being something you are
disturbing and becomes something you are obstructing.

Projecting the push onto the plane perpendicular to travel removes exactly that
component and nothing else. **Progress along the path is then untouchable by
construction** — the particle keeps its schedule to the millisecond and steps
sideways around the cursor, which is what avoidance actually looks like.

The direction of travel is free: position is a pure function of time, so every
state already knows the curve it is riding — the guide tangent in flight, the seed
normal on the way up.

### Seated particles are exempt

They are structure, not traffic. There is no progress left to protect, and a
bridge that refuses to be pushed along its own axis feels like it is on rails.

### Law 5 is structural

The displacement is an **additive offset on top of the scheduled position, never
a force.** The two terms never interact and the schedule always wins.

30 units against a 468-unit main span is **6.4%**, so the silhouette survives by
construction rather than by discipline. Clamping the offset clamps the deformation
absolutely — there is no accumulation for a determined visitor to exploit.

---

## 5. Push-in

```ts
CAMERA.dolly = {
  enabled: true, travel: 340, lerp: 0.07,
  autoReturnAfter: 2.4, autoReturnRate: 0.35,
}
INTERACTION.proximityDispersion = {
  startsAt: 0.55, maxRadius: 180, maxDisplacement: 64,
}
```

### Input normalisation

```ts
this.dollyTarget = clamp(this.dollyTarget + event.deltaY / 900, 0, 1);
```

**Not raw wheel delta.** The scene reads an absolute position, not a rate, so it
can be released and returned from — and so that a trackpad's hundred small deltas
and a mouse wheel's three large ones arrive at the same place instead of one of
them overshooting to the end of the travel.

### `preventDefault` is conditional

```ts
const scrollable = document.documentElement.scrollHeight > window.innerHeight + 1;
if (!scrollable) event.preventDefault();
```

On a short viewport the subscribe form can push the page taller than the window,
and **a landing page that refuses to scroll because it would rather move its
camera is a landing page nobody can use.**

### Auto-return

```ts
if (dollyTarget > 0 && frame.elapsed - lastDollyAt > 2.4) {
  dollyTarget = max(0, dollyTarget - 0.35 * frame.delta);
}
```

The push-in releases itself. **A landing page that stays where it was shoved
greets its next reader with a composition nobody chose** — and the visitor who did
the shoving has no way of knowing there was a way back.

The timestamp is stamped inside `render()`, not in the wheel handler:
`ticker.now()` is the SCENE clock and the comparison is against `frame.elapsed`,
the wall clock. The two are seekable independently, and mixing them is the same
mistake that once made the scene start at a negative time.

### Camera motion

```ts
_dolly.subVectors(target, home).normalize();
_tmp.addScaledVector(_dolly, CAMERA.dolly.travel * dolly);
camPos.lerp(_tmp, CAMERA.parallax.lerp);
```

Applied to the **rest position, before the parallax lerp**, so it inherits the
same lag. Applied afterwards it would arrive instantly while everything else
eased, and the camera would feel jointed.

The camera moves along its **own view axis**, so the composition is preserved and
only the distance changes. Moving it toward a fixed world point would swing the
frame as it travelled, and the gesture would read as "look over there" rather than
"come closer".

### Dispersion

```ts
const disperse = smoothstep(dolly, 0.55, 1);
```

Nothing happens for the first 55% of the travel — you can push in and look
without the bridge falling apart.

```glsl
if (uDisperse > 0.001 && !isDormant) {
  vec3 dir = centrelineNrm(aU) * cos(aRollPhase) + centrelineBin(aU) * sin(aRollPhase);
  float near = 1.0 - smoothstep(0.0, 180.0, distance(pos, uDisperseOrigin));
  pos += dir * 64.0 * uDisperse * near * (0.45 + 0.55 * aSizeVar);
}
```

**The one place Law 5 is relaxed.** Everywhere else the silhouette is protected by
construction; here it is meant to come apart, because the gesture is "get closer"
and *what you find when you get close to something made of light is that it was
never solid*.

Radial about the **centreline**, not random per particle. A random direction makes
the bridge fizz, which reads as noise; expanding outward along the curve's own
frame makes it **bloom**, which reads as the structure loosening.

`maxRadius: 180` scales it by proximity to `uDisperseOrigin` — the point where the
view axis meets the bridge. What you have pushed into scatters; what is still far
away holds.

---

## 6. Timing summary

| | Value | Frame-rate correct? |
|---|---|---|
| Pointer smoothing | `1 - 0.0015^delta` | ✅ |
| Cursor rise | τ = 0.34 s | ✅ exponential |
| Cursor return | τ = 1.40 s | ✅ exponential |
| Dolly lerp | 0.07 | ❌ naive |
| Camera lerp | 0.045 | ❌ naive |
| Dolly auto-return delay | 2.4 s | ✅ wall clock |
| Dolly auto-return rate | 0.35 /s | ✅ × delta |

**No cooldown, no debounce, no rearm, no throttle anywhere.** Every gesture is
continuous and can be re-engaged instantly.

---

## 7. What is declared and not built

`INTERACTION` contains a fully specified subsystem that does not exist:

```ts
ripple: {
  enabled: true, speed: 340, amplitude: 11, lifetime: 0.9,
  bandWidth: 40, rearmRequiresExit: true,
}
```

**No ripple is implemented.** Nothing reads any of these six values. The intended
behaviour — a travelling band radiating outward from where the cursor touched the
bridge — is absent.

```ts
flight: {
  avoidRadius: 70, speedFloor: 0.92, maxDeflection: 62,
  recoveryRate: 3.2, approachAvoidScale: 0.35,
}
```

**Also unread.** The flight-time avoidance that *is* implemented uses
`influenceRadius`/`maxDisplacement` — the same constants as the seated
interaction — rather than these. So `speedFloor` (the guarantee that a particle
never drops below 92% of its speed) and `approachAvoidScale` (reduced deflection
during the final approach so the landing is not disturbed) are specified
behaviours that do not happen.

```ts
spring: { stiffness: 6.0, damping: 0.86 }
```

**Unread.** The interaction spring is exponential smoothing with two time
constants, not a stiffness/damping pair.

```ts
touch.minHoldForRipple: 0
touch.releaseUsesReturnResponse: true
cursorDepth: "nearestBridgePoint"     // descriptive only
```

All unread. `releaseUsesReturnResponse` happens to be true of the implementation,
but by accident of how the spring works rather than because anything reads it.

⚠ `hygiene-check.mjs` does not flag any of these, because its nested-key
heuristic only reports leaf names longer than four characters that appear nowhere
else in `src/` — and `speed`, `amplitude`, `lifetime`, `stiffness`, `damping` are
either on the common-word filter or appear coincidentally elsewhere.

---

## 8. Verification

`npm run interact` — 8 checks, all currently passing:

```
ok  mouse hover engages                      peak 0.624
ok  hover field is HELD, not an envelope     held 0.805
ok  leaving releases                         settled to 0.036
ok  touch press-and-hold engages             peak 0.629
ok  lifting a finger releases                settled to 0.020
ok  push-in reaches full travel              dolly 0.901
ok  push-in disperses the span               disperse 0.876
ok  push-in auto-returns                     dolly 0.047
```

Fields are read directly (`__cursorStrength`, `__dolly`, `__disperse`) rather than
diffed from screenshots, because a pixel diff can only report that *something*
moved. Waits are on **values, not durations**: under a software rasteriser the
frame rate is a tenth of real and the return spring is 1.6 s of scene time, so a
fixed wall-clock wait would report a half-finished recovery as a failure.
