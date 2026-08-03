/**
 * The single source of truth for every number in this project.
 *
 * Two halves:
 *   1. Deployment configuration — site identity, launch date, endpoints. Sourced
 *      from environment variables so the same build artefact can be reconfigured
 *      without touching code. See .env.example.
 *   2. Scene configuration — every constant the 3D scene depends on, mirroring
 *      claradix_creative_pack/36_CONFIGURATION.md.
 *
 * A magic number anywhere else in src/ is a bug. If this file and a document in
 * the creative pack disagree, this file wins and the document is filed as a bug.
 */

// ===========================================================================
// PART 1 — Deployment configuration
// ===========================================================================

export const SITE = {
  name: "Claradix",
  legalName: "Claradix LLC",
  url: "https://claradix.com",
  email: "info@claradix.com",
  phone: "+994 50 443 19 29",
  /** One tap → WhatsApp chat with the message already written (client,
   *  2026-08-03). The number and text are the CTA's entire contract. */
  whatsapp: `https://wa.me/994515760410?text=${encodeURIComponent(
    "Salam. Əlaqə nömrənizi https://claradix.com veb saytından aldım, zəhmət olmasa boş zamanınızda geri dönüş edərsiniz",
  )}`,
  address: {
    street: "Babək prospekti, Babək plaza 14C",
    locality: "Baku",
    country: "AZ",
  },
  social: {
    linkedin: "https://www.linkedin.com/company/claradix/",
    instagram: "https://instagram.com/claradix_llc",
    facebook: "https://www.facebook.com/profile.php?id=100076390094082",
  },
} as const;

/**
 * A countdown to a date you will not hit is worse than no countdown at all —
 * visitors who return to a reset timer stop believing the rest of the page.
 * Leave VITE_LAUNCH_DATE unset and the UI shows a build-status readout instead,
 * which is honest and needs no maintenance.
 */
const rawLaunch = import.meta.env.VITE_LAUNCH_DATE as string | undefined;
const parsedLaunch = rawLaunch ? Date.parse(rawLaunch) : NaN;

/**
 * The full site ships 2026-08-28 15:30 Baku time (client, 2026-08-01) — the
 * countdown runs to it by default; VITE_LAUNCH_DATE still overrides for
 * other deployments.
 */
export const LAUNCH_DATE: Date | null = Number.isFinite(parsedLaunch)
  ? new Date(parsedLaunch)
  : new Date("2026-08-28T15:30:00+04:00");

/**
 * POST endpoint receiving { email, locale, source }. When absent, the form
 * degrades to a mailto: link rather than pretending to have collected anything.
 */
export const SUBSCRIBE_ENDPOINT: string | null =
  (import.meta.env.VITE_SUBSCRIBE_ENDPOINT as string | undefined) || null;

// ===========================================================================
// PART 2 — Scene configuration
// ===========================================================================

/**
 * `u` — the most important symbol in the scene.
 *
 * Normalised ARC LENGTH along the bridge centreline.
 *   u = 0.0  NEAR end, closest to camera, running off the bottom-left of frame
 *   u = 1.0  FAR end, vanishing toward the right horizon
 *
 * Assembly runs u = 1 → 0 (far to near). Rewind runs u = 0 → 1.
 *
 * Not to be confused with world units, which are only ever written as a suffix
 * on a number in prose (`90u`) and never appear in code as a bare `u`.
 */

// ---------------------------------------------------------------------------
// SCENE — master switches. The things a human is expected to flip.
// ---------------------------------------------------------------------------

export const SCENE = {
  /**
   * false → the bridge is complete at T+0.000, UI visible immediately,
   * interaction live. Used for design review and as the reduced-motion path.
   */
  playIntro: true,

  /**
   * Replay forever: build → hold → black hole → burst → build.
   *
   * FALSE by client decision (2026-08-01): the bridge builds once and stays.
   * THE MACHINERY REMAINS FULLY WIRED — flip this one flag to true and the
   * whole Act IV choreography (suction, detonation, world-covering rain, the
   * seamless 33.7s cycle) comes back exactly as designed. Everything
   * downstream derives from this flag and the shared constants; nothing else
   * needs touching. The loop-check exercises it via the runtime toggle
   * (__scene.loop) so it cannot rot while switched off.
   */
  loop: false,

  /** Global multiplier on every duration in TIMELINE. Practical floor 0.55. */
  timeScale: 1.0,

  /** Debug only. Must be 0 in production. */
  debugStartPhase: 0,

  /** Debug only. Renders the target cloud statically — catastrophic if shipped. */
  debugShowTargetsOnly: false,

  /** Debug only. Draws the flight guide curve as a visible line. */
  debugShowGuideCurves: false,
} as const;

// ---------------------------------------------------------------------------
// TIMELINE — the master clock. Seconds, at timeScale = 1.
// ---------------------------------------------------------------------------

/**
 * Phase boundaries describe what the SCENE looks like overall. They are not
 * gates that every particle passes through together — at T+4.000 the frame
 * contains dormant, lifting and gliding particles simultaneously. That overlap
 * is what makes the scene read as a process rather than as three animations
 * played in sequence. Per-particle schedules come from LIFT / ASSEMBLY below.
 *
 * THE FOUR-ACT MASTER TIMELINE — one 35-second cycle, looping forever:
 *
 *   ACT I    AWAKENING     0 –  5   the sleeping world begins releasing light
 *   ACT II   CONSTRUCTION  5 – 15   spiral rivers feed the bridge, far → near
 *   ACT III  STILLNESS    15 – 20   the bridge complete; sparkles at key joints
 *   ACT IV   RETURN       20 – 35   near → far release; spirals unwind home
 *
 * At T+35.000 every particle is back on its original seed and the frame is
 * pixel-identical to T+0.000 — the visitor can never find the seam.
 */
export const TIMELINE = {
  phase0_dormantStart: 0.0,
  phase1_awakeningStart: 0.8,
  phase2_glideStart: 3.4,
  phase3_assemblyStart: 5.2,
  /** The build sweep runs 20% faster (client, 2026-08-01). */
  phase4_completionStart: 13.5,
  phase5_livingStart: 14.3,

  /**
   * The page arrives WHILE the comet is still building. With the gathering
   * skipped in no-loop mode (INTRO_START = 4.6), scene T+12 is ~7.4s of wall
   * time after load — the wait the client approved — and the finished bridge
   * lands as the last words settle.
   */
  uiRevealStart: 12.0,
  /** When the LAST element BEGINS its fade. It finishes 950ms later. */
  uiRevealLastStart: 15.1,
  /** When the page is actually, fully readable. */
  uiRevealEnd: 16.05,
} as const;

export type Phase = 0 | 1 | 2 | 3 | 4 | 5 | 6;

// ---------------------------------------------------------------------------
// WORLD — coordinate system and extents
// ---------------------------------------------------------------------------

/**
 * Three.js handedness: +X right, +Y up, +Z toward the viewer. Camera looks −Z.
 * One world unit = one metre, conceptually — which is what makes the numbers
 * sanity-checkable. A 468-unit main span is a plausible bridge; if a value stops
 * being physically believable, that is a signal something is wrong.
 */
export const WORLD = {
  /**
   * The ground must run PAST the camera (z = 900), not stop in front of it.
   * With maxZ at 400 the terrain sheet ended mid-frame and the bottom band
   * of the viewport looked straight past its edge into the void — the world
   * read as a floating island (client report, 2026-08-01: "the ground ends
   * before it leaves the camera; dark blue gaps underneath"). The bounds now
   * clear the frustum on every side the camera can see.
   */
  bounds: {
    minX: -1500,
    maxX: 1400,
    minY: -180,
    maxY: 420,
    minZ: -1400,
    maxZ: 1150,
  },

  valleyFloorY: 0,

  /** A thin mist plane pools in the valley bottom. Not water — never reflects. */
  mistPlaneY: 6,

  /**
   * The mist is how the GROUND establishes itself, and it is the answer to a
   * requirement the scene was failing exactly backwards.
   *
   * The ground's existence has to be established by the design, not by the
   * particles. It was not: the opening frame's landscape WAS the 140,000 seeded
   * particles, and the moment they lifted off to become the bridge the valley
   * went black. Rim light cannot fix that — it only fires at silhouette edges,
   * and a valley floor seen down its own length presents almost none.
   *
   * What does fix it is a thing lying ON the ground. Mist pools in hollows and
   * thins over rises, so it draws the topography directly: where it is thick you
   * are looking into a hollow, where it breaks you are looking at a ridge. That
   * reads as terrain even when the terrain itself is barely lit.
   *
   * And it is nearly free against the colour rule, because NEAR-BLACK IS NOT
   * BLACK. The band edge is 0.058; this contributes about 0.014 over terrain
   * sitting at 0.03, for a total around 0.044 — plainly visible on a dark screen
   * and still counted as near-black by the checker. The rule constrains the
   * histogram, not the visibility, and there is a great deal of usable picture
   * underneath it.
   */
  mist: {
    /** Terrain height at which the mist has fully thinned out. Above this you
     *  are on a ridge and there is nothing pooling. Lowered so only genuine
     *  hollows pool — not the entire pressed foreground plain. */
    ceiling: 38,
    /** Below this it is uniformly thick — the bottom of the carved chasm. */
    floor: -130,
    /**
     * SOLVED, not picked. The mist has to land just under the near-black edge:
     * visible as ground, invisible to the colour rule.
     *
     *   want            0.025 luminance added at the thickest point
     *   noise           ~0.50 average
     *   distance fade   ~0.60 over the visible valley
     *   so alpha_eff  = 0.62 * 0.5 * 0.6 = 0.186
     *   #14251C is 0.1286 → 0.1286 * 0.186 = 0.024   ✓
     *
     * The first attempt used #0A1712 at 0.22, which works out to 0.003 — about
     * a tenth of what was needed, and it rendered as nothing at all. Worth
     * writing the arithmetic down rather than turning a dial: the difference
     * between invisible and correct here is one order of magnitude, which is
     * many more increments than anyone wants to sit through.
     */
    color: "#14251c",
    /** Down from 0.62 with the on-road camera: the foreground press put ALL
     *  near ground under the mist ceiling, and the pooled mist became a
     *  green blanket over land the reference keeps near-black. */
    opacity: 0.3,
    /** Two octaves, drifting. Slow enough to never read as motion; present so
     *  that no two frames are identical, which is what reads as air. */
    driftSpeed: 0.9,
    turbulencePeriod: 41.0,
    /** Grid resolution. Density is evaluated per VERTEX against the real
     *  heightfield, so this is what sets how faithfully the mist follows it. */
    segments: 120,
  },

  /**
   * Linear fog, tinted to the sky's horizon band so the horizon dissolves.
   * Near edge sits past the main tower (1,005u) so the hero structure stays
   * bright; the far end of the span (1,900u) reads ~65% faded, which is the
   * depth cue the reference frame carries.
   */
  fogNear: 700,
  fogFar: 2400,
  /** Between the sky's horizon band and its mid band, so distant terrain
   *  dissolves into the sky with no seam. Same value as PALETTE.ink. */
  fogColor: "#070a13",
} as const;

// ---------------------------------------------------------------------------
// SKY — gradient, stars, nebula
// ---------------------------------------------------------------------------

