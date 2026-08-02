# 36 — CONFIGURATION

**The single source of truth for every number in this project.**

---

## 36.1 How to use this file

Every other document in this pack quotes numbers. **This file owns them.**

> **Since implementation began, `src/lib/config.ts` is the executable copy of
> this document.** The arbitration order is now: **code → this file → everything
> else.** If `config.ts` and this document disagree, `config.ts` wins and this
> document is filed as a bug; if this document and any other document disagree,
> this one wins.

When document `12_phase_3_assembly.md` says

> the assembly window is `ASSEMBLY.windowSpan` = **5.220s**

it is quoting this file. If the two ever disagree, **this file wins** and the
other document is filed as a bug.

### The rule of one scalar

Wherever possible, related values are **derived from a single scalar** rather
than listed independently. The clearest example is time: the client has already
stated the total intro duration may change. If seven timing values were written
as seven independent constants, changing the duration would mean seven edits and
at least one mistake.

Instead, all timings derive from **`SCENE.timeScale`**. Set it to `0.75` and the
entire intro plays in three-quarters of the time, with every phase, every
stagger, and every easing window scaling in proportion, automatically.

**Values printed in this document are the values at `timeScale = 1.0`.**

> **Corrected.** This document previously named the scalar `TIMELINE.masterScale`
> in one place and `SCENE.timeScale` in another — two names for one value, inside
> one file. `SCENE.timeScale` is the real one.

### Unit conventions

| Symbol | Meaning |
|---|---|
| `u` (unitless) | **world units.** 1 unit = 1 metre, conceptually. |
| `s`, `ms` | seconds, milliseconds |
| `°` | degrees |
| `px` | CSS pixels (UI only, never world space) |
| `T+n` | absolute scene time in seconds from first rendered frame |
| `norm` | a normalised `0.0 – 1.0` value |

### The `u` parameter — read this before anything else

Throughout this pack, the lowercase letter **`u`** used *on its own* means one
specific thing:

> **`u` = normalised position along the bridge centreline.**
> **`u = 0.0` is the NEAR end** — the end closest to the camera, running off the
> bottom-left of the frame.
> **`u = 1.0` is the FAR end** — the end that vanishes toward the right horizon.

This is the backbone of the entire choreography. Assembly runs **`u = 1` → `u = 0`**
(far to near). Rewind runs **`u = 0` → `u = 1`** (near to far).

Do not confuse this with `u` as a world unit; the unit is only ever written as
a suffix on a number (`90u`).

---

## 36.2 `SCENE` — master switches

The top-level flags. These are the things a human is expected to flip.

```ts
export const SCENE = {
  /** Master on/off for the intro build sequence.
   *  false → the bridge is present and complete at T+0.000, UI visible
   *  immediately, interaction live. Used for design review and for the
   *  reduced-motion fallback. */
  playIntro: true,

  /** When true, the scene replays forever: build → hold → reverse → build …
   *  When false, the scene builds once and stays in Phase 5 permanently.
   *  DEFAULT IS false — a landing page that keeps dismantling itself while a
   *  visitor is reading it is hostile. This exists so the client can turn it
   *  on deliberately. */
  loop: false,

  /** Global multiplier on every duration in TIMELINE. See 36.3. */
  timeScale: 1.0,

  /** Skip straight to a given phase on load. Debug only; must be 0 in
   *  production. Values 0–6 map to the seven phases. */
  debugStartPhase: 0,

  /** Render the bridge target point cloud as static dots with no animation.
   *  Debug only — this is how you verify 19_bridge_anatomy geometry without
   *  waiting 12 seconds. */
  debugShowTargetsOnly: false,

  /** Draw the guide curves from 23_flight_choreography as visible lines.
   *  Debug only. */
  debugShowGuideCurves: false,
} as const
```

> **Trap:** `loop` defaults to `false` and that default is a design decision, not
> laziness. See [`15_phase_6_rewind.md`](15_phase_6_rewind.md) §"Why this is off
> by default".

---

## 36.3 `TIMELINE` — the master clock

All values in seconds, at `timeScale = 1.0`.

### Phase boundaries

```ts
export const TIMELINE = {
  phase0_dormantStart:      0.000,
  phase1_awakeningStart:    1.200,
  phase2_glideStart:        2.800,
  phase3_assemblyStart:     5.400,
  phase4_completionStart:  11.200,
  phase5_livingStart:      12.400,

  /** UI reveal runs concurrently with the start of Phase 5. */
  uiRevealStart:           12.400,
  /** When the LAST element BEGINS its fade. It finishes 520ms later. */
  uiRevealLastStart:       15.000,
  /** When the page is actually, fully readable. */
  uiRevealEnd:             15.520,
} as const
```

> **Corrected.** `uiRevealEnd` previously held `15.000`, which is when the footer
> *starts* fading, not when it finishes. `00_START_HERE.md` propagated that as
> "the page is fully readable at T+15.000". It is readable at **T+15.520**.

