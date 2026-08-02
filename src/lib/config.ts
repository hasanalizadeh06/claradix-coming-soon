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
  whatsapp: "https://api.whatsapp.com/send?phone=994702001019",
  address: {
    street: "Babək prospekti, Babək plaza 14C",
    locality: "Baku",
    country: "AZ",
  },
  social: {
    linkedin: "https://www.linkedin.com/company/claradix/",
    instagram: "https://instagram.com/claradix_llc",
    facebook: "https://www.facebook.com/profile.php?id=100076390094082",
    behance: "https://www.behance.net/",
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
   * Replay forever: build → hold → reverse → build.
   *
   * TRUE by design — the master timeline's explicit requirement is that the
   * world "simply continues breathing forever" with no visible reset. The old
   * objection (a page that dismantles itself under a reader) is answered by the
   * UI, not the scene: the page reveals once and STAYS — only the world behind
   * it cycles. See reveal.ts, "once revealed, it stays revealed".
   */
  loop: true,

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
  phase4_completionStart: 14.8,
  phase5_livingStart: 15.6,

  /** UI reveal runs as the last particles land — Act III is when the page is
   *  read, and the bridge holding still underneath it is the reward. */
  uiRevealStart: 15.0,
  /** When the LAST element BEGINS its fade. It finishes 520ms later. */
  uiRevealLastStart: 17.6,
  /** When the page is actually, fully readable. */
  uiRevealEnd: 18.12,
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
     *  are on a ridge and there is nothing pooling. */
    ceiling: 58,
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
    opacity: 0.62,
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
    /** One star per ~1750px of a 1536x1024 frame. Texture in the dark, not a
     *  starfield — a visible constellation would imply somewhere specific. */
    count: 900,
    sizePx: { min: 0.7, max: 1.6 },
    /** Max 0.34, comfortably under the 0.62 bloom threshold. */
    brightness: { min: 0.1, max: 0.34 },
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
   * The only part of the frame with colour, and the reason the far tower reads
   * at all despite being 61% fogged — it resolves against a faintly luminous
   * field instead of against pure black.
   *
   * Upper right, diagonally opposite the headline block. The frame's two soft
   * masses are opposed and the countdown ring sits between them.
   */
  nebula: {
    /** Widened to the WHOLE sky band (second reference image: sculptural
     *  lit cloud masses left AND upper-right; the noise's own patchiness
     *  separates them into banks). */
    extent: { x: [0.0, 1.0] as const, y: [0.0, 0.5] as const },
    color: "#2a520e",
    peakOpacity: 0.44,
    octaves: [
      [1.0, 1.0],
      [2.3, 0.46],
      [5.1, 0.19],
    ] as ReadonlyArray<readonly [number, number]>,
    drift: {
      /**
       * About 0.7 world units across the whole of Phase 0 — imperceptible, and
       * meant to be. Its job is not to be seen moving. Its job is that no two
       * frames are identical, which the eye detects even when it cannot name it.
       * A perfectly static sky reads as a photograph.
       */
      speed: 0.6,
      direction: [0.82, -0.56] as const,
      /** The internal structure evolves too, so over a long session the shape
       *  genuinely changes rather than merely translating. */
      turbulencePeriod: 34.0,
    },
  },

  /**
   * AURORA — one serpentine polar-light ribbon (client direction,
   * 2026-08-01: "zigzag, smaller, more vivid, more alive — not a flat wash").
   *
   * A single narrow band zigzagging across the sky's right two-thirds, with
   * the real aurora's anatomy: crisp bright lower edge, wispy rays feathering
   * upward, folds travelling and striations flickering on the wall clock.
   * Vivid green at the edge shading into teal in the rays.
   *
   * Peak added luminance ≈ 0.85 clamp × intensity × colour luminance ≈ 0.53 —
   * the brightest thing in the sky, still under the 0.62 bloom threshold.
   */
  aurora: {
    colorLow: "#42f08a",
    colorHigh: "#1fc8b0",
    intensity: 0.85,
    /** Kept for reference by the shader's envelope; the ribbon's centre
     *  rides elevation ~0.30 ± 0.17 of zigzag wander. */
    band: [0.05, 0.62] as const,
    driftSpeed: 0.011,
    swaySpeed: 0.017,
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
    window: 17.5,
    probability: 0.55,
    duration: [0.9, 1.4] as const,
    brightness: 0.58,
    /** Screen-height units. */
    tailLength: [0.1, 0.2] as const,
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
     * THE LUMINOUS HIGHWAY (second reference image, 2026-08-01): the road of
     * light and the bridge are ONE continuous path. It passes low behind the
     * viewer, RAMPS up from the bottom-right of frame onto the span, crests
     * past the huge main tower right-of-centre, crosses to the smaller far
     * tower, and DESCENDS into the dark right-hand mountains. The Y profile
     * is the ramp: low near, high at the towers, sinking at the far exit.
     */
    { u: 0.0, p: [140, 36, 920] },
    { u: 0.25, p: [200, 48, 490] },
    { u: 0.495, p: [320, 80, 70] }, // MAIN TOWER base
    { u: 0.785, p: [620, 84, -340] }, // FAR TOWER base
    { u: 1.0, p: [900, 62, -590] },
  ],

  /** Derived at init from the arc-length table. Recompute if points change. */
  arcLength: 1760,

  deckWidth: 46,
  deckThickness: 3.2,
  deckCamber: 1.4,

  /**
   * The bridge is not uniformly a suspension bridge. The near and far ends
   * have no main cable — which is exactly what the reference frame shows in
   * the foreground: a long cable-free sweep of glowing deck. The side-span
   * cables (tower top → deck-level anchorage) cover part of the approaches.
   */
  sections: {
    nearApproach: [0.0, 0.495],
    mainSpan: [0.495, 0.785],
    farApproach: [0.785, 1.0],
  },

  towers: {
    main: {
      u: 0.495,
      baseY: 80,
      height: 175, // saddle at Y = 255
      legSpacing: 34,
      legTaper: 0.62,
      crossBraceY: [130, 186, 243],
    },
    far: {
      u: 0.785,
      baseY: 84,
      height: 102, // saddle at Y = 186
      legSpacing: 26,
      legTaper: 0.66,
      crossBraceY: [126, 164],
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
    lateralOffset: 19,
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
    spacing: 14,
    /** Prevents zero-length hangers where the cable meets the deck at mid-span. */
    minLength: 2.5,
  },

  piers: {
    spacing: 78,
    widthTop: 16,
    widthBase: 26,
  },

  /**
   * How the particle budget is divided.
   *
   * Deliberately NOT proportional to surface area — particle count buys
   * legibility of THIN things. Towers get 20%: they are the reference frame's
   * protagonists and were reading as wire. Hangers DOWN to 12%: at 20% the
   * hanger curtain out-shouted the cables and towers it hangs between. Cables
   * up to 20%, which now also covers the two side spans.
   */
  targetDistribution: {
    deck: 0.28,
    hangers: 0.12,
    mainCables: 0.2,
    towers: 0.2,
    /** The chasm made the piers 150–200u tall; they need the extra density
     *  to read as columns instead of dotted lines. */
    piers: 0.12,
    railing: 0.08,
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

// ---------------------------------------------------------------------------
// TERRAIN — the valley
// ---------------------------------------------------------------------------

export const TERRAIN = {
  segmentsX: 384,
  segmentsZ: 384,

  /** Layered value noise, [frequency, amplitude]. */
  octaves: [
    [0.00042, 148], // continental — the big ridgelines
    [0.0012, 62], // hills
    [0.0038, 19], // undulation
    [0.011, 6.5], // surface roughness
    /**
     * Micro detail. Invisible on any surface; its entire job is SILHOUETTES.
     * The terrain is read almost entirely from rim light along ridgelines, and a
     * ridge built from four octaves is a smooth mathematical curve that looks
     * it. This octave makes the edge ragged, and ragged edges read as rock.
     * First thing dropped by anyone optimising the noise. Do not.
     */
    [0.034, 1.8],
  ] as ReadonlyArray<readonly [number, number]>,

  /** Deterministic. A landscape that varies per load cannot be composed. */
  noiseSeed: 0x5eed_1a3f,

  /**
   * Ruggedness scaled by DEPTH (client direction, 2026-08-01: "make the land
   * rise and fall more"): the background runs wild at 1.35× while the ground
   * near the lens calms to 0.85× — relief where the eye reads silhouettes,
   * never a wall in front of the camera.
   */
  relief: {
    far: 1.35,
    near: 0.85,
    zFar: -350,
    zNear: 250,
  },

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

  /** Placed for composition, not generated. Negative heights are BASINS. */
  framingRidges: [
    /** BEHIND the far exit at the RIGHT, so the deck fades INTO the
     *  mountains where it leaves the frame — not in front of the far tower. */
    { centre: [1110, 0, -720], radius: 400, height: 170 },
    { centre: [1290, 0, -1060], radius: 520, height: 240 },
    /** The LEFT flank, layered (client: "the left is too empty — give it
     *  mountains and shadows"). Three depths, separated by fog. */
    { centre: [-770, 0, -300], radius: 380, height: 138 },
    { centre: [-1080, 0, -580], radius: 470, height: 215 },
    { centre: [-520, 0, -940], radius: 520, height: 245 },
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
  tour: [
    [-60, 390, -140],
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
    /** Detonation instant. Every particle is aboard by ~28.7. */
    at: 29.4,
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
  sizePx: { min: 1.1, max: 2.9 },

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
    seated: 0.74,
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
 * Boundary check:
 *   first — pier at u=1:      7.400 + 0     + 0.000 = 7.400   = orb arrival
 *   last  — railing at u=0:   7.400 + 6.400 + 1.000 = 14.800  = phase4 start
 */
export const ASSEMBLY = {
  windowStart: 7.4,
  windowSpan: 6.4,
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
  influenceRadius: 90,
  /** Full strength inside. Prevents a normalize() singularity at d = 0. */
  innerRadius: 26,
  /** 30u against a 468u main span — 6.4%. Law 5 survives by construction. */
  maxDisplacement: 30,

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
  /** Wider with the on-deck viewpoint — a standing eye, not a telephoto. */
  fov: 44,
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
   * OVER THE ROAD (final orientation, client-confirmed direction: the wide
   * near ramp exits at the BOTTOM-LEFT under the viewer, the main tower
   * looms left-of-centre at (0.39, top 0.20), the span crosses the frame
   * rightward to the far tower at (0.60, 0.37), and the deck exits RIGHT
   * at (0.71, 0.48), only ~1,580u out — near enough to stay a presence
   * through the fog. Exact horizontal mirror of the previous solve.
   */
  basePosition: [330, 86, 880] as const,
  baseTarget: [360, 54, -240] as const,

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
    fov: 54,
    basePosition: [310, 92, 930] as const,
    baseTarget: [350, 58, -240] as const,
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
  ambient: { intensity: 0.22 },

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
    intensity: 0.03,
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
    terrainClamp: 0.18,
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
      awakening: 0.055,
      glide: 0.09,
      assembly: 0.055,
      completion: 0.045,
      living: 0.025,
    },
  },

  /** A projected decal, driven by local bridge completion. NOT a reflection. */
  groundGlow: {
    halfWidth: 190,
    /** Down from 0.26 with the reference-frame re-solve: the reference floor
     *  is DARK, its light carried by discrete streams — not a uniform wash. */
    peakOpacity: 0.17,
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
    radius: 0.42,
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
      dormant: 0.3,
      awakening: 0.46,
      glide: 0.62,
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
      assembly: 0.44,
      assemblyEnd: 0.88,
      completion: 1.15,
      living: 0.85,
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

/** The single pulse the scene is allowed. Fires once per build, never repeats. */
export const COMPLETION_PULSE = {
  startDelay: 0.2,
  duration: 0.5,
  bandWidth: 190,
  peakBrightness: 1.0,
  recoveryMs: 260,
  /** Far → near, the same direction the build ran. */
  direction: "farToNear",
  bloomPeak: 1.15,
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

  sequence: [
    { id: "logo", offset: 0.0 },
    /**
     * NOT in the pack's list, which counts eleven elements and the page has
     * twelve. The masthead's keyword rail sits opposite the logo and had no slot
     * at all — under the old hardcoded delays it revealed at 120ms because
     * somebody typed 120, which is how a twelfth element stays invisible in a
     * document that describes eleven.
     */
    { id: "tagline", offset: 0.15 },
    { id: "eyebrow", offset: 0.3 },
    /** The headline reveals line by line — blocks are seen, lines are read. */
    { id: "headline-line-1", offset: 0.55 },
    { id: "headline-line-2", offset: 0.75 },
    { id: "headline-line-3", offset: 0.95 },
    { id: "subheadline", offset: 1.2 },
    { id: "cta", offset: 1.45 },
    { id: "socials", offset: 1.7, childStagger: 0.06 },
    { id: "countdown-ring", offset: 1.95, ringDrawDuration: 0.8 },
    { id: "countdown-units", offset: 2.4, childStagger: 0.07 },
    { id: "footer", offset: 2.6 },
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

/** 35.0s exactly, which is not a coincidence — the constants were chosen for it. */
export const CYCLE_LENGTH = REWIND_START + LOOP.returnWindow;

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