/**
 * Four layers, back to front: gradient, stars, nebula, fog.
 *
 * NOTHING IN THE SKY EVER BLOOMS. Every value here is chosen to sit below
 * POSTFX.bloom.threshold (0.62) — the sky's own peak is the brightest star at
 * 0.34, roughly half the threshold. Only particles glow. Break this and the
 * scene turns to mush, because a blooming sky has no dark for the bridge to be
 * bright against.
 */
export const SKY = {
  /**
   * A four-stop vertical ramp. `y` is ELEVATION — the sine of the angle above
   * the horizon, taken from the view ray — not screen height.
   *
   * The pack specifies screen height with 0 at the horizon, which is the same
   * thing for a fixed camera and stops being the same thing the moment the
   * camera pitches. Elevation costs one normalise and is right in both cases:
   * the horizon lands where the horizon actually is, at every camera angle, and
   * the band stays put while the frame moves around it.
   */
  gradient: [
    { y: 0.0, color: "#0e1626" },
    { y: 0.025, color: "#080c17" },
    { y: 0.1, color: "#05070e" },
    { y: 0.45, color: "#02030a" },
  ] as ReadonlyArray<{ readonly y: number; readonly color: string }>,

  /**
   * BRIGHTER than the pack's #0C1220, and spread over a fifth of the height.
   *
   * The pack's horizon is 0.0695 against a near-black band edge — which the pack
   * itself sets, from --soil — of 0.0580. So the specified horizon was above its
   * own ceiling, and because it was ramped across 30% of the sky it put roughly
   * 16% of the frame into the deep band on its own, against a 10% budget the
   * terrain was already using.
   *
   * The resolution is not a darker horizon but a NARROWER one. What ridgelines
   * need is contrast at the boundary, not a large area of lifted sky: a
   * silhouette is an edge, and an edge needs one bright pixel behind it, not a
   * thousand. #0E1626 is 0.0841 — brighter than the pack asked for — but it has
   * decayed under the band edge within about 0.9 degrees of the horizon, so the
   * whole glow costs around 2% of the frame instead of 16%.
   *
   * This is what makes the mountains read as mountains. Without it, distant
   * ridges are fog-coloured against a sky of nearly the same luminance and there
   * is no silhouette at all — which is the state the scene was in.
   */
  zenithIsDarkerThanPage: true,

  stars: {
    /** Denser and brighter (client, 2026-08-03: "the stars must read
     *  clearly") — the cloud bodies now occlude them, so the open gaps can
     *  afford a fuller field without the sky ever reading busy. */
    count: 1700,
    sizePx: { min: 0.7, max: 1.9 },
    /** Max 0.42, still under the 0.62 bloom threshold. */
    brightness: { min: 0.1, max: 0.42 },
    /**
     * Star FIELDS (client, 2026-08-03 round 2: "density in some regions,
     * some stars brighter — detailed, not uniform dots"). A large-scale
     * noise multiplies the existence probability, so the sky has dense
     * drifts and near-empty pools; and a rare fraction of stars burn
     * half again brighter and larger. The post-twinkle cap keeps even
     * those under the bloom threshold.
     */
    cluster: { scale: 0.13, min: 0.4, max: 2.0 },
    brightStar: { fraction: 0.035, boost: 1.5, sizeBoost: 1.35, cap: 0.58 },
    /** Thinned toward the ridgeline, where atmospheric extinction is greatest
     *  and where they would otherwise compete with the terrain silhouette. */
    falloffStart: 0.42,
    falloffEnd: 0.86,
    twinkle: {
      /**
       * Per-star, spread across a wide range and phase-scattered.
       *
       * Clustered periods give the starfield a collective rhythm that becomes
       * obvious within a minute. Across 3-11s no pattern is detectable over any
       * observation window, which is what the tab-left-open-for-four-hours
       * requirement actually needs.
       */
      periodRange: [3.0, 11.0] as const,
      amplitude: 0.28,
    },
  },

  /**
   * THE CLOUDSCAPE (client, 2026-08-03: "the sky must be EXACTLY like the
   * reference — clouds near and far, small clouds, green glows between
   * them, stars clearly visible"). Replaces both the old flat nebula wash
   * and the aurora ribbon.
   *
   * Three cooperating layers, all derived from one noise field so they stay
   * physically coherent:
   *   bodies — dark sculptural masses that OCCLUDE the stars (a cloud is a
   *            thing in front of the sky, not a glow painted onto it)
   *   cores  — internal green light in the thick of the masses, the
   *            "lit from within" the reference frame shows
   *   rims   — thin bright edges where a mass meets open sky
   * Plus small high-frequency puffs near the horizon: the depth cue the
   * client called out — distance is read from cloud SIZE.
   *
   * Everything stays under the 0.62 bloom threshold. The sky never blooms.
   */
  /**
   * THE NEBULA (client, 2026-08-03 round 3). Not clouds, not fog, not
   * smoke — a volumetric deep-space plasma formation. The full design
   * lives in the sky shader; what it builds:
   *
   *   - DOUBLE DOMAIN-WARPED fractal fields — coordinates bent through
   *     two nested fbm warps, so nothing reads as Perlin patterning;
   *     edges tear into filaments and folded membranes instead of ending
   *     in cloud-like outlines
   *   - TWO stacked translucent sheets (coarse back, fine front) — the
   *     front's thin regions reveal the back, which is what makes the
   *     formation read as deep rather than painted
   *   - MICRO-DETAIL field shredding every silhouette at high frequency
   *   - an internal ENERGY field: light originates INSIDE the body and
   *     escapes only through translucent membranes and ridged fracture
   *     VEINS — thick cores occlude their own light, there are no rims,
   *     no edge glow, no bloom (the sky never blooms; the brightest
   *     yellow-green core stays under the 0.62 threshold)
   *   - a center-open FRAMING mask: formations wrap the frame's edges
   *     and corners and leave negative space over the bridge
   *
   * The palette ramp (near-black green → deep emerald → forest → toxic
   * green → electric lime → yellow-green core) is embedded in the shader
   * as constants — it is a designed ramp, not a tunable.
   */
  nebula: {
    /** Wall-clock. GLACIAL on purpose — the formation breathes, it does
     *  not drift like weather. Its job is that no two frames are ever
     *  identical over a long session. */
    driftSpeed: 0.0015,
    /** The toxic-green the painted mountain ranges borrow for their
     *  crest light, so ridge lighting and nebula emission always agree. */
    glowColor: "#37a32b",
  },

  /**
   * SHOOTING STARS — rare, brief, and on the SCENE clock, deliberately.
   *
   * Two opportunity windows per 35s cycle, each firing with the given
   * probability at a hash-chosen moment, place and heading. Scene-clock
   * timing means the loop stays EXACTLY repeatable (loop-check's pixel
   * comparison would otherwise flake whenever a meteor crossed one frame of
   * a pair) and every capture is deterministic.
   *
   * Brightness sits just under the 0.62 bloom threshold: the brightest thing
   * in the sky, still not a glowing one.
   */
  meteors: {
    /** CYCLE_LENGTH / 4 (33.7 ÷ 4) — twice the old frequency (client,
     *  2026-08-01: "repeat 50% sooner") and still wrap-safe in loop mode. */
    window: 8.425,
    probability: 0.55,
    duration: [0.9, 1.4] as const,
    brightness: 0.58,
    /** Screen-height units. */
    tailLength: [0.1, 0.2] as const,
    /** Per-meteor size variation (client: "one 1.2x, another 0.7x") —
     *  hash-picked per window; scales width, tail and brightness together. */
    scale: [0.65, 1.3] as const,
  },
} as const;

// ---------------------------------------------------------------------------
// BRIDGE — geometry
// ---------------------------------------------------------------------------

/**
 * Five control points, Catmull-Rom interpolated. Everything else — deck, towers,
 * cables, hangers, piers — is generated relative to this curve.
 *
 * NOTE ON `u`: the values below are the control points' NORMALISED ARC-LENGTH
 * positions, recomputed from the chord lengths between them. An earlier draft
 * used 0.22 / 0.45 which put the tower-to-tower arc at 422u — shorter than the
 * 468u straight-line distance between the same two points, which is impossible.
 */