| Phase | Name | Start | End | Duration |
|---|---|---|---|---|
| 0 | Dormant | `T+0.000` | `T+1.200` | 1.200s |
| 1 | Awakening | `T+1.200` | `T+2.800` | 1.600s |
| 2 | The Glide | `T+2.800` | `T+5.400` | 2.600s |
| 3 | Assembly | `T+5.400` | `T+11.200` | 5.800s |
| 4 | Completion | `T+11.200` | `T+12.400` | 1.200s |
| 5 | Living Scene | `T+12.400` | ∞ | — |
| 6 | Rewind | `T+32.400` | `T+40.400` | 8.000s *(only if `SCENE.loop`)* |

### Critical clarification: phases describe the *wave*, not every particle

This is the most misread part of the timeline, so it is stated bluntly:

> **Phase boundaries describe what the scene looks like overall. They are not
> gates that every particle passes through together.**

At `T+4.000` — nominally "Phase 2, the Glide" — the scene actually contains:

- particles still lying dormant on the ground near the camera *(Phase 0 behaviour)*
- particles lifting off in the mid-ground *(Phase 1 behaviour)*
- a dense river of particles in flight *(Phase 2 behaviour)*
- nothing seated yet *(Phase 3 has not begun)*

And at `T+7.000` — "Phase 3, Assembly" — the scene contains a partially built far
half of the bridge, a river still flowing toward it, *and* particles still
leaving the ground.

The overlap is the point. A scene where every particle lifts at once, then every
particle flies, then every particle lands, looks like three separate animations
played in sequence. A scene with overlapping populations looks like a process.

Each particle's individual schedule is computed from the formulas in §36.8.

---

## 36.4 `WORLD` — coordinate system and extents

```ts
export const WORLD = {
  /** Three.js default handedness: +X right, +Y up, +Z toward viewer.
   *  Camera looks down −Z. */
  unitsPerMetre: 1,

  /** Playable extents. Nothing is authored outside these. */
  bounds: {
    minX: -900, maxX:  900,
    minY:  -40, maxY:  420,
    minZ: -1400, maxZ: 400,
  },

  /** The lowest ground elevation in the valley. */
  valleyFloorY: 0,

  /** A thin mist/haze plane pools in the valley bottom. Not water — it never
   *  reflects. See 18_sky_and_atmosphere. */
  mistPlaneY: 6,

  /** Fog. Linear in view distance, tinted to the sky colour so the horizon
   *  dissolves rather than ending. */
  fogNear: 420,
  fogFar: 2100,
  fogColor: '#070A13',
} as const
```

See [`16_world_map.md`](16_world_map.md) for the annotated map of this space.

---

## 36.5 `BRIDGE` — geometry

### Centreline

The bridge follows a single **Catmull-Rom spline** through five control points.
Everything else — deck, towers, cables, hangers, piers — is generated relative
to this curve.

```ts
export const BRIDGE = {
  /** Control points, NEAR (u=0) to FAR (u=1).
   *
   *  These `u` values are normalised ARC LENGTH, recomputed from the chord
   *  lengths between the points. An earlier draft used 0.22 / 0.45, which put
   *  the tower-to-tower arc at 422u — shorter than the 468u straight-line
   *  distance between the same two points, which is impossible. */
  centreline: [
    { u: 0.00, p: [-520, 34,  300] },   // near abutment, off-frame bottom-left
    { u: 0.18, p: [-300, 38,  120] },
    { u: 0.41, p: [ -60, 42, -160] },   // MAIN TOWER base
    { u: 0.71, p: [ 240, 46, -520] },   // FAR TOWER base
    { u: 1.00, p: [ 520, 50, -880] },   // far abutment, off-frame right
  ],

  /** Total arc length of the centreline, in world units.
   *  Derived, not authored — recompute if control points change.
   *  Current value: ~1,624u */
  arcLength: 1624,

  deckWidth: 46,
  deckThickness: 3.2,

  /** Deck sits this far above the centreline (the centreline runs through the
   *  deck's structural axis). */
  deckCamber: 1.4,
} as const
```

### Spans

The bridge is not uniformly a suspension bridge. It has three distinct sections,
and this matters because the far and near thirds have **no cables** — which is
exactly what the reference frame shows in the foreground.

| Section | `u` range | Structure present |
|---|---|---|
| Near approach viaduct | `0.00 – 0.34` | Piers, deck, railing. **No towers, no cables.** |
| Main suspension span | `0.34 – 0.82` | Both towers, deck, main cable, hangers, railing |
| Far approach | `0.82 – 1.00` | Piers, deck, railing. **No cables.** |

### Towers

```ts
  towers: {
    main: {
      u: 0.41,
      baseY: 42,
      height: 175,          // top at Y = 217
      legSpacing: 38,       // distance between the two legs
      legTaper: 0.62,       // leg width at top / leg width at base
      crossBraces: 3,       // horizontal struts between the legs
      crossBraceY: [92, 148, 205],
    },
    far: {
      u: 0.71,
      baseY: 46,
      height: 140,          // top at Y = 186
      legSpacing: 32,
      legTaper: 0.66,
      crossBraces: 2,
      crossBraceY: [96, 168],
    },
  },
```

