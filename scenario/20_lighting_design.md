# 20 — LIGHTING DESIGN

**All the light in the scene, and why there is so little of it.**

---

## 20.1 The premise

> **There is no light source in this world.**

No sun. No moon. No lamp, no fire, no window, no distant city. Nothing in the
frame emits light except the particles themselves and a faint glow in the sky.

This single decision produces most of the scene's character, and it is the
reason for several of the bans in [`05_visual_language.md`](05_visual_language.md)
§5.4:

| Banned | Because |
|---|---|
| Lens flares | Imply a source in or near frame |
| God rays / volumetric shafts | Imply a source casting them |
| Cast shadows | Imply a directional source |
| Specular highlights | Imply a source to reflect |
| Horizon glow | Implies civilisation beyond the frame |

---

## 20.2 The complete light inventory

Four things. That is all.

| # | Light | Type | Intensity | Lights what |
|---|---|---|---|---|
| 1 | **Ambient** | Ambient | 0.22 | Everything, flatly |
| 2 | **Skyglow** | Directional | 0.16 | Terrain |
| 3 | **Swarm** | 5 × Point | 0.00 – 0.35 | Terrain only |
| 4 | **Particles** | Emissive | self | Themselves |

Plus one **non-light** that behaves like one:

| 5 | Rim term | Shader effect | 0.34 | Terrain silhouettes |

---

## 20.3 Ambient

```ts
LIGHTING.ambient = { color: '#14240A', intensity: 0.22 }
```

A flat, directionless base applied to everything.

`#14240A` is a very dark desaturated green — luminance about 0.02. At intensity
0.22 it contributes a maximum of roughly **0.005 luminance** to any surface.

**It is almost nothing, and it is essential.** Without it, terrain facing away
from the skyglow is mathematically pure black, and pure black regions kill the
sense that the surface continues into shadow. With it, unlit terrain sits at a
value just barely above the sky, so the eye reads *dark ground* rather than
*hole*.

> **Trap:** ambient is the easiest lever to raise when someone says "I can't see
> the mountains". Raising it flattens everything — ambient light has no
> direction, so it destroys form. The correct answer to "I can't see the
> mountains" is almost always the rim term, not ambient.

---

## 20.4 Skyglow (the key light)

```ts
LIGHTING.key = {
  color: '#A9C77E',
  intensity: 0.16,
  direction: [-0.40, 0.70, -0.35],
}
```

One directional light, coming from **above and slightly behind-left**.

### It is not a sun

At intensity 0.16 with a desaturated pale-green colour, it produces no visible
highlight and no discernible shadow direction. It reads as **diffuse light from
the whole sky**, which is what it is standing in for.

The direction vector matters less for where light falls and more for **which
slopes are marginally brighter than others** — enough to give the terrain a
consistent sense of which way is up, without ever suggesting a source.

### No shadows

`castShadow: false`. Shadow maps at this scale would cost 2–4ms per frame and
would produce hard-edged shadows from a light that is meant to be diffuse. The
absence is correct, not a compromise.

---

## 20.5 The rim term

Not a light. A shader effect. It does more work than any actual light in the
scene.

```ts
TERRAIN.material = {
  rimColor: '#41750F',
  rimStrength: 0.34,
  rimPower: 3.2,
}
```

```glsl
float rim = pow(1.0 - abs(dot(normal, viewDir)), rimPower);
color += rimColor * rim * rimStrength;
```

Where a surface turns away from the camera — along a ridgeline, at the edge of a
silhouette — the rim term rises.

### This is how the mountains are visible at all

The terrain's albedo is `#0B0F18`, luminance 0.008 — essentially invisible. The
rim term takes the brightest terrain pixel up to about **0.09 luminance**.

**Ninety percent of what you can see of the landscape is the rim term.**

