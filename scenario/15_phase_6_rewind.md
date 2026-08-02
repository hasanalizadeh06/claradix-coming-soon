# 15 — PHASE 6 · REWIND

**`T+32.400` → `T+40.400` · duration 8.000s · 480 frames at 60fps**

**Optional. Runs only when `SCENE.loop === true`. Default is `false`.**

---

## 15.1 The one-line version

> Twenty seconds after the bridge completed, the text fades away and the bridge
> comes apart — near to near, top-down, exactly reversing the build — until the
> valley is empty again and one speck brightens.

---

## 15.2 Why this is off by default

```ts
SCENE.loop = false
```

This default is a design decision, and it is worth defending because it will be
questioned.

**A landing page that repeatedly destroys itself while somebody is trying to
read it is hostile.**

The page's purpose is to communicate a launch date and capture an email address.
A visitor who arrives, starts reading the sub-headline, and watches the entire
background dismantle itself has been interrupted by the page they came to read.
If they were mid-way through typing an email address, worse.

The rewind is also the least defensible use of GPU time in the project — a
laptop on battery running a permanent 41.6-second build/destroy cycle is a real
cost paid for a diminishing return.

> **What it is genuinely good for:**
> - Design review, where you want to see the build repeatedly without reloading
> - A showreel or screen recording
> - A kiosk or trade-show display, where nobody is reading and the loop is the
>   point
> - Social media capture
>
> Those are real uses. They are just not "a person visiting the website."

**The flag exists so the client can turn it on deliberately.** That is the whole
design: make it available, make it one line, do not make it the default.

---

## 15.3 The cycle

```
T+0.000    ┌─ build ─────────────────────────────┐
T+12.400   │  bridge complete                    │
T+12.400   ├─ UI reveal (3.1s)                   │
T+15.520   │  page fully readable                │
           │                                     │
           ├─ HOLD (20.000s) ────────────────────┤
           │  the living scene, fully interactive│
           │                                     │
T+31.500   ├─ UI fade out begins (900ms lead)    │
T+32.400   ├─ REWIND (8.000s) ───────────────────┤
T+40.400   │  valley empty, particles dormant    │
           │                                     │
T+40.400   ├─ restart delay (1.200s) ────────────┤
T+41.600   └─ cycle restarts at T+0.000 ─────────┘

Full cycle: 41.600 seconds
```

```ts
LOOP = {
  holdAfterComplete: 20.000,     // measured from T+12.400
  rewind: {
    duration: 8.000,
    uiFadeOutLeadTime: 0.900,
    uiFadeOutDuration: 0.600,
    retraceExact: false,
  },
  restartDelay: 1.200,
}
```

### The hold is measured from completion, not from UI settle

`holdAfterComplete` runs from **`T+12.400`** (`TIMELINE.phase5_livingStart`),
not from `T+15.520` when the UI finishes.

The brief says *"20 seconds after the bridge is built"*, and the bridge is built
at `T+12.400`. The UI reveal is a separate system that happens to overlap.

**Effective reading time:** `T+15.520` → `T+31.500` = **15.98 seconds** of a
fully readable, fully interactive page per cycle.

> That is the number to argue about if the loop is enabled. Sixteen seconds is
> enough to read the headline and the sub-headline. It is **not** enough to read
> them, decide, click *Get notified*, and type an email address. If the client
> wants the loop on for a live page, `holdAfterComplete` should go up
> substantially — 45s or more. See §15.9.

---

## 15.4 The reversal

### Ordering 1 — spatial: near → far

The exact reverse of assembly.

```
rewindAt(u) = REWIND.start + u × REWIND.spatialSpan
```

| `u` | Location | Departs at |
|---|---|---|
| 0.00 | bottom-left of frame | `T+32.400` |
| 0.25 | near approach | `T+33.977` |
| 0.50 | mid-span | `T+35.555` |
| 0.75 | past the far tower | `T+37.132` |
| 1.00 | far horizon | `T+38.710` |