export const BRIDGE = {
  /**
   * RE-AUTHORED for silhouette legibility, together with the camera.
   *
   * The previous centreline receded 1,180 units in Z against 1,040 in X, and
   * from any +Z camera the view ran nearly along the span: the main cable's
   * sag projected to almost nothing, the towers presented edge-on, and the
   * finished bridge read as a horizontal band of light that could not be
   * named. The geometry and the camera were solved as one problem this time,
   * against constraints on the SILHOUETTE — the cable's curve must subtend a
   * visible fraction of the frame, the towers must cross the horizon into
   * sky — rather than on where things land in the frame.
   *
   * The span now sweeps X-dominant (1,020 in X against 770 in Z), so the
   * camera sees the main span nearly broadside: the drape is a drawn curve,
   * not a foreshortened line.
   */
  /**
   * RE-AUTHORED against the reference frame, together with the camera — the
   * two were solved as one problem (scripts/_camsolve.mjs prints the screen
   * positions of every anchor below).
   *
   * The far half now recedes nearly ALONG the view axis (Z-dominant), which is
   * what produces the reference's strong perspective diminution: the far tower
   * subtends 0.41× the main tower on screen. The span visibly ARCS away
   * toward the right-hand mountains, exactly as the reference frame draws it.
   */
  centreline: [
    /**
     * THE LUMINOUS HIGHWAY, now a CINEMATIC S-CURVE (client, 2026-08-03
     * round 4: "a long cinematic S-curve — begin close to the camera,
     * gently curve across the landscape, and naturally connect into the
     * suspension bridge"). The road still passes low behind the viewer and
     * ends bottom-centre AT the eye (u0.1 projects to 0.504, 0.861), but
     * the approach now BOWS LEFT to x≈0.44 through u 0.2–0.32 (clear of
     * the text column at x<0.35) before sweeping right through the main
     * tower (0.601) to the exit (0.831) — one inflection, solved in
     * _camsolve.mjs, that walks the eye directly up to the towers. The Y
     * profile is unchanged: low near, high at the towers, sinking exit.
     */
    /**
     * EXTENDED BOTH WAYS (client, 2026-08-04 art-direction revision: "the
     * bridge must connect two distant worlds"). The near end now starts
     * BEHIND the camera (z 1060 vs the eye at 980), so the roadway passes
     * beneath the viewer and out of frame — a journey you are already on.
     * The far end runs 340u past the old exit and SINKS (y 62 → 44) as it
     * goes, so it drops behind the mountain silhouettes inside the fog and
     * dissolves with no visible endpoint. Interior anchors — the S-curve
     * elbow and both tower bases — are the same world points as before;
     * only their normalised u moved with the longer arc.
     */
    { u: 0.0, p: [150, 34, 1060] },
    { u: 0.124, p: [158, 40, 780] },
    { u: 0.297, p: [152, 55, 390] },
    { u: 0.457, p: [320, 80, 70] }, // MAIN TOWER base
    { u: 0.683, p: [620, 84, -340] }, // FAR TOWER base
    { u: 0.849, p: [900, 62, -590] },
    { u: 1.0, p: [1140, 44, -830] },
  ],

  /** Derived at init from the arc-length table. Recompute if points change. */
  arcLength: 2280,

  /** WIDENED 46 → 74 (client, 2026-08-03 round 2: "the bridge in the image
   *  is WIDER — make it exactly like the image"), and KEPT wide through the
   *  round-4 redesign (client confirmed): the ribbon is wide and paper-thin,
   *  not narrow. legSpacing, cable lateralOffset, pier widths and the
   *  traffic lanes all moved with it — the deck must still pass INSIDE the
   *  tower portals. */
  deckWidth: 74,
  /** SLASHED 3.2 → 0.8 (client, round 4: deck visual thickness down
   *  70–80% — "a thin floating ribbon suspended in space", no volume, no
   *  weight). The deck now has a top surface only; nothing is generated
   *  below it. */
  deckThickness: 0.8,
  deckCamber: 0.5,

  /**
   * The bridge is not uniformly a suspension bridge. The near and far ends
   * have no main cable — which is exactly what the reference frame shows in
   * the foreground: a long cable-free sweep of glowing deck. The side-span
   * cables (tower top → deck-level anchorage) cover part of the approaches.
   */
  sections: {
    nearApproach: [0.0, 0.457],
    mainSpan: [0.457, 0.683],
    farApproach: [0.683, 1.0],
  },

  /**
   * SLIMMER AND TALLER (client, round 4: "elegant pillars of pure light
   * instead of heavy structural columns — emphasize height, lightness,
   * refinement"). +10% height each (main top projects to y 0.184, still
   * inside frame); the real slimming happens in bridgeTargets — leg member
   * width 4.4 → 1.6 — so the same particle share condenses into hotter,
   * thinner lines. legSpacing is NOT slimmed: it is the portal the 74-wide
   * deck passes through and must exceed the deck width.
   */
  /**
   * REBUILT AGAINST THE DESIGN-BREAKDOWN SHEET (client, 2026-08-04).
   * Blueprint ratios, mapped to our world scale:
   *   - legs are DEEPER than wide (cross-section 6.5 × 12 m at 120 m
   *     height → width ≈ 5.4%, depth ≈ 10% of height), depth halving
   *     toward the top (side view 12 → 6.5)
   *   - the portal CONVERGES toward the top (front view 24 → 18 m). Ours
   *     converges from the deck-constrained 80 down to topPortal 70, so
   *     the leg centres land exactly on the main-cable line (±35) — the
   *     saddle sits under the cable, which is what makes the anchorage
   *     believable
   *   - ONE massive crossbeam with an arched underside high on the mast
   *     (beamY), plus a deck-level connection derived from deckY(u)
   *   - a widened foundation pedestal continuing below the terrain
   * Consumed exclusively by towerStructures.ts (real geometry).
   */
  towers: {
    main: {
      u: 0.457,
      baseY: 80,
      height: 192, // saddle at Y = 272
      /** Just outside the widened deck (74) — a portal the road passes through. */
      legSpacing: 80,
      topPortal: 70,
      /** Leg cross-section half-extents [across portal, along span] —
       *  THICKENED (2026-08-04 refinement: "the towers must appear
       *  heavier... believable that they could support thousands of
       *  tons") without touching height or portal proportions. */
      legBase: [6.2, 11.5] as const,
      legTop: [5.0, 6.2] as const,
      /** The structural crossbeam's centre height (world Y). */
      beamY: 230,
    },
    far: {
      u: 0.683,
      baseY: 84,
      height: 114, // saddle at Y = 198
      /** Same deck passes through this portal too — the far pylon is squat
       *  and wide in world space; perspective slims it on screen. */
      legSpacing: 78,
      topPortal: 70,
      legBase: [4.4, 7.8] as const,
      legTop: [3.5, 4.4] as const,
      beamY: 172,
    },
  },

  /**
   * PARABOLA, not a catenary.
   *
   * A catenary is the curve of a chain hanging under its OWN weight. A
   * suspension bridge's main cable carries a roughly uniform deck load through
   * its hangers, and that load dominates the cable's own mass — which makes the
   * curve a parabola. Golden Gate, Brooklyn, Akashi: all parabolic.
   *
   * The creative pack originally specified `cosh`. That was wrong and this is
   * the correction; the pack has been updated to match.
   */
  mainCable: {
    /**
     * Sag as a fraction of the arc span between the towers.
     *
     * 0.225 is far beyond a real bridge's 0.08–0.11, and it has to be: this
     * bridge's towers are stylised-tall relative to its span (0.33 against a
     * real bridge's ~0.1), so a realistic ratio leaves the cable dangling high
     * over the deck and every hanger comes out the same length — the render
     * reads as a picket fence. The reference frame's cable swoops down to
     * almost TOUCH the deck at mid-span, which is what grades the hangers long
     * near the towers and short at the crown. The clearance at the low point
     * works out to ~17u.
     */
    sagRatio: 0.225,
    count: 2,
    /** Just inside the widened deck edges (±37). */
    lateralOffset: 35,
    /**
     * Side spans: beyond each tower the cable descends to a deck-level
     * anchorage, as the reference frame clearly draws left of the main tower.
     * `anchorU` is how far along `u` the anchorage sits from its tower;
     * `sagFraction` is the mild sag of that descending run, as a fraction of
     * the total drop.
     */
    sideSpan: {
      main: { anchorU: 0.145, sagFraction: 0.14 },
      far: { anchorU: 0.105, sagFraction: 0.14 },
    },
  },

  hangers: {
    /** HALVED 14 → 7 (round 4), then 7 → 6 (Pass 1: "increase cable
     *  density significantly — the cables should create rhythm"). With
     *  both side spans this yields ~175 columns per side, ~350 hair-thin
     *  verticals; the budget moved with it so each thread keeps its
     *  along-line continuity. */
    spacing: 6,
    /** Prevents zero-length hangers where the cable meets the deck at mid-span. */
    minLength: 2.5,
  },

  piers: {
    spacing: 78,
    /** SLIMMED 26/42 → 9/14 (client, round 4: no visible structural mass —
     *  the deck is a ribbon held up by threads of light, not columns). */
    widthTop: 9,
    widthBase: 14,
  },

  /**
   * COMPLETE ARCHITECTURE REDESIGN (client, 2026-08-04): "only the two main
   * tower pairs should exist as true physical structures... everything else
   * should be generated through particles... the roadway should not exist —
   * there is only an invisible spline." Towers moved OUT of the particle
   * system entirely (real geometry — see towerStructures.ts); the deck,
   * railing and piers no longer generate ANY particles at all — the
   * roadway's only visual representation is the flowing river in
   * groundStreams.ts, which IS the invisible-spline-plus-density illusion
   * the brief describes. The whole particle budget belongs to the two
   * "semi-physical" elements: the delicate cable drapes and the hanger
   * curtain that visibly connects them to the (invisible) roadway.
   */
  /**
   * NOTE the shares no longer sum to 1 — that is the point. The particle
   * count is DERIVED from the targets that survive generation, so spending
   * only 36% of the nominal budget simply yields a smaller, finer particle
   * population: cables at ~today's density (delicate lines, not ropes) and
   * nothing wasted on layers that no longer exist. The dedup-shortfall
   * fallback that used to refill the deck is gone with the deck itself.
   */
  targetDistribution: {
    deck: 0,
    hangers: 0.14,
    mainCables: 0.22,
    towers: 0,
    piers: 0,
    railing: 0,
  },
} as const;

export const LAYERS = [
  "piers",
  "towers",
  "deck",
  "mainCables",
  "hangers",
  "railing",
] as const;

export type Layer = (typeof LAYERS)[number];

/**
 * THE TOWERS' MATERIAL (2026-08-04 architecture redesign). Real opaque
 * geometry — the bridge's only solid object — read through the same visual
 * grammar as everything else: a near-black body (matching terrain's
 * uBase/uAmbient darkness, so the towers sit IN the scene's palette rather
 * than floating outside it) with an emissive rim that concentrates toward
 * the saddle, where the cables converge and the energy is highest.
 */
export const TOWER_GLOW = {
  base: "#040f08",
  /** Deliberately > 1 in the green channel — an opaque mesh does not stack
   *  toward white under additive blending the way particles do. Red/blue
   *  held LOW (saturated green, never warm/yellow), and the whole vector
   *  TEMPERED for the 2026-08-04 art-direction pass: the towers must
   *  almost disappear into the environment, readable only through subtle
   *  edge light — part of the world's ecosystem, not an object in it. */
  glow: [0.2, 1.0, 0.28] as const,
  rimPower: 2.6,
  /** Base→top brightness mix — "the towers are anchors, energy concentrates
   *  toward the point cables meet the mast". */
  verticalFloor: 0.22,
} as const;

// ---------------------------------------------------------------------------
// TERRAIN — the valley
// ---------------------------------------------------------------------------

