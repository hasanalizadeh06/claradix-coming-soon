# 13 — PHASE 4 · COMPLETION

**`T+11.200` → `T+12.400` · duration 1.200s · 72 frames at 60fps**

---

## 13.1 The one-line version

> The last particle lands. After a held silence, one wave of brightness runs the
> whole length of the bridge — and then the scene is quiet.

---

## 13.2 What this phase is doing

Phase 4 is **punctuation**. It contains no construction, no new information, and
no interaction change. Its entire job is to tell the viewer *that was the end.*

### Why a build needs a full stop

Without it, the transition from Phase 3 to the UI reveal is arbitrary. The last
particle seats — which, being one particle among 140,000, is not a perceptible
event — and then, for no reason the viewer can detect, text starts appearing.

The pulse converts an invisible technical milestone (`seated === total`) into a
visible one.

### It also buys a beat before the UI

The viewer has watched a 12-second build. Dropping text onto the frame the
instant it finishes gives them nothing to land on. The 1.2 seconds of Phase 4
is the exhale.

---

## 13.3 The three beats

Phase 4 has internal structure. It is not one gesture.

```
T+11.200        T+11.400              T+11.900          T+12.400
    │               │                     │                 │
    ├── silence ────┤                     │                 │
    │   200ms       ├──── the pulse ──────┤                 │
    │               │      500ms          ├──── settle ─────┤
    │               │                     │      500ms      │
    ▼               ▼                     ▼                 ▼
 last particle   pulse departs        pulse arrives    Phase 5 /
 seats           from u=1.0           at u=0.0         UI reveal
```

### Beat 1 — the silence · `T+11.200` → `T+11.400`

**200ms of nothing.**

The bridge is complete. The river is gone. No particle is in flight. Bloom holds
at `0.880`.

This is the shortest and most easily deleted beat in the scene, and deleting it
costs more than its length suggests. Without the gap, the pulse reads as *part
of the assembly* — the last event in a sequence of events. With it, the pulse
reads as *a response to* the assembly.

> **Trap:** in review this pause reads as a hitch or a dropped frame, and
> somebody will ask whether the animation stalled. It did not. Consider
> annotating this beat in any review build.

### Beat 2 — the pulse · `T+11.400` → `T+11.900`

A band of brightness travels the length of the bridge.

| Property | Value |
|---|---|
| Direction | `u = 1.0` → `u = 0.0` — **far to near**, same direction the build ran |
| Duration | 500ms |
| Speed | `1624u / 0.5s` = **3,248 u/s** — roughly 10× glide speed |
| Band width | 190u along the bridge |
| Peak particle brightness | `1.00` (from seated `0.74`) |
| Falloff within band | `smoothstep`, symmetrical |
| Per-particle recovery | 260ms, `easeOutQuad`, back to `0.74` |

```ts
export const COMPLETION_PULSE = {
  startDelay: 0.200,        // after the last seat
  duration: 0.500,
  bandWidth: 190,           // world units along the centreline
  peakBrightness: 1.00,
  recoveryMs: 260,
  direction: 'farToNear',
  /** Bloom peaks with the pulse and falls back. */
  bloomPeak: 1.15,
  bloomPeakDurationMs: 200,
} as const
```

**Why far → near, the same direction as the build:**

The alternative — a pulse running near → far, back the way the particles came —
was considered and rejected. It reads as *recoil*, or as the energy returning to
its source. That is a fine idea; it is not this idea.

Running it in the build direction makes the pulse read as a **signal travelling
along something that is now continuous**, which it was not a second earlier. The
structure is testing itself.

**Bloom:**

```
T+11.400  0.880  ──┐
T+11.500         0.98
T+11.600         1.09
T+11.650         1.15   ← peak, held ~200ms
T+11.850         1.15  ──┘
T+11.900         1.06
T+12.100         0.93
T+12.400         0.85   ← POSTFX.bloom.strengthByPhase.living
```

The bloom peak at **1.15** is the brightest moment in the entire scene. It lasts
200ms.

### Beat 3 — the settle · `T+11.900` → `T+12.400`

The pulse has passed. Every particle recovers to `0.74`. Bloom falls from `1.15`
to `0.85`.

The bridge arrives at its permanent resting state.

Idle breathing (`PARTICLES.breathe`) fades in across this beat, from zero
amplitude to full `0.9u` — so the structure does not snap from "perfectly rigid"
to "shimmering", it relaxes into it.

---

## 13.4 One pulse. Never repeated.

```
COMPLETION_PULSE fires exactly once per scene lifetime.
```

If `SCENE.loop` is enabled, it fires once per cycle — after each build, never
during Phase 5, and never on rewind.

> **Why this is a hard rule:** a bridge that pulses rhythmically is a
> **heartbeat**, and a heartbeat is a much cheaper and far more common idea than
> the one this scene is telling. It also immediately makes the structure read as
> a creature rather than as architecture.
>
> The single pulse is an *event*. A repeating pulse is a *property*. We want the
> event.

This is why idle breathing has **scattered phase** — see
[`14_phase_5_living_scene.md`](14_phase_5_living_scene.md). If the breathing
were synchronised, the bridge would swell and shrink together, producing exactly
the pulse we just forbade, forever.

---

## 13.5 Frame-by-frame

