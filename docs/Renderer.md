# Renderer

`src/gl/Stage.ts` (532 lines) and `src/gl/PostFX.ts` (887 lines).

---

## 1. WebGLRenderer

```ts
new THREE.WebGLRenderer({
  antialias: false,      // bloom + grain hide edges; MSAA would cost more than it returns
  alpha: false,
  powerPreference: "high-performance",
  stencil: false,
  depth: true,
});

renderer.outputColorSpace = THREE.LinearSRGBColorSpace;   // NOT SRGBColorSpace
renderer.toneMapping      = THREE.NoToneMapping;          // NOT ACESFilmicToneMapping
renderer.setClearColor(0x000000, 1);
```

**Colour management is handled explicitly in the composite pass, not by
three.js.** `outputColorSpace = LinearSRGB` and `toneMapping = NoToneMapping`
together mean three.js performs no conversion at all — everything stays linear
through the render targets, and the composite does exposure → ACES → sRGB in one
place where it can be read and reasoned about.

If someone "fixes" either of these to the three.js defaults, the scene will be
double-encoded and will wash out.

### Pixel ratio

```ts
pixelRatio = min(window.devicePixelRatio || 1, capabilities.maxPixelRatio)
```

`maxPixelRatio` comes from the capability probe, capped at 2.0 for `high`/`ultra`
and 1.0 for `low`/`minimal` (`PERF.maxDPRByTier`). Retina at 3× is never worth
it on this scene — it triples fill cost for detail that additive bloom destroys
anyway.

---

## 2. Camera

```ts
new THREE.PerspectiveCamera(cameraFov ?? 45, width / height, 0.1, 400)
```

⚠ **Note the discrepancy.** `Stage` constructs the camera with `near: 0.1, far:
400`, and then `BridgeScene` immediately overwrites all three:

```ts
camera.fov  = CAMERA.fov;    // 38
camera.near = CAMERA.near;   // 1
camera.far  = CAMERA.far;    // 4000
camera.updateProjectionMatrix();
```

`SceneCanvas` also passes `cameraFov: 40` in `StageOptions`, which is then
overwritten by `CAMERA.fov: 38`. There are **three** places a FOV is specified
and only one of them wins. See [`Camera.md`](Camera.md) §7.

The composite's `uNear`/`uFar` are refreshed from the camera every frame, so the
depth linearisation stays correct despite the overwrite.

---

## 3. Render targets

All allocated in `PostFX.setSize(width, height)` with:

```ts
{ type: THREE.HalfFloatType, format: THREE.RGBAFormat,
  minFilter: LinearFilter, magFilter: LinearFilter,
  depthBuffer: true, stencilBuffer: false, generateMipmaps: false }
```

**HalfFloat throughout.** Additive blending on this scene routinely sums past 1.0
— the tower legs are white-hot cores nobody painted — and an 8-bit target would
clip that information before the tone mapper ever saw it.

| Target | Size | Depth | Purpose |
|---|---|---|---|
| `sceneTarget` | full | **DepthTexture**, UnsignedInt 24-bit | The world |
| `trailScratch` | half | yes | This frame's trailing particles only |
| `trailA` / `trailB` | half | no | Ping-pong accumulator |
| `mips[0..2]` | ½, ¼, ⅛ | no | Bloom chain |
| `atmosphereTarget` | full | no | Only allocated if a scene installs an atmosphere pass |

`sceneTarget` gets a real `DepthTexture` rather than just a depth buffer because
the composite samples it for depth of field, and an atmosphere pass would too.
`UnsignedIntType` (24-bit) rather than float depth — precision is ample over this
scene's far plane and it is the format every target platform supports without an
extension.

**No scene currently installs an atmosphere pass.** `setAtmospherePass` exists,
`SceneHandle.atmosphere` exists, `BridgeScene` does not return one. The sky is
drawn as scene geometry instead. That path is live code with no caller.

---

## 4. The frame

