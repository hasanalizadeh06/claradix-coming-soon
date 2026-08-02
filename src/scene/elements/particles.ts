/**
 * THE PARTICLES.
 *
 * One system, one geometry, one material, ONE DRAW CALL. Every particle is
 * identical except for the values in its attribute record, and every record is
 * written once at init and never touched again.
 *
 * THE ARCHITECTURAL DECISION
 * --------------------------
 * A particle's position at time `t` is a PURE FUNCTION of its attributes and
 * `t`. Nothing is integrated; there is no previous frame.
 *
 * The instinct of anyone who has written a particle system before is
 * `pos += vel * dt`. That breaks four things at once:
 *
 *   determinism             float accumulation differs per device, so the
 *                           reference frame can never be diffed
 *   frame-rate independence a 30fps and a 144fps device diverge
 *   scrubbing               seek(10.5) becomes impossible; you must simulate
 *   Law 5                   forces accumulate, so a determined viewer can always
 *                           push a particle somewhere it should not be
 *
 * The scrubbing loss is the worst: without seek() there is no capture tooling,
 * and without capture tooling nothing about this scene can be verified.
 *
 * The cost is that interaction cannot be a force — it has to be a displacement
 * applied ON TOP of the computed position. Which turns out to be the feature
 * that makes Law 5 enforceable, because clamping an offset clamps the
 * deformation absolutely.
 */

import * as THREE from "three";
import {
  ASSEMBLY,
  BRIDGE,
  CAMERA,
  FLIGHT,
  INTERACTION,
  LAYERS,
  LOOP,
  ORB,
  PALETTE,
  PARTICLE_COLOR_RAMP,
  PARTICLES,
  REWIND_START,
  SCENE,
  SEED,
  TARGET,
  TIMELINE,
  WORLD,
  type Layer,
} from "@/lib/config";
import { hashIndex, makeRng } from "@/lib/rng";
import { CENTRELINE_GLSL, centreline } from "../centreline";
import type { TargetCloud } from "../bridgeTargets";
import type { TerrainHandle } from "./terrain";

export interface ParticleHandle {
  points: THREE.Points;
  material: THREE.ShaderMaterial;
  count: number;
  dispose(): void;
}

const _v = new THREE.Vector3();

/**
 * The camera layer the trail pass renders in isolation.
 *
 * Layer 0 is everything; this is the particles as well. Anything else that
 * should streak would enable the same layer, and anything that should not simply
 * never mentions it.
 */
export const TRAIL_LAYER = 1;

// ---------------------------------------------------------------------------
// Colour ramp
// ---------------------------------------------------------------------------

/**
 * Colour is sampled by BRIGHTNESS, so a hot particle is naturally whiter and a
 * cold one deeper green without anyone authoring a per-state colour. Temperature
 * reads as energy for free, and dense regions sum past 1.0 under additive
 * blending and clamp toward lime-core — which is why tower legs have white-hot
 * cores that nobody painted.
 */
function buildRampTexture(): THREE.DataTexture {
  const N = 256;
  const data = new Uint8Array(N * 4);
  const stops = PARTICLE_COLOR_RAMP.map(([t, hex]) => ({
    t: t as number,
    c: new THREE.Color(hex as string),
  }));

  const tmp = new THREE.Color();
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1);
    let a = stops[0];
    let b = stops[stops.length - 1];
    for (let s = 0; s < stops.length - 1; s++) {
      if (t >= stops[s].t && t <= stops[s + 1].t) {
        a = stops[s];
        b = stops[s + 1];
        break;
      }
    }
    tmp.copy(a.c).lerp(b.c, b.t > a.t ? (t - a.t) / (b.t - a.t) : 0);
    data[i * 4] = Math.round(tmp.r * 255);
    data[i * 4 + 1] = Math.round(tmp.g * 255);
    data[i * 4 + 2] = Math.round(tmp.b * 255);
    data[i * 4 + 3] = 255;
  }

  const tex = new THREE.DataTexture(data, N, 1, THREE.RGBAFormat);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

// ---------------------------------------------------------------------------
// The orb's path, baked
// ---------------------------------------------------------------------------

/** Where the baked rows start and end, in scene seconds. */
export const ORB_PATH = {
  t0A: ORB.tourStart,
  buildStart: ASSEMBLY.windowStart,
  t1A: ASSEMBLY.windowStart + ASSEMBLY.windowSpan + 0.3,
  t0B: REWIND_START,
  t1B: ORB.boom.at,
} as const;

const PATH_SAMPLES = 256;

/**
 * The construction leg: the orb hovering just above the point of the span it
 * is currently building, corkscrewing gently as it works. uFront runs 1 → 0
 * across ASSEMBLY.windowSpan — the same linear sweep `seatAtFor` encodes, so
 * the comet is always exactly over the seats being filled.
 */
function buildLegPoint(t: number, out: THREE.Vector3): THREE.Vector3 {
  const k = THREE.MathUtils.clamp(
    (t - ORB_PATH.buildStart) / ASSEMBLY.windowSpan,
    0,
    1,
  );
  const u = 1 - k;
  centreline.positionAt(u, out);
  const fr = centreline.frameAt(u);
  const side = fr.binormal.z >= 0 ? 1 : -1;
  const phase = k * ORB.build.helixTurns * Math.PI * 2;
  out.y += ORB.build.heightAbove + Math.sin(phase) * ORB.build.helixRadius;
  out.addScaledVector(
    fr.binormal,
    side * (ORB.build.lateral + Math.cos(phase) * ORB.build.helixRadius),
  );
  return out;
}

/**
 * The orb's entire itinerary as a 256×2 float texture the vertex shader
 * samples by time — the same trick the centreline frames use.
 *
 *   row 0   the gathering tour (top-left → behind the text → across the
 *           valley → behind the mountains) flowing seamlessly into the
 *           construction sweep along the span
 *   row 1   Act IV's black hole: the slow feeding climb that ends at the
 *           detonation point
 *
 * The tour's spiral is baked here — helix around the path tangent plus an
 * independent vertical bob — so the shader stays a pure lookup. The helix
 * radius eases to zero into the build leg's own corkscrew, and the tour's
 * last control point is REPLACED by the build leg's first position, so the
 * seam between the two legs is exact.
 */
