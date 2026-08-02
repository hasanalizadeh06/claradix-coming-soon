# 18 — SKY AND ATMOSPHERE

**Everything above the horizon, and the air between the camera and everything
else.**

---

## 18.1 What the sky is for

The sky occupies roughly **35% of the frame** and contains almost nothing. It is
the second element in the priority stack — Atmosphere outranks Bridge — and it
does three jobs.

**It provides the only ambient light.** There is no sun, no moon, no lamp. The
faint glow of the sky is the reason anything is visible at all before the
particles wake.

**It establishes scale.** A valley with a black rectangle above it is a stage
set. A valley with an atmosphere above it is a place with weather and distance.

**It gives the darkness texture.** 85% of the frame is near-black. If that
near-black were *uniform*, the frame would read as an unloaded page. The sky is
where most of the variation in the dark lives.

---

## 18.2 The layers

Four, back to front.

| Layer | What | Cost |
|---|---|---|
| 1 · Sky gradient | Vertical ramp, near-black to very dark green | Trivial |
| 2 · Stars | Sparse micro-points | Trivial |
| 3 · Nebula haze | Upper-right cloud, drifting | One texture sample |
| 4 · Fog | Applied to everything, not just sky | Free (built in) |

---

## 18.3 The sky gradient

```ts
export const SKY = {
  gradient: [
    { y: 0.00, color: '#0C1220' },   // horizon — slightly green, slightly lifted
    { y: 0.30, color: '#070A13' },
    { y: 0.62, color: '#05070E' },
    { y: 1.00, color: '#02030A' },   // zenith — the darkest thing in the frame
  ],
  /** y is normalised screen height: 0 at the horizon, 1 at the top of frame. */
} as const
```

```
   y=1.00  #02030A  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓  zenith, darkest
                    ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓
   y=0.62  #05070E  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓
                    ▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒
   y=0.30  #070A13  ▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒
                    ░░░░░░░░░░░░░░░░
   y=0.00  #0C1220  ░░░░░░░░░░░░░░░░  horizon, lightest
   ────────────────────────────────── ridgeline
```

### The zenith is darker than the page background

`#02030A` (luminance 0.004) is darker than `--void` `#040610` (0.006).

This is deliberate. The top of the frame should be the darkest thing a viewer
sees, so that the vignette has something to work against and so the frame
reads as *deep* rather than as flat black.

### The horizon is lifted and tinted

`#0C1220` at the horizon — slightly brighter and slightly green.

This is standing in for the light that would be scattered by atmosphere near the
ground. It is what makes the ridgelines readable as silhouettes: without a
brighter band behind them, black mountains against black sky have no edge.

> **Trap:** the horizon lift is easy to over-do. At `#141A10` it starts reading
> as dawn, which implies a sun, which the scene does not have. The current value
> is about as bright as it can be while still reading as "night".

---

## 18.4 Stars

```ts
SKY.stars = {
  count: 900,
  sizePx: { min: 0.7, max: 1.6 },
  brightness: { min: 0.10, max: 0.34 },
  /** Concentrated in the upper two-thirds; almost none near the horizon. */
  horizonFalloff: 0.42,
  twinkle: {
    periodRange: [3.0, 11.0],    // s, per star
    amplitude: 0.28,             // fraction of base brightness
  },
}
```

### Sparse and dim

900 stars across a 1536 × 1024 frame is roughly **one star per 1,750 pixels**.
They are meant to be noticed as *texture in the dark*, not as a starfield.

Peak brightness `0.34` sits well below `POSTFX.bloom.threshold` of 0.62, so
**stars never bloom.** Only particles bloom. Same discipline as the terrain rim
in [`17_terrain.md`](17_terrain.md) §17.6.

### Horizon falloff

Star density drops toward the horizon, because that is where atmospheric
extinction is greatest in reality — and because stars close to the ridgeline
compete with the terrain silhouette.

### Twinkle

Per-star period between 3 and 11 seconds, randomised. Amplitude 28% of base.

**Why the wide period range:** with periods clustered around one value, the
starfield develops a visible collective rhythm. Spread across 3–11s and
phase-scattered, no pattern is detectable over any observation window — which
matters for the "tab left open for four hours" requirement in
[`14_phase_5_living_scene.md`](14_phase_5_living_scene.md).

### Stars are not in world space

They are rendered on a screen-space quad behind everything, **not** as points at
a large distance.

| Approach | Problem |
|---|---|
| Points at Z = −3900 | Parallax moves them, which is wrong (real stars do not parallax) and they get fogged |
| **Screen-space, camera-locked** | ✅ No parallax, no fog, no depth sorting, one draw call |