export const TERRAIN = {
  segmentsX: 384,
  segmentsZ: 384,

  /** Deterministic. A landscape that varies per load cannot be composed. */
  noiseSeed: 0x5eed_1a3f,

  /**
   * THE LAYERED WORLD (client direction, 2026-08-03 round 3: "an entirely
   * new terrain system — multiple layers of mountains, rolling hills,
   * valleys, ridges; never flat, never uniform; naturally formed over
   * millions of years, not procedurally generated").
   *
   * The heightfield is now COMPOSED, not a single fbm stack:
   *
   *   hills      gentle rolling base, everywhere — the connective tissue
   *   mountains  ridged multifractal RANGES, domain-warped twice so no two
   *              silhouettes repeat and nothing aligns to a grid
   *   belt       a low-frequency mask that gathers mountains into ranges
   *              with quiet plains between — mountains cluster, they are
   *              never evenly spaced
   *   valleys    broad negative basins flowing between the ranges
   *   micro      silhouette raggedness (see the note on `micro` below)
   *
   * Every amplitude is scaled by DEPTH (see depthRamp): small hills and
   * ridges near the lens, medium mountains across the midground, giants at
   * the horizon — the classic three-plane cinematic layering the reference
   * image is built from.
   */
  hills: {
    freq: 0.0016,
    octaves: 4,
    lacunarity: 2.03,
    gain: 0.5,
    /** Amplitude near the camera vs at the horizon. */
    amp: { near: 34, far: 72 },
  },

  mountains: {
    freq: 0.00082,
    octaves: 5,
    lacunarity: 2.07,
    gain: 0.52,
    /** Crest sharpening exponent of the ridged transform (1-|n|)^s. Higher
     *  is craggier; below ~1.6 the ranges soften into dunes. */
    sharpness: 2.2,
    amp: { near: 108, far: 430 },
    /**
     * DOUBLE domain warp — the single most important anti-repetition tool.
     * The coarse warp (170u at ~600u wavelength) bends whole ranges so no
     * chain runs straight; the fine warp (34u) kinks individual spurs.
     * Value noise unwarped shows its lattice within seconds of looking.
     */
    warp: { freq: 0.0016, strength: 170, freq2: 0.006, strength2: 34 },
    /**
     * The range mask. Below `low` the mountain field contributes only
     * `floor` (isolated knolls on the plains); above `high` a full range
     * stands. The floor is small but non-zero — a plain with literally no
     * mountain energy reads as a different biome, not a quiet region.
     */
    /**
     * WIDENED (first probe round): at 0.38–0.78 the belts left the camera's
     * visible sector almost rangeless — the horizon read flat, which is the
     * exact failure the rework exists to fix. More of the world carries
     * ranges now; the clearance corridor still keeps the bridge's own path
     * open, so width here costs the composition nothing.
     */
    belt: { freq: 0.00095, low: 0.3, high: 0.66, floor: 0.08 },
  },

  /** Broad basins between ranges. Deeper with distance — the near ground
   *  rolls, the far world is carved. */
  valleys: { freq: 0.00055, depth: 58, low: 0.15, high: 0.85 },

  /**
   * Micro detail, [frequency, amplitude]. Invisible on any surface; its
   * entire job is SILHOUETTES. A ridgeline built from smooth octaves is a
   * mathematical curve and looks like one — these make the edge ragged, and
   * ragged edges read as rock. First thing dropped by anyone optimising the
   * noise. Do not.
   */
  micro: [
    [0.011, 6],
    [0.034, 2.2],
  ] as ReadonlyArray<readonly [number, number]>,

  /**
   * How amplitude scales from the lens to the horizon: 0 at zNear, 1 at
   * zFar, raised to `exponent` so the growth back-loads — the midground
   * stays medium and the last third of the world carries the giants.
   */
  /** Exponent 1.0 (was 1.25): the back-loading left the MIDGROUND too calm —
   *  medium mountains are the layer the eye actually reads, the giants only
   *  close the horizon behind them. */
  depthRamp: { zNear: 250, zFar: -900, exponent: 1.0 },

  /**
   * The SOFT SADDLE (client direction, 2026-08-01 round 2: "no carved-out
   * look — the mountain stays as it is, and the bridge settles onto it").
   *
   * No canyon, no channel. The natural relief runs right up to and under the
   * deck; pier lengths follow it — short on the knolls, long over the
   * hollows, exactly as asked. The only intervention is this wide, partial
   * relaxation of ground that would otherwise rise THROUGH the deck: broad
   * enough (280u) and gentle enough (85% of the excess, soft falloff) to
   * read as a natural pass between shoulders, never as a cut.
   */
  clearance: {
    halfWidth: 280,
    /** Fully effective inside this fraction of halfWidth; fades to zero at 1. */
    innerFrac: 0.22,
    margin: 26,
    strength: 0.85,
  },

  /**
   * The FOREGROUND CAP: a soft ceiling on ground height between the camera
   * and the bridge, derived from the sightline to the deck's near end. Keeps
   * the frame's bottom filled with rolling ground (never void) while
   * guaranteeing by construction that no near hill ever occludes the deck,
   * the gorge, or the piers standing in it.
   */
  foregroundCap: {
    startZ: 200,
    base: 34,
    slopePerZ: 0.055,
    knee: 0.1,
  },

  /**
   * Placed for composition, not generated. Negative heights are BASINS.
   *
   * REDUCED with the layered-world rework: the generated ranges now supply
   * the mountains these used to fake, so each ridge is an accent guaranteeing
   * a compositional fact (the deck exits INTO mountains; the left flank is
   * never empty) rather than the mountain itself. At the old heights they
   * stacked on top of the generated relief into 450u walls.
   */
  framingRidges: [
    /** BEHIND the far exit at the RIGHT, so the deck fades INTO the
     *  mountains where it leaves the frame — not in front of the far tower. */
    { centre: [1110, 0, -720], radius: 400, height: 120 },
    { centre: [1290, 0, -1060], radius: 520, height: 160 },
    /**
     * The RIGHT-OF-FRAME layering (heightfield scan, 2026-08-03): the belt
     * noise happens to gather this seed's generated ranges on the LEFT, so
     * the visible right sector — where the reference stacks range upon
     * range — came out bare. Four accents restore the layers: a midground
     * range at the right edge, a backdrop the far tower reads against, a
     * fog-veiled giant closing the horizon under the nebula, and a low
     * near hill rolling through the bottom-right corner. All verified
     * outside the clearance corridor and under the deck sightlines.
     */
    { centre: [1150, 0, -250], radius: 320, height: 150 },
    { centre: [900, 0, -900], radius: 420, height: 260 },
    { centre: [450, 0, -1050], radius: 500, height: 300 },
    { centre: [780, 0, 120], radius: 280, height: 85 },
    /** The LEFT flank, layered (client: "the left is too empty — give it
     *  mountains and shadows"). Three depths, separated by fog. */
    { centre: [-770, 0, -300], radius: 380, height: 80 },
    { centre: [-1080, 0, -580], radius: 470, height: 120 },
    { centre: [-520, 0, -940], radius: 520, height: 140 },
    /**
     * The DARK WATER BASIN under the main span (second reference image): a
     * broad organic hollow, not a cut — the mist pools into it as water,
     * and the tower pylons plunge down into it.
     */
    { centre: [470, 0, -160], radius: 500, height: -120 },
  ],

  material: {
    roughness: 0.94,
    metalness: 0.0,
    /**
     * MEASURED UP from 0.34, and the measurement that justified it was one I had
     * first read backwards.
     *
     * Sweeping this 0.34 → 0.05 moved the deep band by 0.2 points, which I filed
     * as "the rim is not the problem". The useful reading is the opposite: the
     * rim is nearly FREE. It only lights silhouette edges, so it buys visible
     * mountain for almost no share of the frame — which makes it the one term
     * that can be spent generously.
     *
     * It has to be. The scene's requirement is that the ground's existence is
     * established by the DESIGN, not by the particles, and the scene was failing
     * it exactly backwards: the dormant frame's landscape was 140,000 seeded
     * particles, and the moment they flew off to become the bridge the ground
     * went black. The terrain has to carry itself once they leave.
     *
     * 0.55 against --rim's 0.387 luminance peaks at 0.21 — bright enough to
     * model a ridge, still inside the deep band, still nowhere near the 0.62
     * bloom threshold. The landscape must never bloom; only particles do.
     *
     * Rendering the terrain in isolation is what settled the number. In the
     * composite the ground looked absent and the obvious reading was that the
     * rim had failed; alone, it was plainly working — rolling ridgelines across
     * the whole right of the frame. What is actually true is that the left half
     * is empty because the terrain's horizon runs off it, and that half is where
     * the headline sits and where the text scrim darkens the frame anyway. So
     * the ground did not need more light. Isolating an element answers "is this
     * broken" in one screenshot; the composite can only ever answer "something
     * is".
     */
    rimStrength: 0.55,
    /**
     * STRENGTH and POWER are not interchangeable, and this is where that bites.
     *
     * Strength scales the rim's brightness; power sets how far down the face it
     * runs — its AREA. Widening it from 3.2 to 2.4 cost five points of near-black
     * across every capture, uniformly, while raising strength at a fixed 3.2
     * costs almost nothing. My earlier "the rim is nearly free" reading came from
     * a sweep that only ever moved strength, so it was true of strength and I
     * generalised it to the wrong parameter.
     *
     * The same distinction decided the bloom halo: there, radius was the weak
     * lever and mip depth the expensive one. In a scene budgeted by PIXEL COUNT
     * rather than by intensity, every parameter that sets an area is the
     * expensive one and every parameter that sets a brightness is cheap.
     */
    rimPower: 3.2,

    /**
     * The colour the terrain dissolves INTO at distance (world-polish pass:
     * "the nebula should wrap around the environment rather than floating
     * behind it"). Plain --ink is the SKY's blue-black, and far mountains
     * mixed toward it looked cut out against a nebula that is green; this is
     * ink pulled toward near-black emerald, so the ground's horizon and the
     * sky's body meet in one atmosphere. Luminance 0.057 — still inside the
     * near-black band; the wrap costs the colour rule nothing.
     */
    horizonFog: "#09110d",
  },

  /**
   * INTERNAL EMISSIVE GLOW (client, 2026-08-03 round 3: "the glow comes
   * from within the landscape rather than sitting on top of it — internal
   * emissive lighting with soft volumetric diffusion, no hard bloom").
   *
   * A per-vertex emissive factor baked with the heightfield:
   *
   *   crest    height above the locally blurred field — energy accumulates
   *            along ridgelines, hilltops and peaks, exactly where the
   *            brief puts it
   *   elev     absolute elevation ramp — valley floors stay dark
   *   cluster  low-frequency noise so whole regions are quiet while others
   *            burn — brightness is NEVER distributed evenly
   *
   * The strongest baked value renders around 0.30 luminance — well under
   * the 0.62 bloom threshold. The terrain glows; it never blooms. The
   * bright pinpoint energy on top of this diffusion belongs to the network
   * (below), not the mesh.
   */
  glow: {
    /** Prominence (u above the blurred field) that counts as a full crest.
     *  14, down from 26 (first probe round): real ridge prominence at the
     *  384-grid scale runs 8–20u, so 26 left crests at half strength. */
    crestNorm: 14,
    /** Elevation ramp — below elevLow fully dark, above elevHigh full.
     *  Lowered so the MIDGROUND hills participate; the valley floors sit
     *  under elevLow and stay dark regardless. */
    elevLow: 10,
    elevHigh: 170,
    /** The quiet-region mask. Same field seeds the network's density, so
     *  the mesh diffusion and the particle energy always agree about which
     *  regions are alive. */
    clusterFreq: 0.004,
    /** 1.9, up from 1.6 (world-polish pass): quiet regions QUIETER — the
     *  contrast between live and dark ground is the hierarchy. */
    clusterPow: 1.9,
    /** 0.85, down from 1.0 (world-polish pass): the terrain stays a step
     *  darker than the bridge, always. Light guides; darkness dominates. */
    strength: 0.85,
    /** Slow breathing of the internal light. Hz, wall clock. */
    breatheHz: 0.09,
    /** deep emerald → toxic green, the "lit from inside" ramp. */
    colorA: "#0e3b1e",
    colorB: "#37a32b",
  },

  /**
   * THE ENERGY NETWORK — the terrain's luminous surface (client, 2026-08-03
   * round 3: "an illuminated digital landscape made from thousands of
   * glowing green particles connected by extremely thin energy lines...
   * luminous particle streams naturally follow the elevation of the
   * ground").
   *
   * Four deterministic layers, all generated by MARCHING THE REAL
   * HEIGHTFIELD (never painted on):
   *
   *   lines    polylines advected through a blend of the contour direction
   *            (wrapping hills like elevation isolines) and the downslope
   *            direction (draining into valleys like water), plus noise
   *            wander — so every line bends over hills, wraps around
   *            valleys and climbs mountains, because it literally walks
   *            the surface
   *   scatter  thousands of dim surface particles, the ground's grain
   *   hubs     bright nodes at genuine local summits — energy concentrates
   *            at peaks, and only there does the palette reach yellow-green
   *   motes    microscopic particles floating just above the surface,
   *            drifting slowly — the depth-and-air cue
   *
   * Density follows the SAME cluster field as the mesh glow: dense
   * constellations in the live regions, near-nothing in the quiet ones.
   */
  network: {
    /** Line vertices sit this far above the surface — under the z-fight
     *  floor and under the seed particles' 0.15–0.55 rest offset. */
    lift: 0.7,
    /** March step, world units. Half the terrain cell — lines follow the
     *  interpolated surface faithfully. */
    step: 8.5,
    /** Line length in steps, hash-varied. Wide spread on purpose: uniform
     *  line lengths read as a generated pattern instantly. */
    segments: [24, 92] as const,
    /**
     * Two families: contour-followers (bias ~0.1, wrap the landforms) and
     * flow-lines (bias ~0.6, run downhill into the basins). The mix is what
     * makes the network read as one drainage system rather than as
     * concentric rings.
     */
    /** Min raised off zero (first probe round): a pure contour line around a
     *  small knoll CLOSES INTO A RING — the artificial-wireframe look the
     *  brief bans. A little permanent downhill drift turns every would-be
     *  ring into an open spiral. */
    contourBias: [0.12, 0.26] as const,
    flowBias: [0.45, 0.8] as const,
    flowFraction: 0.32,
    /** Rotational noise blended into the march direction. 0.35, down from
     *  0.65 (probe round 4): on steep complex flanks the stronger wander
     *  tangled the network into scribbles — the lines must WRAP the forms,
     *  silkily, and let the relief supply the complexity. */
    wander: 0.35,
    /** Per-step direction smoothing — kills kinks without straightening. */
    turnSmooth: 0.55,
    /** A minority of lines carry extra energy: the "major flowing terrain
     *  paths" where brightness naturally accumulates. */
    trunkFraction: 0.12,
    /** Camera-space near fade, same law as every luminous element: the
     *  ground at the viewer's feet stays calm. */
    nearFade: [90, 340] as const,
    /** Same reference distance as the bridge particles. */
    sizeAttenuation: 950,
    /** Master output scale — the one dial for the whole network. */
    master: 1.5,
    /**
     * Occasional luminous streams travelling the lines. GENTLE: 46 u/s
     * along the surface (the orb tour moves ~1,000 u/s — this is 4% of
     * that), one soft ~90u pulse per 430u of line, on under half the lines.
     */
    /** Gain 0.6, down from 0.85 (world-polish pass): the streams must be
     *  noticed only when looked for — alive, never busy. */
    pulse: { wavelength: 430, speed: 46, gain: 0.6, fraction: 0.45 },
    /**
     * near-black green → deep emerald → forest → toxic → electric lime.
     * The ramp is evaluated per-vertex by energy; only hub peaks push into
     * the final stop. Yellow-green (#d9ff9c) is reserved for hub cores.
     */
    ramp: ["#0d2a12", "#1e5c17", "#37a32b", "#7cfc00"] as const,
    hub: {
      /** Only genuine summits qualify — scanned from the real field. 70,
       *  down from 110: the visible midground's summits run 80–180. */
      minHeight: 70,
      gridStep: 44,
      cap: 150,
      sizePx: [3.0, 4.6] as const,
      bright: [0.5, 0.72] as const,
    },
    linesByTier: {
      ultra: 1900,
      high: 1500,
      medium: 950,
      low: 520,
      minimal: 300,
    } satisfies Record<string, number>,
    /** The reference terrain's surface texture is mostly DOTS — the particle
     *  grid. This is the layer that carries it; the counts are the point. */
    scatterByTier: {
      ultra: 75_000,
      high: 60_000,
      medium: 38_000,
      low: 20_000,
      minimal: 10_000,
    } satisfies Record<string, number>,
    motesByTier: {
      ultra: 9_000,
      high: 7_000,
      medium: 4_200,
      low: 2_200,
      minimal: 1_200,
    } satisfies Record<string, number>,
  },
} as const;