### Main cable

A **parabola** — *not* a catenary.

A catenary is the curve of a chain hanging under its **own** weight. A
suspension bridge's main cable carries a roughly uniform deck load through its
hangers, and that load dominates the cable's own mass — which makes the curve a
**parabola**. Golden Gate, Brooklyn, Akashi: all parabolic.

> **Corrected.** This document, `19_bridge_anatomy.md` and `01_GLOSSARY.md`
> originally specified a catenary (`y = a·cosh(x/a)`) and argued that a parabola
> "reads subtly wrong". That was backwards, and the existing implementation in
> `src/scene/centreline.ts` had it right. See
> [`40_decision_log.md`](40_decision_log.md) entry **D-016**.

```ts
  mainCable: {
    /** Vertical drop from tower top to the cable's lowest point, as a fraction
     *  of the horizontal distance between towers. Real bridges: 0.08–0.11. */
    sagRatio: 0.094,

    /** Two cables, one per side of the deck. */
    count: 2,
    lateralOffset: 19,      // ±19u from centreline

    /** Beyond the towers the cable continues down to the anchorages at a
     *  straight, steeper angle. */
    anchorageDrop: 0.42,
  },
```

### Hangers

The thin vertical lines from the main cable down to the deck.

```ts
  hangers: {
    spacing: 14,            // one hanger every 14u of deck length
    /** Hangers exist only where the main cable is above the deck by at least
     *  this much — prevents zero-length hangers at mid-span. */
    minLength: 2.5,
  },
```

### Piers

```ts
  piers: {
    /** Approach viaduct piers, spaced along the centreline. */
    spacing: 78,
    widthTop: 16,
    widthBase: 26,
    /** Piers extend from the deck underside down to terrain height at that
     *  point, sampled from the terrain heightfield. */
  },
```

### Target point cloud distribution

The bridge is represented as a cloud of target positions. This table says how the
total particle budget is divided across the structure.

| Component | Share | Notes |
|---|---|---|
| Deck surface & edges | **34%** | The most visually dominant element |
| Hangers | **20%** | Many, thin, high visual frequency — needs density to read |
| Main cables | **16%** | Two long smooth curves |
| Towers | **14%** | Concentrated, bright |
| Piers & foundations | **8%** | Mostly in shadow |
| Railing & detail | **8%** | Fine top edge that catches light |
| | **100%** | |

> **Why deck gets a third:** it is the longest continuous element and it is the
> one the eye tracks from foreground to horizon. Under-sample it and the bridge
> reads as "towers floating above a dotted line".

---

## 36.6 `TERRAIN` — the valley

Terrain is **built geometry, never particles.** See Law 1 in
[`00_START_HERE.md`](00_START_HERE.md).

```ts
export const TERRAIN = {
  /** Heightfield resolution across the playable bounds. */
  segmentsX: 384,
  segmentsZ: 384,

  /** Layered value noise. Each octave: [frequency, amplitude]. */
  octaves: [
    [0.00042, 148],   // continental — the big ridgelines
    [0.00120,  62],   // hills
    [0.00380,  19],   // undulation
    [0.01100,   6.5], // surface roughness
    [0.03400,   1.8], // micro detail, breaks up silhouettes
  ],

  /** The bridge corridor. Terrain is pushed DOWN inside this corridor so the
   *  bridge has something to span. This is Law 2 in practice — the valley is
   *  shaped by the bridge's existence. */
  corridor: {
    halfWidth: 210,       // how far either side of the centreline is affected
    depth: 132,           // how deep the carve is at the centre
    falloffExp: 2.4,      // smoothstep exponent from centre to edge
  },

  /** Ridges that frame the composition on the right side of the frame. */
  framingRidges: [
    { centre: [ 640, 0, -560], radius: 420, height: 196 },
    { centre: [ 880, 0, -980], radius: 520, height: 244 },
    { centre: [-760, 0, -300], radius: 380, height: 128 },
  ],

  material: {
    baseColor: '#0B0F18',
    roughness: 0.94,
    metalness: 0.0,
    /** Terrain is almost pure black. Its shape is read from rim light only. */
    rimColor: '#41750F',
    rimStrength: 0.34,
    rimPower: 3.2,
  },
} as const
```

---

## 36.7 `PARTICLES` — counts and appearance

