/**
 * THE BRIDGE.
 *
 * "Claradix is the bridge between your idea and reality" — so the scene is not a
 * decorative backdrop that happens to sit behind that sentence. It is that
 * sentence rendered.
 *
 * A valley wakes up, throws its light into the air, and builds a bridge out of
 * it — starting at the far horizon and finishing at your feet — and then lets you
 * put your hand through it.
 *
 * This module is only the orchestrator. Terrain owns its heightfield, the target
 * cloud owns the bridge's geometry, the particle system owns the choreography;
 * they agree because they all read the same centreline and the same config.
 *
 * BUILD ORDER IS LOAD-BEARING
 * ---------------------------
 *   centreline  →  terrain  →  targets  →  seeds
 *
 * Terrain before targets, because piers are sampled down to the ground.
 * Targets before seeds, because a particle's seed is placed beneath its own
 * target's footprint — reversing that scatters flight durations from ~1.8s to
 * ~14s and the river stops reading as one current.
 */

import * as THREE from "three";
import type { Pointer, SceneContext, SceneHandle } from "@/gl/Stage";
import type { FrameInfo } from "@/lib/ticker";
import {
  A11Y,
  BRIDGE,
  CAMERA,
  LAYERS,
  COMPLETION_PULSE,
  CYCLE_LENGTH,
  INTERACTION,
  LIGHTING,
  PALETTE,
  PARTICLES,
  PERF,
  POSTFX,
  REWIND_START,
  RIVER,
  SCENE,
  TIMELINE,
  WORLD,
  type Tier,
} from "@/lib/config";
import { centreline } from "./centreline";
import { buildTargets } from "./bridgeTargets";
import { createGroundGlow } from "./elements/groundGlow";
import { createGroundStreams } from "./elements/groundStreams";
import { createMist } from "./elements/mist";
import { createSky } from "./elements/sky";
import { createTerrain } from "./elements/terrain";
import { createTerrainNetwork } from "./elements/terrainNetwork";
import { createTowerStructures } from "./elements/towerStructures";
import { TRAIL_LAYER, createParticles } from "./elements/particles";

const _tmp = new THREE.Vector3();
const _ray = new THREE.Vector3();
const _ndc = new THREE.Vector3();
const _dolly = new THREE.Vector3();
const _best = new THREE.Vector3();

/**
 * Swarm-light intensity for the current scene time.
 *
 * The valley is most visible during the JOURNEY and least visible once the
 * destination is reached — the light that was illuminating it lands and settles.
 * That fade is a choice, not a technical consequence: the scene's attention
 * narrows onto the bridge exactly as the bridge becomes worth attending to.
 */
function swarmIntensityAt(t: number): number {
  const k = LIGHTING.swarmLights.intensityByPhase;
  const T = TIMELINE;
  if (t < T.phase1_awakeningStart) return k.dormant;
  if (t < T.phase2_glideStart)
    return THREE.MathUtils.mapLinear(
      t, T.phase1_awakeningStart, T.phase2_glideStart, k.dormant, k.awakening);
  if (t < T.phase3_assemblyStart)
    return THREE.MathUtils.mapLinear(
      t, T.phase2_glideStart, T.phase3_assemblyStart, k.awakening, k.glide);
  // Assembly runs glide → assembly, NOT glide → completion. `k.assembly` was
  // declared and skipped, which quietly turned a five-point curve into a
  // four-point one and made the swarm fade through the whole assembly phase
  // instead of holding while there are still particles in the air to cast it.
  if (t < T.phase4_completionStart)
    return THREE.MathUtils.mapLinear(
      t, T.phase3_assemblyStart, T.phase4_completionStart, k.glide, k.assembly);
  if (t < T.phase5_livingStart)
    return THREE.MathUtils.mapLinear(
      t, T.phase4_completionStart, T.phase5_livingStart, k.assembly, k.completion);
  return THREE.MathUtils.mapLinear(
    THREE.MathUtils.clamp(t, T.phase5_livingStart, T.phase5_livingStart + 3.2),
    T.phase5_livingStart, T.phase5_livingStart + 3.2, k.completion, k.living);
}