// ---------------------------------------------------------------------------
// SEED — where dormant particles rest
// ---------------------------------------------------------------------------

/**
 * Seeds cover THE WHOLE VISIBLE WORLD, independent of the bridge.
 *
 * The client's direction is explicit: the awakening must read as the entire
 * landscape releasing its light — every slope, every ridge, the mountains —
 * not as the bridge's own footprint stirring. Seeds are scattered uniformly
 * across the world area and accepted if they fall inside the camera's view
 * (with margin, so parallax and wider aspects never expose an unseeded edge).
 *
 * The old constraint — seeds near their targets, for tight flight bands — is
 * gone with the choreography that needed it: every particle now flies to the
 * ORB, not to its own bridge position, so seed placement owes the bridge
 * nothing.
 */
export const SEED = {
  /** Uniform scatter area, world units. Generous past the frustum on every
   *  side that matters. */
  area: { x: [-1350, 1250] as const, z: [-1200, 980] as const },
  /** NDC acceptance half-width — 1.0 is the exact frustum edge. */
  frustumMargin: 1.3,
  /** Closer than this and a resting particle renders as a fat foreground
   *  blob under the camera. */
  minCameraDistance: 280,
  /** Rest ON the surface: 0 z-fights, above ~1.5 visibly hovers. */
  surfaceOffset: [0.15, 0.55] as const,
  /** Steeper than this and they look stuck to a cliff rather than resting.
   *  Raised so the mountains' flanks carry seeds too. */
  maxSlopeDeg: 55,
  maxRerolls: 40,
} as const;

// ---------------------------------------------------------------------------
// ORB — the gathering sphere and its journey
// ---------------------------------------------------------------------------

/**
 * The heart of the revised choreography (client direction, 2026-07-31):
 *
 * Particles rise from the whole landscape and converge into ONE luminous
 * sphere. The orb forms at the top-left of frame, then glides — spiralling,
 * never a straight line — down behind the text column, across the valley,
 * off behind the right-hand mountains, and re-emerges at the bridge's far
 * end, where it sweeps along the span far → near, spending itself into the
 * structure. The comet IS the construction front.
 *
 * In Act IV the flow inverts: a second orb hangs over the span like a black
 * hole, drinks the bridge in near-section-first, drifts up into the sky, and
 * DETONATES — throwing every particle back out across the entire landscape
 * to the very seed it first rose from.
 *
 * The whole path is baked into a 256×2 texture at init (row 0: tour + build
 * sweep, row 1: the black hole's drift) and the vertex shader reads position
 * as a pure function of time, exactly like everything else in this scene.
 */
export const ORB = {
  /** Radius of the riding cloud. Volume-distributed, dense core. */
  radius: 20,
  /**
   * Comet tail: how far behind the head (seconds) a particle may ride.
   * SMALL on purpose — the tour moves at ~1,000u/s, so every 0.1s of lag is
   * ~100u of tail. 0.45 turned the ball into a 600u sausage.
   */
  lagMax: 0.18,
  /** Swirl revolutions/sec inside the orb. */
  spin: 1.1,
  /** Brightness while riding. The core clamps to white on its own — this
   *  keeps the halo readable instead of one blown disc. */
  ridingBrightness: 0.6,

  rise: {
    /** Earliest arrival at the orb — the formation moment. */
    joinStart: 2.4,
    /**
     * Hash-spread of arrivals — DELIBERATELY SHORT. Every join lands inside
     * the loiter (before tourDepart), so the whole sky's streams converge on
     * ONE nearly-stationary point and the gathering reads as a ball forming,
     * not as particles chasing a traveller all across the frame. That
     * misreading is exactly what the first draft produced.
     */
    joinWindow: 2.0,
    /** Seed → orb travel time. */
    flightDur: [1.4, 2.2] as const,
    /** How high the rise arcs before swooping toward the orb. */
    arcHeight: [55, 115] as const,
    /** A particle must be aboard this long before its deposit begins. */
    boardingMargin: 0.4,
    /** Nothing rises before the world has been seen asleep. */
    earliestRise: 0.85,
  },

  /**
   * The itinerary's three legs, all baked into row 0 of the path texture:
   *
   *   tourStart → tourDepart   the LOITER: the orb hangs at the formation
   *                            point (tour[0]), swirling as it accretes —
   *                            "gathering at one point, like a sphere"
   *   tourDepart → build start the TOUR: swooping behind the text, across
   *                            the valley, off behind the mountains,
   *                            spiralling the whole way
   *   build start → +span      the SWEEP: laying the bridge far → near
   *
   * Waypoints in world space; the last is overridden at bake time with the
   * exact build-sweep start so the legs are seamless. Screen positions
   * verified in _camsolve: (0.16, 0.19) → behind the text (0.12, 0.37) →
   * valley (0.34, 0.45) → off-frame right behind the mountains → far span.
   */
  tourStart: 2.2,
  tourDepart: 4.6,
  /**
   * Every waypoint sits INSIDE the fog's useful range (the first draft's
   * formation point was 2,265u out — past fogFar — and the forming orb was
   * simply invisible). Formation projects to (0.10, 0.17) at 1,436u; the
   * mountain waypoint dives into the [900,-820] framing ridge so the comet
   * is genuinely occluded there, not merely fogged.
   */
  /** Formation happens OFF-SCREEN (client, 2026-08-01: "outside the field of
   *  view") — the risers stream out past the top-left edge, and the orb
   *  enters the frame already formed, gliding in behind the text. */
  tour: [
    [-420, 470, -100],
    [-100, 260, 0],
    [80, 200, 140],
    [1200, 240, -480],
    [900, 100, -590],
  ] as ReadonlyArray<readonly [number, number, number]>,
  /** The accretion swirl while loitering: radius swells from and returns to
   *  the formation point, so both ends of the loiter are seamless. */
  loiter: { radius: 46, turns: 2.2 },
  /** The tour's spiral: helix turns around the path, radius easing in-flight,
   *  plus an independent vertical bob so it never reads as a mere corkscrew. */
  helix: { turns: 2.6, radius: [64, 14] as const, bob: 26 },

  /** Hovering offset while laying the bridge, and the tight working spiral. */
  build: { heightAbove: 34, lateral: 22, helixRadius: 10, helixTurns: 7 },

  /** Act IV. How long one particle takes to be drunk in. */
  suction: { duration: 0.9 },
  /** The black hole's slow climb while it feeds. Ends at the boom point —
   *  high over the viewer's shoulder, so the burst fills the sky. */
  orb2Path: [
    [470, 160, -150],
    [420, 220, -90],
    [370, 300, -30],
  ] as ReadonlyArray<readonly [number, number, number]>,

  boom: {
    /** Detonation instant (loop mode): REWIND_START (18.7) + 9.4 — every
     *  particle is aboard by ~27.4. */
    at: 28.1,
    /** Outward flight speed toward the seeds. */
    speed: 380,
    minDur: 1.2,
    maxDur: 4.2,
    /** The burst arcs up and out before raining onto the landscape. */
    arcLift: 130,
  },

  /** Deposit: the short drop from the passing comet onto the structure. */
  depositDur: 0.7,
} as const;

// ---------------------------------------------------------------------------
// PARTICLES
// ---------------------------------------------------------------------------

export const TIERS = ["ultra", "high", "medium", "low", "minimal"] as const;
export type Tier = (typeof TIERS)[number];

