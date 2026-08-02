# State Machine

There are **two** state machines in this project and they are unrelated:

1. **The particle state machine** — six states, derived in the vertex shader,
   82,599 independent instances.
2. **The UI reveal gate** — one boolean, resolved once, never reversed.

There is no third. No scene-level state machine, no phase manager class, no
transition system, no event bus. "Phase" is a pure function of a number.

---

## 1. The particle state machine

### 1.1 It is DERIVED, not STORED

```glsl
float returnDur = 1.5100;
bool isDeparting = uLoop > 0.5 && t >= aRewindAt && t < aRewindAt + returnDur;
bool hasLanded   = uLoop > 0.5 && t >= aRewindAt + returnDur;

bool isDormant     = t <  aLiftAt || hasLanded;
bool isSeated      = t >= aSeatAt && !isDeparting && !hasLanded;
bool isLifting     = !isDormant && !isSeated && !isDeparting && t < aLiftAt + 0.4200;
bool isApproaching = !isDormant && !isSeated && !isDeparting && t >= aSeatAt - approachDur;
```

Three comparisons per particle, **zero memory**, no transition events, no
callbacks, no bookkeeping.

Critically, the state is computed **in the same shader invocation that computes
the position.** That removes any possibility of a one-frame lag between a particle
seating and its trail stopping.

> A CPU-side check running one frame late accumulates a persistent faint blur
> exactly on the bridge's shape, and the bridge looks out of focus with no
> findable cause.

### 1.2 The six states

| State | Condition | Position source | Brightness |
|---|---|---|---|
| **DORMANT** | `t < aLiftAt` or `hasLanded` | `aSeed`, completely static | 0.17 ± 0.055 shimmer |
| **LIFTING** | `t < aLiftAt + 0.42` | ballistic along `aSeedNormal` | 0.17 → 0.55 by *distance* |
| **GLIDING** | else, `t < aSeatAt - approachDur` | `guidePoint(u)` + barrel roll | 0.92 |
| **APPROACHING** | `t >= aSeatAt - approachDur` | `mix(guide, aTarget, smoothstep)` | 0.92 → 1.00 |
| **SEATED** | `t >= aSeatAt` | `aTarget` + breathe | 1.00 → 0.74 over 180 ms |
| **DEPARTING** | loop only, `t >= aRewindAt` | `mix(aTarget, aSeed, easeOutQuad)` + arc | 1.00 flash → 0.17 |

`approachDur = flightSpan * FLIGHT.approachFraction` = 22% of the flight.

### 1.3 The transition graph

```
                      ┌─────────────────────────────────────┐
                      │                                     │
                      ▼                                     │
                 ┌─────────┐                                │
      t=0 ──────►│ DORMANT │                                │
                 └────┬────┘                                │
                      │ t >= aLiftAt                        │
                      ▼                                     │
                 ┌─────────┐                                │
                 │ LIFTING │  0.42s                         │
                 └────┬────┘                                │
                      │                                     │
                      ▼                                     │
                 ┌─────────┐                                │
                 │ GLIDING │                                │
                 └────┬────┘                                │
                      │ t >= aSeatAt - 0.22·span            │
                      ▼                                     │
              ┌──────────────┐                              │
              │ APPROACHING  │                              │
              └──────┬───────┘                              │
                     │ t >= aSeatAt                         │
                     ▼                                      │
                ┌─────────┐                                 │
                │ SEATED  │◄──── the bridge                 │
                └────┬────┘                                 │
                     │ uLoop && t >= aRewindAt               │
                     ▼                                      │
              ┌────────────┐                                │
              │ DEPARTING  │  1.51s                         │
              └─────┬──────┘                                │
                    │ t >= aRewindAt + 1.51                 │
                    └───────────────────────────────────────┘
                              hasLanded → DORMANT
```

**There are no branches, no conditions on external state, and no way to enter a
state out of order.** The graph is a line that closes into a circle. That is a
direct consequence of state being a function of `t` alone.

### 1.4 Ordering is exhaustive and mutually exclusive

The GLSL if/else chain:

```glsl
if      (isDormant)     { ... }
else if (isDeparting)   { ... }
else if (isSeated)      { ... }
else if (isLifting)     { ... }
else                    { /* GLIDING / APPROACHING */ }
```

Every particle takes exactly one branch, every frame. `brightness` is declared
uninitialised and assigned in all five — the final `else` has no condition, so the
chain cannot fall through.

`isDeparting` sits **before** `isSeated` in both the boolean definitions and the
branch order. `isSeated` is defined as `t >= aSeatAt && !isDeparting &&
!hasLanded`, so every downstream branch that tests it stays correct without being
touched: **the bridge simply stops being a bridge at `aRewindAt`.**

### 1.5 Per-state side effects

| State | `sizeBoost` | Trail? | Interaction |
|---|---|---|---|
| DORMANT | 1.0 | ❌ suppressed | ❌ exempt (`!isDormant` guard) |
| LIFTING | 1.0 | ✅ | ✅ projected ⊥ `aSeedNormal` |
| GLIDING | 1.0 | ✅ | ✅ projected ⊥ `centrelineTan(aU)` |
| APPROACHING | 1.0 | ✅ | ✅ projected ⊥ `centrelineTan(aU)` |
| SEATED | 1.35 → 1.0 over 30 ms | ❌ suppressed | ✅ **full radial**, no projection |
| DEPARTING | 1.35 flash | ❌ suppressed | ✅ full radial |

