# Environment

Everything that is not the bridge: terrain, sky, nebula, stars, mist, ground
glow, fog.

Four objects, four draw calls, and none of them is a `THREE.Light`.

---

## 1. Terrain

`src/scene/elements/terrain.ts`, 419 lines.

### 1.1 Geometry

```ts
width  = 1800    // WORLD.bounds.maxX - minX
depth  = 1800    // WORLD.bounds.maxZ - minZ
segments = PERF.terrainSegmentsByTier[tier]   // 384 at high/ultra
```

A `PlaneGeometry(1800, 1800, 383, 383)`, rotated `-π/2` about X and translated to
`(0, 0, -500)`. **147,456 vertices, 294,338 triangles**, one draw call.

Every vertex's Y is set from `noiseHeight(x, z) - carveAmount(x, z)`, then
`computeVertexNormals()`.

### 1.2 Noise

Custom 2D value noise, not simplex, not Perlin:

```ts
function hash2(ix, iy, seed) { /* integer hash → [0,1) */ }

const smoother = (t) => t * t * t * (t * (t * 6 - 15) + 10);   // quintic

function valueNoise2(x, y, seed) {
  // bilinear between four hashed lattice corners, quintic-smoothed
}
```

Quintic smoothing (`6t⁵ - 15t⁴ + 10t³`) rather than cubic, because it has zero
first *and* second derivative at the lattice points — cubic leaves a visible
second-derivative discontinuity that reads as a faint grid on large smooth slopes.

### 1.3 Five octaves

```ts
octaves: [
  [0.00042, 148],   // continental — the big ridgelines
  [0.0012,   62],   // hills
  [0.0038,   19],   // undulation
  [0.011,     6.5], // surface roughness
  [0.034,     1.8], // MICRO DETAIL
]
```

Total possible amplitude 237.3 units.

> **The fifth octave is invisible on any surface and its entire job is
> SILHOUETTES.** The terrain is read almost entirely from rim light along
> ridgelines, and a ridge built from four octaves is a smooth mathematical curve
> that looks it. This octave makes the edge ragged, and ragged edges read as rock.
> It is the first thing anyone optimising the noise will drop. Do not.

Seeded with `TERRAIN.noiseSeed = 0x5eed1a3f`, each octave offset by `i * 977`.

### 1.4 The corridor carve

```ts
corridor: { halfWidth: 210, depth: 132, falloffExp: 2.4 }
```

```ts
function carveAmount(x, z) {
  const u = centreline.nearestU(point);
  const d = distance to the centreline;
  const t = clamp(1 - d / halfWidth, 0, 1);
  return depth * pow(t, falloffExp);
}
```

**Law 2 made mechanical.** The ground beneath the bridge is pushed DOWN, so the
valley exists *because* the bridge crosses there. Without it you get a bridge over
terrain that did not need bridging, which reads as a 3D asset dropped onto a
landscape — everyone can tell, nobody can say why.

132 units of carve against a 210-unit half-width, falloff exponent 2.4 so the
valley walls are steep near the centre and flatten out.

### 1.5 Framing ridges

Three, placed for composition rather than generated:

```ts
framingRidges: [
  { centre: [ 640, 0, -560], radius: 420, height: 196 },
  { centre: [ 880, 0, -980], radius: 520, height: 244 },
  { centre: [-760, 0, -300], radius: 380, height: 128 },   // faint, left side
]
```

The third is deliberately faint and exists to stop the text scrim reading as a
flat black rectangle.

### 1.6 The height cache

```ts
const field = new Float32Array(segments * segments);   // 147,456 floats, 0.59 MB
```

Filled once during construction. `heightAt(x, z)` is then a **bilinear lookup**,
not a noise evaluation.

> Re-running five octaves plus a `nearestU` search 140,000 times during seeding
> costs roughly **400 ms** and shows up as a visible hitch before the scene
> starts. Sampling the cache costs about **6 ms**.

`normalAt` is a central difference over one cell. `slopeAt` is
`acos(normal.y)` in degrees.

Four consumers depend on this cache:

| Consumer | Use |
|---|---|
| `bridgeTargets` | pier footings sampled down to the ground |
| `particles` | seed placement + `aSeedNormal` |
| `mist` | per-vertex pooling density |
| `groundGlow` | decal elevation, +1.6 to avoid z-fighting |