Camera parallax (±22u) would move world-space stars by a detectable amount, and
stars that shift when you move the mouse look like fireflies.

---

## 18.5 The nebula haze

The most visually distinctive part of the sky, and the only part with colour.

```ts
SKY.nebula = {
  /** Screen-space extent in the reference frame. */
  extent: { x: [0.55, 1.00], y: [0.00, 0.35] },

  color: '#1D3A0A',              // --moss
  peakOpacity: 0.30,

  /** Three octaves of scrolling noise, sampled from one texture. */
  octaves: [
    [1.0, 1.00],
    [2.3, 0.46],
    [5.1, 0.19],
  ],

  drift: {
    speed: 0.6,                  // u/s equivalent
    direction: [0.82, 0.11, -0.56],
    turbulencePeriod: 34.0,      // s
  },

  /** Soft-edged everywhere. No hard boundary. */
  edgeFalloff: 'smoothstep',
}
```

### It occupies the upper right

Deliberately opposite the headline block, which sits upper-left. The frame's two
"soft masses" are diagonally opposed, and the countdown ring sits between them.

It is also **behind where the far end of the bridge builds**, so during Phase 3
the far tower resolves against a faintly luminous field rather than against pure
black. That is why the far tower reads at all despite being 61% fogged.

### Drift

At `0.6 u/s` the nebula moves about **0.7 world units during all of Phase 0** —
imperceptible.

Its job is not to be seen moving. Its job is that **no two frames are
identical**, which the eye detects even when it cannot name it. A perfectly
static sky reads as a photograph; a sky with 0.7u of drift reads as air.

The turbulence period of 34s means the internal structure also evolves, so over
a long session the nebula's shape genuinely changes rather than merely
translating.

### It never blooms

`peakOpacity 0.30` against `--moss` gives a maximum luminance of about **0.03** —
far below the 0.62 bloom threshold.

**Nothing in the sky ever blooms.** Sky, stars, nebula, horizon: all below
threshold. Only particles glow. This is the third restatement of the same
discipline, and it is the single most important rule keeping the scene from
turning to mush.

---

## 18.6 Fog

```ts
WORLD.fogNear  = 420
WORLD.fogFar   = 2100
WORLD.fogColor = '#070A13'
```

Linear in view distance. Applied to terrain and particles; **not** to the sky
(the sky *is* the fog colour at infinity).

| Distance | Fog | What is there |
|---|---|---|
| 230u | 0% | Near abutment |
| 420u | 0% | Fog begins |
| 700u | 17% | Main tower |
| 782u | 22% | Camera look-at point |
| 1090u | 40% | Far tower |
| 1450u | 61% | Far abutment |
| 1560u | 68% | Far framing ridge |
| 2100u | 100% | Fully dissolved |

### Fog outranks the bridge

The far end of the bridge is **61% fogged**. Someone will ask to reduce fog so
the far tower reads more clearly.

The answer is no. A clearly visible far tower makes the valley look small. Fog
is the scene's primary depth cue, and Atmosphere sits above Bridge in the
priority stack ([`05_visual_language.md`](05_visual_language.md) §5.1).

### The fog colour matches the sky's horizon band

`#070A13` sits between the horizon (`#0C1220`) and the mid-sky (`#070A13`).
Distant terrain therefore dissolves into the sky with no visible seam, and the
horizon has no hard edge anywhere except where a ridgeline is close enough to
survive it.

### Fog and additive particles

**A subtlety worth stating**, because it is easy to get wrong.

Standard fog *blends toward* the fog colour: `result = mix(color, fogColor, f)`.
That is correct for terrain.

For **additive** particles, blending toward a non-black fog colour makes distant
particles *add* fog colour to the frame — so a dense distant region gets
brighter, not dimmer. Backwards.

Additive particles must instead **attenuate toward zero**:

```glsl
// terrain (and any opaque surface)
color = mix(color, fogColor, fogFactor);

// additive particles
color *= (1.0 - fogFactor);
```

> Symptom if you get it wrong: the far end of the bridge glows *more* than the
> near end during Phase 3, and the whole depth read inverts.

---

## 18.7 What is not in the sky

| Absent | Why |
|---|---|
| **Sun / moon** | No visible light source anywhere in the scene. This is why lens flares and god rays are banned — both imply a source. |
| **Clouds** | Weather implies a time of day and a climate. The nebula is deliberately non-meteorological. |
| **Aurora** | Too literal a green-sky reference; also implies a specific latitude and a real-world phenomenon we are not depicting. |
| **Horizon glow / city light** | Implies civilisation beyond the frame. The valley is empty except for the bridge. |
| **Moving stars / meteors** | Introduces events the viewer might interpret as meaningful. |
| **Volumetric shafts** | No source to shaft from, and expensive. |