The disassembly front travels **away from the camera**, the opposite of the
build.

### Ordering 2 — structural: top-down

The exact reverse of the load-bearing order.

```
railing     ← leaves first    ┄┄┄┄┄┄┄┄┄┄┄
hangers                       │ │ │ │ │ │
mainCables                    ╲_________╱
deck                          ▀▀▀▀▀▀▀▀▀▀▀
towers                        ║         ║
piers       ← leaves last     ▓▓       ▓▓
```

```ts
REWIND.layerOffset = {          // seconds
  railing:    0.000,
  hangers:    0.058,
  mainCables: 0.145,
  deck:       0.290,
  towers:     0.435,
  piers:      0.580,
}
```

> **Why top-down and not bottom-up:** because you cannot remove a tower while a
> cable still hangs from it, for the same reason you could not hang the cable
> before the tower existed. The scene's structural honesty runs in both
> directions.
>
> It also looks correct: the fine detail evaporates first and the heavy
> foundations persist longest, which is how real structures decay and how
> demolition actually sequences.

### It is 0.65× the build

```
build:  12.400s
rewind:  8.000s
ratio:   0.645
```

> **Why faster:** a rewind that takes as long as the build reads as an error —
> the viewer thinks something has gone wrong and the animation is replaying. At
> roughly two-thirds speed it reads as deliberate, as *undoing* rather than
> *repeating*.
>
> Faster than ~0.5× and it reads as a collapse, which is a different emotional
> event entirely and one this scene does not want. The bridge is not failing;
> it is being put away.

---

## 15.5 What one particle does

### Stage A — release · per-particle

State changes `seated` → `departing`.

- Brightness rises `0.74` → `1.00` over 120ms — **the same peak as arrival**
- The particle lifts **out of** its position along the local structural normal
  (perpendicular to the deck, outward from a tower leg)
- Initial speed `REWIND.releaseSpeed` = **34 u/s**
- Trails resume

> The brief symmetry with the seating snap is deliberate. Departure is
> acknowledged the same way arrival was.

### Stage B — the return flight

State `departing` → `returning`.

```ts
REWIND.retraceExact = false
```

**Particles do not retrace their original flight paths.**

They take a simplified direct route: a single smooth arc from their bridge
position down to their original seed point on the terrain, with a modest barrel
roll (`turns × 0.6` of the outbound value).

> **Why not retrace exactly:**
>
> An exact reversal looks like **video played backwards**. The eye is extremely
> good at detecting time-reversed motion — decelerations that should be
> accelerations, easing curves running the wrong way — and the moment it
> registers, the illusion that these are objects with agency collapses. They
> stop being particles going home and become a recording being scrubbed.
>
> A different, simpler return path preserves the fiction: these things chose to
> come here, and now they are choosing to leave.

**The return river runs the other way** — from the bridge line back down and
toward the camera — and it is thinner and less organised than the outbound
river, because particles are departing from all along the structure rather than
being funnelled from one source.

### Stage C — landing

The particle arrives at its **original seed position** — the exact spot it
occupied at `T+0.000`.

- Decelerates with `easeOutQuad` — gentler than the `easeOutQuint` of assembly
- Brightness falls `1.00` → `0.17` over 340ms
- State → `dormant`
- Trails stop
- Shimmer resumes

> **Same seed, not a new one.** This matters for the loop: if particles landed
> at fresh random positions each cycle, the ground's density pattern would drift
> and the second build would differ from the first. Returning to the original
> seeds makes the cycle exactly repeatable.

---

## 15.6 The UI leaves first

```ts
LOOP.rewind.uiFadeOutLeadTime = 0.900     // begins BEFORE the rewind
LOOP.rewind.uiFadeOutDuration = 0.600
```

At **`T+31.500`** — 900ms before the first particle moves — the UI begins to
fade.