```ts
export const PARTICLES = {
  /** Chosen at runtime by the tier detection in 34_performance_budget. */
  countByTier: {
    ultra:   200_000,
    high:    140_000,
    medium:   90_000,
    low:      45_000,
    minimal:  16_000,
  },

  /** Base on-screen size in CSS pixels at 1× device pixel ratio, before
   *  perspective scaling. */
  sizePx: { min: 1.1, max: 2.9 },

  /** World-space size attenuation: size *= attenuation / viewDistance */
  sizeAttenuation: 320,

  /** Brightness by lifecycle state, 0–1, before bloom. */
  brightness: {
    dormant:     0.17,   // barely visible embers on the ground
    lifting:     0.55,   // brightens as it leaves the ground
    gliding:     0.92,   // brightest in flight — the river is the hero
    approaching: 1.00,   // peak, just before it seats
    seated:      0.74,   // settles back down once it is structure
  },

  /** Colour ramp. A particle's colour is sampled from this by its brightness,
   *  so hot particles push toward near-white and cold ones toward deep green. */
  colorRamp: [
    [0.00, '#16300A'],
    [0.35, '#4AA30C'],
    [0.62, '#7CFC00'],
    [0.85, '#A6FD3F'],
    [1.00, '#D9FF9C'],
  ],

  /** Additive blending — particles never occlude each other, they accumulate.
   *  This is what makes dense regions (towers) read as solid light. */
  blending: 'additive',
  depthWrite: false,
  depthTest: true,

  /** Idle micro-motion once seated. See 14_phase_5_living_scene. */
  breathe: {
    amplitude: 0.9,        // world units
    frequencyHz: 0.21,
    /** Each particle's phase is offset by a hash of its index so the bridge
     *  never pulses in unison — unison reads as a heartbeat, which is wrong. */
    phaseScatter: true,
  },
} as const
```

### Trails

```ts
  trail: {
    /** Trails are what produce the light-river streaks in the reference frame.
     *  Implemented as a fading history buffer, not as per-particle line
     *  geometry. See 33_render_pipeline §"Trail accumulation". */
    enabled: true,
    lengthFrames: 26,      // ≈ 430ms of history at 60fps
    decay: 0.88,           // per-frame multiplier on the accumulation buffer
    /** LIFTING / GLIDING / APPROACHING. A seated particle must not smear.
     *
     *  Corrected — this originally listed only the first two, which would have
     *  stopped the river streaking for the final 22% of every flight: visible as
     *  the stream fading out a fifth of the way before each landing. */
    statesWithTrails: ['lifting', 'gliding', 'approaching'],
  },
```

---

## 36.8 `LIFT`, `FLIGHT`, `ASSEMBLY` — the per-particle schedule

This section defines **when each individual particle does what.** Everything
here is a function of that particle's `u` (its target's position along the
bridge) and its structural layer.

### Lift-off time

```ts
export const LIFT = {
  windowStart: 1.200,      // = TIMELINE.phase1_awakeningStart
  windowSpan:  4.400,      // last particle leaves the ground at T+5.600
  /** Exponent > 1 front-loads the wave: most particles leave early, with a
   *  thinning tail. Exponent = 1 would give a hard, even sweep that reads as
   *  mechanical. */
  curveExp: 1.6,
  /** Randomisation per particle so the wave front is soft, not a straight
   *  ruler line moving across the ground. */
  jitter: 0.090,           // ±90ms
  /** Vertical velocity at the instant of release. */
  releaseSpeed: 26,        // u/s
  /** How long the particle rises near-vertically before its path bends into
   *  the glide. */
  verticalPhase: 0.42,     // s
}
```

**Formula:**

```
liftAt(u) = LIFT.windowStart
          + pow(1 - u, LIFT.curveExp) * LIFT.windowSpan
          + random(-LIFT.jitter, +LIFT.jitter)
```

| `u` | Position | `liftAt` |
|---|---|---|
| 1.00 | far end | `T+1.200` |
| 0.75 | past far tower | `T+1.667` |
| 0.50 | mid-span | `T+2.649` |
| 0.25 | near approach | `T+3.966` |
| 0.00 | near end | `T+5.600` |

### Seat time

```ts
export const ASSEMBLY = {
  windowStart: 5.400,      // = TIMELINE.phase3_assemblyStart
  windowSpan:  5.220,      // the far→near sweep
  /** Added on top, so that within any cross-section of the bridge the
   *  structure builds in a load-bearing order: you cannot hang a cable from a
   *  tower that does not exist yet. */
  layerOffset: {
    piers:      0.000,
    towers:     0.145,
    deck:       0.290,
    mainCables: 0.435,
    hangers:    0.522,
    railing:    0.580,
  },
  jitter: 0.055,           // ±55ms
}
```

**Formula:**

```
seatAt(u, layer) = ASSEMBLY.windowStart
                 + (1 - u) * ASSEMBLY.windowSpan
                 + ASSEMBLY.layerOffset[layer]
                 + random(-ASSEMBLY.jitter, +ASSEMBLY.jitter)
```

**Boundary check:** the last particle to seat is a railing particle at `u = 0`:

```
5.400 + (1 - 0) * 5.220 + 0.580 = 11.200  ✓  = TIMELINE.phase4_completionStart
```

The first is a pier particle at `u = 1`:

```
5.400 + (1 - 1) * 5.220 + 0.000 =  5.400  ✓  = TIMELINE.phase3_assemblyStart
```

