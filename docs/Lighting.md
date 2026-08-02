# Lighting

There are **no `THREE.Light` objects in this project.** Not one. Every lighting
term is arithmetic inside a fragment shader.

---

## 1. The rule everything is measured against

From the creative pack, and the only rule in it carrying a number:

> **85% near-black · 10% deep green · 5% neon accent**

`scripts/palette-check.mjs` enforces it against seven captures. The band edges are
**derived from the palette tokens, not chosen**:

| Token | Hex | Luminance | Role |
|---|---|---|---|
| `--void` | `#040610` | 0.0247 | zenith, terrain base |
| `--ink` | `#070a13` | 0.0390 | fog colour |
| `--soil` | `#0b0f18` | **0.0580** | ← **near-black band edge** |
| `--moss` | `#1d3a0a` | 0.1900 | ambient, nebula, ground glow |
| `--rim` | `#41750f` | **0.3870** | ← **accent band edge** |
| `--lime-deep` | `#5fd800` | **0.6850** | ← **neon band edge** |
| `--lime` | `#7cfc00` | 0.8100 | the brand |
| `--lime-bright` | `#a6fd3f` | 0.8660 | swarm light colour |
| `--lime-core` | `#d9ff9c` | — | hottest particle cores |

The edges were previously 0.06 / 0.22 / 0.55, inherited and never checked against
the tokens they describe. The middle boundary was badly wrong: `--rim` — the
terrain rim light, which carries ninety percent of what you can see of the
landscape — has luminance 0.387, so **every lit ridgeline was being counted as a
neon violation.**

> A band boundary that does not come from the palette measures something other
> than the rule it claims to enforce.

### Per-capture targets

The scene must start dark and get brighter. A single global target cannot say
that, so `palette-check` uses seven:

| Capture | T+ | want black | want accent |
|---|---|---|---|
| dormant | 0.6 | 94% | 0.5% |
| awakening | 2.0 | 91% | 2.0% |
| glide | 4.1 | 87% | 4.0% |
| assembly-early | 6.4 | 87% | 4.0% |
| assembly-late | 10.5 | 85% | 5.0% |
| complete | 12.4 | 86% | 4.5% |
| settled | 16.0 | 85% | 5.0% |

Tolerance ±3 points. Sampled on the world side only, `x > 45%` — counting the
headline would measure the layout.

---

## 2. Terrain lighting

Four additive terms, in the fragment shader.

### 2.1 Base — `--void`, 0.0247

The darkest token. The terrain's unlit floor has to sit clear of the near-black
band edge with room for the ambient and key terms on top, or every visible slope
crosses it and the landscape alone consumes the whole deep-green budget.

```
--soil  0.0580   ON the edge; ambient alone tips it over
--ink   0.0390   + ambient 0.015 = 0.054, key takes it to 0.074 — over
--void  0.0247   + ambient 0.005 = 0.030, key takes it to 0.050 — under
```

Making the terrain indistinguishable from the page background is not a loss: its
shape is read from the rim term, which is unaffected.

### 2.2 Ambient — `moss × 0.22 × 0.12`

Exists only so surfaces facing away from the skyglow are not mathematically zero.
Pure black regions clip once grain and bloom are applied on top. It must not be
large enough to lift the floor across the band edge on its own — hence the 0.12
scale on top of the 0.22 intensity.

### 2.3 Key — intensity **0.03**

```ts
key: { intensity: 0.03, direction: [-0.4, 0.7, -0.35] }
```

**Skyglow, not a sun.** It produces no visible highlight and no discernible
shadow direction; its job is *normal disambiguation*, so slopes facing different
ways are marginally different rather than identical.

It was 0.16 against a key colour of luminance 0.66 — a contribution of 0.106,
**five times** what the pack claimed (0.02). At that value every lit slope was
firmly in the deep band before any other term was added.

### 2.4 Rim — strength **0.55**, power **3.2**

```glsl
float rim = pow(1.0 - abs(dot(n, viewDir)), uRimPower);
color += uRim * rim * uRimStrength;
```

**This is how the mountains are visible at all.**

`--rim` at 0.387 × 0.55 peaks at 0.21 — bright enough to model a ridge, still
inside the deep band, still nowhere near the 0.62 bloom threshold. *The landscape
must never bloom; only particles do.*

**Strength and power are not interchangeable.** Strength scales brightness; power
sets how far down the face the light runs — its AREA. Widening power from 3.2 to
2.4 cost **five points of near-black across every capture, uniformly**, while
raising strength at a fixed 3.2 costs almost nothing.

---

## 3. Swarm lights

Five point lights that follow the flying particles and illuminate the valley they
pass over. The one moment the environment acknowledges the bridge exists.