export const PARTICLES = {
  countByTier: {
    ultra: 200_000,
    high: 140_000,
    medium: 90_000,
    low: 45_000,
    minimal: 16_000,
  } satisfies Record<Tier, number>,

  /**
   * CSS pixels at DPR 1, before perspective attenuation.
   *
   * Raising the minimum to 1.6 was tried, on the theory that the scene's
   * viewport drift came from the dimmest particles falling under one fragment
   * and so keeping an absolute footprint while the frame shrank around them. It
   * moved the near-black spread by nothing at all — 2.1 points before and after —
   * so that is not the mechanism, or not the dominant one. Reverted: a constant
   * whose justification did not survive measurement is worse than no change.
   *
   * See scripts/viewport-check.mjs for what the drift actually is.
   */
  /** Tightened 1.1–2.9 → 0.9–2.4 (client, round 4: "microscopic stars, not
   *  blurry glowing dots" — every particle individually visible). The
   *  matching change is the fragment falloff, sharpened so the sprite is a
   *  hard-edged point instead of a soft disc. */
  sizePx: { min: 0.9, max: 2.4 },

  /**
   * The distance at which a particle renders at its nominal sizePx. NOT a
   * strength — it is a reference distance, and it has to be near the subject.
   *
   * MEASURED up from 320, which was a leftover from the 277-unit world this
   * scene was scaled out of. The bridge now sits 700–1500u from the camera, so
   * 320/1100 shrank every particle to 0.29× nominal: even a peak-brightness one
   * rendered at 0.85px, below the point-size floor. That is why the accent band
   * ran at 1.6% against a 5% target while peak brightness measured 0.96 — the
   * light was all there, in far too few pixels to count.
   *
   * Same class of error as the depth-of-field focus plane, which was also still
   * pointing at the old world. When a scene's scale changes, every constant
   * denominated in distance has to move with it.
   *
   * The reference-frame composition solve moved the main span out to
   * ~1,000–1,450u (main tower at 1,005), so the reference distance moves with
   * it — the same law that produced this constant in the first place: when
   * the world's scale changes, every constant denominated in distance changes
   * with it.
   */
  sizeAttenuation: 950,

  /**
   * Note that `gliding` is BRIGHTER than `seated`. This is the scene's central
   * aesthetic inversion and it is deliberate: the travel is the hero, not the
   * destination. Particles are at their most alive in transit and calm down once
   * they become structure.
   */
  brightness: {
    dormant: 0.17,
    lifting: 0.55,
    gliding: 0.92,
    approaching: 1.0,
    /** Down from 0.74 → 0.62 → 0.5 → 0.46 across the client rounds. Round
     *  4: "most of the bridge should remain relatively dark with soft
     *  internal illumination" — brightness now comes from DENSITY (fiber
     *  lines, condensed tower legs), never from the individual point. */
    seated: 0.46,
  },

  blending: "additive",
  /** test: can terrain hide me? yes. write: can I hide other particles? no. */
  depthTest: true,
  depthWrite: false,

  /**
   * Idle motion, forever. Phase MUST be scattered — synchronised breathing makes
   * the whole bridge swell as one, which is a pulse, and the scene gets exactly
   * one of those (at completion).
   */
  breathe: {
    amplitude: 0.9,
    frequencyHz: 0.21,
    /** Fades in across Phase 4's settle rather than snapping on. */
    fadeInMs: 400,
  },

  /** Dormant shimmer is brightness only. Dormant particles never move. */
  dormantShimmer: {
    amplitude: 0.055,
    frequencyHz: 0.13,
    doubleRateFraction: 0.09,
  },

  trail: {
    enabled: true,
    lengthFrames: 26,
    decay: 0.88,
    /**
     * How much of the accumulated streak is added back into the frame.
     *
     * WELL under 1, and the reason is that the particles are drawn again in
     * full on top of their own smear. At 0.55 the trail was more than half as
     * bright as the thing casting it and the river closed up into a solid band
     * of light — the streaks stopped reading as motion and started reading as
     * geometry. 0.35 keeps the particle unambiguously the brighter object.
     *
     * It also costs about a point of near-black across the flight phases, which
     * is correct and unavoidable: a trail is light, and the colour rule counts
     * light. This is the price of the effect, not a bug in it.
     */
    strength: 0.35,
    /**
     * Three states, not two. An earlier draft omitted `approaching`, which would
     * have made the river stop streaking for the final 22% of every flight —
     * visible as the stream fading out a fifth of the way before each landing.
     */
    statesWithTrails: ["lifting", "gliding", "approaching"],
  },

  /** One frame of extra brightness as a particle seats. Exactly one. */
  snap: {
    sizeMultiplier: 1.35,
    decayMs: 180,
  },
} as const;

// ---------------------------------------------------------------------------
// LIFT / FLIGHT / ASSEMBLY — the per-particle schedule
// ---------------------------------------------------------------------------

/**
 * seatAt(u, layer) = windowStart + (1-u)*windowSpan + layerOffset + jitter
 *
 * ACT II — construction, far → near, laid by the PASSING ORB: windowStart is
 * the moment the comet arrives at the far end of the span, and the sweep is
 * the comet spending itself into the structure. The layer stagger inside any
 * cross-section is ~1.0s, so everything appears to emerge TOGETHER while
 * still being causally honest about load-bearing order.
 *
 * Boundary check (sweep 20% faster per client, 2026-08-01):
 *   first — pier at u=1:      7.400 + 0     + 0.000 = 7.400   = orb arrival
 *   last  — railing at u=0:   7.400 + 5.100 + 1.000 = 13.500  = phase4 start
 */
export const ASSEMBLY = {
  windowStart: 7.4,
  windowSpan: 5.1,
  /** Load-bearing order. You cannot hang a cable from a tower that is not there. */
  layerOffset: {
    piers: 0.0,
    towers: 0.25,
    deck: 0.5,
    mainCables: 0.75,
    hangers: 0.9,
    railing: 1.0,
  } satisfies Record<Layer, number>,
  jitter: 0.055,
} as const;

/**
 * Slimmed with the orb choreography: the spiral lives in the ORB's baked
 * path and its internal swirl now, not in per-particle roll attributes.
 */
export const FLIGHT = {
  sizeVar: { min: 0.85, max: 1.15 },
} as const;

/**
 * The river the particles fly along — offset above and camera-side of the bridge
 * so the assembly is never hidden behind the stream feeding it. Pure staging
 * with no physical justification; it exists so the camera can see both the
 * source and the destination at once.
 */
export const RIVER = {
  heightAbove: 74,
  lateralOffset: 46,
  /** Both offsets taper to zero from here, converging onto the bridge. */
  taperStart: 0.72,
  /** Nominal. Actual speed is DERIVED from pathLength / duration. */
  glideSpeed: 238,
} as const;

// ---------------------------------------------------------------------------
// INTERACTION
// ---------------------------------------------------------------------------

export const INTERACTION = {
  /** Tightened (client, 2026-08-01: "smaller radius, no absurd distortions" —
   *  worst at mid-span, where the deck, cables, hangers and traffic stack in
   *  one small screen area and a wide field churned them all at once). */
  influenceRadius: 62,
  /** Full strength inside. Prevents a normalize() singularity at d = 0. */
  innerRadius: 18,
  /** ~4% of the main span. Law 5 survives by construction. */
  maxDisplacement: 20,

  spring: { stiffness: 6.0, damping: 0.86 },

  /**
   * The most important number pair in the project. Fast to scatter, slow to
   * return. A symmetric response reads as a weightless field effect; the 1:4
   * asymmetry reads as MATTER — things easy to disturb and effortful to restore
   * have mass.
   */
  riseResponse: 0.34,
  returnResponse: 1.4,

  /** The cursor's world position is the nearest point on the bridge to its ray. */
  cursorDepth: "nearestBridgePoint",

  /** The one permitted one-shot. State must be distance-driven; events may not. */
  ripple: {
    enabled: true,
    speed: 340,
    amplitude: 11,
    lifetime: 0.9,
    bandWidth: 40,
    rearmRequiresExit: true,
  },

  flight: {
    /** Smaller than influenceRadius — a flying particle reacts later and less. */
    avoidRadius: 70,
    /**
     * LAW 4. Speed may never drop below this fraction of nominal, whatever the
     * cursor does. Avoidance deflects DIRECTION only, by projecting out the
     * along-heading component of the repulsion. A stalled particle misses its
     * deadline and seats after the completion pulse.
     */
    speedFloor: 0.92,
    maxDeflection: 62,
    /** Exponential, not a spring — a spring oscillates and reads as turbulence. */
    recoveryRate: 3.2,
    /** Late-approach particles become effectively immune, so they always land. */
    approachAvoidScale: 0.35,
  },

  touch: {
    holdBehaviour: "sustained",
    minHoldForRipple: 0,
    releaseUsesReturnResponse: true,
  },

  /** Push-in scatters the bridge globally. The one place Law 5 is relaxed. */
  proximityDispersion: {
    startsAt: 0.55,
    maxRadius: 180,
    maxDisplacement: 64,
  },
} as const;

// ---------------------------------------------------------------------------
// CAMERA
// ---------------------------------------------------------------------------