### Flight duration — derived, not authored

A particle's time in the air is simply the gap between its two scheduled events:

```
flightDuration = seatAt - liftAt
```

| `u` | `liftAt` | `seatAt` (deck) | Flight duration |
|---|---|---|---|
| 1.00 | 1.200 | 5.690 | **4.490s** |
| 0.75 | 1.667 | 6.995 | **5.328s** |
| 0.50 | 2.649 | 8.300 | **5.651s** |
| 0.25 | 3.966 | 9.605 | **5.639s** |
| 0.00 | 5.600 | 10.910 | **5.310s** |

All durations land in a **4.5s – 5.7s** band. This is deliberate: the flight
reads as a single coherent river with one characteristic speed, rather than as
particles moving at wildly different rates.

```ts
export const FLIGHT = {
  /** Safety clamp. If jitter ever produces a gap shorter than this, liftAt is
   *  pulled earlier rather than the particle teleporting. */
  minDuration: 2.000,
  /** Ease applied to progress along the flight path. Slow release, confident
   *  middle, decisive arrival. */
  easing: 'easeInOutCubic',
  /** How much of the flight is spent in the final approach, where the particle
   *  peels off the shared river toward its own target. */
  approachFraction: 0.22,
}
```

### Barrel roll

```ts
  roll: {
    /** Radius of the helix the particle traces around its guide curve. */
    radius: { min: 0.4, max: 1.2 },   // world units — SMALL. See the trap below.
    /** Revolutions completed over the full flight. */
    turns: { min: 1.6, max: 3.4 },
    /** Starting angle, randomised per particle. */
    phaseScatter: true,
    /** Roll radius fades to zero over the final approach so particles arrive
     *  cleanly instead of wobbling into position. */
    dampenOverApproach: true,
  },
```

> **Trap — roll radius:** the instinct is to make this large so the roll is
> visible. It must not be. At `radius > ~3u` the river stops reading as a river
> and starts reading as confetti. The roll is meant to be felt as *shimmer and
> life within a coherent stream*, not seen as individual loops. If you can trace
> one particle's spiral with your eye, it is too big.

---

## 36.9 `INTERACTION` — cursor and touch

```ts
export const INTERACTION = {
  /** Radius of cursor influence, in world units, measured on the plane through
   *  the cursor's projected depth. */
  influenceRadius: 90,

  /** Inside this radius the push is at maximum — prevents a singularity at
   *  the exact cursor point. */
  innerRadius: 26,

  /** Maximum distance a seated particle can be pushed from its target. */
  maxDisplacement: 30,

  /** Falloff curve from innerRadius to influenceRadius. */
  falloff: 'smoothstep',

  /** Spring that returns a displaced particle to its target.
   *  Critically damped-ish: no visible overshoot, no oscillation. */
  spring: {
    stiffness: 6.0,
    damping: 0.86,
    /** Time for a maximally displaced particle to return within 1u of its
     *  target once the cursor leaves. Derived, ~1.4s. */
  },

  /** Asymmetry: displacement is fast, return is slow. This is what makes the
   *  bridge read as MATTER rather than as a field of dots. */
  riseResponse: 0.34,      // s to reach full displacement
  returnResponse: 1.40,    // s to settle back

  /** A single ripple emitted when the cursor first ARRIVES over the bridge.
   *  Re-arms only after the cursor has fully left. Never repeats while the
   *  cursor is stationary. */
  ripple: {
    enabled: true,
    speed: 340,            // u/s outward
    amplitude: 11,
    lifetime: 0.9,         // s
    rearmRequiresExit: true,
  },
} as const
```

### During flight

```ts
  flight: {
    /** Smaller than the seated influence radius — a flying particle reacts
     *  later and less. */
    avoidRadius: 70,

    /** LAW 4. The particle's SPEED may never drop below this fraction of its
     *  nominal speed, no matter what the cursor does. Avoidance deflects
     *  DIRECTION only. */
    speedFloor: 0.92,

    /** Maximum angle the flight direction may be deflected from its ideal
     *  heading. */
    maxDeflection: 62,     // degrees

    /** How quickly the particle re-converges on its guide curve after passing
     *  the cursor. */
    recoveryRate: 3.2,     // 1/s
  },
```

### Camera-proximity dispersion

When the viewer pushes the camera in toward the bridge, the bridge scatters —
the same disturbance as the cursor, but applied globally.

```ts
  proximityDispersion: {
    /** Dolly is a normalised 0–1 value. 0 = default framing, 1 = maximum
     *  push-in. */
    startsAt: 0.55,
    /** Displacement radius scales from 0 to this as dolly goes startsAt → 1. */
    maxRadius: 180,
    maxDisplacement: 64,
    /** Same spring as above; releasing the dolly reassembles the bridge. */
  },
```

---

## 36.10 `CAMERA`