### 1.7 Runtime API

```ts
interface TerrainHandle {
  mesh: THREE.Mesh;
  heightAt(x, z): number;
  normalAt(x, z, out?): Vector3;
  slopeAt(x, z): number;
  setSwarm(positions: Vector3[], intensity: number): void;
  setSwarmCount(count: number): void;    // degradation ladder
  setRim(strength: number): void;        // dev only
  dispose(): void;
}
```

---

## 2. Sky

`src/scene/elements/sky.ts`, 327 lines. **One fullscreen quad. No dome, no
geometry worth the name.**

A skybox would need a mesh large enough to contain the world, which means it
competes with the far clipping plane and gets fogged by anything that fogs by
distance. Instead: one triangle-pair pinned to the far plane in clip space, and
every pixel reconstructs its own view ray from `uInvViewProj`.

```ts
depthTest: false, depthWrite: false, renderOrder: -1000, frustumCulled: false
side: DoubleSide
```

### 2.1 The matrices are derived, not read

```ts
camera.updateMatrixWorld();
camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
_vp.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
invViewProj.copy(_vp).invert();
```

The renderer does not refresh `matrixWorldInverse` until it draws. Reading it
would give the **previous** frame's view — the horizon would trail the ridgeline
by exactly one frame of camera drift, which reads as the mountains sliding
against the sky. Off by one frame is the hardest kind of wrong to see and the
easiest to feel.

`sky.update()` is therefore called **last** in `BridgeScene.update`, after the
camera has moved.

### 2.2 Gradient

Four stops in **elevation** (`sin` of the angle above the horizon), not screen
height. See [`Shaders.md`](Shaders.md) §4 for the full derivation of why the
horizon band is brighter but twenty times narrower than the pack specified.

### 2.3 Stars

900 nominal, over a 60×40 = 2,400-cell screen-space grid at probability 0.375.
Roughly one star per 1,750 pixels of a 1536×1024 frame. **Texture in the dark,
not a starfield** — a visible constellation would imply somewhere specific.

Screen-space and camera-locked. Stars at Z = −3900 would parallax with the ±22u
camera drift and read as fireflies, and would be fogged.

Twinkle: per-star period 3–11 s, phase-scattered, amplitude 28%. Clustered
periods give the field a collective rhythm that becomes obvious within a minute.

Peak brightness 0.34 against a 0.62 bloom threshold. **Nothing in the sky ever
blooms.**

### 2.4 Nebula

The most visually distinctive part of the sky and the only part with colour.
Three octaves of scrolling value noise masked to the upper right — deliberately
opposite the headline block, and **behind where the far end of the bridge builds**,
so the far tower resolves against a faintly luminous field rather than against
pure black. That is why it reads at all despite being 61% fogged.

Drift 0.6 u/s: about 0.7 world units across the whole of Phase 0. Turbulence
period 34 s evolves the internal structure, so over a long session the shape
genuinely changes rather than merely translating.

> Its job is not to be seen moving. Its job is that **no two frames are
> identical**, which the eye detects even when it cannot name it. A perfectly
> static sky reads as a photograph; a sky with 0.7u of drift reads as air.

Colour `--moss`, peak opacity 0.30 → maximum luminance ~0.03.

---

## 3. Mist

`src/scene/elements/mist.ts`, 226 lines. **The element that makes the ground
exist.**

### 3.1 Why it is here

The requirement is that the design establishes the ground, not the particles. The
scene did the opposite: the opening frame's landscape *was* 140,000 particles
seeded across it, and the instant they lifted away to build the bridge the valley
went black.

**Lighting the terrain harder does not fix that.** The rim term only fires where a
surface turns away from the viewer, and a valley seen down its own length
presents almost none: the floor faces the camera, so `1 - |dot(n, v)|` stays near
zero across the whole of it. Raising the rim was measured at 2.7 points of the
near-black budget for a change that was not visible in the composite at all.

Mist works because it is a thing lying **on** the ground rather than a property of
the ground's surface. Where it is thick you are looking into a hollow; where it
breaks you are looking at a rise. **It draws the topography instead of shading
it.**

### 3.2 Construction

```ts
mist: {
  ceiling: 58,        // terrain height at which the mist has fully thinned
  floor: -70,         // below this it is uniformly thick
  color: "#14251c",
  opacity: 0.62,
  driftSpeed: 0.9,
  turbulencePeriod: 41.0,
  segments: 120,
}
```