/**
 * Bloom strength for the current scene time.
 *
 * The pack specifies seven values across the build and the scene used to pin
 * all seven to one of them. That is not a rounding error, it is the difference
 * between a scene that becomes made of light and a scene that always was: the
 * opening is supposed to be nearly unlit haze, and the completion is supposed
 * to be the brightest frame in the film.
 *
 * `assemblyEnd` is the value reached at the END of the assembly phase rather
 * than a phase of its own — assembly opens at the same strength glide closed
 * at, so the two run continuously, and then climbs as the deck fills in.
 *
 * The tail from `completion` back down to `living` is the exhale. Holding the
 * completion peak would make the finished bridge a light source rather than a
 * thing that has just finished being built, and nothing that stays at its
 * loudest ever reads as having arrived.
 */
function bloomStrengthAt(t: number): number {
  const k = POSTFX.bloom.strengthByPhase;
  const T = TIMELINE;
  const ramp = (a: number, b: number, from: number, to: number) =>
    THREE.MathUtils.mapLinear(THREE.MathUtils.clamp(t, a, b), a, b, from, to);

  if (t < T.phase1_awakeningStart) return k.dormant;
  if (t < T.phase2_glideStart)
    return ramp(T.phase1_awakeningStart, T.phase2_glideStart, k.dormant, k.awakening);
  if (t < T.phase3_assemblyStart)
    return ramp(T.phase2_glideStart, T.phase3_assemblyStart, k.awakening, k.glide);
  if (t < T.phase4_completionStart)
    return ramp(T.phase3_assemblyStart, T.phase4_completionStart, k.assembly, k.assemblyEnd);
  if (t < T.phase5_livingStart)
    return ramp(T.phase4_completionStart, T.phase5_livingStart, k.assemblyEnd, k.completion);
  return ramp(
    T.phase5_livingStart,
    T.phase5_livingStart + POSTFX.bloom.settleSeconds,
    k.completion,
    k.living,
  );
}