| `rimPower` | Result |
|---|---|
| 1.5 | Broad glow across whole hillsides. Reads as fog. |
| **3.2** | **A tight edge a few pixels wide, tracing each ridgeline.** |
| 6.0 | Almost nothing survives. Terrain disappears. |

### It stays below the bloom threshold

Peak terrain luminance **0.09**, bloom threshold **0.62**. A factor of seven of
headroom.

> **This separation is the most important number relationship in the lighting.**
>
> Terrain never blooms. Sky never blooms. Stars never bloom. Nebula never
> blooms. **Only particles bloom.**
>
> That is what keeps the landscape reading as *solid matter* next to objects made
> of *light*. If terrain ever crosses the threshold, the two categories merge and
> the scene loses its most basic visual distinction — everything becomes glowing
> soup.

---

## 20.6 Swarm lights — the flying particles illuminate the mountains

The client's explicit request: *the particles should light the mountains as they
fly, but not too brightly.*

### The problem

140,000 emissive particles should, physically, light everything around them.
140,000 dynamic lights is not a thing any renderer can do — not at 60fps, not at
6fps.

### The solution

**Five point lights that follow the centroids of particle clusters.**

```ts
LIGHTING.swarmLights = {
  count: 5,
  color: '#A6FD3F',
  intensityMax: 0.35,
  distance: 320,
  decay: 2,
  terrainClamp: 0.18,
  intensityByPhase: {
    dormant:    0.00,
    awakening:  0.14,
    glide:      0.35,   // peak
    assembly:   0.20,
    completion: 0.08,
    living:     0.04,
  },
}
```

### Clustering

Active particles are bucketed by their position along the river into five equal
bins by `u`. Each light sits at the mean position of its bin.

```
        light 0   light 1   light 2   light 3   light 4
           ●         ●         ●         ●         ●
        ░▒▓███▓▒░▒▓███▓▒░▒▓███▓▒░▒▓███▓▒░▒▓███▓▒░
        u=0-0.2  0.2-0.4  0.4-0.6  0.6-0.8  0.8-1.0
```

A light whose bin contains no active particles is **disabled**, not left at the
origin — otherwise a dead light sits at world centre spilling green onto the
valley floor.

### Why this is not a compromise

At `distance: 320` with `decay: 2`, the falloff is so broad that the exact
position of any individual particle has **no measurable influence** on the
result. What matters is where the mass of light is, and the centroid captures
that exactly.

The five-light approximation is **indistinguishable from the physically correct
answer** at these intensities and distances. It is not a cheaper version of the
right thing; at this scale it *is* the right thing.

### The clamp is enforced in the shader

```glsl
float swarm = /* accumulate five point lights */;
swarm = min(swarm, 0.18);      // TERRAIN_SWARM_CLAMP
```

A hard ceiling, not a post-hoc adjustment.

**Why:** when the river passes close to a ridge, unclamped inverse-square
falloff produces a bright hotspot — a spotlight sliding across the mountain.
That reads as *a light being shone at the landscape*, which introduces an
external agent into a story that has none
([`04_story_seed_to_bridge.md`](04_story_seed_to_bridge.md) §4.7).

Clamped, the ridge brightens up to a point and no further, so the light reads as
**spill** rather than as illumination from a source.

### The intensity curve

```
0.35 ┤                    ╭──╮
     │                  ╱     ╲
0.25 ┤                ╱        ╲
     │              ╱           ╲
0.15 ┤          ╱─╯               ╲
     │       ╱                      ╲___
0.05 ┤    ╱                              ╲______________
0.00 ┼──╯
     └────┬──────┬──────┬──────┬──────┬──────┬──────────
        0.0    1.2    2.8    5.4   11.2   12.4      →
      dormant awaken  glide  assembly comp   living
```

**The landscape is most visible during the journey and least visible once the
destination is reached.**

The scene's attention narrows onto the bridge exactly as the bridge becomes
worth attending to. This is a choice, not a technical consequence, and it is
worth defending: it means the valley is revealed in the phase where the viewer is
least likely to be looking at it, which is precisely why it registers as
atmosphere rather than as a feature.