export const CAMERA = {
  /**
   * CINEMATIC WIDE (client, 2026-08-03 camera-correction round: "28–35°,
   * grandeur from perspective, not scale"). 35 vertical ≈ 50° horizontal
   * at 3:2 — wide enough for the S-curve to spread, nowhere near fisheye.
   */
  fov: 35,
  near: 1,
  far: 4000,
  /**
   * RE-SOLVED for silhouette legibility, together with the new centreline.
   *
   * The previous solve placed everything correctly by frame percentages and
   * produced an unnameable object: the camera stood at deck height (Y=40
   * against a 42–50 deck), and any long structure at eye level collapses into
   * a line on the horizon. The constraints encoded WHERE things sat, none
   * encoded whether the result would READ.
   *
   * This solve constrains the silhouette itself, and achieves:
   *
   *   view axis to main span     89.7° — the cable is seen broadside
   *   cable sag on screen        8.0% of frame height — a drawn curve
   *   main tower                 top (0.36, 0.42), base (0.36, 0.79) —
   *                              crosses the horizon, stands in sky,
   *                              clear of the text column (x < 0.35)
   *   far tower                  top (0.93, 0.48), 0.80× the main's height
   *   deck entry                 left edge at y 0.82, ~600u away — the near
   *                              side arrives low on the visitor's left,
   *                              where the words will land
   *   horizon                    y 0.64
   *   both ends                  off frame — left edge and right edge
   *
   * RE-SOLVED AGAIN, against the reference frame directly (_camsolve.mjs):
   *
   *   main tower        x 0.560, top y 0.343, base y 0.596   (ref 0.57 / 0.34 / 0.62)
   *   far tower         x 0.776, top y 0.473                 (ref 0.79 / 0.505)
   *   far/main ratio    0.41                                 (ref ~0.40)
   *   deck band         y 0.57–0.63, entering off-left       (ref 0.55–0.64)
   *   horizon           y 0.550
   *
   * The camera stands 30–45u above the deck and well back (main tower at
   * ~1,000u), so the bridge occupies the frame's right-centre band, the towers
   * cross the horizon into sky, and the BOTTOM THIRD of the frame is free for
   * the valley floor — where the ground streams flow, as in the reference.
   */
  /**
   * ON THE ROAD'S OWN LINE (client, 2026-08-03: "the near end must end AT
   * my viewpoint, centred — EXACTLY like the reference image"). The camera
   * stands directly over the highway: the light-road rises from the bottom
   * CENTRE of the frame (u0.1 at x 0.523), the main tower at (0.60, top
   * 0.21) right-of-centre precisely where the reference puts it, the far
   * tower at (0.74, 0.37), the deck exiting right at (0.83, 0.48), horizon
   * 0.465 — all solved against the reference frame in _camsolve.mjs.
   */
  /**
   * RE-SOLVED (2026-08-03 camera-correction round, _camsolve.mjs): the eye
   * now hovers 26u over the road's own start — LOW and just behind u=0, so
   * the roadway erupts from BELOW the bottom edge (u0 projects to y 1.14)
   * and its 74u width overfills the bottom corners. The S swings left to
   * x 0.28, the main tower stands at 0.45 with its top at 0.13, the deck
   * exits right at (0.73, 0.49), horizon 0.487. Grandeur from perspective:
   * nothing in the world moved, only the camera.
   */
  basePosition: [140, 62, 980] as const,
  baseTarget: [440, 52, -240] as const,

  /**
   * Framing constraints. These are the camera's real specification and they must
   * hold at every aspect ratio.
   */
  framing: {
    mainTowerTopY: [0.3, 0.4] as const,
    /** Right of centre, clear of the text column, as the reference frames it. */
    mainTowerCentreX: [0.52, 0.62] as const,
    horizonY: [0.52, 0.62] as const,
    /** The cable's sag must subtend at least this fraction of frame height, or
     *  the bridge cannot be named. The deep sagRatio gives ~0.2. */
    minCableSagScreen: 0.1,
  },

  /**
   * Deliberately almost imperceptible. lerp 0.045 is a ~0.36s time constant —
   * the camera has mass and lags noticeably. It should be nearly impossible to
   * notice you are controlling it; you should only notice the scene is not flat.
   */
  parallax: {
    offsetX: 22,
    offsetY: 11,
    yaw: 2.4,
    pitch: 1.2,
    lerp: 0.045,
  },

  /**
   * An ABSOLUTE function of time, never an accumulator — an accumulator drifts
   * out of frame over hours. Periods are coprime so the combined motion has a
   * 713-second period and never lands in a recognisable loop.
   */
  idleDrift: {
    amplitudeX: 7,
    amplitudeY: 3.5,
    periodX: 23.0,
    periodY: 31.0,
  },

  dolly: {
    enabled: true,
    travel: 340,
    lerp: 0.07,
    autoReturnAfter: 2.4,
    autoReturnRate: 0.35,
  },

  /** Portrait re-composes rather than crops — a crop loses the sweep entirely. */
  portrait: {
    /** Same low-and-behind language, opened wider — 9:16 keeps the road
     *  ~60% of the bottom and the tower rising past the top third. */
    fov: 58,
    basePosition: [148, 66, 990] as const,
    baseTarget: [400, 54, -240] as const,
  },

  orientationParallax: {
    /** Never prompt on load. Used only if permission was already granted. */
    enabled: "onPermission",
    maxTiltDeg: 22,
    lerp: 0.035,
  },
} as const;

// ---------------------------------------------------------------------------
// LIGHTING
// ---------------------------------------------------------------------------

/**
 * There is no visible light source in this world. No sun, no moon, no lamp.
 * That single decision is why lens flares, god rays and cast shadows are all
 * banned — each implies a source, and there isn't one.
 */
export const LIGHTING = {
  /** Halved-and-more (client, 2026-08-03: the ground must sit in black and
   *  darkest greens, as the reference does — the light belongs to the roads
   *  and the bridge, never to the land). */
  ambient: { intensity: 0.09 },

  /**
   * Reads as diffuse skyglow. Its job is normal disambiguation — giving slopes a
   * consistent sense of which way is up — not lighting.
   *
   * MEASURED, not taken from the pack. The pack specified 0.16 and claimed it
   * "gains about 0.02 luminance, roughly 5 values out of 256". That arithmetic
   * was wrong by a factor of five: the key colour #A9C77E has a luminance of
   * 0.66, so at 0.16 a fully-lit surface gains 0.106 — and with the terrain's
   * own albedo (--soil, 0.058) sitting exactly ON the near-black band edge, every
   * lit terrain pixel crossed into the deep band.
   *
   * Isolating the elements showed terrain contributing 23% of the frame to that
   * band against the particles' 4%, and sweeping the rim term from 0.34 to 0.05
   * moved it by 0.2 points — so it was never the rim. It was base + key.
   *
   * 0.030 x 0.66 = 0.020, which is what the pack meant.
   */
  key: {
    intensity: 0.014,
    direction: [-0.4, 0.7, -0.35] as const,
  },

  /**
   * The client asked for flying particles to light the mountains. 140,000
   * dynamic lights is not a thing any renderer does, so five point lights follow
   * the centroids of particle clusters binned by `u`.
   *
   * This is not a compromise: at distance 320 with decay 2 the falloff is so
   * broad that individual particle positions have no measurable influence —
   * only the centroid and the count matter, which is exactly what it captures.
   */
  swarmLights: {
    count: 5,
    intensityMax: 0.35,

    /**
     * The radius at which a light contributes EXACTLY ZERO. Not a scale factor.
     *
     * This was `distance: 150` feeding an unwindowed 1/(1+d^2), which has no
     * zero — a curve that still returns 0.19 at 310u and never stops. Since
     * swarm-lit terrain is deep-band by definition, the tail alone was spending
     * 25 of the 10-point deep budget, and no amount of turning the rim, the
     * particles or the bloom down could have recovered it. Four rounds of doing
     * exactly that moved the figure by two points.
     *
     * Five lights over a 1624u bridge sit about 325u apart. At 260 the pools
     * stay discrete — each light dies before it reaches its neighbour — so the
     * illumination visibly TRAVELS with the river instead of pooling into a
     * valley-wide wash. That sweep is the entire reason the effect reads as
     * caused by the particles rather than as a fill light someone switched on.
     */
    range: 260,
    /** Exponent of the windowed falloff (1 - x^2)^decay. 2 is a smooth
     *  shoulder that still terminates cleanly. */
    decay: 2,
    /** Hard ceiling, enforced in-shader. Unclamped, a passing river produces a
     *  spotlight sliding across a ridge — which implies an external agent. */
    terrainClamp: 0.11,
    /**
     * Kept BELOW terrainClamp on purpose.
     *
     * These previously peaked at 0.35 against a 0.18 clamp — a ratio near two,
     * which means a single light saturated across most of its footprint. The
     * clamp then stopped limiting a hotspot and started producing a flat disc of
     * constant brightness, which is the spotlight-on-a-ridge it exists to
     * prevent, just with straighter edges. Under the clamp, the falloff curve is
     * what you see, and the ceiling only catches the rare close pass.
     */
    intensityByPhase: {
      dormant: 0.0,
      awakening: 0.03,
      glide: 0.05,
      assembly: 0.03,
      completion: 0.022,
      living: 0.014,
    },
  },

  /** A projected decal, driven by local bridge completion. NOT a reflection. */
  groundGlow: {
    halfWidth: 190,
    /** The reference floor is BLACK; the only ground light is the roads
     *  themselves. Lifted 0.09 → 0.13 (world-polish pass): the spill is how
     *  the bridge ROOTS into the terrain — the two systems share light where
     *  they touch, which is what removes the boundary between them. */
    peakOpacity: 0.13,
  },
} as const;

// ---------------------------------------------------------------------------
// POSTFX
// ---------------------------------------------------------------------------

export const POSTFX = {
  /**
   * Bloom is the visual identity. Threshold 0.62 is what separates matter from
   * light: terrain peaks at ~0.09 (0.27 with swarm), stars at 0.34, dormant
   * particles at 0.17 — none of them bloom. Only particles do.
   */
  bloom: {
    threshold: 0.62,
    /** Above ~0.5 the hangers merge into haze and the bridge loses its detail.
     *  A weak lever: sweeping it 0.42 → 0.10 moved the colour ratio by under
     *  half a point, because it only widens the up-sample tent by a few texels.
     *  `mips` below is the control that actually sets the halo's size. */
    radius: 0.34,
    /**
     * MEASURED down from 5 — and it was 5 only because this field was declared
     * here and never read, so PostFX was using its own default.
     *
     * Mip depth is the halo's true extent: each level halves the resolution the
     * glow is reconstructed from, so five levels throw light from one bright
     * particle across roughly 32 pixels. With 140,000 of them in flight the
     * union of those throws became a faint wash over the middle third of the
     * frame. The histogram is what made this legible — nine of the twelve excess
     * deep-band points sat between 0.058 and 0.2, barely above the black edge,
     * which is a wide dim haze and not the bright core the pack asks for. Three
     * band counts had hidden that shape completely.
     *
     * At 3 the wash goes and the tight glow around each particle stays: the
     * glide frames moved from 78.7% near-black to 85.3% against an 87% target,
     * with peak brightness unchanged.
     */
    mips: 3,
    strengthByPhase: {
      dormant: 0.22,
      awakening: 0.34,
      glide: 0.46,
      /**
       * Assembly OPENS lower than glide closes, which is the one discontinuity
       * in this curve and it is deliberate.
       *
       * T+6.4 is the densest instant in the film: the airborne population is at
       * its maximum while the seated population is already accumulating, so both
       * light sources are running at once. It is the only frame whose target the
       * scene could not meet, and it stayed out by three to four points through
       * every other adjustment. Bloom is the largest single term in the frame —
       * disabling it entirely is worth eleven points — so it is the only lever
       * with enough authority, and taking it at the start of assembly costs
       * nothing at the completion peak, which is where the glow is the point.
       */
      /** Pulled down across the board (client, 2026-08-03: the bridge was
       *  far past the reference's "ideal brightness" — neon soup), then
       *  AGAIN in round 4 ("reduce bloom significantly, keep edges sharp,
       *  physically believable glow"). The structure is razor line-work;
       *  the only halo is a tight one on the hottest cores. */
      assembly: 0.22,
      assemblyEnd: 0.3,
      completion: 0.42,
      living: 0.26,
    },
    /** How long the exhale from the completion peak back down to `living`
     *  takes. Long enough to be a settle, not a switch. */
    settleSeconds: 3.2,
  },

  vignette: { strength: 0.34, smoothness: 0.62 },

  /**
   * Not optional. 85% of the frame spans about 5 values out of 256, and any
   * gradient across that range bands visibly on 8-bit displays. Grain dithers
   * the quantisation. Must be the FINAL pass — applied before bloom it gets
   * blurred and stops dithering.
   */
  grain: { amount: 0.035, animated: true },

  chromaticAberration: 0.0012,

  /**
   * The left-side darkening that guarantees text contrast. A DOM overlay above
   * the canvas and below the UI, not a post-process — it must not be bloomed,
   * must not enter the trail buffer, and must survive a WebGL failure.
   *
   * Active from T+0.000 even though there is no text on it until T+12.400: if it
   * faded in with the UI the viewer would see a rectangle appear.
   */
  textScrim: { opacity: 0.86, extent: 0.52 },
} as const;

/**
 * The pulse — one band of brightness travelling the span, far → near, the
 * same direction the build ran. RECURS while the bridge stands complete
 * (client, 2026-08-01: every 10 seconds), computed as a pure function of the
 * clock — no fired-flags, so seeking and the loop wrap stay exact. In loop
 * mode it fires inside the stillness window only.
 */