export function createBridgeScene(ctx: SceneContext): SceneHandle {
  const { scene, camera, capabilities } = ctx;

  // Conservative. `ultra` is never guessed — it has to be earned by measurement
  // or set explicitly for captures.
  const tier: Tier = capabilities.densityScale >= 0.9
    ? "high"
    : capabilities.densityScale >= 0.6
      ? "medium"
      : "low";

  const reduced =
    typeof matchMedia !== "undefined" &&
    matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Only a fallback. The sky quad covers every pixel, so this is what shows if
  // the sky ever fails to draw — the zenith colour, so the failure is a very
  // dark frame rather than a bright one.
  scene.background = new THREE.Color(PALETTE.void);
  // No THREE.Fog. Terrain and particles each apply fog in their own shaders,
  // because they need OPPOSITE operations: opaque surfaces mix toward the fog
  // colour, additive ones attenuate toward zero. Three's built-in fog only does
  // the first, which would make distant particles ADD fog colour and leave the
  // far end of the bridge glowing brighter than the near end.
  scene.fog = null;

  // --- the world ----------------------------------------------------------
  const sky = createSky();
  scene.add(sky.mesh);

  const terrain = createTerrain(tier);
  scene.add(terrain.mesh);

  /**
   * The terrain joins the TRAIL pass as a DEPTH-ONLY occluder.
   *
   * The trail accumulator renders just the moving-light layer, and its depth
   * buffer used to start empty — so a packet falling into a hollow BEHIND a
   * hill was hidden in the main pass but its streak still accumulated and
   * glowed through the ridge (client report: "it is in a blind spot, it must
   * not be visible"). With the terrain writing depth (and only depth — the
   * colour stays black or the accumulator would sum it 8× at the decay), the
   * trail pass occludes exactly like the scene does.
   */
  terrain.mesh.layers.enable(TRAIL_LAYER);
  const terrainMaterial = terrain.mesh.material as THREE.Material;
  terrain.mesh.onBeforeRender = (_renderer, _scene, cam) => {
    if (!cam.layers.isEnabled(0)) terrainMaterial.colorWrite = false;
  };
  terrain.mesh.onAfterRender = () => {
    terrainMaterial.colorWrite = true;
  };

  // BOTH after the terrain: each samples the heightfield it is going to lie on.
  const mist = createMist(terrain);
  scene.add(mist.mesh);

  const groundGlow = createGroundGlow(terrain);
  scene.add(groundGlow.mesh);

  const streams = createGroundStreams(terrain, tier);
  streams.setLoop(SCENE.loop);
  scene.add(streams.points);

  // The terrain's own luminous surface — energy lines, nodes and motes
  // marched across the heightfield (client, 2026-08-03 round 3). After the
  // terrain, whose baked field it samples and whose depth buffer hides its
  // lines behind ridges.
  const network = createTerrainNetwork(terrain, tier);
  scene.add(network.group);

  // --- the bridge, as a list of positions ---------------------------------
  const nominal = PARTICLES.countByTier[tier];
  const targets = buildTargets(nominal, terrain.heightAt);

  // --- the particles ------------------------------------------------------
  const particles = createParticles(targets, terrain);
  scene.add(particles.points);

  // --- the towers: the bridge's ONLY real geometry (2026-08-04 redesign) --
  // Opaque, depth-writing masts — the solid anchors the energy flows
  // between. After the terrain, whose heightfield their feet stand on.
  const towers = createTowerStructures(terrain);
  scene.add(towers.group);

  /**
   * The towers join the TRAIL pass as DEPTH-ONLY occluders, exactly like
   * the terrain (2026-08-04 correction: "the bridge must pass THROUGH the
   * towers"). Without this, the moving packets' accumulated streaks glow
   * straight through the mast legs — the roadway looked pasted IN FRONT
   * of the towers even though the main pass occluded it correctly.
   */
  towers.group.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) return;
    obj.layers.enable(TRAIL_LAYER);
    const mat = obj.material as THREE.Material;
    obj.onBeforeRender = (_renderer, _scene, cam) => {
      if (!cam.layers.isEnabled(0)) mat.colorWrite = false;
    };
    obj.onAfterRender = () => {
      mat.colorWrite = true;
    };
  });

  // --- camera -------------------------------------------------------------
  //
  // Placed once and held. There is NO camera animation during the intro: the
  // particles are already travelling across the frame, and adding camera motion
  // on top produces two competing vectors that stop the assembly being legible.
  const home = new THREE.Vector3(...CAMERA.basePosition);
  const target = new THREE.Vector3(...CAMERA.baseTarget);
  camera.fov = CAMERA.fov;
  camera.near = CAMERA.near;
  camera.far = CAMERA.far;
  camera.position.copy(home);
  camera.lookAt(target);
  camera.updateProjectionMatrix();

  const camPos = home.clone();
  const camAim = target.clone();

  // --- interaction state --------------------------------------------------
  const cursorWorld = new THREE.Vector3(0, -9999, 0);
  let cursorStrength = 0;
  const swarmPositions = Array.from({ length: 5 }, () => new THREE.Vector3());

  /**
   * Mutable so the rewind can be exercised even though it ships off.
   *
   * SCENE.loop is false by default and the reasoning is in config: a landing
   * page that repeatedly dismantles itself while a visitor is reading it is
   * hostile. But an animation that nothing can ever run is one that will be
   * broken the next time somebody turns it on, and the whole rewind is eight
   * seconds of choreography with its own inverted orderings.
   */
  let loopEnabled: boolean = SCENE.loop;

  /**
   * Dev-only element toggles.
   *
   * A colour-ratio failure names a band, not a cause. Every attempt so far to
   * reason about WHICH element was over-contributing picked the wrong one — the
   * depth-of-field blur, then bloom, then particle brightness, none of which
   * were it. Being able to hide one element and re-measure answers the question
   * in one run instead of one rebuild per guess.
   */
  if (import.meta.env.DEV && typeof window !== "undefined") {
    (window as unknown as {
      __scene?: Record<string, (on: boolean) => void>;
    }).__scene = {
      terrain: (on) => {
        terrain.mesh.visible = on;
      },
      particles: (on) => {
        particles.points.visible = on;
      },
      sky: (on) => {
        sky.mesh.visible = on;
      },
      mist: (on) => {
        mist.mesh.visible = on;
      },
      groundGlow: (on) => {
        groundGlow.mesh.visible = on;
      },
      streams: (on) => {
        streams.points.visible = on;
      },
      network: (on) => {
        network.group.visible = on;
      },
      towers: (on) => {
        towers.group.visible = on;
      },
      /**
       * The capture harness needs this: under SwiftShader the trail buffer's
       * 26 frames span SECONDS of scene time, and every moving light smears
       * into a tube that does not exist at 60fps. Judging particle SHAPE
       * from a headless screenshot requires the trails off.
       */
      trails: (on) => {
        const method = on ? "enable" : "disable";
        particles.points.layers[method](TRAIL_LAYER);
        streams.points.layers[method](TRAIL_LAYER);
      },
      loop: (on) => {
        loopEnabled = on;
        particles.material.uniforms.uLoop.value = on ? 1 : 0;
        groundGlow.setLoop(on);
        streams.setLoop(on);
      },
    };
    (window as unknown as { __rim?: (v: number) => void }).__rim = (v) =>
      terrain.setRim(v);
    // Heightfield probe — answers "is the mountain there or is it only
    // invisible" without a rebuild, which is the terrain analogue of
    // __targets for the bridge.
    (window as unknown as {
      __terrainAt?: (x: number, z: number) => { h: number; prom: number };
    }).__terrainAt = (x, z) => ({
      h: Math.round(terrain.heightAt(x, z)),
      prom: Math.round(terrain.prominenceAt(x, z) * 10) / 10,
    });
    // The vertex shader is assembled from config at runtime, so when the
    // particles stop appearing the generated source is the only place the
    // answer can be. Reading the TypeScript that produced it is not the same
    // thing — the whole failure mode is that the two have diverged.
    (window as unknown as { __particleShader?: () => string }).__particleShader =
      () => particles.material.vertexShader;
    (window as unknown as { __particleUniforms?: () => unknown }).__particleUniforms =
      () => particles.material.uniforms;
    // Per-layer target statistics. When a structural element goes missing from
    // the frame, this answers "was it ever generated?" in one call — the
    // difference between a rendering problem and a generation problem.
    (window as unknown as { __targets?: () => unknown }).__targets = () => {
      const stats: Record<string, { n: number; minY: number; maxY: number }> = {};
      for (let i = 0; i < targets.count; i++) {
        const layer = LAYERS[targets.layer[i]];
        const y = targets.position[i * 3 + 1];
        const s = (stats[layer] ??= { n: 0, minY: Infinity, maxY: -Infinity });
        s.n += 1;
        if (y < s.minY) s.minY = Math.round(y);
        if (y > s.maxY) s.maxY = Math.round(y);
      }
      return stats;
    };
    (window as unknown as { __particleState?: () => unknown }).__particleState = () => ({
      inScene: particles.points.parent !== null,
      pointsVisible: particles.points.visible,
      matVisible: particles.material.visible,
      transparent: particles.material.transparent,
      blending: particles.material.blending,
      depthTest: particles.material.depthTest,
      depthWrite: particles.material.depthWrite,
      opacity: particles.material.opacity,
      renderOrder: particles.points.renderOrder,
      frustumCulled: particles.points.frustumCulled,
      drawRange: particles.points.geometry.drawRange,
    });
    (window as unknown as { __particleGeom?: () => unknown }).__particleGeom = () => {
      const g = particles.points.geometry;
      const out: Record<string, unknown> = { drawCount: g.attributes.position?.count };
      for (const [k, a] of Object.entries(g.attributes)) {
        const arr = (a as THREE.BufferAttribute).array as Float32Array;
        out[k] = {
          itemSize: (a as THREE.BufferAttribute).itemSize,
          count: (a as THREE.BufferAttribute).count,
          first: [...arr.slice(0, 3)].map((v) => +v.toFixed(2)),
          finite: Number.isFinite(arr[0]) && Number.isFinite(arr[arr.length - 1]),
        };
      }
      return out;
    };
    (window as unknown as { __pointScale?: (v: number) => void }).__pointScale = (
      v,
    ) => {
      particles.material.uniforms.uPointScale.value = v;
    };
  }

  if (reduced && A11Y.reducedMotion.skipIntro) {
    // The build either plays or it does not. A "faster version" is still
    // sweeping full-screen motion, and the setting means stop, not hurry.
    particles.material.uniforms.uTime.value = TIMELINE.phase5_livingStart + 4;
  }

  let sceneT = 0;

  /** Rungs of the degradation ladder this scene owns. */
  let swarmCount = PERF.swarmLightsByTier[tier];
  let particleFraction = 1;

  const setParticleFraction = (f: number) => {
    particleFraction = f;
    // Free, instant, and uniform — the attribute buffers are written in a
    // shuffled order precisely so that a prefix is a random sample rather than
    // a contiguous section of bridge. The span gets sparser, never shorter.
    particles.points.geometry.setDrawRange(
      0,
      Math.max(1, Math.floor(particles.count * f)),
    );
  };

  return {
    trailLayer: TRAIL_LAYER,
    bloomStrength: () => bloomStrengthAt(sceneT),

    degrade(step) {
      switch (step) {
        case "trailLength":
          // Nothing to give back yet: the trail accumulation buffer is not
          // built. Returning false is the honest answer — the governor then
          // takes the next rung instead of believing it has saved something.
          return false;
        case "swarmLights":
          if (swarmCount <= 1) return false;
          swarmCount = Math.max(1, swarmCount - 2);
          particles.points.visible = true;
          terrain.setSwarmCount(swarmCount);
          return true;
        case "terrainSegments":
          // The heightfield is baked at construction and everything else —
          // seeds, piers, mist density, the ground glow — is sampled from it.
          // Rebuilding it mid-scene would move the ground out from under the
          // bridge. Deliberately not actionable.
          return false;
        case "particleCount":
          if (particleFraction <= 0.4) return false;
          setParticleFraction(particleFraction - 0.2);
          return true;
        default:
          return false;
      }
    },

    restore(step) {
      switch (step) {
        case "swarmLights":
          if (swarmCount >= PERF.swarmLightsByTier[tier]) return false;
          swarmCount = Math.min(PERF.swarmLightsByTier[tier], swarmCount + 2);
          terrain.setSwarmCount(swarmCount);
          return true;
        case "particleCount":
          if (particleFraction >= 1) return false;
          setParticleFraction(Math.min(1, particleFraction + 0.2));
          return true;
        default:
          return false;
      }
    },

    update(frame: FrameInfo, pointer: Pointer) {
      // THE LOOP IS ONE MODULO.
      //
      // Because every position in this scene is a pure function of time rather
      // than something integrated frame by frame, repeating the film costs
      // exactly this. Nothing accumulates, nothing has to be reset, and there is
      // no state that could survive a cycle and make the second build differ
      // from the first.
      //
      // It is also why particles return to their ORIGINAL seed rather than to a
      // fresh random one. Land them somewhere new and the ground's density
      // pattern drifts a little each cycle; land them where they started and the
      // loop is exactly repeatable, forever, from one line.
      //
      // Wrapped HERE and nowhere else. The particle shader, the swarm lights,
      // the bloom curve and the ground glow all read this clock, and a wrap
      // applied inside any one of them is a wrap the other three do not get.
      const raw = reduced ? TIMELINE.phase5_livingStart + 4 : frame.sceneTime;
      const t = loopEnabled ? raw % CYCLE_LENGTH : raw;
      sceneT = t;
      particles.material.uniforms.uTime.value = t;

      // --- swarm lights ---------------------------------------------------
      //
      // Five point lights following particle-cluster centroids, binned by `u`.
      // Computed ANALYTICALLY from the guide curve rather than by iterating the
      // population: 140,000 reductions per frame costs ~4ms and is entirely
      // avoidable, because a bin's particles are known to lie along a known
      // section of a known curve.
      const count = PERF.swarmLightsByTier[tier];
      for (let i = 0; i < swarmPositions.length; i++) {
        const u = (i + 0.5) / Math.max(count, 1);
        centreline.guidePoint(
          u, RIVER.heightAbove, RIVER.lateralOffset, RIVER.taperStart,
          swarmPositions[i],
        );
      }
      terrain.setSwarm(swarmPositions, swarmIntensityAt(t));

      // --- the completion pulse -------------------------------------------
      //
      // ONE band of brightness travelling near → far — away from the camera
      // toward the mountains, the direction the round-5 build runs (client,
      // 2026-08-03: the white shimmer must leave the viewer, not arrive at
      // them) — RECURRING every ten seconds while the bridge stands
      // complete. A pure function of the clock, no fired-flags: seeking
      // lands on the exact frame, and in loop mode the pulse schedule wraps
      // with everything else. The stillness gate keeps it out of Act IV,
      // where a proud pulse on a dissolving bridge would be a lie.
      {
        const firstPulse =
          TIMELINE.phase4_completionStart + COMPLETION_PULSE.startDelay;
        let pulseU = -1;
        if (t >= firstPulse && (!loopEnabled || t < REWIND_START)) {
          const k =
            ((t - firstPulse) % COMPLETION_PULSE.repeatEvery) /
            COMPLETION_PULSE.duration;
          pulseU = k <= 1 ? k : -1;
        }
        particles.material.uniforms.uPulseU.value = pulseU;
      }

      // --- the cursor, resolved into the world ----------------------------
      //
      // A screen point has to become a world position somehow. A fixed depth
      // plane makes the same screen position behave differently along the
      // bridge; raycasting 140,000 particles is unaffordable and would flicker
      // as they breathe.
      //
      // The bridge is treated as a VERTICAL CURTAIN, not a wire (client,
      // 2026-08-01: hovering must scatter EVERY part — towers, cables,
      // pylons — not just the roadway). At each march step the candidate
      // point sits on the centreline in plan but takes the RAY'S own height,
      // clamped to the structure's vertical extent at that u: hover the
      // deck and the influence lands on the deck; hover a tower top or the
      // cable drape and it lands exactly there.
      _ndc.set(pointer.x, pointer.y, 0.5).unproject(camera);
      _ray.subVectors(_ndc, camera.position).normalize();

      let bestD = Infinity;
      for (let i = 0; i <= 40; i++) {
        _tmp.copy(camera.position).addScaledVector(_ray, 120 + i * 40);
        const u = centreline.nearestU(_tmp);
        centreline.positionAt(u, _ndc);

        let topY = _ndc.y + 12;
        const rise = centreline.cableRise(u);
        if (rise > 0) topY = Math.max(topY, rise);
        const { main, far } = BRIDGE.towers;
        if (Math.abs(u - main.u) < 0.022)
          topY = Math.max(topY, main.baseY + main.height * 1.05);
        if (Math.abs(u - far.u) < 0.022)
          topY = Math.max(topY, far.baseY + far.height * 1.05);

        _ndc.y = THREE.MathUtils.clamp(_tmp.y, _ndc.y - 130, topY);

        // The road directly underfoot is not a hover target: it lives at the
        // frame's extreme bottom edge, and its curtain passes near enough to
        // rays aimed at the frame corners that the field would never fully
        // release. The visible, hoverable structure starts past ~470u; the
        // exclusion only removes what nobody can meaningfully point at.
        if (_ndc.distanceTo(camera.position) < 420) continue;

        const d = _ndc.distanceTo(_tmp);
        if (d < bestD) {
          bestD = d;
          _best.copy(_ndc);
        }
      }

      // SMOOTHED, never snapped. At mid-span the curtain is nearly parallel
      // to the ray, so tiny pointer moves used to teleport the resolved point
      // hundreds of units along the span — the field churned and the bridge
      // looked like it was being mangled. An ~80ms time constant keeps the
      // influence gliding along the structure instead.
      if (bestD < Infinity) {
        cursorWorld.lerp(_best, 1 - Math.exp(-frame.delta / 0.08));
      }

      // Proximity drives the reaction, and the reaction is HELD. No time term:
      // a stationary cursor produces a constant field, so nothing decays
      // underneath it. An envelope-based version was built and rejected — it
      // began rebuilding while the viewer was still pointing at the bridge and
      // read as a flicker rather than as a response.
      const proximity = pointer.engaged
        ? 1 - THREE.MathUtils.smoothstep(bestD, 0, INTERACTION.influenceRadius * 2.2)
        : 0;

      // Fast to scatter, slow to return. That 1:4 asymmetry is what makes the
      // bridge read as MATTER rather than as a weightless field effect: things
      // easy to disturb and effortful to restore have mass.
      const tau = proximity > cursorStrength
        ? INTERACTION.riseResponse
        : INTERACTION.returnResponse;
      cursorStrength +=
        (proximity - cursorStrength) * (1 - Math.exp(-frame.delta / tau));

      particles.material.uniforms.uCursor.value.copy(cursorWorld);
      particles.material.uniforms.uCursorStrength.value =
        cursorStrength * (reduced ? A11Y.reducedMotion.interactionScale : 1);

      // --- camera ----------------------------------------------------------
      //
      // Parallax is deliberately almost imperceptible. lerp 0.045 is a ~0.36s
      // time constant, so the camera has mass and lags noticeably: it should be
      // nearly impossible to notice you are controlling it, and only obvious
      // that the scene is not flat.
      //
      // Idle drift is an ABSOLUTE function of time, never an accumulator — an
      // accumulator drifts out of frame over hours. The periods are coprime, so
      // the combined motion has a 713-second period and never lands in a
      // recognisable loop.
      // --- push-in ---------------------------------------------------------
      //
      // Dolly moves the camera ALONG ITS OWN VIEW AXIS, so the composition is
      // preserved and only the distance changes. Moving it toward a fixed world
      // point instead would swing the frame as it travelled, and the gesture
      // would read as "look over there" rather than "come closer".
      const dolly = reduced ? 0 : pointer.dolly;
      const disperse = THREE.MathUtils.smoothstep(
        dolly, INTERACTION.proximityDispersion.startsAt, 1,
      );

      // The origin is where the view axis meets the bridge — the thing you are
      // pushing into. Resolved on the centreline so it stays on the structure
      // rather than floating at an arbitrary depth.
      _ray.subVectors(camAim, camPos).normalize();
      _tmp.copy(camPos).addScaledVector(_ray, camPos.distanceTo(camAim));
      const originU = centreline.nearestU(_tmp);
      centreline.positionAt(
        originU,
        particles.material.uniforms.uDisperseOrigin.value as THREE.Vector3,
      );
      particles.material.uniforms.uDisperse.value = disperse;

      if (!reduced) {
        const w = frame.elapsed;
        const drift = new THREE.Vector3(
          Math.sin((w / CAMERA.idleDrift.periodX) * Math.PI * 2) * CAMERA.idleDrift.amplitudeX,
          Math.cos((w / CAMERA.idleDrift.periodY) * Math.PI * 2) * CAMERA.idleDrift.amplitudeY,
          0,
        );

        _tmp.copy(home)
          .add(drift)
          .add(new THREE.Vector3(
            pointer.x * CAMERA.parallax.offsetX,
            pointer.y * CAMERA.parallax.offsetY,
            0,
          ));

        // Push-in applied to the REST position, before the parallax lerp, so it
        // inherits the same lag. Applied afterwards it would arrive instantly
        // while everything else eased, and the camera would feel jointed.
        _dolly.subVectors(target, home).normalize();
        _tmp.addScaledVector(_dolly, CAMERA.dolly.travel * dolly);

        camPos.lerp(_tmp, CAMERA.parallax.lerp);

        // The rotation goes INTO the translation — moving right translates right
        // and yaws slightly right, so the far side of the valley opens up. That
        // is what a person does when they lean to see past something.
        _tmp.copy(target).add(new THREE.Vector3(
          pointer.x * CAMERA.parallax.offsetX * 0.45,
          pointer.y * CAMERA.parallax.offsetY * 0.45,
          0,
        ));
        camAim.lerp(_tmp, CAMERA.parallax.lerp);

        camera.position.copy(camPos);
        camera.lookAt(camAim);
      }

      // LAST, after the camera has been moved. The sky derives its horizon from
      // the camera's own matrices, so updating it earlier would paint this
      // frame's sky with last frame's view.
      mist.update(frame.elapsed);
      terrain.update(frame.elapsed);
      network.update(frame.elapsed);
      groundGlow.update(t);
      towers.update(t, loopEnabled);
      // Existence, the falls and the pre-wrap fade are all derived per-packet
      // inside the traffic shader from the deck's own schedule — the global
      // intensity is only a master fader.
      streams.update(1, frame.elapsed, t);
      sky.update(frame.elapsed, t, camera);

      // Exposed for the capture harness, which cannot see a shader. The
      // interaction fields especially: every one of these paths has at some
      // point existed as plausible source code that did nothing, and a pixel
      // diff can only tell you that SOMETHING moved.
      const dev = window as unknown as {
        __sceneTime?: number;
        __cursorStrength?: number;
        __dolly?: number;
        __disperse?: number;
      };
      dev.__sceneTime = t;
      dev.__cursorStrength = cursorStrength;
      dev.__dolly = pointer.dolly;
      dev.__disperse = disperse;
    },

    resize(width: number, height: number) {
      sky.setSize(width, height);
      // Point size is expressed in pixels, so it has to track viewport height or
      // the scene turns to soup on a phone and to dust on a 4K monitor.
      const scale = THREE.MathUtils.clamp(height / 900, 0.55, 1.5);
      particles.material.uniforms.uPointScale.value = scale;
      streams.setPointScale(scale);
      network.setPointScale(scale);
      void width;
    },

    dispose() {
      scene.remove(
        sky.mesh,
        terrain.mesh,
        mist.mesh,
        particles.points,
        streams.points,
        network.group,
        groundGlow.mesh,
        towers.group,
      );
      sky.dispose();
      terrain.dispose();
      mist.dispose();
      particles.dispose();
      streams.dispose();
      network.dispose();
      groundGlow.dispose();
      towers.dispose();
    },
  };
}

/** Kept so callers that reason about world extents do not re-derive them. */
export { WORLD };
