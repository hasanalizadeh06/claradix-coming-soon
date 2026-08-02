# Timeline

The scene clock, the phases, seeking, and the loop.

> **RE-TIMED (July 2026) — the four-act master timeline.** The numbers quoted
> in this document describe the earlier 12.4s build with the loop off. The
> scene now runs one 35-second cycle, looping forever with no visible seam:
>
> | Act | Name | Window |
> |---|---|---|
> | I | Awakening | 0 – 5s |
> | II | Construction (far → near) | 5 – 15s |
> | III | Stillness (sparkles at structural nodes) | 15 – 20s |
> | IV | Return (near → far, spirals unwind home) | 20 – 35s |
>
> `src/lib/config.ts` (`TIMELINE`, `LIFT`, `ASSEMBLY`, `LOOP`, `CYCLE_LENGTH`)
> is the single source of truth; where this document disagrees with config,
> config wins. The mechanics described below — two clocks, seeking, the
> pure-function-of-time particle schedule, the modulo wrap — are unchanged.

---

## 1. Two clocks

`src/lib/ticker.ts`, 290 lines. One `requestAnimationFrame` loop for the whole
page.

```ts
interface FrameInfo {
  delta:     number;   // seconds since last frame, CLAMPED both ends
  raw:       number;   // the same interval UNCLAMPED
  elapsed:   number;   // wall seconds since start, excluding time hidden
  fps:       number;   // rolling average over ~1s
  sceneTime: number;   // elapsed * timeScale, offset by any seek
  phase:     Phase;    // 0..6
}
```

### `delta` vs `raw`

```ts
const raw   = (now - this.lastTime) / 1000;
const delta = Math.min(Math.max(raw, 0), MAX_DELTA);   // MAX_DELTA = 1/20
```

**Animation must use `delta`**, or a tab restored after two minutes advances the
scene by two minutes in a single step.

**Performance measurement must use `raw`**, because the clamp hides precisely the
long frames it is looking for: a device stuttering at 200 ms per frame reports a
healthy 50 ms once clamped, and the governor never sees a reason to act.

The clamp is at **both ends**. The lower bound stops any clock irregularity
running the scene backwards, which is never a thing a viewer should be able to
observe.

### The negative-clock bug

`lastTime` is seeded from the **first rAF callback**, not from `performance.now()`
in `start()`.

Those are two different clocks. The value passed to a rAF callback is the time
the *frame began*, and that can precede a `performance.now()` reading taken when
the loop was installed. Measured: the first callback arrived carrying t = 2320 ms
against a `start()` reading of ~4500 ms — a single **−2.18 s** delta, which
`Math.min(raw, MAX_DELTA)` passed straight through because it had no lower bound.

The scene clock then ran negative for its first two seconds, so Phase 0 lasted
three seconds instead of 1.2 and every schedule was offset.

### Scene time is not `elapsed * timeScale`

A seek moves the origin without touching wall time, so the two are tracked
separately.

```ts
this.elapsed += delta;
if (!this.paused) this.sceneTime += delta * this.timeScale;
```

---

## 2. Visibility

The loop **stops completely** when the tab is hidden. A WebGL loop left running in
a background tab is the most common cause of "this site drains my battery".

```ts
HIDDEN_RESUME_THRESHOLD = 0.5
```

A tab hidden for longer than that returns to the **finished scene** rather than
resuming mid-build — a viewer coming back to a half-built bridge has lost the
context that made it legible, and would see structure appearing with no
explanation.

---

## 3. The phases

```ts
TIMELINE = {
  phase0_dormantStart:     0.0,
  phase1_awakeningStart:   1.2,
  phase2_glideStart:       2.8,
  phase3_assemblyStart:    5.4,
  phase4_completionStart: 11.2,
  phase5_livingStart:     12.4,

  uiRevealStart:          12.4,
  uiRevealLastStart:      15.0,
  uiRevealEnd:            15.52,
}
```

| Phase | Range | Name | What dominates |
|---|---|---|---|
| 0 | 0.0 – 1.2 | Dormant | A dark valley. Particles lie on the ground, shimmering. |
| 1 | 1.2 – 2.8 | Awakening | Lift-off, far end first, spreading toward the camera. |
| 2 | 2.8 – 5.4 | Glide | The river. Maximum population in the air. |
| 3 | 5.4 – 11.2 | Assembly | The bridge appears, far → near, bottom-up per section. |
| 4 | 11.2 – 12.4 | Completion | The last particles land. One pulse fires. |
| 5 | 12.4 – 32.4 | Living | Idle breathing, interaction, UI reveal. |
| 6 | 32.4 – 42.0 | Rewind | Only when `SCENE.loop` is on. |