### The restraint test

> **A viewer must not be able to identify the moment the mountains became
> visible.** They should only be able to say, in retrospect, that they can see
> more of the valley than they could at the start.

If the mountains are obviously and evenly lit — if it looks like a light was
turned on — the intensity is too high and the 85/10/5 ratio has already broken.

Check `npm run palette` at the `awakening` and `glide` captures. If the deep
green band exceeds ~9%, turn the swarm lights down.

---

## 20.7 Particles are emissive

```ts
LIGHTING.bridgeIsEmissive = true
```

Particles are **never lit by anything**. They generate their own brightness from
their lifecycle state, sampled through `PARTICLES.colorRamp`.

```
brightness  0.17 → 0.55 → 0.92 → 1.00 → 0.74
            dorm   lift   glide  appr   seated
```

Consequences:

**They are unaffected by ambient, skyglow, or each other.** A particle's
appearance depends only on its own state and the fog at its distance.

**Density produces the highlights.** Additive blending means overlapping
particles sum and clamp toward `--lime-core` `#D9FF9C`. The white-hot cores in
the tower legs are not painted — they are 19,600 particles in a small volume.
See [`06_art_direction.md`](06_art_direction.md) §6.3.

**They cannot be shadowed.** Nothing casts onto them and they cast onto nothing.
The only occlusion is depth-testing against the terrain.

---

## 20.8 The ground glow

A soft additive decal on the terrain beneath the bridge.

```ts
export const GROUND_GLOW = {
  /** Follows the bridge centreline, fading with distance from it. */
  halfWidth: 190,
  color: '#1D3A0A',
  peakOpacity: 0.26,
  /** Scales with how much of the bridge above it is built. */
  drivenByLocalCompletion: true,
}
```

Produces the diffuse green pool visible under the bridge in the reference frame,
around `x 55–90%`, `y 72–88%`.

### It is not a reflection

The valley floor has mist, not water. It never mirrors the bridge, never ripples,
never inverts.

> A real reflection would double the fill-rate cost and imply a lake, which
> changes what the valley is. `07` §7.11 note **R-4** records this as a
> deliberate difference from the reference image.

### It builds with the bridge

`drivenByLocalCompletion` — the glow's opacity at any point along the corridor
scales with the fraction of bridge particles seated above that point.

So during Phase 3 the ground glow **follows the construction front**, appearing
under completed sections and absent under empty ones. It is a free reinforcement
of the far→near sweep and costs one extra lookup.

---

## 20.9 Light budget by phase

Total light in the frame, as it changes.

| Phase | Ambient | Skyglow | Swarm | Particles | Bloom | Net feel |
|---|---|---|---|---|---|---|
| 0 · Dormant | 0.22 | 0.16 | 0.00 | minimal | 0.30 | **Darkest** |
| 1 · Awakening | 0.22 | 0.16 | 0.14 | rising | 0.46 | First light |
| 2 · Glide | 0.22 | 0.16 | **0.35** | **peak** | 0.62 | **Brightest landscape** |
| 3 · Assembly | 0.22 | 0.16 | 0.20 → 0.04 | shifting | 0.62 → 0.88 | Attention narrowing |
| 4 · Completion | 0.22 | 0.16 | 0.08 | seated | **1.15** | **Brightest frame** |
| 5 · Living | 0.22 | 0.16 | 0.04 | seated | 0.85 | Settled |

**Ambient and skyglow never change.** Every variation in the scene's lighting
comes from the swarm lights, the particles' own brightness, and the bloom curve.

> That constancy is deliberate. The *world's* light is fixed — it is a place, and
> places do not change their lighting. Everything that varies is the particles
> and the atmosphere's response to them.

---

## 20.10 What the lighting must never do

