# 16 — WORLD MAP

**The space everything happens in.**

---

## 16.1 The coordinate system

Three.js conventions. Right-handed.

```
                    +Y  (up)
                     │
                     │
                     │
                     └──────────  +X  (right)
                    ╱
                   ╱
                 +Z  (toward the viewer, out of the screen)
```

**The camera looks down `−Z`.** So "further away" means "more negative Z".

Positions are written `(x, y, z)`.

| | |
|---|---|
| Origin | `(0, 0, 0)` — a point on the valley floor, roughly centre-frame |
| **1 world unit** | **1 metre**, conceptually |
| Written as | `90u` |

### Why metres

The scene could use any scale. Choosing metres means the numbers are
**sanity-checkable against reality**: a main span of 468u is a plausible
468-metre bridge (the Golden Gate's is 1,280m; the Brooklyn Bridge's is 486m).
A tower 175u above the deck is plausible. A particle influence radius of 90u is
a large room.

If a number stops being physically plausible, that is a signal something is
wrong.

---

## 16.2 Extents

```ts
WORLD.bounds = {
  minX: -900,  maxX:  900,     // 1800u wide
  minY:  -40,  maxY:  420,     //  460u tall
  minZ: -1400, maxZ:  400,     // 1800u deep
}
```

Nothing is authored outside these. The terrain mesh spans them exactly; fog
consumes anything approaching the far edge.

### Key elevations

| Y | What |
|---|---|
| `420` | Top of world bounds. Nothing reaches it. |
| `217` | **Main tower top** |
| `186` | **Far tower top** |
| `~148` | Highest terrain (framing ridge at `(880, 0, −980)`) |
| `114` | Top of the river's arc at its highest |
| `34 – 50` | **Bridge deck**, rising with `u` |
| `6` | Mist plane |
| `0` | **Valley floor** — the datum |
| `−40` | Bottom of bounds; deepest terrain carve |

---

## 16.3 Plan view

Looking straight down. The camera is at the bottom of this diagram.

```
        -900        -450          0          450         900   ← X
   -1400 ┌───────────────────────────────────────────────┐
         │                                    ╱          │
         │  fog consumes everything    ╱─────╯           │
         │  beyond here          ╱────╯   ◆ far abutment │
   -1000 │                 ╱────╯          (520,50,-880) │
         │            ╱───╯          ▲▲▲                 │
         │       ╱───╯            ▲▲▲▲▲▲▲  ridge         │
    -600 │   ╱──╯  ◆ FAR TOWER   ▲▲▲▲▲▲▲▲▲               │
         │ ╱╯       (240,46,-520)   ▲▲▲▲▲                │
         ╱                                               │
    -200 │╲                                              │
         │ ╲  ◆ MAIN TOWER                               │
         │  ╲  (-60,42,-160)                             │
       0 │   ╲                                           │
         │    ╲                          ▲▲▲             │
         │     ╲                       ▲▲▲▲▲  ridge      │
     200 │      ╲                                        │
         │       ╲  ◆ near abutment                      │
         │        ╲  (-520,34,300)                       │
     400 └─────────╲─────────────────────────────────────┘
                    ▲
              CAMERA at (10, 96, 520)
              looking toward (40, 70, -260)

    ╱╲  bridge centreline        ▲▲▲  framing ridge        ◆  control point
```

**Note the diagonal.** The bridge runs from lower-left `(−520, +300)` to
upper-right `(+520, −880)` in plan. It is not aligned to any axis, which is what
produces the sweeping S-curve in screen space.

---

## 16.4 Elevation view

Looking from the side, along `+X`. Vertical exaggeration ~2×.

```
  Y
 250│
    │              ╔═╗ main tower top (217)
 200│              ║ ║
    │              ║ ║              ╔═╗ far tower top (186)
 150│    ╲         ║ ║              ║ ║
    │     ╲___     ║ ║     _____    ║ ║        ▁▁▂▃▄ ridges
 100│         ╲╲   ║ ║ ___╱     ╲___║ ║___
    │           ╲╲ ║ ║╱               ║ ║  ╲╲
  50│  ══════════╲╲╬═╬════════════════╬═╬═══╲╲═══  deck (34→50)
    │  ▓▓  ▓▓  ▓▓ ║ ║                 ║ ║      ▓▓
   0│▁▁▓▓▁▁▓▓▁▁▓▓▁╨▁╨▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁╨▁╨▁▁▁▁▁▁▓▓▁▁  valley floor
    │  piers                                         
 -40└────────────────────────────────────────────────────
     u=0                                            u=1
     NEAR                                            FAR
     (camera side)                              (horizon)

  ╲╲  main cable (catenary)      ▓▓  pier      ╬  tower leg
```