### Phases describe the SCENE, not individual particles

> Phase boundaries describe what the SCENE looks like overall. They are not gates
> that every particle passes through together — at T+4.000 the frame contains
> dormant, lifting and gliding particles simultaneously. **That overlap is what
> makes the scene read as a process rather than as three animations played in
> sequence.**

The lift window is 4.4 s long while Phase 1 is only 1.6 s. The near ground is
still releasing particles at T+5.400, well into "assembly".

```ts
phaseAt(sceneTime): Phase       // pure, so scripts and the prerender can ask
```

---

## 4. Boundary arithmetic

Every boundary is derivable, and the derivations are checks:

```
first pier seats:   5.400 + (1-1.0)·5.22 + 0.000  =  5.400   = phase3 start  ✓
last railing seats: 5.400 + (1-0.0)·5.22 + 0.580  = 11.200   = phase4 start  ✓
```

The minimum-flight guard pulls `liftAt` **earlier**, never `seatAt` later,
because `seatAt` is a hard deadline and the phase boundary depends on the last
particle landing exactly at T+11.200.

---

## 5. Seek

```ts
seek(t) {
  this.sceneTime = t;
  for (const listener of this.seekListeners) listener();
}
```

Exposed in DEV only as `window.__claradixSeek(t)`. **`seek()` must never be
called in production.**

Seeking works because **a particle's position is a pure function of its
attributes and the current scene time.** Nothing is integrated frame to frame. So
`seek(10.5)` renders exactly the T+10.500 frame with no simulation, and every
visual acceptance check depends on it.

### The one thing that must be told

```ts
onSeek(listener): () => void
```

Almost nothing needs it. The exception is anything that **accumulates across
frames**, and there is exactly one of those: the trail buffer. After a jump it
holds a smear from wherever the clock used to be, and without this it drags ten
seconds of the wrong history across the frame being measured.

`Stage` subscribes: `ticker.onSeek(() => this.post.clearTrails())`.

---

## 6. The loop

```ts
SCENE.loop = false          // DEFAULT
```

`false`, and that is a design decision rather than laziness. A landing page that
repeatedly dismantles itself while a visitor is reading it is hostile, and with
the 20-second hold a visitor gets only ~16 seconds of readable page per cycle —
enough to read the headline, not enough to read it, decide, and type an email
address.

> It shipped as `true`, directly under that paragraph. The whole rewind was also
> unimplemented at the time, so the flag did nothing and nobody noticed which way
> it was pointing.

### Derived constants

```ts
REWIND_START           = phase5_livingStart + LOOP.holdAfterComplete
                       = 12.4 + 20.0 = 32.4

REWIND_RETURN_DURATION = rewind.duration + landingDeadlineSlack
                       - rewind.spatialSpan - rewind.layerOffset.piers
                       = 8.0 + 0.4 - 6.31 - 0.58 = 1.51

CYCLE_LENGTH           = REWIND_START + duration + slack + restartDelay
                       = 32.4 + 8.0 + 0.4 + 1.2 = 42.0
```

**Derived, never typed in.** Every one of those numbers already existed above;
writing them out again is how a timeline drifts out of step with itself the first
time somebody adjusts the hold.

`REWIND_RETURN_DURATION` is what `spatialSpan`'s comment means by *"derived so the
last departure leaves room to land by the phase end"*. The last particle to leave
is the one at `u=1` in the last layer, at `spatialSpan + piers` into the rewind;
the deadline is `duration + landingDeadlineSlack`. What is left over is the flight
time, and giving every particle the same one is what stops the early departures
drifting home at a fifth of the speed of the late ones.

### The loop is one modulo

```ts
const raw = reduced ? phase5_livingStart + 4 : frame.sceneTime;
const t   = loopEnabled ? raw % CYCLE_LENGTH : raw;
```

Because every position is a pure function of time, repeating the film costs
exactly this. Nothing accumulates, nothing has to be reset, and there is no state
that could survive a cycle and make the second build differ from the first.

It is also why particles return to their **original seed** rather than to a fresh
random one. Land them somewhere new and the ground's density pattern drifts a
little each cycle; land them where they started and the loop is exactly
repeatable, forever, from one line.

**Wrapped in `BridgeScene` and nowhere else.** The particle shader, the swarm
lights, the bloom curve and the ground glow all read this clock, and a wrap
applied inside any one of them is a wrap the other three do not get.

### The rewind's two inversions