function buildOrbPathTexture(terrain: TerrainHandle): THREE.DataTexture {
  const data = new Float32Array(PATH_SAMPLES * 2 * 4);
  const up = new THREE.Vector3(0, 1, 0);
  const p = new THREE.Vector3();
  const tan = new THREE.Vector3();
  const e1 = new THREE.Vector3();
  const e2 = new THREE.Vector3();

  // --- row 0: tour + build sweep -----------------------------------------
  const tourPoints = ORB.tour.map(
    (q) => new THREE.Vector3(q[0], q[1], q[2]),
  );
  tourPoints[tourPoints.length - 1] = buildLegPoint(
    ORB_PATH.buildStart,
    new THREE.Vector3(),
  );
  const tour = new THREE.CatmullRomCurve3(
    tourPoints,
    false,
    "centripetal",
    0.5,
  );

  const formation = tourPoints[0];

  for (let i = 0; i < PATH_SAMPLES; i++) {
    const t = THREE.MathUtils.lerp(
      ORB_PATH.t0A,
      ORB_PATH.t1A,
      i / (PATH_SAMPLES - 1),
    );

    if (t < ORB.tourDepart) {
      // THE LOITER. The orb hangs at the formation point and swirls while
      // the world's light streams into it. The swirl radius rises from zero
      // and returns to zero (sin envelope), so the accretion begins as a
      // point and hands over to the tour with no seam.
      const lp = THREE.MathUtils.clamp(
        (t - ORB_PATH.t0A) / (ORB.tourDepart - ORB_PATH.t0A),
        0,
        1,
      );
      const theta = lp * ORB.loiter.turns * Math.PI * 2;
      const radius = ORB.loiter.radius * Math.sin(lp * Math.PI);
      p.copy(formation);
      p.x += Math.cos(theta) * radius;
      p.y += Math.sin(theta) * radius * 0.7 + Math.sin(lp * Math.PI * 2) * 14;
      p.z += Math.sin(theta) * radius * 0.4;
    } else if (t < ORB_PATH.buildStart) {
      const pr =
        (t - ORB.tourDepart) / (ORB_PATH.buildStart - ORB.tourDepart);
      // Mildly eased: the orb leaves its formation gently and decelerates
      // into the far end of the span, but never stalls mid-tour.
      const pe = pr * pr * (3 - 2 * pr) * 0.7 + pr * 0.3;

      tour.getPointAt(pe, p);
      tour.getTangentAt(pe, tan).normalize();
      e1.crossVectors(tan, up);
      if (e1.lengthSq() < 1e-6) e1.set(1, 0, 0);
      e1.normalize();
      e2.crossVectors(e1, tan).normalize();

      const theta = pe * ORB.helix.turns * Math.PI * 2;
      const radius =
        THREE.MathUtils.lerp(ORB.helix.radius[0], ORB.helix.radius[1], pe) *
        (1 - THREE.MathUtils.smoothstep(pe, 0.88, 1)) *
        THREE.MathUtils.smoothstep(pe, 0, 0.1);
      p.addScaledVector(e1, Math.cos(theta) * radius)
        .addScaledVector(e2, Math.sin(theta) * radius);
      p.y += Math.sin(pe * Math.PI * 2.7) * ORB.helix.bob * (1 - pe * 0.6);

      // TERRAIN CLEARANCE. Authored waypoints cannot know what the noise
      // octaves put under every metre of the route, and a comet that clips
      // through a hillside kills the illusion instantly. Held 55u above the
      // ground everywhere EXCEPT the dive window — the stretch where the
      // orb deliberately plunges behind the right-hand ridge ("goes behind
      // the mountains") and the framing ridge occludes it for real.
      const clearance = terrain.heightAt(p.x, p.z) + 55;
      const dive =
        THREE.MathUtils.smoothstep(pe, 0.6, 0.7) *
        (1 - THREE.MathUtils.smoothstep(pe, 0.84, 0.94));
      if (p.y < clearance) {
        p.y = THREE.MathUtils.lerp(clearance, p.y, dive);
      }
    } else {
      buildLegPoint(t, p);
    }

    const o = i * 4;
    data[o] = p.x;
    data[o + 1] = p.y;
    data[o + 2] = p.z;
    data[o + 3] = 0;
  }

  // --- row 1: the black hole's feeding climb ------------------------------
  const orb2 = new THREE.CatmullRomCurve3(
    ORB.orb2Path.map((q) => new THREE.Vector3(q[0], q[1], q[2])),
    false,
    "centripetal",
    0.5,
  );

  for (let i = 0; i < PATH_SAMPLES; i++) {
    const pr = i / (PATH_SAMPLES - 1);
    orb2.getPointAt(pr, p);
    // A slow restless hover — the hole is alive while it feeds. Both terms
    // are zero at pr = 1, so the detonation point is exactly the authored one.
    p.y += Math.sin(pr * Math.PI * 2) * 14 * (1 - pr);
    p.x += Math.cos(pr * Math.PI * 3.1) * 9 * (1 - pr);

    const o = (PATH_SAMPLES + i) * 4;
    data[o] = p.x;
    data[o + 1] = p.y;
    data[o + 2] = p.z;
    data[o + 3] = 0;
  }

  const tex = new THREE.DataTexture(
    data,
    PATH_SAMPLES,
    2,
    THREE.RGBAFormat,
    THREE.FloatType,
  );
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}

// ---------------------------------------------------------------------------
// Schedule
// ---------------------------------------------------------------------------

/**
 * Two orderings at once: spatially FAR → NEAR, and within any cross-section
 * bottom-up in load-bearing order. You cannot hang a cable from a tower that
 * does not exist yet. Nothing forces the scene to obey that, but a viewer who
 * has ever seen construction feels the wrongness without being able to name it.
 *
 * The layer sequence at one point takes 580ms; the spatial sweep takes 5220ms.
 * That ~9:1 ratio is what makes the phase look like watching real construction
 * from a distance — a slow front advancing, with fast detail inside it.
 */
const seatAtFor = (u: number, layer: Layer, jitter: number) =>
  ASSEMBLY.windowStart +
  (1 - u) * ASSEMBLY.windowSpan +
  ASSEMBLY.layerOffset[layer] +
  jitter;