| Property | Value |
|---|---|
| Start | `T+31.500` |
| Duration | 600ms |
| Animation | opacity `1 → 0`, translateY `0 → −8px` |
| Easing | `cubic-bezier(0.4, 0, 1, 1)` — ease-in, the mirror of the reveal |
| Order | **All elements together**, no stagger |
| Complete | `T+32.100`, 300ms before the rewind starts |

### Why no stagger on exit

The reveal is staggered over 3.1 seconds because the viewer is meant to *read*
each element as it arrives. The exit is not asking to be read — it is getting
out of the way. Staggering it would draw attention to a moment that should be
unremarkable.

### Why it leads the rewind

So that nobody is reading text while the page dismantles itself underneath it.
By the time the first railing particle lifts, the text is already gone and the
frame is purely the scene again.

---

## 15.7 Frame-by-frame

| `T+` | Front at `u ≈` | Seated | Airborne | Bloom | Notes |
|---|---|---|---|---|---|
| 31.500 | — | 100% | 0% | 0.850 | **UI fade-out begins** |
| 32.100 | — | 100% | 0% | 0.850 | UI gone |
| **32.400** | **0.00** | 100% | 0% | 0.850 | **Rewind begins.** Foreground railing lifts. |
| 33.000 | 0.10 | 93% | 7% | 0.856 | |
| 34.000 | 0.25 | 79% | 21% | 0.866 | Near approach dissolving |
| 35.000 | 0.41 | 63% | 36% | 0.874 | |
| 35.600 | 0.50 | 53% | 46% | 0.878 | **Halfway.** Main tower coming apart. |
| 36.500 | 0.65 | 39% | 60% | 0.870 | Return river at maximum density |
| 37.500 | 0.81 | 22% | 76% | 0.848 | Only the far section remains |
| 38.500 | 0.96 | 6% | 91% | 0.812 | Far tower dissolving |
| 38.710 | **1.00** | 2% | 95% | 0.802 | Last particle departs the bridge |
| 39.400 | — | 0% | 68% | 0.716 | Bridge gone. Return river still in flight. |
| 40.000 | — | 0% | 24% | 0.548 | Ground refilling |
| **40.400** | — | 0% | **0%** | **0.300** | **All dormant.** Valley empty. |
| 41.600 | — | — | — | 0.300 | **Cycle restarts.** |

### The last 1.7 seconds have no bridge and no ground

Between `T+38.710` (last particle leaves the bridge) and `T+40.400` (last
particle lands), the frame contains **only a return river** crossing an empty
valley.

This is a genuinely striking image and it is the only time in the scene it
occurs — during the build, there is always either ground particles or bridge or
both. It is worth not compressing.

### Bloom falls with the population

Bloom is not scripted during rewind; it follows the light actually present.
`0.850` → `0.300` as particles land and dim, arriving exactly at the Phase 0
value.

---

## 15.8 Interaction during rewind

**Fully active.** Every rule from Phase 5 applies to seated particles, and every
rule from Phases 1–3 applies to moving ones.

| State | Population | Behaviour |
|---|---|---|
| `seated` | falling from 100% to 0% | Displacement + spring |
| `departing` | transient | Steering avoidance |
| `returning` | rising then falling | Steering avoidance |
| `dormant` | rising to 100% | **None** |

**Law 4 holds in reverse:** a returning particle never stops. The cursor
deflects its direction, not its speed.

### Deadlines are softer here

A returning particle has a landing time, but missing it by 200ms costs nothing —
it lands slightly late into an empty valley, and the restart delay absorbs it.

```ts
REWIND.landingDeadlineSlack = 0.400      // vs. 0.000 for assembly
```

Contrast with assembly, where `seatAt` is a hard deadline because a straggler
arrives into a *finished bridge* and is obvious. Nothing is watching the ground.

### Dolly

Remains **enabled**. Pushing in during rewind scatters whatever is still seated,
composing normally with the disassembly.

---

## 15.9 If the loop is enabled on a live page

Practical guidance, because the defaults are tuned for review, not for
production looping.