```ts
LOOP.rewind = {
  duration: 8.0,          // 0.65× the build
  spatialSpan: 6.31,
  layerOffset: { railing: 0.0, hangers: 0.058, mainCables: 0.145,
                 deck: 0.29, towers: 0.435, piers: 0.58 },
  releaseSpeed: 34,
  returnArcHeight: 48,
  landingDeadlineSlack: 0.4,
  retraceExact: false,
  uiFadeOutLeadTime: 0.9,
  uiFadeOutDuration: 0.6,
}
LOOP.restartDelay = 1.2
```

**Spatially** the front runs `u` ascending, so disassembly travels *away* from
the camera while the build travelled *toward* it.

**Structurally** the layers leave top-down: railing first, piers last. You cannot
remove a tower while a cable still hangs from it, for exactly the reason you could
not hang the cable before the tower existed.

**0.65× the build** (8.0 s against 12.4). A rewind that takes as long as the build
reads as an error — the viewer thinks something has gone wrong and the animation
is replaying. At roughly two-thirds speed it reads as *undoing* rather than
*repeating*. Faster than ~0.5× and it reads as a collapse, which is a different
emotional event entirely and one this scene does not want. **The bridge is not
failing; it is being put away.**

### Not implemented from the loop spec

`uiFadeOutLeadTime` and `uiFadeOutDuration` are declared and **not wired**. The
pack says the UI leaves before the rewind; this implementation keeps it. The
reasoning recorded in `lib/reveal.ts` is that removing text from under someone who
is reading it — or worse, from under a half-typed email address — is hostile in a
way no animation earns back, and that the loop is off by default precisely because
of that hostility.

That is a deliberate deviation from the specification and it is not recorded in
the decision log as one. **It should be.**

---

## 7. UI reveal timing

```ts
UI_REVEAL = {
  duration: 0.52,
  easing: "cubic-bezier(0.16, 1, 0.3, 1)",
  translateY: 12,
  sequence: [
    { id: "logo",             offset: 0.00 },
    { id: "tagline",          offset: 0.15 },
    { id: "eyebrow",          offset: 0.30 },
    { id: "headline-line-1",  offset: 0.55 },
    { id: "headline-line-2",  offset: 0.75 },
    { id: "headline-line-3",  offset: 0.95 },
    { id: "subheadline",      offset: 1.20 },
    { id: "cta",              offset: 1.45 },
    { id: "socials",          offset: 1.70, childStagger: 0.06 },
    { id: "countdown-ring",   offset: 1.95, ringDrawDuration: 0.8 },
    { id: "countdown-units",  offset: 2.40, childStagger: 0.07 },
    { id: "footer",           offset: 2.60 },
  ],
}
```

Durations and staggers **do not scale with `SCENE.timeScale`.** The offsets are
choreography; the 520 ms is UI micro-interaction timing tuned to human perception
of a control appearing, and it is the same whether the intro took 8 seconds or 16.

`tagline` is **not in the pack's list**, which counts eleven elements while the
page has twelve. The masthead's keyword rail had no slot at all — under the old
hardcoded delays it revealed at 120 ms because somebody typed 120.

### The gate

`lib/reveal.ts`. Resolves on the **first of three signals**, and two of them do
not involve the scene at all:

| | Signal | Why |
|---|---|---|
| 1 | scene clock reaches `uiRevealStart` | the intended path |
| 2 | reduced motion requested | immediately, no animation to wait for |
| 3 | a **20-second wall-clock deadline** | regardless of what the scene is doing |

(3) is not only a failure path. **A slow device *should* show its text early while
the scene is still building: the animation is the treat, the page is the point.**

Gating readable text on a WebGL animation is a promise that the animation will
finish. It might not: no WebGL, a failed chunk, a context loss, a device so slow
the clock crawls. Any of those, taken literally, is a blank page forever.

### Once revealed, it stays revealed

The loop rewinds the bridge. The UI does not go with it.

---

## 8. Reduced motion

```ts
A11Y.reducedMotion = {
  skipIntro: true,
  disableLoop: true,
  interactionScale: 0.25,       // damped, not removed
  disableCameraParallax: true,
  disableIdleBreathe: false,    // 0.9u is sub-pixel at normal viewing distance
}
```

**The build either plays or it does not.** A "faster version" is still sweeping
full-screen motion, and the setting means *stop*, not *hurry*.

```ts
if (reduced && A11Y.reducedMotion.skipIntro) {
  particles.material.uniforms.uTime.value = TIMELINE.phase5_livingStart + 4;
}
```

The scene renders its settled frame from the first rendered frame onward.

⚠ `disableLoop` and `disableCameraParallax` are declared and **read by nothing**.
The camera parallax block is gated on `if (!reduced)`, which happens to produce
the right behaviour, but the constant is not what does it. `disableIdleBreathe` is
likewise unread.
