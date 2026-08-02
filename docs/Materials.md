# Materials

Nine `ShaderMaterial` instances. **Zero built-in three.js materials.** No
`MeshStandardMaterial`, no `MeshBasicMaterial`, no `PointsMaterial`, no
`SpriteMaterial`.

---

## 1. Inventory

| # | Material | Object | Blending | depthTest | depthWrite | transparent | renderOrder |
|---|---|---|---|---|---|---|---|
| 1 | Particles | `THREE.Points` | **Additive** | ✅ | ❌ | ✅ | 5 |
| 2 | Terrain | `THREE.Mesh` | Normal | ✅ | ✅ | ❌ | 1 |
| 3 | Sky | `THREE.Mesh` | Normal | ❌ | ❌ | ❌ | −1000 |
| 4 | Mist | `THREE.Mesh` | **Additive** | ✅ | ❌ | ✅ | −1 |
| 5 | Ground glow | `THREE.Mesh` | **Additive** | ✅ | ❌ | ✅ | −1 |
| 6 | Trail accumulate | fullscreen | Normal | ❌ | ❌ | ❌ | — |
| 7 | Trail add | fullscreen | **Additive** | ❌ | ❌ | ✅ | — |
| 8 | Bloom (prefilter / down / up) | fullscreen | Normal / Additive | ❌ | ❌ | ❌ | — |
| 9 | Composite | fullscreen | Normal | ❌ | ❌ | ❌ | — |

Only **one material writes depth**: the terrain. That is the whole depth story.
Mountains can hide the bridge; nothing else hides anything.

---

## 2. Particle material

```ts
new THREE.ShaderMaterial({
  vertexShader:   buildVertexShader(),   // assembled from config at runtime
  fragmentShader: FRAGMENT,
  uniforms: { uTime, uFrameTex, uRamp, uPointScale, uCursor, uCursorStrength,
              uDisperse, uLoop, uTrailPass, uDisperseOrigin, uPulseU },
  transparent: true,
  blending: THREE.AdditiveBlending,
  depthTest: true,
  depthWrite: false,
})
```

### The depth pair

> These two look contradictory and someone will "fix" them by disabling both.
> They do different jobs:
>
> ```
> test  = can terrain hide me?         yes
> write = can I hide other particles?  no
> ```
>
> Disabling `depthTest` draws the bridge over the mountain in front of it.
> Enabling `depthWrite` makes particles occlude each other and **destroys the
> additive accumulation the entire scene relies on** — the tower legs stop being
> white-hot bars of light and become a flat green fog of individual dots.

### Why additive

Overlapping particles **sum**, which is where nearly all of the scene's visual
character comes from: tower legs read as solid bars of light, cables as continuous
lines, the river fringe as separate sparks — all the same particle at the same
brightness, in different amounts.

It is also order-independent, which is why there is no sorting anywhere in this
project.

### Textures

| Uniform | Texture | Format |
|---|---|---|
| `uFrameTex` | 512 × 4 | RGBA32F, `NearestFilter`? **No — Linear**, hence the half-texel inset |
| `uRamp` | 256 × 1 | RGBA8, `LinearFilter` both ways |

**Two textures for the entire scene.** No albedo maps, no normal maps, no
roughness maps, no sprite atlas, no HDRI, no LUT.

### `onBeforeRender`

```ts
points.onBeforeRender = (_renderer, _scene, camera) => {
  material.uniforms.uTrailPass.value = camera.layers.isEnabled(0) ? 0 : 1;
};
```

The same material serves both the main pass and the trail pass, so the uniform
cannot be set once. **The camera's layer mask is the honest signal**: the trail
pass switches to the trail layer alone, so layer 0 being disabled means this is
it. Inferring it from the render target instead would couple `particles.ts` to
`PostFX`'s internals.

### Layers

```ts
points.layers.enable(TRAIL_LAYER);   // 1
points.frustumCulled = false;
geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 100, -300), 2600);
```

`position` is a dummy of zeros, so three.js would otherwise compute a zero-radius
bounding sphere at the origin and cull the entire system on the first frame.

---

## 3. Terrain material

```ts
new THREE.ShaderMaterial({
  vertexShader: VERT, fragmentShader: FRAG,
  uniforms: {
    uBase:          Color(PALETTE.void),
    uRim:           Color(PALETTE.rim),
    uRimStrength:   0.55,
    uRimPower:      3.2,
    uAmbient:       Color(PALETTE.moss) * (0.22 * 0.12),
    uKeyColor, uKeyIntensity: 0.03, uKeyDir,
    uSwarmPos: Vector3[5], uSwarmIntensity, uSwarmRange: 260,
    uSwarmDecay: 2, uSwarmClamp: 0.18,
    uSwarmColor: Color(PALETTE.limeBright), uSwarmCount,
    uFogColor: Color(PALETTE.ink), uFogNear: 420, uFogFar: 2100,
  },
})
```