**The deck rises with `u`** — from `Y=34` at the near abutment to `Y=50` at the
far one. A 16u rise over 1624u of arc: a gradient of about **1%**, which is
imperceptible as a slope but stops the bridge from looking mechanically level.

---

## 16.5 The bridge centreline

Five control points, Catmull-Rom interpolated.

```ts
BRIDGE.centreline = [
  { u: 0.00, p: [-520, 34,  300] },   // near abutment, off-frame bottom-left
  { u: 0.22, p: [-300, 38,  120] },
  { u: 0.45, p: [ -60, 42, -160] },   // MAIN TOWER base
  { u: 0.71, p: [ 240, 46, -520] },   // FAR TOWER base
  { u: 1.00, p: [ 520, 50, -880] },   // far abutment, off-frame right
]
```

| Property | Value |
|---|---|
| Arc length | **~1624u** |
| Main span (tower to tower) | **~468u** |
| Near approach (`u` 0.00–0.34) | ~552u |
| Far approach (`u` 0.82–1.00) | ~292u |

### `u` is normalised **arc length**, not parameter

This matters. `u = 0.5` is the point halfway **along the curve**, not halfway
between the first and last control points, and not the halfway value of the
spline's internal parameter.

Getting this wrong makes the assembly sweep speed up and slow down as it crosses
control points, which is visible as a stutter in the construction front.

**Implementation:** build an arc-length lookup table at initialisation
(256 samples is plenty), and reparameterise by binary search. This is a solved
problem; Three.js `Curve.getSpacedPoints()` does it.

---

## 16.6 The camera

```ts
CAMERA = {
  fov: 38,                        // vertical degrees
  near: 1,
  far: 4000,
  basePosition: [ 10,  96,  520],
  baseTarget:   [ 40,  70, -260],
}
```

| Property | Value |
|---|---|
| Distance to target | **~782u** |
| Look direction | `(0.038, −0.033, −0.999)` — almost straight down `−Z`, tilted down ~1.9° |
| Vertical FOV | 38° |
| Horizontal FOV at 3:2 | **~54.6°** |
| Visible width at target depth | **~805u** |

### Why the bridge runs off both edges

Visible width at the target depth is ~805u. The bridge spans **1040u** in X.

**It does not fit, deliberately.** The near end runs off the bottom-left; the far
end runs off the right. This is what makes the world feel larger than the frame
— we are looking at part of a valley, not at a diorama.

### Framing constraints

These must hold at every aspect ratio. They are the camera's real specification.

| Constraint | Value |
|---|---|
| Main tower top | between `y 28%` and `y 38%` of frame |
| Main tower horizontal | between `x 55%` and `x 68%` |
| Deck must exit | both the left and right frame edges |
| Horizon line | between `y 60%` and `y 70%` |

If any of these fail, the composition has broken. See
[`25_camera.md`](25_camera.md) for how each aspect ratio satisfies them.

---

## 16.7 The river's path

The particles do **not** fly along the bridge centreline. They fly above and
camera-side of it, so the assembly is never hidden behind the stream.

```ts
RIVER = {
  heightAbove: 74,      // world units above the centreline
  lateralOffset: 46,    // toward the camera (+Z side)
  taperStart: 0.72,     // u where both offsets begin fading to zero
}
```

```
Cross-section at u = 0.4, looking along the bridge:

              ░▒▓███▓▒░          ← river core, 74u above,
                 ▲                 46u toward camera
                 │
                 │ 74u
                 │
        ═════════╪═════════      ← deck
             ├───┤
              46u
```

Beyond `u = 0.72` both offsets taper smoothly to zero, so the river converges
exactly onto the bridge line at the far end — where the construction front
actually is.

> This is pure staging. It has no physical justification. It exists so the
> camera can see both the stream and its destination simultaneously, which is
> the entire compositional argument of the frame.

---

## 16.8 Where the swarm lights live

Five point lights follow the centroids of particle clusters.

**Clustering:** particles are bucketed by their position along the river
(`u` at their current location), into five equal bins. Each light sits at the
mean position of its bin's active particles.