/**
 * When a particle LEAVES, if the loop is on.
 *
 * The exact inverse of `seatAtFor` in both of its orderings, and both inversions
 * carry meaning.
 *
 * SPATIALLY it runs `u` rather than `1 - u`, so the disassembly front travels
 * away from the camera while the build travelled toward it. The two fronts move
 * in opposite directions across the frame and are never mistaken for each other.
 *
 * STRUCTURALLY the layer offsets are their own table, top-down: railing leaves
 * first and piers leave last. You cannot remove a tower while a cable still
 * hangs from it, for exactly the reason you could not hang the cable before the
 * tower existed — the scene's structural honesty runs in both directions. It
 * also looks right: fine detail evaporates first and heavy foundations persist,
 * which is how structures actually decay and how demolition actually sequences.
 *
 * No jitter. Assembly jitter hides the seams in a front moving toward you;
 * moving away, the same jitter just reads as the front losing its edge.
 */
const rewindAtFor = (u: number, layer: Layer) =>
  REWIND_START + u * LOOP.rewind.spatialSpan + LOOP.rewind.layerOffset[layer];

// ---------------------------------------------------------------------------

export function createParticles(
  targets: TargetCloud,
  terrain: TerrainHandle,
): ParticleHandle {
  const n = targets.count;
  const rng = makeRng(TARGET.randomSeed ^ 0x5bf03635);

  const aSeed = new Float32Array(n * 3);
  const aTarget = new Float32Array(n * 3);
  const aSeedNormal = new Float32Array(n * 3);
  const aBreatheDir = new Float32Array(n * 3);
  /**
   * (u, rewindAt) per particle, in ONE attribute.
   *
   * Fourteen attribute slots is what this system gets. A fifteenth links a
   * program that fails validation — `Too many attributes` — and three.js then
   * skips the draw without throwing, so the bridge simply is not in the frame.
   * Packing keeps the count where it was.
   */
  const aUR = new Float32Array(n * 2);
  /** riseAt — when the particle leaves its seed for the orb. */
  const aLiftAt = new Float32Array(n);
  const aSeatAt = new Float32Array(n);
  /** Swirl phase inside the orb. */
  const aRollPhase = new Float32Array(n);
  /** Radial distance inside the orb — cbrt-distributed, so the ball has
   *  uniform volume density: a solid glowing sphere, not a hollow shell. */
  const aRollRadius = new Float32Array(n);
  /** Repurposed: the seed → orb flight duration. */
  const aRollTurns = new Float32Array(n);
  const aSizeVar = new Float32Array(n);
  const aHash = new Float32Array(n);

  /**
   * The frustum test for seed placement. Seeds cover the ENTIRE VISIBLE
   * WORLD — the client's direction is that the awakening reads as the whole
   * landscape releasing its light, mountains included, not as the valley
   * floor stirring. Built against the base camera with margin, so parallax
   * and aspect changes never expose an unseeded edge.
   */
  const seedCam = new THREE.PerspectiveCamera(CAMERA.fov, 1536 / 1024, 1, 4000);
  seedCam.position.set(...CAMERA.basePosition);
  seedCam.lookAt(new THREE.Vector3(...CAMERA.baseTarget));
  seedCam.updateMatrixWorld(true);
  seedCam.matrixWorldInverse.copy(seedCam.matrixWorld).invert();
  seedCam.updateProjectionMatrix();
  const camWorld = new THREE.Vector3(...CAMERA.basePosition);
  const probe = new THREE.Vector3();

  const seedVisible = (x: number, z: number): boolean => {
    probe.set(x, terrain.heightAt(x, z) + 3, z);
    if (probe.distanceTo(camWorld) < SEED.minCameraDistance) return false;
    probe.project(seedCam);
    return (
      Math.abs(probe.x) <= SEED.frustumMargin &&
      probe.y >= -1.35 &&
      probe.y <= 1.4 &&
      probe.z <= 1
    );
  };

  // `position` exists only so three knows the draw count. The real position is
  // computed in the vertex shader from the attributes below.
  const position = new Float32Array(n * 3);
  const normal = new THREE.Vector3();

  /**
   * A SHUFFLED reading order, so any prefix of the buffer is a uniform sample.
   *
   * Targets are generated layer by layer and section by section, so buffer order
   * is spatial order. That makes the cheapest possible performance lever —
   * `setDrawRange(0, k)`, which costs nothing and needs no rebuild — useless:
   * truncating an ordered buffer deletes a contiguous piece of bridge rather
   * than thinning the whole of it.
   *
   * Interleaved by a seeded Fisher-Yates, dropping the count instead removes
   * particles evenly from everywhere. The bridge gets sparser; it does not get
   * shorter. That is the difference between a device quietly running at reduced
   * density and one visibly missing its far span.
   *
   * Seeded, like everything else here, so the same device always builds the same
   * bridge and the capture harness compares like with like.
   */
  const order = new Uint32Array(n);
  for (let i = 0; i < n; i++) order[i] = i;
  for (let i = n - 1; i > 0; i--) {
    const j = rng.int(i + 1);
    const tmp = order[i];
    order[i] = order[j];
    order[j] = tmp;
  }

  for (let i = 0; i < n; i++) {
    const o = i * 3;
    const src = order[i];
    const so = src * 3;
    const tx = targets.position[so];
    const ty = targets.position[so + 1];
    const tz = targets.position[so + 2];
    const u = targets.u[src];
    const layer = LAYERS[targets.layer[src]] as Layer;

    aTarget[o] = tx;
    aTarget[o + 1] = ty;
    aTarget[o + 2] = tz;
    aUR[i * 2] = u;

    // --- seed: anywhere on the visible world --------------------------------
    //
    // Uniform over the world area, accepted when it lands inside the camera's
    // (margined) view on ground that can plausibly hold a resting mote. The
    // old scheme seeded each particle under its own bridge position, which
    // read as the valley floor stirring; the client's direction is that the
    // WHOLE landscape releases its light — every slope, the mountains, the
    // far reaches — and converges on one point.
    let sx = tx;
    let sz = tz;
    let placed = false;

    for (let attempt = 0; attempt < SEED.maxRerolls; attempt++) {
      const cx = rng.range(SEED.area.x[0], SEED.area.x[1]);
      const cz = rng.range(SEED.area.z[0], SEED.area.z[1]);
      if (!seedVisible(cx, cz)) continue;
      if (terrain.slopeAt(cx, cz) > SEED.maxSlopeDeg) continue;
      sx = cx;
      sz = cz;
      placed = true;
      break;
    }
    if (!placed) {
      // Vanishingly rare. Fall back to the bridge's own footprint, jittered.
      const d = rng.disc(120);
      sx = tx + d.x;
      sz = tz + d.y;
    }

    sx = THREE.MathUtils.clamp(sx, WORLD.bounds.minX + 8, WORLD.bounds.maxX - 8);
    sz = THREE.MathUtils.clamp(sz, WORLD.bounds.minZ + 8, WORLD.bounds.maxZ - 8);

    terrain.normalAt(sx, sz, normal);
    // Rest ON the surface: at 0 they z-fight and flicker, above ~1.5 they hover
    // and the "seeds lying in soil" reading is lost. The window is narrow
    // because both failure modes are close.
    const off = rng.range(SEED.surfaceOffset[0], SEED.surfaceOffset[1]);

    aSeed[o] = sx + normal.x * off;
    aSeed[o + 1] = terrain.heightAt(sx, sz) + normal.y * off;
    aSeed[o + 2] = sz + normal.z * off;

    // The RELEASE DIRECTION. A particle lifts perpendicular to the ground it was
    // lying on, not straight up. On a 30 degree hillside the hill appears to
    // exhale; the same particles rising vertically look like gravity was
    // switched off. One line, disproportionately responsible for Phase 1 feeling
    // physical.
    aSeedNormal[o] = normal.x;
    aSeedNormal[o + 1] = normal.y;
    aSeedNormal[o + 2] = normal.z;

    // --- schedule ----------------------------------------------------------
    //
    // rise → join the orb → ride it → be deposited when the comet passes u.
    //
    // The one hard constraint: a particle must be ABOARD before its deposit
    // begins. joinLatest enforces it, which naturally makes far-span (early-
    // seating) particles rise first — the same far-first causality the old
    // choreography had, arrived at from the deadline instead of a curve.
    const seat = seatAtFor(u, layer, rng.jitter(ASSEMBLY.jitter));

    let flightDur = rng.range(ORB.rise.flightDur[0], ORB.rise.flightDur[1]);
    const joinLatest = seat - ORB.depositDur - ORB.rise.boardingMargin;
    let join = ORB.rise.joinStart + Math.pow(rng.next(), 0.85) * ORB.rise.joinWindow;
    join = Math.min(join, joinLatest);

    let rise = join - flightDur;
    if (rise < ORB.rise.earliestRise) {
      rise = ORB.rise.earliestRise + rng.next() * 0.3;
      flightDur = Math.max(join - rise, 0.8);
    }

    aLiftAt[i] = rise;
    aRollTurns[i] = flightDur;
    aSeatAt[i] = seat;
    // Small temporal jitter on the departure. The build front needed jitter to
    // hide its seams; the RELEASE needs it to soften density spikes — the near
    // sections are the large-on-screen ones, and un-jittered they let go as
    // one white wall. ±0.35s against a 7.2s sweep keeps the front legible.
    aUR[i * 2 + 1] = rewindAtFor(u, layer) + (rng.next() - 0.5) * 0.7;

    // --- per-particle variation --------------------------------------------
    aRollPhase[i] = rng.next() * Math.PI * 2;
    // cbrt → uniform VOLUME density: the orb reads as a solid ball of light
    // with a naturally hot core, not a hollow shell.
    aRollRadius[i] = ORB.radius * Math.cbrt(rng.next());

    /**
     * STRUCTURAL NODE FLAG, packed into aSizeVar's integer part (+2.0).
     *
     * Act III's sparkles are reserved for the bridge's critical locations —
     * tower peaks, cable saddles and anchors, the mid-span crown, the
     * deck/tower joints. "Never sparkle everywhere. Sparkles should feel
     * earned." The attribute budget is at its hard limit of fourteen, so the
     * flag rides on aSizeVar (real range 0.85–1.15) and the shader unpacks
     * with one comparison. No extra rng calls here — the stream's determinism
     * is what every visual check keys on.
     */
    const towers = BRIDGE.towers;
    const uMidSpan = (towers.main.u + towers.far.u) / 2;
    let isNode = false;
    if (layer === "towers") {
      const tw =
        Math.abs(u - towers.main.u) < Math.abs(u - towers.far.u)
          ? towers.main
          : towers.far;
      isNode = ty > tw.baseY + tw.height * 0.9;
    } else if (layer === "mainCables") {
      isNode =
        Math.abs(u - towers.main.u) < 0.012 ||
        Math.abs(u - towers.far.u) < 0.012 ||
        Math.abs(u - uMidSpan) < 0.01;
    } else if (layer === "deck") {
      isNode =
        Math.abs(u - towers.main.u) < 0.008 ||
        Math.abs(u - towers.far.u) < 0.008 ||
        Math.abs(u - uMidSpan) < 0.006;
    }

    aSizeVar[i] =
      rng.range(FLIGHT.sizeVar.min, FLIGHT.sizeVar.max) + (isNode ? 2 : 0);
    aHash[i] = hashIndex(i, 0x9e37);

    // A FIXED RANDOM unit vector, doing double duty: the seated breathe
    // direction AND the particle's swirl plane inside the orb. Both jobs need
    // exactly the same thing — a direction with no collective structure.
    _v.set(rng.range(-1, 1), rng.range(-1, 1), rng.range(-1, 1)).normalize();
    aBreatheDir[o] = _v.x;
    aBreatheDir[o + 1] = _v.y;
    aBreatheDir[o + 2] = _v.z;
  }

  const geometry = new THREE.BufferGeometry();
  const set = (name: string, arr: Float32Array, size: number) =>
    geometry.setAttribute(name, new THREE.BufferAttribute(arr, size));

  set("position", position, 3);
  set("aSeed", aSeed, 3);
  set("aTarget", aTarget, 3);
  set("aSeedNormal", aSeedNormal, 3);
  set("aBreatheDir", aBreatheDir, 3);
  set("aUR", aUR, 2);
  set("aLiftAt", aLiftAt, 1);
  set("aSeatAt", aSeatAt, 1);
  set("aRollPhase", aRollPhase, 1);
  set("aRollRadius", aRollRadius, 1);
  set("aRollTurns", aRollTurns, 1);
  set("aSizeVar", aSizeVar, 1);
  set("aHash", aHash, 1);

  // `position` is a dummy, so three would compute a bounding sphere around the
  // origin and cull the entire system on the first frame.
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 100, -300), 2600);

  const material = new THREE.ShaderMaterial({
    vertexShader: buildVertexShader(),
    fragmentShader: FRAGMENT,
    uniforms: {
      uTime: { value: 0 },
      uFrameTex: { value: centreline.buildFrameTexture() },
      uOrbTex: { value: buildOrbPathTexture(terrain) },
      uRamp: { value: buildRampTexture() },
      uPointScale: { value: 1 },
      uCursor: { value: new THREE.Vector3(0, -9999, 0) },
      uCursorStrength: { value: 0 },
      uDisperse: { value: 0 },
      uLoop: { value: SCENE.loop ? 1 : 0 },
      uTrailPass: { value: 0 },
      uDisperseOrigin: { value: new THREE.Vector3() },
      uPulseU: { value: -1 },
    },
    transparent: true,
    // Additive. Overlapping particles SUM, which is where nearly all of the
    // scene's visual character comes from: tower legs read as solid bars of
    // light, cables as continuous lines, the river fringe as separate sparks —
    // all the same particle at the same brightness, in different amounts.
    blending: THREE.AdditiveBlending,
    // These two look contradictory and someone will "fix" them by disabling
    // both. They do different jobs:
    //   test  = can terrain hide me?         yes
    //   write = can I hide other particles?  no
    // Disabling depthTest draws the bridge over the mountain in front of it;
    // enabling depthWrite makes particles occlude each other and destroys the
    // additive accumulation the entire scene relies on.
    depthTest: true,
    depthWrite: false,
  });

  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;

  /**
   * Visible to the ordinary camera AND to the trail pass.
   *
   * The trail pass renders the same scene graph with the camera restricted to
   * this layer, so it draws the particles and nothing else — one graph, one set
   * of matrices, no second scene to drift out of step with the first.
   */
  points.layers.enable(TRAIL_LAYER);

  /**
   * Which pass is this?
   *
   * The same material serves both, so the uniform cannot simply be set once. The
   * camera's layer mask is the honest signal: the trail pass switches to the
   * trail layer alone, so layer 0 being disabled means this is it. Inferring it
   * from the render target instead would couple this file to PostFX's internals.
   */
  points.onBeforeRender = (_renderer, _scene, camera) => {
    material.uniforms.uTrailPass.value = camera.layers.isEnabled(0) ? 0 : 1;
  };
  points.renderOrder = 5;

  return {
    points,
    material,
    count: n,
    dispose() {
      geometry.dispose();
      (material.uniforms.uFrameTex.value as THREE.DataTexture).dispose();
      (material.uniforms.uOrbTex.value as THREE.DataTexture).dispose();
      (material.uniforms.uRamp.value as THREE.DataTexture).dispose();
      material.dispose();
    },
  };
}