The only opaque, depth-writing material in the scene.

`TERRAIN.material.roughness (0.94)` and `metalness (0.0)` are declared in config
and **read by nothing** — a leftover from a PBR path that no longer exists. The
hygiene check's nested-key heuristic does not flag them because `roughness` and
`metalness` are on its common-word filter.

---

## 4. Sky material

```ts
new THREE.ShaderMaterial({
  vertexShader: VERTEX, fragmentShader: FRAGMENT,
  uniforms: {
    uGradientColor: Color[4], uGradientY: number[4],
    uNebulaColor, uNebulaOpacity, uNebulaExtent: Vector4,
    uNebulaOctaves: Vector3[3], uNebulaDrift: Vector2, uNebulaTurbulence,
    uStarGrid: Vector2(60,40), uStarProbability: 0.375,
    uStarSize: Vector2(0.7,1.6), uStarBrightness: Vector2(0.10,0.34),
    uStarFalloff: Vector2(0.42,0.86), uStarPeriod: Vector2(3,11),
    uStarTwinkle: 0.28,
    uInvViewProj: Matrix4, uCameraPos: Vector3,
    uResolution: Vector2, uTime,
  },
  depthTest: false,
  depthWrite: false,
  side: THREE.DoubleSide,
})
```

Geometry is `PlaneGeometry(2, 2)`. The vertex shader ignores the projection
matrix entirely and emits `vec4(position.xy, 1.0, 1.0)`.

`side: DoubleSide` is defensive — the quad is emitted in clip space so winding
should not matter, but a `-1` scale anywhere upstream would silently blank the
sky.

---

## 5. Mist material

```ts
{
  transparent: true,
  blending: THREE.AdditiveBlending,
  depthTest: true,          // terrain occludes it
  depthWrite: false,        // it never occludes the particles flying over it
  side: THREE.DoubleSide,   // the camera can pass below the plane during push-in
}
```

Additive, like everything else that emits rather than reflects. **Mist lit from
within is the only kind that belongs in this palette** — a mist that occludes
would have to be brighter than what is behind it to be seen, and there is nothing
behind it but black.

Custom attribute `aDensity` (1 float per vertex), 14,641 vertices.

---

## 6. Ground glow material

```ts
{
  transparent: true,
  blending: THREE.AdditiveBlending,
  depthTest: true,
  depthWrite: false,
  frustumCulled: false,
  renderOrder: -1,
}
```

Custom attributes `aU` and `aLat`, both 1 float, 4,320 vertices. Indexed
triangles: `(ALONG-1) × (ACROSS-1) × 2 = 8,234` triangles.

---

## 7. Post-processing materials

All share one `VERT`:

```glsl
varying vec2 vUv;
void main(){
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
```

and are blitted through a single reused fullscreen mesh:

```ts
private blit(material, target) {
  this.fsMesh.material = material;
  this.renderer.setRenderTarget(target);
  this.renderer.render(this.fsScene, this.fsCamera);
}
```

One mesh, one geometry, swapped material. Nine blit-capable materials, one
draw-call's worth of geometry between them.

### `matTrailAdd` needs `autoClear = false`

```ts
const autoClear = renderer.autoClear;
renderer.autoClear = false;
this.blit(trail.add, this.sceneTarget);
renderer.autoClear = autoClear;
```

It is additive onto a target that already has the scene in it. Without this the
blit erases the frame it is adding to.

---

## 8. Material count and program count

| | Count |
|---|---|
| `ShaderMaterial` instances | 9 |
| Distinct GLSL programs | 9 |
| Textures uploaded | **2** (frame table, colour ramp) |
| Render targets | 4 + 3 mips = **7** |
| Geometries | 6 (particles, terrain, sky quad, mist, glow, fullscreen quad) |
| `THREE.Light` instances | **0** |

Nothing is instanced, nothing is batched, nothing is merged. There is nothing to
merge — every object is already exactly one draw call.

---

## 9. Disposal

`Stage.dispose()` traverses the scene graph:

```ts
this.scene.traverse((object) => {
  const mesh = object as THREE.Mesh | THREE.Points | THREE.LineSegments;
  mesh.geometry?.dispose?.();
  const material = mesh.material;
  if (Array.isArray(material)) material.forEach((m) => m.dispose());
  else material?.dispose();
});
```

plus `handle.dispose()` (which disposes each element's own geometry/material
again — harmless, three.js disposal is idempotent) and `post.dispose()` for the
render targets.

⚠ **The two `DataTexture`s are not explicitly disposed.** `uFrameTex` and `uRamp`
are created inside `createParticles` and never released. The material's
`dispose()` does not dispose its textures. On a single-page site with one Stage
this leaks 33 KB once, which is why nobody has noticed, but it is a real leak on
any page that creates and destroys Stages.