| Frame | `T+` | Pulse at `u ≈` | Bloom | Notes |
|---|---|---|---|---|
| 672 | 11.200 | — | 0.880 | Last particle seats. Bridge complete. **Silence begins.** |
| 678 | 11.300 | — | 0.880 | |
| 684 | 11.400 | **1.00** | 0.880 | Pulse departs the far end |
| 690 | 11.500 | 0.80 | 0.980 | |
| 696 | 11.600 | 0.60 | 1.090 | Pulse crossing the main span |
| 699 | 11.650 | 0.50 | **1.150** | **Brightest frame in the scene** |
| 702 | 11.700 | 0.40 | 1.150 | Passing the main tower |
| 708 | 11.800 | 0.20 | 1.150 | |
| 711 | 11.850 | 0.10 | 1.150 | Bloom peak ends |
| 714 | 11.900 | **0.00** | 1.060 | Pulse reaches the near end and dissipates |
| 726 | 12.100 | — | 0.930 | Breathing fading in |
| 738 | 12.300 | — | 0.870 | |
| **744** | **12.400** | — | **0.850** | **Phase 5 begins. UI reveal starts this frame.** |

---

## 13.6 Interaction during Phase 4

All 140,000 particles are `seated`, so for the first time the interaction model
is **uniform**.

| Input | Behaviour |
|---|---|
| Cursor over bridge | Displacement + spring return, at full `INTERACTION` values |
| Camera parallax | Active |
| Dolly / wheel / pinch | **Still disabled** until `T+12.400` |
| Click | No target yet |

### The pulse and displacement compose additively

If the viewer is holding the cursor over the bridge while the pulse passes
through, both effects apply: the particles are displaced *and* they flare.

No special handling. Displacement is positional; the pulse is a brightness
modulation. They occupy different channels and never fight.

> This produces an incidental but genuinely nice moment — the pulse illuminating
> a cursor-shaped void in the structure. It was not designed; it falls out of
> keeping the two systems separate. Do not "fix" it.

### Dolly stays locked for 1.2 more seconds

Enabling push-in *during* the pulse would let a viewer trigger
`proximityDispersion` while the completion moment plays, scattering the bridge
at the exact instant it is supposed to read as whole.

`T+12.400` is the earliest safe unlock, and it is where it happens.

---

## 13.7 Capture point — `complete` at `T+12.400`

**Must show:**

1. The bridge **complete** — all six layers, both towers, cables, hangers,
   railing, from `u = 0` to `u = 1`
2. **No particles in flight.** Zero.
3. **No light trails.** The trail buffer has fully decayed (26 frames ≈ 430ms
   since the last flying particle; the last seat was 1.2s ago).
4. **No UI** — the first UI element (`logo`) begins its 520ms fade on this
   exact frame, so it is at opacity ≈ 0.
5. Bloom settled to `0.850`
6. The bridge is visibly **composed of discrete points** at 100% zoom
7. Mountains have receded to near-silhouette — swarm lights at `0.040`

**Colour distribution:**

| Band | Share |
|---|---|
| Near-black | ~86% |
| Deep green | ~9.5% |
| Neon accent | ~4.5% |

> This capture is the cleanest test of **Law 3** — the bridge is never fully
> solid. Zoom to 100% on the main tower. If the particles have merged into a
> continuous opaque mass, either the particle size or the bloom is too high.
> You must be able to see through the tower to the sky behind it.

---

## 13.8 Failure modes

**1 · The silence is missing.**
The pulse fires the instant the last particle seats. Reads as a continuation of
assembly rather than as a response to it. Check `COMPLETION_PULSE.startDelay`.

**2 · The pulse repeats.**
Usually because it is driven by a looping time function rather than fired once
by an event. Symptom: a heartbeat. Fatal to the concept.

**3 · The pulse is too slow.**
At 500ms it is decisive. At 1.5s it becomes a *scan*, which re-introduces the
scanning-beam reading that Phase 3 works hard to avoid.

**4 · Trails still visible.**
The buffer has not been allowed to decay, or seated particles are still
contributing. See [`11_phase_2_glide.md`](11_phase_2_glide.md) §11.5.

**5 · Breathing snaps on.**
Amplitude jumps from 0 to 0.9u at `T+12.400` instead of fading in across Beat 3.
Visible as the whole bridge twitching at the moment the UI appears.

**6 · Bloom peak is too high or too long.**
At `1.15` for 200ms it is a flare. At `1.4`, or held for 600ms, the frame
blows out to white-green and the 85/10/5 ratio breaks badly enough that
`palette-check` fails at the `complete` capture.

---

## 13.9 Phase 4 checklist

- [ ] 200ms of silence between the last seat and the pulse.
- [ ] The pulse fires **exactly once**.
- [ ] It travels **far → near**, the same direction the build ran.
- [ ] Duration 500ms; band width 190u.
- [ ] Bloom peaks at **1.15** for **200ms** and settles to **0.85**.
- [ ] Every particle recovers to `0.74` after the band passes.
- [ ] Idle breathing **fades in** across Beat 3; it does not snap on.
- [ ] All particles are `seated`; none in flight.
- [ ] Trail buffer is fully decayed by `T+12.400`.
- [ ] Displacement and pulse compose without special handling.
- [ ] Dolly remains disabled for the whole phase.
- [ ] At `T+12.400` the bridge is visibly a point cloud at 100% zoom —
      **Law 3**.
- [ ] Colour distribution ~86 / 9.5 / 4.5.
- [ ] No UI is visible in the `complete` capture.

---

**Next:** [`14_phase_5_living_scene.md`](14_phase_5_living_scene.md) — the scene
starts listening.