```
Stage.render(frame)
 │
 ├─ pointer smoothing            x += (targetX - x) * (1 - 0.0015^delta)
 ├─ dolly bump stamp + auto-return
 ├─ pointer.dolly += (dollyTarget - dolly) * 0.07
 │
 ├─ handle.update(frame, pointer)          ◄── BridgeScene: everything moves here
 ├─ post.setBloomStrength(handle.bloomStrength())
 ├─ governor.sample(frame.raw * 1000, frame.phase)
 ├─ intro fade                              1 - (1-fade)³ over 1.4s
 │
 └─ post.render(scene, camera, elapsed, trailLayer)
      │
      │  ── TRAIL (only if options.trails && scene published a trailLayer) ──
      ├─ camera.layers.set(TRAIL_LAYER)          save mask first
      ├─ scene.background = null                 ◄── CRITICAL, see §5
      ├─ render(scene, camera) → trailScratch
      ├─ scene.background = saved
      ├─ camera.layers.mask = saved
      ├─ blit(TRAIL_ACCUM{tPrevious:B, tCurrent:scratch, uDecay}) → A
      └─ swap A ↔ B
      │
      │  ── SCENE ──
      ├─ matComposite.tScene = null              release before rendering INTO it
      ├─ matComposite.tDepth = null
      ├─ setRenderTarget(sceneTarget); clear()
      ├─ render(scene, camera)                   5 objects
      │
      │  ── TRAIL ADD ──
      ├─ autoClear = false
      ├─ blit(TRAIL_ADD{tSource:B}) → sceneTarget      additive, no clear
      ├─ autoClear = restored
      │
      │  ── ATMOSPHERE (unused) ──
      ├─ if (atmosphereMaterial) blit(...) → atmosphereTarget; source = that
      │
      │  ── BLOOM ──
      ├─ blit(PREFILTER{tSource:source, uThreshold}) → mips[0]
      ├─ for i in 1..2:  blit(DOWNSAMPLE) → mips[i]
      ├─ for i in 2..1:  blit(UPSAMPLE)   → mips[i-1]     additive
      │
      │  ── COMPOSITE ──
      └─ blit(COMPOSITE{tScene, tBloom:mips[0], tDepth}) → null (screen)
```

### Draw calls per frame

| Pass | Calls |
|---|---|
| Trail pass (particles only) | 1 |
| Scene pass (sky, terrain, mist, glow, particles) | 5 |
| Trail accumulate | 1 |
| Trail add | 1 |
| Bloom prefilter | 1 |
| Downsample | 2 |
| Upsample | 2 |
| Composite | 1 |
| **Total** | **14** |

14 draw calls for the whole page. Two of them (the trail pass and the scene's
particle draw) each push 82,599 vertices.

### Render order

```
sky          renderOrder -1000   opaque,      depthTest false, depthWrite false
groundGlow   renderOrder    -1   transparent, depthTest true,  depthWrite false
mist         renderOrder    -1   transparent, depthTest true,  depthWrite false
terrain      renderOrder     1   opaque,      depth write ON
particles    renderOrder     5   transparent, depthTest true,  depthWrite false
```

Only the terrain writes depth. Everything additive tests against it and writes
none — so the mountains can hide the bridge, and the bridge cannot hide itself.

---

## 5. Two subtleties that cost real time to find

### 5.1 The background must be nulled for the trail pass

`renderer.render` clears with `scene.background` when one is set. The trail pass
would therefore start every frame filled with the fallback sky colour, and the
accumulator would sum it geometrically: `1/(1-0.88)` = **8.3×**, a flat lift of
~0.11 luminance across the whole frame, in a scene whose entire near-black band
lives below 0.058.

**The dormant frame is what gave it away.** Every particle is suppressed there, so
a trail effect cannot possibly change it — and it had changed by 2.6 points.
Whatever was brightening the frame was not the trails.

### 5.2 Textures must be released before rendering into their target

```ts
this.matComposite.uniforms.tScene.value = null;
this.matComposite.uniforms.tDepth.value = null;
renderer.setRenderTarget(this.sceneTarget);
```

They are still bound from last frame's composite pass, and a target that is
simultaneously a bound texture and the framebuffer is a feedback loop — WebGL
rejects the draw outright.

---

## 6. PostFX options actually in use

From `SceneCanvas.tsx`:

```ts
{
  bloom:          true,
  bloomStrength:  POSTFX.bloom.strengthByPhase.dormant,   // 0.30 — starting value only
  bloomThreshold: 0.62,
  bloomRadius:    0.42,
  maxMips:        3,
  trails:         true,
  trailDecay:     0.88,
  trailStrength:  0.35,
  defocus:        0,          // DEPTH OF FIELD OFF
  exposure:       1.0,
  vignette:       POSTFX.vignette.strength,   // 0.34
  grain:          POSTFX.grain.amount,
  aberration:     0.0008,
}
```

`bloomStrength` is only the **starting** value. From the first frame the scene
drives it through `SceneHandle.bloomStrength()` — see [`Lighting.md`](Lighting.md)
§5.

---

## 7. Runtime knobs

Separate from the DEV-only `window.__post` hooks, because a production feature
reaching for a debug hook is a production feature that disappears in production.

```ts
setFade(v)               // intro reveal, 0 → 1
setBloomStrength(v)      // per-frame, from the scene's phase curve
getAberration / setAberration
getGrain / setGrain
getTrails / setTrails    // rebuilds targets; also clears the accumulator
getBloomMips / setBloomMips   // rebuilds the mip chain
clearTrails()            // on ticker.seek
```

`setBloomMips` and `setTrails` both call `setSize()`, which disposes and
reallocates. Costly enough that the governor's hysteresis matters — doing it
every other window would itself be the performance problem.

---

## 8. DEV hooks

Available only under `import.meta.env.DEV`:

| Hook | Purpose |
|---|---|
| `__claradixSeek(t)` | Jump the scene clock |
| `__ticker` | The ticker instance |
| `__sceneTime` | Current scene time (published by BridgeScene's update) |
| `__fade` | Intro fade progress — **the correct thing for a harness to wait on** |
| `__scene.{terrain,particles,sky,mist,groundGlow,loop}(bool)` | Element isolation |
| `__post.{bloom,grain,vignette,exposure,defocus,bloomRadius,bloomThreshold,bloomMips}` | Post knobs |
| `__pointScale(v)` | Particle size multiplier |
| `__rim(v)` | Terrain rim strength |
| `__particleShader()` | The generated vertex shader source |
| `__particleUniforms()` | Live uniform values |
| `__particleGeom()` | Attribute item sizes, counts, first values, finiteness |
| `__particleState()` | Scene membership, visibility, blending, depth, draw range |
| `__renderInfo` | `renderer.info.render` (of the LAST pass — the composite) |
| `__cursorStrength`, `__dolly`, `__disperse` | Interaction fields |
| `__perf` | Governor state |
| `__perfStress(frameMs, windows, phase)` | Drive the governor with synthetic frame times |

### Waiting correctly

Three signals exist and **only the last is correct**:

| Signal | What it means |
|---|---|
| `__claradixSeek` exists | the TICKER started. Published long before the scene mounts, so seeking against it is a silent no-op and every capture measures T+0. |
| `__sceneTime` exists | the scene rendered ONE frame. Still wrong: the intro fade needs 1.4 s of accumulated delta, and every frame before it completes is a dimmed composite — peak 0.83 instead of 0.99, accent 0.08% instead of 5.9%. |
| `__fade === 1` | the scene is actually showing what it renders. |

A fixed three-second wait happened to clear all three on the development machine,
most of the time. That is not a check, it is a coincidence with a timeout.

---

## 9. Context loss

```ts
private handleContextLost = (event: Event) => {
  event.preventDefault();
  this.container.dataset.contextLost = "true";
  this.dispose();
};
```

**Not recovered from.** Losing the context is recoverable in principle, but a
coming-soon page does not justify the restore machinery. The container attribute
reveals the CSS gradient fallback.

---

## 10. Harnesses must capture `console`

three.js reports a shader link failure through **`console.error`** and then draws
nothing. A harness listening only for `pageerror` sees a clean run and a very
dark, very well-behaved frame — which is exactly what the colour rule rewards.

`palette-check.mjs` reported a full set of plausible, internally consistent,
completely wrong numbers for a scene whose entire bridge was not being rendered,
and reported it as a **pass** on five of seven captures.

`hygiene-check.mjs` now fails any script that opens a page without a `console`
listener.