| Forbidden | Why |
|---|---|
| **Cast shadows** | No directional source justifies them; cost is 2–4ms |
| **Specular highlights on terrain** | `metalness: 0`, `roughness: 0.94`. Rock, not plastic. |
| **Light the particles** | They are emissive. Lighting them would make them respond to the world instead of being its only light. |
| **Exceed the terrain clamp** | 0.18. Hotspots read as a spotlight. |
| **Bloom anything that is not a particle** | Terrain, sky, stars, nebula all stay below 0.62. |
| **Introduce a second light colour** | One hue. `#A6FD3F` swarm and `#A9C77E` skyglow are both within the lime family; nothing else is permitted. |
| **Animate ambient or skyglow** | The world's light is fixed. |
| **Use one light per particle** | Physically correct, computationally impossible, and visually identical to the five-centroid approximation. |

---

## 20.11 Degradation

```ts
PERF.degradation includes 'swarmLights'    // 5 → 2 → 0
```

| Tier | Swarm lights | What is lost |
|---|---|---|
| `ultra` / `high` | 5 | — |
| `medium` | 5 | — |
| `low` | 2 | The sweep is coarser; ridges brighten in larger steps |
| `minimal` | **0** | **The mountains stay in silhouette for the whole scene** |

At `minimal` the client's request — particles lighting the mountains — is not
honoured at all. That is an accepted loss on the weakest hardware, because the
alternative is cutting particles, and particles are the scene.

The rim term still runs at every tier, so the mountains remain *visible*; they
simply never brighten.

---

## 20.12 Failure modes

**1 · Ambient raised to "see the mountains".**
Symptom: everything flattens; form disappears. Fix the rim term instead.

**2 · Terrain crossing the bloom threshold.**
Symptom: mountains glow. The distinction between matter and light collapses.

**3 · Swarm light hotspots.**
Clamp not enforced in-shader. Symptom: a spotlight sliding across a ridge,
implying an external agent.

**4 · Dead swarm lights at the origin.**
An empty bin's light left enabled at `(0,0,0)`. Symptom: a persistent green pool
at world centre.

**5 · Particles receiving light.**
Symptom: particles dim when they move away from the swarm lights — a feedback
loop, since they *are* the swarm lights.

**6 · Ground glow reading as a reflection.**
Symptom: viewers see a lake. Ensure it never mirrors geometry.

**7 · Skyglow direction producing a visible shadow terminator.**
Intensity too high. At 0.16 there should be no identifiable light direction.

---

## 20.13 Checklist

- [ ] There is **no visible light source** anywhere in the scene.
- [ ] Exactly four lights: ambient, skyglow, five swarm points, emissive
      particles.
- [ ] No shadow maps. `castShadow: false` everywhere.
- [ ] Ambient contributes ≤ ~0.005 luminance and is never raised to solve
      visibility.
- [ ] Skyglow at 0.16 produces no identifiable light direction.
- [ ] The rim term carries ~90% of terrain visibility, `rimPower` 3.2.
- [ ] Peak terrain luminance ~0.09 — **seven times below** the bloom threshold.
- [ ] **Only particles bloom.** Terrain, sky, stars, nebula never do.
- [ ] Swarm lights bin by `u`, and empty bins **disable** their light.
- [ ] Swarm terrain contribution is clamped at 0.18 **in the shader**.
- [ ] Swarm intensity peaks at 0.35 during Phase 2 and falls to 0.04 by
      Phase 5.
- [ ] A viewer cannot identify the moment the mountains became visible.
- [ ] Particles are emissive and are lit by nothing.
- [ ] Highlights come from **density**, not from painted values.
- [ ] Ground glow follows local bridge completion and never reflects.
- [ ] Ambient and skyglow are constant across all seven phases.
- [ ] At `minimal` tier, swarm lights are off and the rim term still runs.

---

**Next:** [`21_anatomy_of_a_particle.md`](21_anatomy_of_a_particle.md) — what a
single particle actually is.
