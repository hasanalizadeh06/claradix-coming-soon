# Camera

One `PerspectiveCamera`. It is placed once and held. **There is no camera
animation during the intro.**

---

## 1. The solve

```ts
CAMERA = {
  fov: 38,
  near: 1,
  far: 4000,
  basePosition: [-60, 40, 510],
  baseTarget:  [-150, 190, -600],
}
```

These were **solved by brute-force search against explicit framing constraints**,
not nudged by eye.

```ts
framing: {
  mainTowerTopY:    [0.28, 0.38],    // fraction of frame height, from top
  mainTowerCentreX: [0.55, 0.68],
  horizonY:         [0.60, 0.70],
}
```

Constraints used in the solve:

| | Constraint |
|---|---|
| F1 | main tower top between 28% and 38% down the frame |
| F2 | main tower centre between 55% and 68% across |
| F3 | both bridge ends **off frame** — near exits left, far exits right |
| F4 | horizon between 60% and 70% down |
| F5 | far tower visible and distinct from the main tower |

Achieved:

```
main tower top     x 57.6%   y 31.7%
main tower base              y 69.1%
far tower          x 86.5%
near end           x −125%   (off frame left)
far end            x 100.3%  (off frame right)
horizon                      y 69.6%
```

Two errors were made and corrected during the solve, and both are instructive:

1. **The exit constraint was inverted.** `Math.max(0, (fa.x - 1) - 0.02)` rewarded
   *not* exiting. Rewritten as `exitsRight(p) = p.d <= 0 ? 1 : max(0, 1 - p.x)`.
2. **F4 was omitted** from the first solve entirely, which cost a full measurement
   round.

### The bridge deliberately does not fit

Visible width at the look-at depth is ~805 units against a 1,040-unit span.
Pulling back far enough to contain it drops the tower below its framing band and
makes the valley look small. **A bridge that fits in the frame is a model of a
bridge; a bridge that runs out of both sides is a place.**

---

## 2. The camera is at +Z

```
camera  (-60, 40, 510)
              │
              │  looking toward (-150, 190, -600)
              ▼
        ┌─────────────────────────────────┐
        │  u=0 ────────────► u=1          │  bridge, lower-left-near
        │  (-520,34,300)   (520,50,-880)  │  to upper-right-far
        └─────────────────────────────────┘
```

The camera sits **outside** `WORLD.bounds.maxZ` (400) at z=510, so the terrain
starts 110 units in front of it.

`binormal.z >= 0` is how `guidePoint` decides which side of the bridge is
"camera-side" — a direct consequence of this placement, and it would silently
invert if the camera were ever moved to −Z.

---

## 3. No intro animation, on purpose

> The particles are already travelling across the frame, and adding camera motion
> on top produces **two competing vectors** that stop the assembly being legible.

The camera is placed in the constructor and only ever drifts, parallaxes and
dollies from there.

---

## 4. Idle drift

```ts
idleDrift: { amplitudeX: 7, amplitudeY: 3.5, periodX: 23.0, periodY: 31.0 }
```

```ts
const w = frame.elapsed;
const drift = new THREE.Vector3(
  Math.sin((w / 23.0) * Math.PI * 2) * 7,
  Math.cos((w / 31.0) * Math.PI * 2) * 3.5,
  0,
);
```

**An absolute function of time, never an accumulator.** An accumulator drifts out
of frame over hours.

The periods are **coprime**, so the combined motion has a **713-second period**
and never lands in a recognisable loop. Someone leaving the tab open will not
catch it repeating.

Amplitude 7 × 3.5 units against a bridge 1,624 units long: about 0.4% of the
subject. It is felt, not seen.

---

## 5. Parallax

```ts
parallax: { offsetX: 22, offsetY: 11, yaw: 2.4, pitch: 1.2, lerp: 0.045 }
```

```ts
_tmp.copy(home).add(drift).add(new THREE.Vector3(
  pointer.x * 22, pointer.y * 11, 0,
));
camPos.lerp(_tmp, 0.045);

_tmp.copy(target).add(new THREE.Vector3(
  pointer.x * 22 * 0.45, pointer.y * 11 * 0.45, 0,
));
camAim.lerp(_tmp, 0.045);
```

`lerp 0.045` is roughly a **0.36 s time constant** at 60 fps. Deliberately almost
imperceptible: *it should be nearly impossible to notice you are controlling it,
and only obvious that the scene is not flat.*