```ts
export const CAMERA = {
  fov: 38,                 // vertical, degrees
  near: 1,
  far: 4000,

  basePosition: [ 10,  96,  520],
  baseTarget:   [ 40,  70, -260],

  /** Mouse parallax. Deliberately tiny — this is a subtle shift of viewpoint,
   *  not an orbit control. */
  parallax: {
    offsetX: 22,           // ±22u of camera translation
    offsetY: 11,           // ±11u
    yaw: 2.4,              // ±2.4°
    pitch: 1.2,            // ±1.2°
    /** Exponential smoothing factor per frame at 60fps. Low = heavy, cinematic
     *  camera with mass. */
    lerp: 0.045,
  },

  /** Slow autonomous drift so the frame is never perfectly still, even with no
   *  input. On touch devices with no orientation permission this is the only
   *  camera motion. */
  idleDrift: {
    amplitudeX: 7,
    amplitudeY: 3.5,
    periodX: 23.0,         // s
    periodY: 31.0,         // s — deliberately coprime with periodX so the
                           //     motion never visibly repeats
  },

  /** Push-in. Wheel on desktop, pinch on touch. */
  dolly: {
    enabled: true,
    range: [0, 1],
    /** World-space distance travelled toward baseTarget across the full range. */
    travel: 340,
    lerp: 0.070,
    /** Auto-returns to 0 after this long with no input. */
    autoReturnAfter: 2.4,  // s
    autoReturnRate: 0.35,  // 1/s
  },
} as const
```

---

## 36.11 `LIGHTING`

```ts
export const LIGHTING = {
  ambient: { color: '#14240A', intensity: 0.22 },

  /** The only conventional light. Reads as diffuse skyglow, not as a sun. */
  key: {
    color: '#A9C77E',
    intensity: 0.16,
    direction: [-0.40, 0.70, -0.35],
  },

  /** LAW: flying particles illuminate the mountains.
   *  Implemented as a small number of aggregate lights that follow the
   *  centroids of particle clusters — NOT one light per particle, which is
   *  computationally impossible at 140,000 particles. */
  swarmLights: {
    count: 5,
    color: '#A6FD3F',
    /** HARD CAP. The brief is explicit: the illumination should be there, but
     *  not bright. Exceeding this turns the mountains into a green stage set
     *  and destroys the 85/10/5 ratio from 06_art_direction. */
    intensityMax: 0.35,
    distance: 320,
    decay: 2,
    /** Lights fade in during Phase 1, peak during Phase 2 (when the river is
     *  densest and most of the light is in the air), and fade out during
     *  Phase 3 as particles seat and the river thins. */
    intensityByPhase: {
      dormant: 0.00,
      awakening: 0.14,
      glide: 0.35,
      assembly: 0.20,
      completion: 0.08,
      living: 0.04,
    },
    /** Maximum luminance the swarm may contribute to any terrain pixel.
     *  Clamped in the shader. Prevents hotspots when the river passes close to
     *  a ridge. */
    terrainClamp: 0.18,
  },

  /** Bridge particles are emissive. They are not lit by anything. */
  bridgeIsEmissive: true,
} as const
```

---

## 36.12 `POSTFX`

```ts
export const POSTFX = {
  bloom: {
    threshold: 0.62,
    radius: 0.42,
    /** Strength is animated across the scene — the bloom IS the drama. */
    strengthByPhase: {
      dormant:    0.30,
      awakening:  0.46,
      glide:      0.62,
      assembly:   0.62,   // ramps to 0.88 across the phase
      assemblyEnd: 0.88,
      completion: 1.15,   // 200ms peak on the completion pulse
      living:     0.85,
    },
  },

  vignette: { strength: 0.34, smoothness: 0.62 },

  /** Film grain. Small but essential — without it the near-black background
   *  bands visibly on 8-bit displays. */
  grain: { amount: 0.035, animated: true },

  /** Very subtle. Set to 0 if it ever reads as a defect rather than as lens
   *  character. */
  chromaticAberration: 0.0012,

  /** The left-side darkening that guarantees text contrast over the scene.
   *  A gradient overlay, not a post-process — it must sit above the 3D canvas
   *  and below the UI. */
  textScrim: {
    from: 'rgba(3, 5, 2, 0.86)',
    to:   'rgba(3, 5, 2, 0.00)',
    /** Horizontal extent of the gradient, as a fraction of viewport width. */
    extent: 0.52,
  },
} as const
```

---

## 36.13 `UI_REVEAL`

Offsets are **relative to `TIMELINE.uiRevealStart` (`T+12.400`)**.