**Trail suppression is by state, not by velocity.** Dormant particles have not
moved; seated ones are structure. A bridge that smears looks out of focus, and it
would look that way for the entire time anyone is reading the page.

**Seated particles are exempt from Law 4** (lateral projection). They are
structure, not traffic — there is no progress left to protect, and a bridge that
refuses to be pushed along its own axis feels like it is on rails.

### 1.6 The snap

```glsl
float decay = clamp(since / 0.1800, 0.0, 1.0);
brightness = mix(1.0000, 0.7400, decay * decay);
sizeBoost  = mix(1.3500, 1.0, clamp(since / 0.03, 0.0, 1.0));
```

**One frame at peak, then a decay.** Two or three frames and the construction
front develops a bright leading edge that reads as a scanning beam sweeping the
bridge into existence — a completely different, far more generic idea.

The brightness decay is `decay²`, so it is fast at first and slow at the end.

### 1.7 Departure is acknowledged the way arrival was

```glsl
float flash = 1.0 - smoothstep(0.0, 0.10, k);
brightness = mix(..., 1.0, flash);
sizeBoost  = mix(1.0, 1.3500, flash);
```

Brightness rises 0.74 → 1.00 on release: **the same peak as arrival.** The
symmetry is deliberate.

But the *easing* is not symmetric. Assembly uses `easeInOutCubic` into
`smoothstep`; the return uses `easeOutQuad`, which is gentler. **Arriving is an
event and deserves a hard landing; leaving is a decision and does not.**

---

## 2. The UI reveal gate

`src/lib/reveal.ts`, 137 lines. One boolean.

```
                    ┌──────────┐
   mount ──────────►│ WAITING  │
                    └────┬─────┘
                         │  first of:
                         │    ticker.now() >= 12.4
                         │    prefers-reduced-motion
                         │    20s wall clock
                         ▼
                    ┌──────────┐
                    │ REVEALED │  ◄── terminal. never returns.
                    └──────────┘
```

Implemented as a `useState(false)` plus a `requestAnimationFrame` poll. **Not an
event subscription** — the ticker has no "phase changed" signal and does not need
one, because polling a pure function is cheaper than maintaining a subscription.

### Why it never reverses

The loop rewinds the bridge. The UI does not go with it. Removing text from under
someone who is reading it — or from under a half-typed email address — is hostile
in a way no animation earns back.

This deviates from the pack (§15.6, "The UI leaves first"). See
[`Timeline.md`](Timeline.md) §6.

### SSR and the hidden state

```tsx
const [revealed, setRevealed] = useState(false);
```

Server-rendered markup must match the client's **first** render exactly, and on
the server there is no clock and no media query. Both start `false`.

Which means the prerendered HTML ships with the UI hidden — so the rule that hides
it is gated on a `.js` class set by an inline `<head>` script. **Hidden is a state
the page may only enter once it is certain it can leave it.**

---

## 3. Interaction state

Not a state machine — three independent continuous scalars.

| Field | Range | Where it lives |
|---|---|---|
| `cursorStrength` | 0–1 | `BridgeScene`, asymmetric exponential spring |
| `pointer.dolly` | 0–1 | `Stage`, lerp 0.07 toward `dollyTarget` |
| `touchHeld` | bool | `Stage`, set on `pointerdown`, cleared on `pointerup` |

There is **no cooldown, no debounce, no rearm, and no hysteresis** on any of
them. `INTERACTION.ripple.rearmRequiresExit` is declared in config and read by
nothing — the ripple system it belongs to is not implemented at all.

The asymmetry that makes the bridge read as matter is in the spring's time
constant, not in a state:

```ts
const tau = proximity > cursorStrength
  ? INTERACTION.riseResponse      // 0.34s
  : INTERACTION.returnResponse;   // 1.40s
cursorStrength += (proximity - cursorStrength) * (1 - Math.exp(-frame.delta / tau));
```

**Fast to scatter, slow to return.** That 1:4 asymmetry is what makes the bridge
read as MATTER rather than as a weightless field effect: things easy to disturb
and effortful to restore have mass.

### The field is HELD

`proximity` has **no time term**. A stationary cursor produces a constant field,
so nothing decays underneath it.

> An envelope-based version was built and rejected — it began rebuilding while the
> viewer was still pointing at the bridge and read as a flicker rather than as a
> response.

---

## 4. The completion pulse

The only latched, one-shot event in the scene.

```ts
let pulseFired = false;
let pulseStart = -1;

if (!pulseFired && t >= phase4_completionStart + COMPLETION_PULSE.startDelay) {
  pulseFired = true;
  pulseStart = t;
}
if (pulseStart >= 0) {
  const k = (t - pulseStart) / COMPLETION_PULSE.duration;
  uPulseU = k <= 1 ? 1 - k : -1;
}
```

`uPulseU = -1` means "not firing" — the shader tests `if (uPulseU >= 0.0)`.

⚠ **This is CPU state and it is not reset by `seek()`.** Seeking backwards past
T+11.4 leaves `pulseFired` true, so the pulse never fires again in that session.
Seeking straight to T+16 from T+0 fires it at 16 rather than 11.4. Both are
visible in capture output as an anomalous `uPulseU` value, and neither is
corrected.

It is also **not reset by the loop**, so on the second cycle the bridge completes
with no pulse at all.