```ts
swarmLights: {
  count: 5,
  range: 260,           // the radius at which a light contributes EXACTLY ZERO
  decay: 2,
  terrainClamp: 0.18,
  intensityByPhase: {
    dormant: 0.0, awakening: 0.055, glide: 0.12,
    assembly: 0.07, completion: 0.045, living: 0.025,
  },
}
```

### 3.1 Positions are analytical

Computed from the guide curve, **not** by reducing over the population:

```ts
for (let i = 0; i < 5; i++) {
  const u = (i + 0.5) / count;
  centreline.guidePoint(u, RIVER.heightAbove, RIVER.lateralOffset,
                        RIVER.taperStart, swarmPositions[i]);
}
```

140,000 reductions per frame costs ~4 ms and is entirely avoidable, because a
bin's particles are known to lie along a known section of a known curve.

### 3.2 The falloff must reach zero

```glsl
float x = clamp(distance(vWorld, uSwarmPos[i]) / uSwarmRange, 0.0, 1.0);
swarm += pow(1.0 - x * x, uSwarmDecay);
```

The original was `1.0 / (1.0 + d*d)` with `distance: 150` as a scale factor — a
curve that **never reaches zero**, and which ignored the declared `decay`
entirely.

Swarm-lit terrain is deep-band *by definition*: the light's colour
(`--lime-bright`) has luminance 0.866. So the question is not how bright the light
is but how far its tail stays above the band edge:

```
0.866 · falloff · intensity < 0.058   →   falloff < 0.19   →   d > 310u
```

Five lights over a 1,624u bridge sit **325u** apart. Every light reached every
other light's territory. The result was a flat valley-wide wash measured at **25
points of deep against a 10-point budget** — while the comment in `config.ts`
claimed, in detail, that the pools were discrete and the light travelled with the
river.

This one change moved `awakening` from 74.4% near-black to 89.5% and `glide` from
61.0% to 77.0%.

### 3.3 Intensity must stay below the clamp

Intensities previously peaked at 0.35 against a `terrainClamp` of 0.18 — a ratio
near two, so a single light **saturated across most of its footprint.** The clamp
stopped limiting a hotspot and started *producing* one: a flat disc of constant
brightness, which is the spotlight-on-a-ridge it exists to prevent, with
straighter edges.

Under the clamp, the falloff curve is what you see and the ceiling only catches
the rare close pass.

### 3.4 The curve had a missing point

`swarmIntensityAt(t)` originally ramped `glide → completion` across the whole
assembly phase, **skipping `k.assembly` entirely** — a five-point curve quietly
turned into a four-point one, which made the swarm fade through assembly instead
of holding while there are still particles in the air to cast it.

---

## 4. Ground glow

A projected decal that hugs the terrain — **not a reflection.**

```ts
groundGlow: { halfWidth: 190, peakOpacity: 0.26 }
```

A reflection would need the ground to be wet, and wet ground in a dry mountain
valley at night raises a question the scene cannot answer. A patch of lit ground
under a bright object raises none: it is simply what happens.

Driven by **local completion**, inverted analytically from the seating schedule:

```glsl
float seatAt = uWindowStart + (1.0 - vU) * uWindowSpan;
float complete = smoothstep(0.0, 0.9, uTime - seatAt);

if (uRewindSpan > 0.0) {
  float rewindAt = uRewindStart + vU * uRewindSpan;
  complete *= 1.0 - smoothstep(0.0, 0.9, uTime - rewindAt);
}
```

The glow runs far → near underneath the bridge, arriving just behind the
construction front, and is taken away again by the rewind following the same
front. Without the second term the valley stays lit under a bridge that is no
longer there — the single most obvious way to reveal that the glow was painted on
rather than cast.

Painted in **`--moss`, not the brand lime.** Partly for the colour rule (moss at
0.26 opacity is 0.049 luminance, under the 0.058 edge, so a wide band costs almost
nothing), mostly because it is more correct: light bouncing off ground takes the
ground's colour, and lime on the ground reads as a second light source.

---

## 5. Bloom

```ts
bloom: {
  threshold: 0.62,
  radius: 0.42,
  mips: 3,
  strengthByPhase: {
    dormant: 0.30, awakening: 0.46, glide: 0.62,
    assembly: 0.44, assemblyEnd: 0.88,
    completion: 1.15, living: 0.85,
  },
  settleSeconds: 3.2,
}
```

### 5.1 Threshold separates matter from light

0.62 is what separates matter from light: terrain peaks at ~0.09 (0.27 with the
swarm), stars at 0.34, dormant particles at 0.17 — **none of them cross it. Only
particles bloom.**

### 5.2 The curve is driven per frame