```ts
export const UI_REVEAL = {
  /** Every element animates opacity 0→1 and translateY 12px→0. */
  duration: 0.520,
  easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
  translateY: 12,          // px

  sequence: [
    { id: 'logo',            offset: 0.000 },
    { id: 'eyebrow',         offset: 0.300 },
    { id: 'headline-line-1', offset: 0.550 },
    { id: 'headline-line-2', offset: 0.750 },
    { id: 'headline-line-3', offset: 0.950 },
    { id: 'subheadline',     offset: 1.200 },
    { id: 'cta',             offset: 1.450 },
    { id: 'socials',         offset: 1.700, childStagger: 0.060 },
    { id: 'countdown-ring',  offset: 1.950, ringDrawDuration: 0.800 },
    { id: 'countdown-units', offset: 2.400, childStagger: 0.070 },
    { id: 'footer',          offset: 2.600 },
  ],
  /** Last element finishes at 2.600 + 0.520 = 3.120 → T+15.520.
   *  TIMELINE.uiRevealEnd (15.000) is the target; the 520ms tail is the
   *  footer's own fade and is acceptable. */
} as const
```

---

## 36.14 `LOOP` — rewind

Only active when `SCENE.loop === true`.

```ts
export const LOOP = {
  /** Measured from TIMELINE.phase5_livingStart (T+12.400), NOT from the end of
   *  the UI reveal. The brief specifies "20 seconds after the bridge is
   *  built". */
  holdAfterComplete: 20.000,     // rewind begins at T+32.400

  rewind: {
    /** Faster than the build. A rewind that takes as long as the build feels
     *  like a mistake; a rewind at ~0.65× reads as deliberate. */
    duration: 8.000,

    /** EXACT reverse of the build order. */
    // spatial:  u = 0 → u = 1   (near to far)
    // layers:   railing → hangers → mainCables → deck → towers → piers

    /** UI fades out first, so the viewer is not reading text while the page
     *  dismantles itself underneath it. */
    uiFadeOutLeadTime: 0.900,    // begins 900ms BEFORE the rewind
    uiFadeOutDuration: 0.600,

    /** Particles do not retrace their flight paths exactly — they take a
     *  simplified direct return. Exact retracing looks like a video playing
     *  backwards, which breaks the illusion that these are objects with
     *  agency. */
    retraceExact: false,
  },

  /** After rewind completes, hold in dormant before restarting. */
  restartDelay: 1.200,
  /** Full cycle: 12.400 + 20.000 + 8.000 + 1.200 = 41.600s */
} as const
```

---

## 36.15 `PERF` — performance tiers

```ts
export const PERF = {
  targetFps: 60,
  floorFps: 30,

  /** Initial tier is guessed from device signals, then corrected by
   *  measurement. See 34_performance_budget. */
  tiers: ['ultra', 'high', 'medium', 'low', 'minimal'] as const,

  /** Measurement window before a tier change is allowed. */
  sampleFrames: 90,
  /** Average frame time above this for a full window → drop one tier. */
  downgradeMs: 22.0,
  /** Average frame time below this for THREE full windows → allow one
   *  upgrade. Upgrading is deliberately much harder than downgrading, to
   *  prevent oscillation. */
  upgradeMs: 11.5,
  upgradeWindows: 3,

  /** Never downgrade during Phase 3 or 4 — a particle count change mid-assembly
   *  is visible as a pop. Queue it for Phase 5. */
  blockChangesDuringPhases: [3, 4],

  /** What each tier turns off, in the order it is sacrificed. */
  degradation: [
    'chromaticAberration',   // first to go, nobody notices
    'grain',
    'trailLength',           // 26 → 14 frames
    'swarmLights',           // 5 → 2 → 0
    'bloomRadius',           // 0.42 → 0.28
    'terrainSegments',       // 384 → 256 → 160
    'particleCount',         // last resort — this is the scene
  ],
} as const
```

---

## 36.16 `A11Y`

```ts
export const A11Y = {
  /** prefers-reduced-motion: reduce
   *  The intro does not play. The scene renders its final frame at T+0.000,
   *  UI is immediately visible, and interaction is heavily damped rather than
   *  removed entirely (a completely dead scene reads as broken). */
  reducedMotion: {
    skipIntro: true,
    disableLoop: true,
    interactionScale: 0.25,   // displacement × 0.25
    disableIdleBreathe: false, // 0.9u of breathing is below the motion
                               // threshold and helps the page feel alive
    disableCameraParallax: true,
  },

  /** Minimum contrast for all text over the scene, after the scrim. */
  minContrastRatio: 4.5,
  /** Headline is large text, so 3:1 would be permissible — we hold 4.5:1
   *  anyway because the background is animated and its local luminance
   *  changes. */

  /** The canvas is decorative and is hidden from assistive technology. */
  canvasAriaHidden: true,
  /** All meaning must exist in the DOM text layer, never only in the canvas. */
} as const
```

---

## 36.17 `PALETTE`

Mirrored in `src/lib/config.ts` and `src/styles/tokens.css`. Changing one
without the others is a bug.

> **Rebased on the real brand.** Every accent here originally came from
> eyeballing a JPEG of the reference frame (`--lime #7CFC00`). The codebase's
> `tokens.css` turned out to carry the actual Claradix Tailwind values, lifted
> verbatim from the main site — **green.500 is `#7CFC00`** — and the dark ramp is
> blue-black, not green-black. The brand wins over an estimate from an image.
> See [`40_decision_log.md`](40_decision_log.md) entry **D-017**.