---

## 18.8 The sky across the phases

The sky is nearly static, but not entirely.

| Phase | Sky |
|---|---|
| 0 · Dormant | Full quality from frame one. Nebula drifting, stars twinkling. |
| 1 · Awakening | Unchanged |
| 2 · Glide | Unchanged. The river passes *in front of* the nebula in the upper right — the only moment the two interact compositionally. |
| 3 · Assembly | Unchanged. The far tower resolves against the nebula. |
| 4 · Completion | Unchanged. The bloom peak at 1.15 spills over the nebula but does not brighten it. |
| 5 · Living | Unchanged, forever |
| 6 · Rewind | Unchanged |

**The sky never changes state.** It is the one element in the scene with no
choreography at all, and that constancy is part of what makes the transformation
below it legible.

---

## 18.9 Depth-cue summary

The scene is very dark and single-hued, so it has fewer depth cues than a normal
image. The atmosphere carries three of the five.

| Cue | Owner | Doc |
|---|---|---|
| **Fog** | Atmosphere | this file |
| **Aerial perspective** (nebula behind everything) | Atmosphere | this file |
| **Sky gradient** (darker up = higher = further) | Atmosphere | this file |
| Size attenuation | Particles | [`21_anatomy_of_a_particle.md`](21_anatomy_of_a_particle.md) |
| Terrain occlusion | Render pipeline | [`33_render_pipeline.md`](33_render_pipeline.md) |
| Parallax | Camera | [`25_camera.md`](25_camera.md) |

Remove fog and the valley flattens completely. It is the single highest-value
element in this document.

---

## 18.10 Cost and degradation

The sky is nearly free, which is why almost none of it is ever cut.

| Element | Cost | Degradation |
|---|---|---|
| Gradient | One full-screen quad, four-stop lerp | Never cut |
| Stars | One instanced draw, 900 points | 900 → 400 at `minimal` |
| Nebula | Three texture samples per pixel on one quad | 3 octaves → 2 → 1 |
| Fog | Built into every material | Never cut |

`PERF.degradation` does not list any sky element before `terrainSegments`,
because the total sky cost is under 0.4ms even on weak hardware.

---

## 18.11 Failure modes

**1 · Sky elements blooming.**
Any sky luminance above 0.62. Symptom: the nebula glows, the stars bloom, and
the frame turns to soup. Nothing in the sky may cross the threshold.

**2 · World-space stars.**
Symptom: stars shift with camera parallax and look like fireflies. Also they get
fogged and disappear.

**3 · Additive fog applied as a mix.**
Symptom: distant particles get *brighter*. Depth inverts. See §18.6.

**4 · Horizon lift too bright.**
Symptom: reads as dawn, implying a sun.

**5 · Nebula with a hard edge.**
Symptom: a visible shape in the sky, which reads as a texture rather than as
atmosphere. `edgeFalloff` must be `smoothstep` in every direction.

**6 · Fog reduced to "see the bridge better".**
Symptom: the valley looks small. This is the most likely well-intentioned change
to be proposed, and it should be refused.

**7 · Star twinkle periods clustered.**
Symptom: the starfield develops a collective rhythm over long sessions.

---

## 18.12 Checklist

- [ ] Sky gradient runs `#0C1220` (horizon) → `#02030A` (zenith).
- [ ] The zenith is darker than the page background `--void`.
- [ ] The horizon band is lifted enough to silhouette ridgelines, not so much
      that it reads as dawn.
- [ ] Stars are screen-space and camera-locked — **no parallax, no fog**.
- [ ] 900 stars, peak brightness 0.34, **below the bloom threshold**.
- [ ] Star twinkle periods are spread 3–11s with scattered phase.
- [ ] Nebula sits upper-right, soft-edged in every direction, peak opacity
      0.30.
- [ ] Nebula drifts at 0.6 u/s with a 34s turbulence period. No two frames are
      identical.
- [ ] **Nothing in the sky ever blooms.** Sky, stars, nebula all < 0.62
      luminance.
- [ ] Fog is linear, 420u → 2100u, colour `#070A13`.
- [ ] Fog colour sits between the horizon and mid-sky colours — no seam.
- [ ] **Additive particles attenuate toward zero**, they do not mix toward the
      fog colour.
- [ ] The far end of the bridge is ~61% fogged and that is correct.
- [ ] No sun, moon, clouds, aurora, meteors, or horizon city glow.
- [ ] The sky never changes state across any phase.

---

**Next:** [`19_bridge_anatomy.md`](19_bridge_anatomy.md) — the structure itself.