`bloomStrengthAt(t)` in `BridgeScene`. The scene **reports**, the Stage applies —
post-processing stays owned by the Stage, which is the only place that knows
whether bloom is enabled on this device.

The curve was pinned to a single value (`living`, 0.85) for a long time. That is
not a rounding error, it is the difference between a scene that *becomes* made of
light and a scene that always was. It presented as **two contradictory failures**:
the glide frames ran ten points over their deep-band budget while the settled
frames ran three points *under* their accent target. One constant failing in
opposite directions at opposite ends of the film is the signature of a missing
curve, and it is not a signature anyone recognises while still turning dials.

### 5.3 `assembly` opens LOWER than `glide` closes

The one discontinuity in the curve, and deliberate. T+6.4 is the densest instant
in the film: the airborne population is at its maximum *while* the seated
population is already accumulating, so both light sources run at once. Bloom is
the largest single term in the frame — disabling it entirely is worth eleven
points — so it is the only lever with enough authority, and taking it at the
start of assembly costs nothing at the completion peak.

### 5.4 The tail is the exhale

`completion` 1.15 → `living` 0.85 over 3.2 s. Holding the completion peak would
make the finished bridge a light source rather than a thing that has just
finished being built, and **nothing that stays at its loudest ever reads as
having arrived.**

### 5.5 Mip depth, not radius

`mips: 3`, measured down from 5 — and it was 5 only because the field was declared
in config and never read.

Mip depth is the halo's true extent: each level halves the resolution the glow is
reconstructed from, so five levels throw light from one bright particle across
roughly 32 pixels. With 140,000 in flight the union of those throws became a faint
wash over the middle third of the frame.

**The histogram is what made this legible.** Three band counts hid the shape
completely: nine of the twelve excess deep-band points sat between 0.058 and 0.2 —
barely above the black edge — which is a wide dim haze, not the bright core the
pack asks for.

---

## 6. Completion pulse

```ts
COMPLETION_PULSE = {
  startDelay: 0.2, duration: 0.5, bandWidth: 190,
  peakBrightness: 1.0, recoveryMs: 260,
  direction: "farToNear", bloomPeak: 1.15, bloomPeakMs: 200,
}
```

**ONE band of brightness, travelling far → near in the same direction the build
ran. Fires exactly once.** A bridge that pulses rhythmically is a heartbeat, and a
heartbeat is a much cheaper idea than this one.

---

## 7. Tone mapping and exposure

Handled entirely in the composite (see [`Shaders.md`](Shaders.md) §8):

```
color *= uExposure           // 1.0
color = acesFilm(color)      // Narkowicz 2015 ACES approximation
color = toSRGB(color)
color *= 1 - vignette        // AFTER encoding — reads as lens, not lighting
color += grain
color += triangular dither
color *= uFade
```

**ACES rather than Reinhard** keeps saturated greens from clipping to white at the
bloom cores — which matters enormously on a monochrome-green palette where every
bright thing is the same hue.

Exposure is a flat 1.0 and never animated. `POSTFX.vignette.strength` 0.34,
`grain.amount` 0.035.

---

## 8. Where each capture's light comes from

Measured by element isolation (`window.__scene.*` toggles), at T+16:

| Element | near-black contribution |
|---|---|
| Terrain alone | ~10.1% deep |
| Particles alone, bloom off | ~0.6% deep |
| Particles + bloom | ~12.3% deep |
| Mist | **0.0** — lives entirely under the band edge |
| Ground glow | ~0.3 points |
| Sky | ~0.4 points |
| Trails (clamped) | **0.0** |

> **Near-black is not black.** The band edge is 0.058, and the mist contributes
> about 0.024 on top of terrain sitting around 0.03. Plainly visible on a dark
> screen, still counted as near-black. The colour rule constrains the histogram,
> not the visibility — there is a great deal of usable picture underneath it, and
> the scene had been treating that whole range as unavailable.

---

## 9. Current standing

`npm run palette` — **5 of 7 captures inside the rule.**

Two fail and are left failing on purpose (decision log Q-05):

```
        dormant  awaken  glide  asm-early  asm-late  complete  settled
target    94      91      87       87         85        86       85
actual    91.7    89.4    84.6     82.1       82.4      82.8     83.2
                                    FAIL                 FAIL
```

The scene's sequence is smooth and monotone — it darkens into the build, bottoms
out at the densest moment, and recovers as the light lands. The target row is
not: it steps 87 → 87 and then back **up** to 86 after 85. `complete` is targeted
darker than `assembly-late` despite being the frame where bloom peaks at 1.15.

Neither target was edited to match. What is wanted there is a ruling on §6.1, not
a quieter checker.