export const COMPLETION_PULSE = {
  startDelay: 0.2,
  duration: 0.5,
  repeatEvery: 10.0,
  bandWidth: 190,
  peakBrightness: 1.0,
  recoveryMs: 260,
  /** Near → far — away from the camera toward the mountains, the same
   *  direction the round-5 build runs (client, 2026-08-03). */
  direction: "nearToFar",
  /** Down with the round-4 bloom cut — the pulse still crosses the
   *  threshold visibly, it just no longer washes the frame. */
  bloomPeak: 0.85,
  bloomPeakMs: 200,
} as const;

// ---------------------------------------------------------------------------
// UI_REVEAL — offsets relative to TIMELINE.uiRevealStart
// ---------------------------------------------------------------------------

/**
 * Duration and staggers do NOT scale with SCENE.timeScale. The offsets are
 * choreography; the 520ms is UI micro-interaction timing tuned to human
 * perception of a control appearing, and it is the same whether the intro took
 * 8 seconds or 16.
 */
export const UI_REVEAL = {
  duration: 0.52,
  easing: "cubic-bezier(0.16, 1, 0.3, 1)",
  translateY: 12,

  /**
   * WIDER gaps than the original 0.15–0.25s (client, 2026-08-01: "they all
   * arrive at once — let them come one by one"): each element now has room
   * to be SEEN starting before the next begins.
   */
  sequence: [
    { id: "logo", offset: 0.0 },
    /**
     * NOT in the pack's list, which counts eleven elements and the page has
     * twelve. The masthead's keyword rail sits opposite the logo and had no slot
     * at all — under the old hardcoded delays it revealed at 120ms because
     * somebody typed 120, which is how a twelfth element stays invisible in a
     * document that describes eleven.
     */
    { id: "tagline", offset: 0.2 },
    { id: "eyebrow", offset: 0.4 },
    /** The headline reveals line by line — blocks are seen, lines are read. */
    { id: "headline-line-1", offset: 0.65 },
    { id: "headline-line-2", offset: 0.9 },
    { id: "headline-line-3", offset: 1.15 },
    { id: "subheadline", offset: 1.45 },
    { id: "cta", offset: 1.75 },
    { id: "socials", offset: 2.05, childStagger: 0.07 },
    { id: "countdown-ring", offset: 2.4, ringDrawDuration: 0.8 },
    { id: "countdown-units", offset: 2.8, childStagger: 0.08 },
    { id: "footer", offset: 3.1 },
  ],
} as const;

// ---------------------------------------------------------------------------
// LOOP — rewind. Only active when SCENE.loop is true.
// ---------------------------------------------------------------------------

export const LOOP = {
  /**
   * ACT III — stillness. From phase5_livingStart (15.6) to the rewind at
   * exactly T+20.000. The only moment the bridge exists complete; not to be
   * shortened.
   */
  holdAfterComplete: 4.4,

  /**
   * ACT IV — the black hole, T+20 → T+35.
   *
   * The bridge is drunk into a hovering orb, NEAR sections first (the
   * disassembly front travels away from the camera while the build travelled
   * toward it), the orb climbs as it feeds, and at ORB.boom.at it detonates —
   * every particle thrown back across the whole landscape to its own seed.
   *
   * Schedule: releases sweep 20.0 → ~27.75 (spatialSpan + layer offsets +
   * ±0.35 jitter), each suction flight takes ORB.suction.duration, so the
   * last particle is aboard by ≈28.7 — comfortably before the 29.4 boom.
   * Burst flights land by ≈33.9; the world is settled and dormant from
   * T+34.2 to the wrap at T+35.000.
   */
  rewind: {
    spatialSpan: 6.2,
    layerOffset: {
      railing: 0.0,
      hangers: 0.12,
      mainCables: 0.3,
      deck: 0.6,
      towers: 0.95,
      piers: 1.2,
    } satisfies Record<Layer, number>,
    /** Initial push out of the structure toward the orb. */
    releaseSpeed: 34,
  },

  /** Act IV's total width: rewind start + this = one full cycle. */
  returnWindow: 15.0,
} as const;

/**
 * When the rewind starts, and how long one full cycle lasts.
 *
 * DERIVED, never typed in. Every one of these numbers already existed somewhere
 * above; writing them out again is how a timeline drifts out of step with itself
 * the first time somebody adjusts the hold.
 */
export const REWIND_START = TIMELINE.phase5_livingStart + LOOP.holdAfterComplete;

/** 33.7s exactly, which is not a coincidence — the constants were chosen for it. */
export const CYCLE_LENGTH = REWIND_START + LOOP.returnWindow;

/**
 * Where the scene clock BEGINS on load.
 *
 * With the loop off (the default), the gathering act is skipped entirely —
 * the page opens with the light-orb already formed and gliding in (client,
 * 2026-08-01: "start directly with the orb in the sky"). Enable the loop and
 * the clock starts at zero, because the cycle then owns the gathering as its
 * own first act.
 */
/**
 * No-loop mode skips straight to the orb ARRIVING at the far end of the
 * span (client, 2026-08-03: no 2–3 second wander — the orb is already at
 * the bridge's tip and begins building at once). Loop mode still owns the
 * full gathering + tour as its first act.
 */
export const INTRO_START = SCENE.loop ? 0 : ASSEMBLY.windowStart - 0.25;

// ---------------------------------------------------------------------------
// PERF
// ---------------------------------------------------------------------------

export const PERF = {
  targetFps: 60,
  floorFps: 30,

  sampleFrames: 90,
  downgradeMs: 22.0,
  upgradeMs: 11.5,
  /** Upgrading is deliberately much harder than downgrading — oscillation
   *  between tiers is more visible than simply running at the lower one. */
  upgradeWindows: 3,

  /**
   * Phase 0 costs almost nothing and every device passes it. Phase 2 is the peak
   * — maximum trails, maximum overdraw, swarm lights at full. Measuring early
   * means weak devices get a high tier and then stutter where it matters.
   */
  measureFromPhase: 2 as Phase,
  /** A particle-count change mid-assembly is visible as a pop. */
  blockChangesDuringPhases: [3, 4] as ReadonlyArray<Phase>,

  maxDPRByTier: {
    ultra: 2.0,
    high: 2.0,
    medium: 1.5,
    low: 1.0,
    minimal: 1.0,
  } satisfies Record<Tier, number>,

  terrainSegmentsByTier: {
    ultra: 384,
    high: 384,
    medium: 256,
    low: 160,
    minimal: 160,
  } satisfies Record<Tier, number>,

  swarmLightsByTier: {
    ultra: 5,
    high: 5,
    medium: 5,
    low: 2,
    minimal: 0,
  } satisfies Record<Tier, number>,

  /** A phone throttles after minutes. Catching the trend early prevents the
   *  visible collapse that happens when it finally crosses downgradeMs. */
  thermalGuard: {
    windowSeconds: 60,
    degradationThreshold: 1.25,
  },

  /** Ordered by visual cost per millisecond saved. Particle count is last
   *  because it is the scene; everything else is atmosphere. */
  degradation: [
    "chromaticAberration",
    "grain",
    "trailLength",
    "swarmLights",
    "bloomRadius",
    "terrainSegments",
    "particleCount",
  ],
} as const;

// ---------------------------------------------------------------------------
// A11Y
// ---------------------------------------------------------------------------

export const A11Y = {
  /**
   * The build either plays or it does not. A "faster version" is still sweeping
   * full-screen motion, and the setting means stop, not hurry.
   */
  reducedMotion: {
    skipIntro: true,
    disableLoop: true,
    /** Damped rather than removed — a completely dead scene reads as broken. */
    interactionScale: 0.25,
    disableCameraParallax: true,
    /** 0.9u is sub-pixel at normal viewing distance. Keeping it stops the page
     *  feeling frozen without approaching any vestibular threshold. */
    disableIdleBreathe: false,
  },

  /** Held everywhere, even where WCAG would permit 3:1 for large text, because
   *  the background is animated and its local luminance changes. */
  minContrastRatio: 4.5,
} as const;

// ---------------------------------------------------------------------------
// PALETTE
// ---------------------------------------------------------------------------

/**
 * Mirrored in src/styles/tokens.css. Changing one without the other is a bug.
 *
 * The accent ramp is the real Claradix brand green (#7CFC00, green.500 from the
 * company Tailwind config) — not the #A3E635 the creative pack estimated from a
 * JPEG of the reference frame. Where the pack and the brand disagree, the brand
 * wins; the pack has been corrected.
 */
export const PALETTE = {
  void: "#040610",
  ink: "#070a13",
  soil: "#0b0f18",

  moss: "#1d3a0a",
  rim: "#41750f",

  /** The brand. */
  lime: "#7cfc00",
  limeBright: "#a6fd3f",
  /** Hottest particle cores only — the snap flash and the completion pulse. */
  limeCore: "#d9ff9c",
  limeDeep: "#5fd800",

  white: "#ffffff",
  textDim: "#d8dcdf",
  textMuted: "#8d9195",
  hairline: "rgba(255, 255, 255, 0.12)",
} as const;

/**
 * A particle's colour is sampled from this by brightness, so hot particles push
 * toward near-white and cold ones toward deep green without anyone authoring a
 * per-state colour. Dense regions sum past 1.0 under additive blending and clamp
 * toward limeCore — which is why tower legs have white-hot cores that nobody
 * painted.
 */
export const PARTICLE_COLOR_RAMP = [
  [0.0, "#16300a"],
  [0.35, "#4aa30c"],
  [0.62, "#7cfc00"],
  [0.85, "#a6fd3f"],
  [1.0, "#d9ff9c"],
] as const;

/**
 * Measured across the settled frame. Enforced by scripts/palette-check.mjs as a
 * hard acceptance criterion, because every individual change in this scene
 * pushes toward more light and each one is defensible in isolation. Ten
 * defensible changes produce a generic neon page. Taste evaluates changes one at
 * a time; a ratio evaluates the whole.
 */
/**
 * THE 85/10/5 RULE LIVES IN `scripts/palette-check.mjs`, NOT HERE.
 *
 * There was a `COLOUR_RATIO` export at this point carrying 0.85 / 0.10 / 0.05
 * and a 0.03 tolerance. Nothing imported it. The checker that actually enforces
 * the rule carries its own copy of every one of those numbers — plus the part
 * that matters more, the PER-CAPTURE targets, because the scene is supposed to
 * start dark and get brighter and a single global triple cannot say that.
 *
 * Two copies of an acceptance criterion, one of them unread, is worse than one:
 * whichever is easier to find is the one that gets edited, and it is not the one
 * doing the enforcing. Removed rather than wired up, because a `.mjs` script
 * cannot import this file without a build step, and adding a build step to share
 * four numbers with their only consumer is not a trade worth making.
 *
 * The band EDGES are a different matter and are derived, not written down: they
 * come from the luminance of the palette tokens below. See D-021.
 */

// ---------------------------------------------------------------------------
// TARGET generation
// ---------------------------------------------------------------------------

export const TARGET = {
  /** Coincident targets waste budget and create a slightly-too-bright hot dot. */
  minSeparation: 0.35,
  /** Everything uses this. Math.random() anywhere makes every visual check fail
   *  intermittently — which looks like flaky tests rather than like a bug. */
  randomSeed: 0x1a3f7c29,
} as const;