// ---------------------------------------------------------------------------
// Shaders
// ---------------------------------------------------------------------------

const f = (x: number) => x.toFixed(4);

/**
 * Built rather than written, so every constant comes from config.ts. Two
 * hand-maintained copies of the same number drift apart the first time somebody
 * edits one, and the symptom — light that no longer sits on the structure — is
 * very hard to trace.
 */
function buildVertexShader(): string {
  return /* glsl */ `
precision highp float;

${CENTRELINE_GLSL}

attribute vec3  aSeed;
attribute vec3  aTarget;
attribute vec3  aSeedNormal;
attribute vec3  aBreatheDir;
attribute float aLiftAt;
attribute float aSeatAt;

/**
 * TWO schedule values PACKED INTO ONE ATTRIBUTE: (u, rewindAt).
 *
 * Not a micro-optimisation — a hard limit. This system already binds fourteen
 * vertex attributes, and adding a fifteenth for the rewind time linked a program
 * that failed validation with "Too many attributes (aHash)". THREE then skipped
 * the draw silently and the entire bridge vanished from every frame.
 *
 * It took a long time to find because the message goes to console.error and
 * every capture script was listening only for pageerror. Attributes, uniforms,
 * generated shader source, bounding sphere, scene membership, blending and draw
 * range all inspected clean, because they WERE clean. The program was never
 * running. Every one of those checks is now cheap to repeat and none of them
 * would have found it; capturing the console would have, in one line.
 */
attribute vec2 aUR;
attribute float aRollPhase;
attribute float aRollRadius;
attribute float aRollTurns;
attribute float aSizeVar;
attribute float aHash;

uniform float uTime;
uniform float uPointScale;
uniform vec3  uCursor;
uniform float uCursorStrength;
uniform float uDisperse;
uniform float uLoop;
uniform float uTrailPass;
uniform vec3  uDisperseOrigin;
uniform float uPulseU;
uniform sampler2D uOrbTex;

varying float vBrightness;
varying float vFog;

const float TAU = 6.28318530718;
const float PI  = 3.14159265359;

float easeInOutCubic(float t){
  return t < 0.5 ? 4.0*t*t*t : 1.0 - pow(-2.0*t + 2.0, 3.0) * 0.5;
}

const float ORB_SAMPLES = ${PATH_SAMPLES}.0;

/** Row 0 of the baked itinerary: the gathering tour + the build sweep. */
vec3 orbPathA(float tt){
  float s = clamp((tt - ${f(ORB_PATH.t0A)}) / ${f(ORB_PATH.t1A - ORB_PATH.t0A)}, 0.0, 1.0);
  float x = s * (ORB_SAMPLES - 1.0) / ORB_SAMPLES + 0.5 / ORB_SAMPLES;
  return texture2D(uOrbTex, vec2(x, 0.25)).xyz;
}

/** Row 1: the black hole's feeding climb, ending at the detonation point. */
vec3 orbPathB(float tt){
  float s = clamp((tt - ${f(ORB_PATH.t0B)}) / ${f(ORB_PATH.t1B - ORB_PATH.t0B)}, 0.0, 1.0);
  float x = s * (ORB_SAMPLES - 1.0) / ORB_SAMPLES + 0.5 / ORB_SAMPLES;
  return texture2D(uOrbTex, vec2(x, 0.75)).xyz;
}

/**
 * A particle's place INSIDE the orb: a fixed radial distance (cbrt-baked, so
 * the ball is volume-uniform with a hot core) circling in a fixed random
 * plane. The whole sphere seethes without any collective structure.
 */
vec3 swirlOffset(float tt){
  vec3 axis = normalize(aBreatheDir);
  vec3 e1 = cross(axis, vec3(0.3183, 0.7568, -0.5714));
  float l = length(e1);
  e1 = l > 1e-4 ? e1 / l : vec3(1.0, 0.0, 0.0);
  vec3 e2 = cross(axis, e1);
  float th = aRollPhase + tt * TAU * ${f(ORB.spin)} * (0.7 + 0.6 * fract(aHash * 5.31));
  return (e1 * cos(th) + e2 * sin(th)) * aRollRadius;
}

void main(){
  // Unpacked from the one attribute that carries both. Named locals so every
  // reference below reads as though these were still separate attributes —
  // the packing is a binding-slot constraint, not a fact about the schedule.
  float aU        = aUR.x;
  float aRewindAt = aUR.y;

  // aSizeVar carries the structural-node flag in its integer part (+2.0) —
  // the fourteen-attribute limit is hard, so Act III's sparkle eligibility
  // rides on an attribute whose real range is 0.85–1.15.
  bool  isNode  = aSizeVar > 1.5;
  float sizeVar = isNode ? aSizeVar - 2.0 : aSizeVar;

  // Already wrapped to one cycle by the scene. Wrapping it here as well would
  // work and would also mean two places that have to agree about how long a
  // cycle is — while the swarm lights, the bloom curve and the ground glow all
  // read the same clock and would still be reading the unwrapped one.
  float t = uTime;

  // --- STATE, derived rather than stored --------------------------------
  //
  // A handful of comparisons, zero memory, and — critically — computed in the
  // SAME shader invocation that computes the position. That removes any
  // possibility of a one-frame lag between a particle seating and its trail
  // stopping.
  float riseAt    = aLiftAt;
  float flightDur = max(aRollTurns, 0.0001);
  float joinT     = riseAt + flightDur;

  // Act IV: when the burst throws this particle home, and for how long. The
  // duration follows the seed's distance from the detonation point, so the
  // explosion front expands at one physical speed across the whole world.
  vec3  boomPos = vec3(${ORB.orb2Path[ORB.orb2Path.length - 1].map((v) => f(v)).join(", ")});
  float landDur = clamp(distance(boomPos, aSeed) / ${f(ORB.boom.speed)},
                        ${f(ORB.boom.minDur)}, ${f(ORB.boom.maxDur)})
                * (1.0 + 0.15 * fract(aHash * 9.7));
  float landT = ${f(ORB.boom.at)} + landDur;

  // uLoop is a UNIFORM, not a compile-time branch — the rewind must stay
  // exercisable with the loop switched off, or it is broken the day someone
  // turns it on.
  bool isDeparting = uLoop > 0.5 && t >= aRewindAt && t < landT;
  bool hasLanded   = uLoop > 0.5 && t >= landT;

  bool isDormant     = t < riseAt || hasLanded;
  bool isSeated      = t >= aSeatAt && !isDeparting && !hasLanded;
  bool isRising      = !isDormant && !isSeated && !isDeparting && t < joinT;
  bool isApproaching = !isDormant && !isSeated && !isDeparting && !isRising
                     && t >= aSeatAt - ${f(ORB.depositDur)};

  vec3  pos;
  float brightness;
  float sizeBoost = 1.0;

  if (isDormant) {
    // Position is COMPLETELY static. Moving dormant particles would make the
    // ground look already active, which pre-empts the awakening. They are
    // asleep, and asleep things do not drift. The shimmer is brightness only.
    pos = aSeed;
    float rate = aHash < ${f(PARTICLES.dormantShimmer.doubleRateFraction)} ? 2.0 : 1.0;
    brightness = ${f(PARTICLES.brightness.dormant)}
      + sin(t * TAU * ${f(PARTICLES.dormantShimmer.frequencyHz)} * rate + aHash * TAU)
        * ${f(PARTICLES.dormantShimmer.amplitude)};

  } else if (isDeparting) {
    // --- ACT IV: THE BLACK HOLE AND THE BURST ----------------------------
    //
    // The bridge is DRUNK IN: each particle tears out of the structure and
    // accelerates into the hovering orb — a fall into gravity, not a glide.
    // The hole climbs as it feeds. Then, at one instant, it detonates: every
    // particle thrown arcing across the sky, raining down over the entire
    // landscape onto the very seed it first rose from.
    float lag2 = ${f(ORB.lagMax)} * 0.6 * fract(aHash * 3.71);
    float effLag2 = lag2 * smoothstep(aRewindAt + ${f(ORB.suction.duration)},
                                      aRewindAt + ${f(ORB.suction.duration)} + 0.8, t);
    float swirlIn2 = 0.55 * smoothstep(aRewindAt,
                                       aRewindAt + ${f(ORB.suction.duration)} + 0.4, t);

    if (t < ${f(ORB.boom.at)}) {
      vec3 hole = orbPathB(t - effLag2) + swirlOffset(t) * swirlIn2;

      float ks = clamp((t - aRewindAt) / ${f(ORB.suction.duration)}, 0.0, 1.0);
      float es = ks * ks * (3.0 - 2.0 * ks);
      pos = mix(aTarget, hole, es);
      // The initial shove out of the structure, dying immediately — the
      // particle visibly comes OUT of the bridge before the pull takes it.
      pos += aSeedNormal * max(${f(LOOP.rewind.releaseSpeed)} * (t - aRewindAt), 0.0)
           * exp(-8.0 * ks);

      float flash = 1.0 - smoothstep(0.0, 0.08, ks);
      brightness = mix(mix(${f(PARTICLES.brightness.seated)}, 0.5, es), 1.0, flash);
      sizeBoost = mix(1.0, ${f(PARTICLES.snap.sizeMultiplier)}, flash);
    } else {
      // The detonation. Launched from the particle's own place in the hole,
      // arcing up and out, decelerating into the ground's embrace.
      vec3 start = orbPathB(${f(ORB.boom.at)} - lag2) + swirlOffset(${f(ORB.boom.at)}) * 0.55;
      float kb = clamp((t - ${f(ORB.boom.at)}) / landDur, 0.0, 1.0);
      float eb = 1.0 - pow(1.0 - kb, 3.0);

      vec3 ctrl = mix(start, aSeed, 0.42);
      ctrl.y += ${f(ORB.boom.arcLift)} * (0.45 + 0.55 * fract(aHash * 7.77));
      vec3 ab = mix(start, ctrl, eb);
      vec3 bc = mix(ctrl, aSeed, eb);
      pos = mix(ab, bc, eb);

      float flashB = 1.0 - smoothstep(0.0, 0.12, kb);
      brightness = mix(mix(0.62, ${f(PARTICLES.brightness.dormant)},
                           smoothstep(0.5, 0.95, kb)),
                       1.0, flashB);
      sizeBoost = mix(1.0, ${f(PARTICLES.snap.sizeMultiplier)} * 1.25, flashB);
    }

  } else if (isSeated) {
    pos = aTarget;
    float since = t - aSeatAt;

    // Idle breathing. Phase MUST be scattered — synchronised breathing makes the
    // whole bridge swell as one, which is a pulse, and the scene gets exactly one
    // of those. Fades in rather than snapping on.
    float fade = clamp(since / ${f(PARTICLES.breathe.fadeInMs / 1000)}, 0.0, 1.0);
    pos += aBreatheDir
         * sin(t * TAU * ${f(PARTICLES.breathe.frequencyHz)} + aHash * TAU)
         * ${f(PARTICLES.breathe.amplitude)} * fade;

    // The snap: one frame at peak, then a decay. Two or three frames and the
    // construction front develops a bright leading edge that reads as a scanning
    // beam sweeping the bridge into existence — a completely different, far more
    // generic idea.
    float decay = clamp(since / ${f(PARTICLES.snap.decayMs / 1000)}, 0.0, 1.0);
    brightness = mix(${f(PARTICLES.brightness.approaching)},
                     ${f(PARTICLES.brightness.seated)}, decay * decay);
    sizeBoost = mix(${f(PARTICLES.snap.sizeMultiplier)}, 1.0,
                    clamp(since / 0.03, 0.0, 1.0));

    // The completion pulse — one band travelling the bridge's length, far to
    // near, in the same direction the build ran. Fires once, ever.
    if (uPulseU >= 0.0) {
      float d = abs(aU - uPulseU) * ${f(centreline.arcLength)};
      brightness = mix(brightness, 1.0, 1.0 - smoothstep(0.0, 190.0, d));
    }

    // --- ACT III: SPARKLES AT STRUCTURAL NODES ---------------------------
    //
    // During the stillness, only the bridge's critical locations glint —
    // tower peaks, cable saddles and anchors, the mid-span crown, the
    // deck/tower joints. Eligibility is the node flag; WHICH nodes are lit
    // rotates slowly (the fract gate), and each glint is a short bloom-
    // crossing pulse. Never everywhere at once: at any instant roughly one
    // node in eight is glinting, which is what "earned" looks like.
    if (isNode) {
      float win = smoothstep(${f(TIMELINE.phase5_livingStart)} + 0.5,
                             ${f(TIMELINE.phase5_livingStart)} + 1.3, t)
                * (1.0 - smoothstep(${f(REWIND_START)} - 0.6,
                                    ${f(REWIND_START)}, t));
      float g = fract(aHash * 17.13 + t * 0.085);
      float gate = smoothstep(0.86, 0.9, g) * (1.0 - smoothstep(0.94, 0.98, g));
      float glint = pow(0.5 + 0.5 * sin(t * TAU * 1.7 + aHash * 41.0), 6.0);
      float sparkle = win * gate * glint;
      brightness += sparkle * 0.55;
      sizeBoost += sparkle * 0.9;
    }

  } else if (isRising) {
    // --- ACT I: THE RISE -------------------------------------------------
    //
    // From anywhere on the sleeping landscape, up off the ground it was
    // resting on, arcing toward the point where the orb WILL be at the
    // moment of joining. A quadratic bézier whose control point leans along
    // the seed's surface normal: the hillside visibly exhales its light
    // upward before the light bends away toward the gathering.
    vec3 joinPos = orbPathA(joinT);
    float k = clamp((t - riseAt) / flightDur, 0.0, 1.0);
    float e = easeInOutCubic(k);

    float arcH = mix(${f(ORB.rise.arcHeight[0])}, ${f(ORB.rise.arcHeight[1])},
                     fract(aHash * 3.17));
    vec3 ctrl = aSeed + aSeedNormal * arcH + (joinPos - aSeed) * 0.22;
    vec3 ab = mix(aSeed, ctrl, e);
    vec3 bc = mix(ctrl, joinPos, e);
    pos = mix(ab, bc, e);

    brightness = mix(${f(PARTICLES.brightness.dormant)},
                     ${f(PARTICLES.brightness.lifting)},
                     smoothstep(0.0, 0.3, e));
    brightness = mix(brightness, ${f(ORB.ridingBrightness)},
                     smoothstep(0.55, 1.0, e));

  } else {
    // --- RIDING THE ORB / THE DEPOSIT ------------------------------------
    //
    // The particle IS the orb now: its position is the comet's head, sampled
    // slightly in the past (the lag is the comet's tail — late riders trail
    // the head along every twist of the baked path), plus its own place in
    // the seething sphere. Both ease in from zero at the join so there is no
    // seam against the rise.
    //
    // When the comet passes this particle's stretch of the span, the deposit:
    // a short drop out of the sphere onto the structure.
    float lagR = ${f(ORB.lagMax)} * fract(aHash * 3.71);
    float effLag = lagR * smoothstep(joinT, joinT + 1.2, t);
    float swirlIn = smoothstep(joinT, joinT + 1.0, t);
    vec3 ride = orbPathA(t - effLag) + swirlOffset(t) * swirlIn;

    if (isApproaching) {
      float ap = clamp((t - (aSeatAt - ${f(ORB.depositDur)})) / ${f(ORB.depositDur)},
                       0.0, 1.0);
      pos = mix(ride, aTarget, smoothstep(0.0, 1.0, ap));
      brightness = mix(${f(ORB.ridingBrightness)},
                       ${f(PARTICLES.brightness.approaching)}, ap);
    } else {
      pos = ride;
      brightness = ${f(ORB.ridingBrightness)} * (0.8 + 0.4 * fract(aHash * 6.13));
    }
  }

  // --- INTERACTION -------------------------------------------------------
  //
  // An additive offset on top of the scheduled position, never a force. The two
  // terms never interact and the schedule always wins — which is what makes
  // Law 5 structural: clamping the offset clamps the deformation, absolutely.
  // 30u against a 468u main span is 6.4%, so the silhouette survives by
  // construction rather than by discipline.
  if (!isDormant && uCursorStrength > 0.001) {
    vec3 away = pos - uCursor;
    float d = length(away);
    if (d < ${f(INTERACTION.influenceRadius)} && d > 0.0001) {
      float s = 1.0 - smoothstep(${f(INTERACTION.innerRadius)},
                                 ${f(INTERACTION.influenceRadius)}, d);
      vec3 push = (away / d) * s * ${f(INTERACTION.maxDisplacement)} * uCursorStrength;

      // LAW 4 — THE CURSOR MAY DEFLECT A PARTICLE. IT MAY NOT STOP ONE.
      //
      // A plain radial push has a component along the direction of travel, so a
      // cursor held in front of an oncoming particle shoves it BACKWARDS down
      // its own path. The river visibly stalls under the pointer and then snaps
      // forward when it leaves: the cursor reads as an obstruction, and the
      // scene stops being something you are disturbing and becomes something you
      // are obstructing.
      //
      // Projecting the push onto the plane perpendicular to travel removes
      // exactly that component and nothing else. Progress along the path is then
      // untouchable by construction — the particle keeps its schedule to the
      // millisecond and steps SIDEWAYS around the cursor, which is what
      // avoidance actually looks like.
      //
      // The direction of travel is free here. Position is a pure function of
      // time, so every state already knows the curve it is riding: the guide
      // tangent in flight, the seed normal on the way up.
      if (isRising) {
        push -= aSeedNormal * dot(push, aSeedNormal);
      } else if (!isSeated) {
        vec3 travel = normalize(centrelineTan(aU));
        push -= travel * dot(push, travel);
      }
      // Seated particles are deliberately exempt. They are structure, not
      // traffic — there is no progress left to protect, and a bridge that
      // refuses to be pushed along its own axis feels like it is on rails.

      pos += push;
    }
  }

  // --- PUSH-IN DISPERSION --------------------------------------------------
  //
  // The one place Law 5 is relaxed. Everywhere else the silhouette is protected
  // by construction; here it is meant to come apart, because the gesture is
  // "get closer" and what you find when you get close to something made of
  // light is that it was never solid.
  //
  // Radial about the CENTRELINE, not random per particle. A random direction
  // makes the bridge fizz, which reads as noise; expanding outward along the
  // curve's own frame makes it bloom, which reads as the structure loosening.
  // Same frame texture the barrel roll uses, so the two are consistent.
  //
  // maxRadius scales it by proximity to the camera: what you have pushed into
  // scatters, what is still far away holds. The alternative — dispersing the
  // whole span at once — makes the gesture feel like a switch rather than like
  // reaching into something.
  if (uDisperse > 0.001 && !isDormant) {
    vec3 dir = centrelineNrm(aU) * cos(aRollPhase)
             + centrelineBin(aU) * sin(aRollPhase);
    float near = 1.0 - smoothstep(0.0, ${f(INTERACTION.proximityDispersion.maxRadius)},
                                  distance(pos, uDisperseOrigin));
    pos += dir * ${f(INTERACTION.proximityDispersion.maxDisplacement)}
         * uDisperse * near * (0.45 + 0.55 * sizeVar);
  }

  vec4 viewPos = viewMatrix * vec4(pos, 1.0);
  float viewDist = -viewPos.z;

  vBrightness = clamp(brightness, 0.0, 1.0);
  vFog = clamp((viewDist - ${f(WORLD.fogNear)}) /
               ${f(WORLD.fogFar - WORLD.fogNear)}, 0.0, 1.0);

  gl_Position = projectionMatrix * viewPos;

  // Brighter particles are larger, which reinforces the energy reading without
  // touching colour. Size is capped because fill rate is the scene's real limit
  // and size is a QUADRATIC lever on it.
  // THE TRAIL PASS.
  //
  // Only three states leave a streak: lifting, gliding, approaching. Dormant
  // particles have not moved, and seated ones are structure — a bridge that
  // smears is a bridge that looks out of focus, and it would smear for the
  // entire time anyone is actually reading the page.
  //
  // Suppressed by moving the vertex OUTSIDE THE CLIP VOLUME, not by setting the
  // point size to zero. Not all drivers clamp gl_PointSize below one — the first
  // version did exactly that and the dormant frame, in which every particle is
  // suppressed and nothing should have changed, still lost a point of near-black
  // and gained a measurable accent band. Clipping is defined behaviour
  // everywhere; a zero-size point is a request.
  //
  // The condition is the same set of state booleans the position came from, so
  // the two can never disagree about which state a particle is in.
  if (uTrailPass > 0.5 && (isDormant || isSeated || hasLanded)) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    gl_PointSize = 0.0;
    return;
  }

  gl_PointSize = clamp(
    mix(${f(PARTICLES.sizePx.min)}, ${f(PARTICLES.sizePx.max)}, vBrightness)
      * sizeVar * sizeBoost * uPointScale
      * (${f(PARTICLES.sizeAttenuation)} / max(viewDist, 1.0)),
    0.6, 14.0);
}
`;
}