A `PlaneGeometry(1800, 1800, 120, 120)` at `y = WORLD.mistPlaneY = 6`.

Per-vertex density is computed on the CPU from the **real heightfield**:

```ts
d = 1 - smoothstep(terrain.heightAt(x, z), floor, ceiling)
d *= edgeFadeX * edgeFadeZ          // smoothstep from 0.72 to 1.0 of the half-extent
```

Never a second copy of the terrain noise. *A duplicated heightfield is one that
will eventually disagree with the one it is copying, and mist that pools where
there is no hollow is worse than no mist.*

### 3.3 Why it is free

**Near-black is not black.** The band edge is 0.058; this contributes about 0.024
on top of terrain sitting around 0.03. The sum is plainly visible on a dark screen
and still counted as near-black. Measured cost to the colour ratio: **zero**, even
at three times the original brightness.

### 3.4 Solved, not dialled

```
want            0.025 luminance added at the thickest point
noise           ~0.50 average
distance fade   ~0.60 over the visible valley
so alpha_eff  = 0.62 * 0.5 * 0.6 = 0.186
#14251C is 0.1286 → 0.1286 * 0.186 = 0.024   ✓
```

The first attempt used `#0A1712` at 0.22, which works out to 0.003 — about a
tenth of what was needed, and it rendered as nothing at all. The difference
between invisible and correct here is one order of magnitude, which is many more
increments than anyone wants to sit through.

---

## 4. Ground glow

`src/scene/elements/groundGlow.ts`, 235 lines.

A ribbon decal, 180 samples along × 24 across = 4,320 vertices, generated by
walking the centreline and laying vertices at `±halfWidth (190)` on the
**horizontal perpendicular**:

```ts
lateral.crossVectors(tangent, up).normalize();
```

Using the parallel-transport binormal instead would tilt the decal with the
deck's roll and lift one side off the ground. **The glow lies on the terrain, not
on the bridge.**

Y is `terrain.heightAt(x, z) + 1.6` — lifted clear or the decal z-fights the
ground it is painted on, which sparkles.

Falloff is **squared laterally** (`(1 - lat²)²`): a linear falloff gives the pool
a visible border; this has a bright spine under the deck and no edge anywhere.

See [`Lighting.md`](Lighting.md) §4 for the completion/rewind driving.

---

## 5. Fog

```ts
WORLD.fogNear  = 420
WORLD.fogFar   = 2100
WORLD.fogColor = "#070a13"     // === PALETTE.ink
```

**`scene.fog` is `null`.** There is no `THREE.Fog` object. Terrain and particles
each apply fog in their own shaders, because they need **opposite operations**:

```glsl
// terrain (and any opaque surface)
color = mix(color, uFogColor, fogFactor);

// additive particles
color *= (1.0 - vFog);
```

Three's built-in fog only does the first. Applied to additive geometry, blending
toward a non-black colour makes a dense distant region *add* fog colour and get
brighter — so the far end of the bridge glows more than the near end and the
entire depth read inverts.

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

**Fog outranks the bridge.** The far end is 61% fogged and someone will ask to
reduce it so the far tower reads more clearly. The answer is no: a clearly visible
far tower makes the valley look small, and fog is the scene's primary depth cue.

The fog colour sits between the sky's horizon band and its mid band, so distant
terrain dissolves into the sky with no visible seam.

The mist has its own distance fade starting at `fogNear * 2.5 = 1050`, because its
rim is already faded per-vertex and this only has to finish the job. Begun at
`fogNear` it removed half the brightness from everything worth seeing.

---

## 6. What does not exist

Deliberately, and a reader should not go looking:

- **No clouds.** The nebula is the only sky volume.
- **No reflections.** No water, no wet ground, no cube map, no SSR, no
  reflection probe.
- **No shadows.** No shadow map, no contact shadows, no AO. Nothing in the scene
  casts a shadow on anything.
- **No god rays / volumetric scattering.** The swarm lights illuminate surfaces;
  they do not scatter through air.
- **No atmospheric scattering model.** The sky gradient is four hand-picked
  colours, not Rayleigh/Mie.
- **No stars in world space, no skybox texture, no HDRI.**
- **No wind, no vegetation, no birds, no weather.**