### The rotation goes INTO the translation

The look-at target moves at **0.45×** the camera's own offset. Moving right
translates right *and* yaws slightly right, so the far side of the valley opens
up. **That is what a person does when they lean to see past something.**

⚠ `parallax.yaw` (2.4) and `parallax.pitch` (1.2) are declared and **read by
nothing.** The 0.45 factor is a literal in `BridgeScene.ts` — a magic number in
`src/`, which `config.ts`'s own header calls a bug.

---

## 6. Dolly

See [`Interaction.md`](Interaction.md) §5. Summary:

```ts
dolly: { enabled: true, travel: 340, lerp: 0.07,
         autoReturnAfter: 2.4, autoReturnRate: 0.35 }
```

Moves along the **view axis** (`normalize(target - home)`), applied to the rest
position before the parallax lerp so it inherits the same lag.

340 units of travel from a ~1,100-unit standoff — about 31% closer at full push.

---

## 7. Three FOVs, one winner

```
Stage constructor:   new PerspectiveCamera(cameraFov ?? 45, ...)
SceneCanvas passes:  cameraFov: 40
BridgeScene sets:    camera.fov = CAMERA.fov      // 38   ← this one wins
```

Same for near/far: `Stage` builds with `0.1 / 400`, `BridgeScene` overwrites with
`1 / 4000`.

**`400` would have clipped the entire far half of the scene** — the far abutment
is at z = −880 and the far framing ridge at −980, both well beyond a 400-unit far
plane from a camera at z = 510. It works only because `BridgeScene` overwrites it
immediately. That is a latent trap: any scene factory that does not set its own
near/far inherits a frustum that cannot contain this world.

The composite's `uNear`/`uFar` are refreshed from the live camera every frame, so
the depth linearisation stays correct regardless.

---

## 8. Portrait — declared, not implemented

```ts
portrait: {
  fov: 46,
  basePosition: [30, 118, 430],
  baseTarget:  [20, 82, -300],
}
```

> *"Portrait re-composes rather than crops — a crop loses the sweep entirely."*

**Nothing reads any of it.** There is no aspect-ratio branch anywhere in
`BridgeScene` or `Stage`. On a phone in portrait the scene renders the landscape
composition into a tall frame, which means the bridge — solved to run off *both*
sides of a 1.5:1 frame — is even further off both sides of a 0.46:1 one.

This is the single largest unimplemented item in the config.

```ts
orientationParallax: { enabled: "onPermission", maxTiltDeg: 22, lerp: 0.035 }
```

Also unread. No `deviceorientation` listener exists.

---

## 9. Resize

```ts
handleResize() {
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(...);
  post.setSize(width * pixelRatio, height * pixelRatio);
  handle.resize(width, height);
}
```

Driven by a `ResizeObserver` on the container.

`BridgeScene.resize` forwards to `sky.setSize()` (star size is in pixels, so the
shader needs the real viewport) and recomputes `uPointScale`:

```ts
uPointScale = clamp(height / 900, 0.55, 1.5)
```

**FOV does not change with aspect ratio.** Three.js `PerspectiveCamera.fov` is
vertical, so a narrow window keeps the same vertical extent and loses horizontal
extent. On a portrait phone this is exactly the wrong behaviour for a composition
built around a horizontal sweep — and it is what `CAMERA.portrait` exists to fix.

---

## 10. Measured viewport dependence

`npm run viewport`, at T+16:

```
  1152x768   82.0% near-black   6.3% accent
  1440x900   83.5%              4.7%
  1536x1024  83.5%              5.0%     ← the reference frame
  1920x1080  84.2%              3.8%
```

**Monotone with height: smaller frames come out brighter.** 2.2 points of
near-black across the range, against the rule's 3-point tolerance.

The mechanism is **not identified**. The obvious candidate — the one-fragment
rasterisation floor, where the dimmest particles keep an absolute footprint while
the frame shrinks around them — was tested by raising `PARTICLES.sizePx.min` from
1.1 to 1.6 and moved the spread by **nothing**. The remaining candidate is the
bloom chain: mip count is fixed, so the prefilter runs at a constant *fraction* of
the frame while the sprites inside it do not.

Bounded at 2.5 points by the check so a regression is caught even though the cause
is open. See decision log Q-06.