const FRAGMENT = /* glsl */ `
precision highp float;

uniform sampler2D uRamp;

varying float vBrightness;
varying float vFog;

void main(){
  // Procedural round sprite, no texture. One fetch per particle per frame is
  // real bandwidth for a shape that is four lines of maths, and the procedural
  // version stays crisp at any gl_PointSize.
  float d = length(gl_PointCoord - vec2(0.5));
  float alpha = 1.0 - smoothstep(0.24, 0.5, d);

  // The discard matters. A point sprite is a square and the visible dot is a
  // circle; without this the transparent corners — about 36% of the quad — still
  // write to the framebuffer, on the scene's most fill-bound pass.
  if (alpha <= 0.001) discard;

  vec3 color = texture2D(uRamp, vec2(vBrightness, 0.5)).rgb;

  // ADDITIVE FOG.
  //
  // Standard fog blends toward the fog colour: mix(color, fogColor, f). Correct
  // for opaque surfaces and BACKWARDS for additive ones — blending toward a
  // non-black colour makes a dense distant region ADD fog colour and get
  // brighter, so the far end of the bridge glows more than the near end and the
  // entire depth read inverts.
  //
  // Additive geometry attenuates toward zero instead.
  color *= (1.0 - vFog);

  gl_FragColor = vec4(color * vBrightness, alpha);
}
`;

/** Re-exported so BridgeScene can label the layer indices it reads. */
export { LAYERS, BRIDGE, PALETTE };