```
        light 0   light 1   light 2   light 3   light 4
           ●         ●         ●         ●         ●
        ░▒▓███▓▒░▒▓███▓▒░▒▓███▓▒░▒▓███▓▒░▒▓███▓▒░
        u=0-0.2  0.2-0.4  0.4-0.6  0.6-0.8  0.8-1.0
```

During Phase 2 they sit high in the air along the river; during Phase 1 they sit
low, near the ground; during Phase 3 they migrate toward the shrinking river and
then fade.

A light whose bin contains no active particles is disabled, not left at the
origin.

---

## 16.9 Fog

```ts
WORLD.fogNear = 420
WORLD.fogFar  = 2100
WORLD.fogColor = '#070A13'
```

Linear in view distance.

| Distance from camera | Fog factor |
|---|---|
| ≤ 420u | 0% |
| 782u (the look-at point) | **22%** |
| 1200u | 46% |
| 1600u | 70% |
| ≥ 2100u | 100% |

### What fog reaches

| Element | Distance | Fog |
|---|---|---|
| Near abutment | ~230u | 0% |
| Main tower | ~700u | 17% |
| Far tower | ~1090u | 40% |
| Far abutment | ~1450u | 61% |
| Far ridge `(880, 0, −980)` | ~1560u | 68% |

**The far end of the bridge is 61% fogged.** That is why the far tower reads as
small and faint in the reference frame — perspective alone would not do it.

> Fog is the scene's primary depth cue and it outranks the bridge in the
> priority stack. If someone asks to reduce fog so the far tower reads more
> clearly, the answer is no: a clearly visible far tower makes the valley look
> small.

---

## 16.10 Units cheat sheet

For sanity-checking any number in this pack.

| Thing | Size in `u` | Real-world comparison |
|---|---|---|
| Particle (screen size) | ~1–3 px | — |
| Barrel roll radius | 0.4 – 1.2 | a hand's width |
| Idle breathing | 0.9 | a hand's width |
| Hanger spacing | 14 | a bus |
| Deck thickness | 3.2 | a person's height |
| Cursor influence radius | 90 | a large building |
| Deck width | 46 | a six-lane motorway |
| Main cable sag | 44 | a 14-storey building |
| Tower leg spacing | 38 | a tennis court's length |
| Far tower height | 140 | Big Ben |
| Main tower height | 175 | a 50-storey tower |
| Main span | 468 | the Brooklyn Bridge's main span (486m) |
| Bridge arc length | 1624 | 1.6 km |
| Camera distance | 782 | — |
| World width | 1800 | — |

---

## 16.11 Where this lives in code

```
src/scene/centreline.ts     ← the spline, arc-length table, u ↔ position
src/scene/BridgeScene.ts    ← world assembly, bounds, fog
src/gl/Stage.ts             ← camera, renderer, resize
src/lib/config.ts           ← WORLD, BRIDGE, CAMERA constants
```

`centreline.ts` is the most-depended-upon module in the project. Everything —
terrain carving, target generation, river path, assembly ordering, swarm light
binning — asks it questions.

**Its public surface should be exactly:**

```ts
positionAt(u: number): Vector3
tangentAt(u: number): Vector3
frameAt(u: number): { normal: Vector3, binormal: Vector3 }   // parallel transport
uAtDistance(d: number): number
nearestU(p: Vector3): number
arcLength: number
```

---

## 16.12 Checklist

- [ ] Three.js handedness: +X right, +Y up, +Z toward viewer.
- [ ] 1 world unit = 1 metre. Every number is physically plausible.
- [ ] `u` is normalised **arc length**, computed from a lookup table — not the
      spline's raw parameter.
- [ ] The construction front moves at constant speed along the bridge, with no
      stutter at control points.
- [ ] The bridge exits **both** the left and right frame edges.
- [ ] Main tower top sits at `y 28%–38%`, horizontally at `x 55%–68%`.
- [ ] Horizon sits at `y 60%–70%`.
- [ ] Deck rises ~1% from near to far — level enough to look level, sloped
      enough not to look CG.
- [ ] The river runs 74u above and 46u camera-side of the centreline, tapering
      to zero at `u = 0.72`.
- [ ] Swarm lights bin by `u` and disable when their bin is empty.
- [ ] Fog reaches ~61% at the far abutment. The far tower is meant to be faint.
- [ ] `centreline.ts` exposes only the six functions in §16.11.

---

**Next:** [`17_terrain.md`](17_terrain.md) — the valley itself.