| Setting | Review default | Recommended for a live looping page |
|---|---|---|
| `LOOP.holdAfterComplete` | 20.000s | **45.000s or more** |
| `SCENE.timeScale` | 1.0 | 1.0 |
| Loop while a form field is focused | — | **Suspend the loop entirely** |
| Loop while the tab is hidden | — | Suspend (already handled by rAF) |

### Mandatory guard — form focus

If the loop is enabled, it **must** be suspended while the subscribe form is
open or any input is focused.

```
if (document.activeElement is an input || subscribeFormOpen) suspendLoop()
```

A viewer typing an email address while the page dismantles itself behind them
is the worst possible moment for this effect, and it is entirely avoidable.

> This guard is required whenever `SCENE.loop` is `true` in a production build.
> It is listed in [`38_acceptance_criteria.md`](38_acceptance_criteria.md).

### Reduced motion

```ts
A11Y.reducedMotion.disableLoop = true
```

`prefers-reduced-motion` **always** disables the loop, regardless of
`SCENE.loop`. A repeating 41.6-second full-screen animation is precisely what
that setting exists to prevent.

---

## 15.10 Failure modes

**1 · Particles land at new random positions.**
The ground's density pattern drifts cycle by cycle and the second build differs
from the first. Particles must return to their **original** seed positions.

**2 · Exact retrace.**
`retraceExact` left `true`. Symptom: unmistakably video-played-backwards. The
easing curves run the wrong way and the eye catches it immediately.

**3 · Trail buffer not cleared at restart.**
Ghosting accumulates across cycles until the frame is a smear. Clear the buffer
at `T+41.600`.

**4 · UI fade-out staggered.**
Draws attention to a moment that should be invisible.

**5 · Loop runs while an input is focused.**
See §15.9. If the loop is on, this guard is not optional.

**6 · Bloom scripted rather than derived.**
Symptom: bloom stays at 0.850 into an empty valley, so the last second glows
with nothing in it. Bloom during rewind should follow the actual light.

**7 · Rewind too slow.**
At 1.0× it reads as the animation having restarted by mistake. Keep it at
0.65×.

---

## 15.11 Phase 6 checklist

- [ ] `SCENE.loop` defaults to **`false`**.
- [ ] The hold is measured from `T+12.400`, not from the end of the UI reveal.
- [ ] UI fade-out begins **900ms before** the rewind, all elements together,
      no stagger.
- [ ] Spatial order is **near → far** — the exact reverse of assembly.
- [ ] Structural order is **top-down**: railing → hangers → cables → deck →
      towers → piers.
- [ ] No tower is removed while a cable still hangs from it.
- [ ] Rewind duration is 8.000s ≈ **0.65×** the build.
- [ ] Particles do **not** retrace their outbound paths.
- [ ] Every particle lands at its **original** seed position.
- [ ] Bloom is **derived from actual light**, falling to exactly `0.300`.
- [ ] The frame between `T+38.710` and `T+40.400` shows only the return river
      over an empty valley.
- [ ] Interaction is fully active throughout; Law 4 holds for returning
      particles.
- [ ] Trail buffer is cleared at cycle restart.
- [ ] The cycle is exactly repeatable — cycle 2 is identical to cycle 1.
- [ ] Full cycle length is **41.600s**.
- [ ] `prefers-reduced-motion` disables the loop unconditionally.
- [ ] If loop is enabled in production, it suspends on input focus.

---

## 15.12 End of the screenplay section

Documents `09`–`15` describe every phase of the scene exhaustively. Together
with [`08_SCREENPLAY_FULL.md`](08_SCREENPLAY_FULL.md), they are the complete
temporal specification.

What follows in Sections 4–8 is the **spatial and technical** specification: what
the world is made of, what a particle is, how the camera and interaction work
mathematically, and how all of it maps onto code.

---

**Next:** [`16_world_map.md`](16_world_map.md) — the space all of this happens
in.