| Token | Hex | Source | Used for |
|---|---|---|---|
| `--void` | `#040610` | `ink-900` | Page background, deepest black |
| `--ink` | `#070A13` | `ink-800` | Fog colour, scene clear colour |
| `--soil` | `#0B0F18` | `ink-700` | Terrain base albedo |
| `--moss` | `#1D3A0A` | new | Deep green, the 10% band |
| `--rim` | `#41750F` | new | Terrain rim light |
| `--lime` | `#7CFC00` | **`green-500`** | **The brand accent** |
| `--lime-bright` | `#A6FD3F` | `green-400` | Particle highlights, hover states |
| `--lime-deep` | `#5FD800` | `green-600` | Deep accent |
| `--lime-core` | `#D9FF9C` | new | Hottest particle cores only |
| `--white` | `#FFFFFF` | `text-primary` | Headline, countdown numerals |
| `--text-dim` | `#D8DCDF` | `text-secondary` | Sub-headline |
| `--text-muted` | `#8D9195` | `text-muted` | Labels, footer |
| `--hairline` | `rgba(255,255,255,0.12)` | `border-subtle` | Social borders, dividers |

**Two tokens are genuinely new.** `--lime-core` is the near-white that dense
particle regions clamp toward under additive blending — the brand ramp stops at
green.400 and has nothing that hot. `--moss` and `--rim` are the deep greens the
terrain is read from; the brand's dark ramp is blue-black, which reads as a
*surface* rather than as *land* once a green rim light sits on it.

### The particle colour ramp

```ts
PARTICLE_COLOR_RAMP = [
  [0.00, '#16300A'],
  [0.35, '#4AA30C'],
  [0.62, '#7CFC00'],   // the brand, at the seated/gliding midpoint
  [0.85, '#A6FD3F'],
  [1.00, '#D9FF9C'],
]
```

### The 85 / 10 / 5 rule

Measured across the final frame:

- **85%** of pixels are near-black (`--void` … `--soil`)
- **10%** are deep green mid-tones (`--moss` … `--rim`)
- **5%** are neon accent (`--lime` … `--lime-core`)

This is enforced by `scripts/palette-check.mjs` and is a **hard acceptance
criterion**, not a guideline. See [`38_acceptance_criteria.md`](38_acceptance_criteria.md).

---

## 36.18 Derived values — do not author these

These are computed from the constants above. They are listed so that a reader
who sees them in code knows where they came from.

| Value | Formula | Current |
|---|---|---|
| Intro total duration | `phase5_livingStart` | **12.400s** |
| Page fully readable | `uiRevealEnd + UI_REVEAL.duration` | **15.520s** |
| Full loop cycle | `12.400 + 20.000 + 8.000 + 1.200` | **41.600s** |
| Bridge arc length | integral of centreline spline | **~1624u** |
| Main span length | `dist(towers.main, towers.far)` | **~468u** |
| Main cable sag | `mainSpan × sagRatio` | **~44u** |
| Hanger count (per cable) | `mainSpan / hangers.spacing` | **~33** |
| Deck target particles | `count × 0.34` | **47,600** @ high tier |
| Longest flight | `max(seatAt − liftAt)` | **5.651s** |
| Shortest flight | `min(seatAt − liftAt)` | **4.490s** |

---

## 36.19 Changing the intro duration

The stated most-likely change. Here is exactly how to do it.

**Do not edit the phase boundaries.** Set one value:

```ts
SCENE.timeScale = 0.75   // intro now runs in 9.300s instead of 12.400s
```

Everything scales: phase boundaries, lift window, assembly window, layer
offsets, jitter, UI reveal offsets, and the loop hold.

**What does *not* scale**, and why:

| Value | Scales? | Reason |
|---|---|---|
| `UI_REVEAL.duration` (520ms per element) | **No** | This is UI micro-interaction timing, tuned to human perception. It is not part of the cinematic. |
| `INTERACTION.*` | **No** | Interaction responsiveness is independent of the intro's pace. |
| `PARTICLES.breathe.frequencyHz` | **No** | Idle motion, not choreography. |
| `LOOP.holdAfterComplete` | **Yes** | It is part of the cycle. |

**Sanity floor:** below `timeScale = 0.55` the assembly stops reading as
construction and starts reading as a wipe. Below `0.40` individual particle
arrivals are no longer resolvable. If a shorter intro is required, the correct
move is to cut a phase, not to compress all of them — see
[`40_decision_log.md`](40_decision_log.md) entry **D-004**.

---

## 36.20 Where this lives in code

```
src/lib/config.ts          ← every constant in this document
src/styles/tokens.css      ← PALETTE, mirrored as CSS custom properties
```

`src/lib/config.ts` must be **the only place** these numbers appear. A magic
number anywhere else in `src/` is a bug, and
`scripts/` contains a check for the common ones.

---

**Next:** [`01_GLOSSARY.md`](01_GLOSSARY.md) — every term used above, defined
from zero.
