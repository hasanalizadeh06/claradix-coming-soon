# Claradix Coming-Soon — Session Chat History

Archived session log for the Claude Code conversation that built the bridge
animation scene from the master timeline spec through to the client-approved
final composition. Chronological; each round is the client's direction
followed by what was implemented and verified.

---

## Round 0 — Initial build from the master timeline spec

**Brief:** A client-provided master animation timeline document specified a
four-act, 35-second cinematic particle scene (Awakening → Construction →
Stillness → Return), looping forever, built around a reference image of a
lime-green suspension bridge. The existing codebase's scene did not match:
composition was wrong (bridge read as a flat horizontal band, near-zero
perspective between the two towers), and the timeline was still the old
12.4s/42s design.

**Done:**
- Read `claradix_creative_pack/` docs, `src/lib/config.ts`, `centreline.ts`,
  `bridgeTargets.ts`, `particles.ts`, `BridgeScene.ts` to understand the
  existing architecture (position as a pure function of scene time; no
  per-frame integration, which is what makes `seek()` and the capture
  tooling work at all).
- Diagnosed the composition gap with a custom offline camera solver
  (`scripts/_camsolve.mjs`) that projects bridge anchors to screen
  coordinates for any candidate camera, so composition could be matched to
  the reference numerically rather than by eyeballing.
- Re-authored the centreline, camera, and cable sag (`sagRatio` deepened to
  0.225 — realistic ratios rendered every hanger the same length, a "picket
  fence") to match the reference frame.
- Rebuilt the timeline in `config.ts`: `TIMELINE`, `LIFT`, `ASSEMBLY`,
  `LOOP`, derived `CYCLE_LENGTH` — all re-timed to the 35s four-act spec.
- Added side-span cables and hangers to `bridgeTargets.ts` (the reference
  image showed tower-top-to-deck-level anchorage cables the old geometry
  didn't have).
- Added Act III "structural node" sparkles (tower peaks, cable saddles,
  mid-span crown) packed into a spare attribute slot (the shader has a hard
  14-attribute limit).
- Added Act IV spiral return choreography and a new `groundStreams.ts`
  element for the reference image's flowing foreground light-currents.
- Fixed `ticker.ts` phase-at-time wrapping for loop mode.
- Verified with `scripts/loop-check.mjs` (cycle repeats pixel-identical),
  `palette-check.mjs`, `viewport-check.mjs` (re-based targets to the new
  composition, documented why in each script's header), full suite green.
- Saved project memory (composition numbers, verification workflow,
  timeline mapping) to the persistent memory system.

---

## Round 1 — The orb choreography (major rewrite)

**Client feedback (verbatim intent):** The particle-to-bridge mechanism was
wrong. Particles should not rise from the bridge's own footprint and fly
straight to their position; they should:
1. Rise from the **entire visible landscape**, not just the valley/bridge
   corridor.
2. Converge into **one luminous sphere ("orb")** in the sky.
3. The orb should **spiral** — never a straight line — gliding behind the
   text column and behind the mountains before arriving.
4. The orb then builds the bridge by sweeping along it.
5. In reverse (the loop's return act), the bridge should be drawn into a
   black-hole-like second orb, then **detonate**, throwing every particle
   back across the **whole landscape** to its original resting point — not
   just back into the valley.

**Done — full choreography rewrite:**
- New `SEED` scheme in `config.ts`: seeds scatter across the entire world
  area, accepted only if inside the camera's frustum (with margin) —
  replacing the old "seed near your own target" scheme.
- New `ORB` config block: radius, comet-tail lag, spin, a `rise` schedule
  (join window, flight duration, arc height), a baked `tour` (waypoints from
  formation point → behind text → across valley → behind mountains → arrival
  at the far span), a `build` hover/helix spec for the construction sweep,
  and Act IV's `orb2Path` (black hole climb) + `boom` (detonation) specs.
- `particles.ts`: added `buildOrbPathTexture()` — the orb's entire itinerary
  (gathering tour + construction sweep in row 0, black-hole climb in row 1)
  baked into a 256×2 float texture the vertex shader samples by time, same
  technique as the centreline frame texture. Added terrain-clearance logic
  so the orb never visibly clips through a hillside (except a deliberate
  "dive" window where it is meant to pass behind the mountain ridge).
- Shader rewrite: rise (ballistic arc from seed toward the orb's future
  position), ride (comet head sampled with per-particle lag = the tail),
  swirl (fixed radial offset circling in a fixed random plane = the orb's
  volume), deposit (short peel from orb to bridge target), suction (Act IV:
  particle torn from structure into the hovering black hole), and burst
  (parabolic throw from the black hole back to the original seed).
- Verified via `scripts/_probe.mjs` (a capture harness built for this
  session — seeks to arbitrary times, screenshots, optional trail-disable
  for judging particle shape without SwiftShader's exaggerated smear) across
  every choreography beat: formation, tour, dive-behind-mountains,
  construction sweep, suction, detonation, loop seam.
- Several density/visual iterations: the outbound and return rivers needed
  a per-particle radial "braid" spread (quadratic in the random) or every
  rider rendered as one solid white pipe instead of a broad current.

---

## Round 2 — Sky: aurora and shooting stars

**Client feedback:** The sky looked cold and plain. Requested aurora
("kutup ışıkları") and occasional shooting stars.

**Done:**
- Added `SKY.aurora` and `SKY.meteors` config, implemented directly in
  `sky.ts`'s fragment shader (the sky is one full-screen triangle
  reconstructing its own view ray, no geometry).
- First aurora pass was a diffuse curtain wash — client called it "too
  scattered, too flat," wanted a zigzag serpentine ribbon, smaller, more
  vivid, more alive. Rewrote as a single narrow band whose elevation is a
  zigzagging function of azimuth, with a crisp lower edge and soft upward
  rays, wall-clock animated so it visibly breathes and flickers.
- Shooting stars: rare, on the **scene clock** (not wall clock) so the loop
  stays pixel-identical — two hash-gated opportunity windows per cycle.

---

## Round 3 — Terrain: the "floating world" bug

**Client feedback:** From certain angles the ground appeared to end abruptly
in front of the camera, exposing dark-blue void underneath — "the ground
looks like it's floating."

**Done:** Extended `WORLD.bounds` (maxZ pushed from 400 to past the camera)
so the terrain sheet always runs under and past the viewer regardless of
camera angle; added a foreground press/cap so raw noise near the lens
doesn't stand up as an occluding hill.

---

## Round 4 — Terrain naturalism, then camera round trip

**Client feedback (round 4a):** Bridge felt too far away; wanted a closer,
more standing-on-it perspective. Also: the terrain right under the bridge
looked visibly *carved out* (a trench) — wanted the mountain to keep its
natural shape, with the bridge's foundations landing on the terrain as it
already is — some piers tall (over hollows), some short (on knolls).

**Done (4a):** Replaced the perpendicular "canyon" carve with a much softer,
wider, partial "saddle" relaxation (`TERRAIN.clearance`) that only trims
ground that would otherwise poke through the deck — natural relief
elsewhere, pier lengths genuinely following the terrain instead of a
manufactured trench.

**Client feedback (round 4b):** Provided a reference image of a bridge shot
from ON the bridge itself, first-person, with the road/light-path and the
bridge as one continuous element. Directed a full re-composition to match:
camera hovering just off the road, ramp entering from a bottom corner, main
tower dominating center-right, far end visible but not overly distant.

**Done (4b):** Re-solved the entire centreline + camera + orb tour + ground
streams to the "luminous highway" first-person composition using
`_camsolve.mjs` iteratively. This was then **mirrored left↔right three
times** across follow-up messages as the client iterated on which side the
bridge should start/end on, each time re-solving centreline, camera,
portrait fallback, framing ridges, orb tour, ground-stream paths, and
black-hole/boom points together (they're coupled — changing one without the
others breaks the composition).

---

## Round 5 — Deck traffic bound to the bridge

**Client feedback:** The flowing ground-particle streams represented data,
but behaved like free-floating currents unrelated to the bridge — client
wanted them to visibly ride the bridge itself (the bridge "holds them up"),
and in the reverse/dissolve act, particles over a section that has just been
disassembled should **fall physically** onto the ground exactly beneath
where that section stood, not float or teleport.

**Done:** Fully rewrote `groundStreams.ts` as deck traffic: four lanes
riding the centreline itself, existing only where deck has been built
(driven by the same seat schedule the structural particles use), and during
Act IV a per-packet analytic fixed-point solve determines the exact instant
the dissolution front reaches that packet's position — at that instant it
free-falls (real parabolic drop, closed-form) onto the ground height baked
directly beneath the centreline, with a small impact flash before
guttering out. Two clocks used correctly: lane progress on the unwrapped
elapsed clock (endless current), existence/falls/fade on the wrapped scene
clock (matches the bridge's own schedule and the loop seam).

**Follow-up bug (client caught this):** Packets falling into a hollow
*behind* a hill were correctly hidden in the main render pass, but their
motion trail (a separate half-resolution accumulator pass, particles-only,
built for the "streaking light" look) had no depth information about the
terrain — so the falling light's smear glowed straight through the ridge
that should have hidden it. Fixed by adding the terrain to the trail pass
as a depth-only occluder (writes depth, not color, toggled via
`onBeforeRender`/`onAfterRender` — writing color would have summed the
terrain's own brightness into the trail accumulator 8× at its decay rate).

---

## Round 6 — Detail pass (three items in one message)

1. **Left side of frame too empty** — added three layered mountain
   silhouettes at different fog depths on the frame's left flank.
2. **Hover interaction only affected the roadway** — the cursor's world
   position used to resolve only onto the centreline (the road). Rewrote it
   to treat the bridge as a vertical curtain: the candidate point takes the
   ray's own height clamped to the structure's vertical extent at that
   point along the span (tower height, cable rise), so hovering a tower,
   cable, or pylon scatters exactly that part.
3. **"BUILDING" placeholder text** — wired the countdown to the real launch
   date 2026-08-28 15:30 (Baku time), replacing the indefinite build-status
   fallback.

---

## Round 7 — UI polish (three items)

1. **"In development" eyebrow** replaced with a plain "Coming soon" in a
   gradient/glow treatment, dropped the pip-dot and rule-line ornaments
   per direction.
2. **Countdown dial** redesigned from a plain ring into an instrument look:
   fine tick marks, a glowing sweep arc, a hairline cross between the four
   digit readouts, and the launch date printed along the bottom of the dial.
3. **Reveal-timing bug**: on first load the text used to appear suddenly
   fully-formed, then (on certain remounts / hidden-tab returns) pop back to
   hidden and replay — an incoherent double-reveal. Root-caused to two
   separate mechanisms: the ticker's hidden-tab "jump to finished" logic
   firing even in non-loop mode, and the reveal hook not accounting for a
   remount happening *after* the reveal condition was already true. Added a
   module-level `instantReveal` flag and an `enter--settled` CSS state so a
   remount on an already-revealed page renders settled instantly with no
   replay, and disabled the hidden-tab jump when the loop is off.

---

## Round 8 — Mobile responsiveness

**Client feedback:** Page spilled off the screen on mobile ("çok saçma
gözüküyor... ekranımdan dışarı taşıyor").

**Done:** The desktop layout was a sealed exactly-one-viewport frame
(`height: 100dvh; overflow: hidden`) with the countdown dial hidden below
1080px — on a short phone viewport, content that didn't fit was silently
clipped with no way to scroll to it. Below 1080px the seal now opens
(`height: auto; min-height: 100dvh`, `body { overflow-y: auto }`), and the
countdown dial returns, centered under the content, at a smaller scale.
Verified against multiple real mobile viewport heights via a headless probe
that reports document scroll dimensions and overflowing elements.

---

## Round 9 — Assistant's own suggestions (asked directly)

When asked "what would you suggest," proposed six ideas ranked by value:
1. A "mini-orb" reward animation rising from the subscribe form on submit,
   joining the bridge — ties the visitor's own action into the scene's
   narrative.
2. An optional, muted ambient sound layer (off by default).
3. Render the deterministic 35s loop to video for a launch teaser /
   social-media asset, and regenerate the OG image from the new scene.
4. AZ/EN bilingual copy (the `copy.ts` structure already supports it
   cleanly).
5. Device-tilt parallax on mobile (config scaffolding already exists,
   permission flow not wired up).
6. A small easter egg (e.g., repeated logo clicks triggering something).

---

## Round 10 — Final tuning pass (four items in one message)

1. **Orb formation location + build speed** — client wanted the orb to form
   **outside the camera's field of view** (not visibly assembling on
   screen) and the construction sweep **20% faster**. Moved the tour's
   formation waypoint off-frame; cut `ASSEMBLY.windowSpan` and shifted
   `phase4_completionStart`/`phase5_livingStart` accordingly (all derived
   constants, e.g. `REWIND_START`, `CYCLE_LENGTH`, followed automatically).
2. **Loop default OFF, but fully reversible** — the whole Act IV
   (black-hole/detonation/return), the completion-pulse repeat schedule, the
   node-sparkle end-gate, and the deck-traffic fall/fade logic were made to
   derive from the single `SCENE.loop` boolean (default `false` now) so
   flipping it back to `true` restores the entire original cycle with
   nothing else to touch — verified by the existing `loop-check.mjs`, which
   exercises the toggle at runtime.
   - A follow-up correction: with loop off, the scene clock now starts
     **past** the gathering act entirely (`INTRO_START`), so the page opens
     directly on the already-formed orb gliding in — no on-screen ground
     collection is visible on first load, matching the "start directly with
     the orb in the sky, default false" clarification.
3. **Completion pulse recurring** — the single "fires once" sparkle-wave
   was rewritten as a pure function of the clock (`% repeatEvery`, no
   fired-flag) so it repeats every 10 seconds while the bridge stands
   complete, stays exactly seekable, and correctly gates off during the
   Act IV dissolve when loop is on.
4. **Text reveal timing** — widened the stagger offsets between UI elements
   (logo → eyebrow → headline lines → lead → form → socials → dial →
   footer) so each is visibly seen arriving rather than all appearing to
   land in one clump after a long wait.
   - Follow-up (meteors): frequency doubled, added per-meteor random scale
     (0.65×–1.3×) so the sky's meteor shower doesn't repeat identically.
   - Follow-up (interaction): client reported "glitchy" distortions,
     worst at bridge center. Root cause: near mid-span the cursor's
     resolved point on the bridge curtain is nearly parallel to the view
     ray, so tiny mouse movements were teleporting the influence point
     hundreds of world units — reads as the bridge "glitching." Fixed by
     smoothing the resolved cursor position with a short time constant
     (~80ms) instead of snapping every frame, plus tightening the
     influence radius (90 → 62) and max displacement (30 → 20) so a single
     hover no longer visibly disturbs the whole cross-section at once.

---

## Round 11 — Text fade-in still read as sudden

**Client feedback:** After the wait, all the text still seemed to "pop" in
at once rather than fading, despite the widened stagger.

**Root cause (found by tracing computed opacity over time, not just looking
at screenshots):** Two independent CSS bugs stacked on top of each other.
- `.enter`'s animation used `animation-fill-mode: forwards` alone. Without
  *backwards* fill, every element sat at its **natural opacity (1)** during
  its own stagger delay — so the instant the "waiting" class was removed,
  all twelve elements appeared fully visible simultaneously, and only then,
  one by one as their delays elapsed, snapped back to 0 and restarted their
  own animation. The real staggered choreography was running, but on top of
  a page that had already fully appeared.
- Opacity was riding inside the same keyframe as the position/motion
  animation, sharing the `--ease-out` expo curve
  (`cubic-bezier(0.16, 1, 0.3, 1)`), which reaches ~90% of its value in the
  first fifth of its duration — so almost the entire 950ms "fade" was
  already fully opaque; lengthening the duration could never have fixed
  this, since the curve shape was the actual problem.

**Fix:** Split into two independent keyframes — `rise` (transform only,
keeps the expo ease for a poised settle) and `fadeIn` (opacity only, linear)
— combined via `animation-fill-mode: both`. Verified empirically by
sampling `getComputedStyle(el).opacity` for six representative elements
every 250ms through the reveal sequence and confirming a genuine 0→1 ramp
staggered across ~3.75 seconds, not a step function. This also surfaced a
palette-check flake (the countdown dial sits inside the measured "world"
region and was sometimes captured mid-fade); fixed by having the check wait
for every `[data-reveal]` element's opacity to settle before sampling
pixels.

---

## Verification discipline used throughout

- `npx tsc --noEmit` after every source edit.
- `scripts/_probe.mjs` (session-built) — seeks to arbitrary scene times and
  screenshots, with an env flag to disable motion trails so particle shape
  can be judged without SwiftShader's exaggerated multi-second smear.
- `scripts/_camsolve.mjs` (session-built) — offline camera/composition
  solver; every centreline/camera/orb-tour change was verified numerically
  against screen-space targets before being written into `config.ts`.
- `scripts/verify.mjs` — the full acceptance suite (hygiene, palette,
  viewport, interact, reveal, loop, perf), run to green before considering
  any round finished.
- `npm run build` — full production build (typecheck + Vite build + SSR
  prerender) run at the end of each major round.
- Persistent project memory updated after each major round at
  `C:\Users\PC\.claude\projects\c--Users-PC-Desktop-Code-claradix-coming-soon\memory\`
  so future sessions inherit the composition numbers, the choreography
  design, and the verification workflow without re-deriving them.

---

*This file is a narrative reconstruction of the working session, written
from the assistant's conversation context — not a raw transcript export.
Exact code diffs live in the project's own git history / working tree at
`claradix-coming-soon`; this document exists to preserve the conversational
reasoning and client-direction history alongside the finished project.*

---

## Round: the reference-image exact match (2026-08-03)

The client sent the bridge-scene reference image back with six directives,
three of them triple-emphasized as "EXACTLY like the image":

1. Bridge brightness down to the reference's level (ours was neon-blown).
2. No orb wandering at page open — orb already at the bridge tip, building
   immediately; wandering only when the loop is enabled.
3. Email form replaced by a WhatsApp button (same footprint) →
   wa.me/994515760410 with a prefilled Azerbaijani message.
4. The bridge's near end must end AT the viewer, centred on screen.
5. Terrain in dark-green/black tones, near-black like the image.
6. Sky with near and far clouds, green glows between them, visible stars.

What it took:

- **Camera on the road**: `[145,86,880] → [247,55,-215]`, solved with
  `_camsolve.mjs` so the ramp rises from bottom-centre (0.523, 0.882),
  main tower right-of-centre (0.599, top 0.209), horizon at 0.465.
- **Fallout of standing on the road**: the deck/traffic underfoot flooded
  the frame bottom additively. Near fades in both vertex shaders
  (`smoothstep(60,300)` particles, `smoothstep(70,360)` streams, smaller
  point clamps) plus a mid attenuation `mix(0.55,1,smoothstep(280,680))`
  killed first the yellow-white furnace, then the saturated yellow slab
  where four lanes and the deck stack in one screen column.
- **The green blanket had three layers**: lighting cuts, then the mist
  (opacity 0.62→0.3, ceiling 58→38), and finally the real culprit — the
  terrain rim light. At grazing incidence the fresnel term lit the entire
  flat plain; masking it by slope (`rim *= pow(1-|n.y|, 0.9)`) turned flat
  ground near-black while keeping every ridgeline. That single line is
  what made the terrain match the image.
- **Sky**: aurora+nebula replaced by an fbm cloudscape — dark sculptural
  bodies that occlude stars, glowing green cores and threshold rims;
  stars count up, meteors dimmed behind cloud.
- **Intro**: `INTRO_START = SCENE.loop ? 0 : ASSEMBLY.windowStart - 0.25`
  — with the loop off the page opens at scene ~7.15, the orb already at
  the far abutment laying deck.
- **WhatsApp CTA**: new `WhatsAppCta.tsx` in the old form's footprint,
  reveal id unchanged so the entrance order test still passes.

A hard lesson repeated: one round of edits had gone to the stale copy at
`Code\claradix-coming-soon`, and later a dev server that answered on the
expected port was serving that stale tree — captures looked "unchanged"
because they were of unchanged code. The fix is procedural now: after
starting any server, fetch a source file over HTTP and grep for the edit
you just made before trusting a single screenshot. Canonical path:
`Code\1-Finish\claradix-coming-soon`, dev server on 5203, ports 5196–5199
left free for the check suite's own servers.

Round closed green: palette targets re-based to the dark composition
(dormant ~67% near-black, accent arc 0→13%), `verify.mjs` 7/7 PASS,
`npm run build` clean, memory updated.

---

## Round 2 of the reference match (2026-08-03, same day)

The client came back with five sharpened complaints: the bridge is WIDER
in the image; the neon is still too hot; the far mountains had gone
invisible while the near ground was right; the clouds must read as WHITE
masses backlit by green light (lit parts green-white, unlit parts dark
but with their form still legible) with the stars in dense fields, some
brighter than others; and the image holds MANY mountains, not one.

What changed:

- **Width**: deckWidth 46 → 74, tower legs re-spaced into true portals
  (80/78 — wider than the deck they let through), cables at ±35, beefier
  piers, and six traffic lanes instead of four. Widening also solved half
  the brightness complaint for free: the same particle budget spread over
  1.6× the width is dimmer per pixel.
- **Brightness**: seated particles 0.62 → 0.5 and the whole bloom curve
  pulled down (completion 0.78 → 0.62, living 0.55 → 0.42). The structure
  now reads as drawn line-work with white heat only at the saddles.
- **Sky**: the cloud shader rebuilt around a BACKLIT model — a shadowed
  textured body (form never collapses to black), a green-white backlit
  term where a low-frequency light field stands behind the mass, green
  haze in the gaps, and light-gated rims. The same glowField leaks out of
  the cloud block to light everything below it.
- **Mountains**: a third, tall painted range added behind the two low
  ones, its height enveloped by azimuth (crowds the right flank and far
  left, stays low over the bridge); every range catches the glow on its
  crest and dies downslope. The real terrain got a directional
  distance-lift on its rim light: far slopes facing the glow bank glint
  green, the flanks turned away stay shadow — one mountain, both
  treatments.
- **Stars**: clustered by a large-scale noise into drifts and pools, with
  a rare bright few (capped after twinkle, still under the bloom
  threshold — the sky must never bloom).

One syntax lesson: a backtick inside a GLSL comment terminates the
enclosing TypeScript template literal. esbuild's error points at a
comment line and looks impossible until you see it.

Closed green again: palette re-based (the gap glow lifted the deep band
~6 points everywhere), verify.mjs 7/7 PASS, production build clean.

---

## Round 3: the volumetric nebula (2026-08-03)

The client replaced the cloud brief entirely with a film-quality spec: a
volumetric deep-space plasma formation — layered translucent sheets,
torn membranes and filaments instead of cloud outlines, no visible
procedural patterning, internal emission leaking through fractures (no
rims, no neon edges), a strict green ramp (black → emerald → forest →
toxic → lime → yellow-green cores only), glacial breathing movement, and
a center-open composition that frames the bridge instead of covering it.

Implementation, all in the sky fragment shader:

- **Double domain warp** — every field reads through two nested fbm
  warps (q, then r), which is what kills the Perlin look and folds the
  density into membranes and filaments.
- **Two stacked sheets** — a coarse back layer seen through the torn
  thin regions of a finer front layer; a third high-frequency micro
  field multiplies into every threshold so silhouettes dissolve into
  smaller and smaller tears instead of ending in an outline.
- **Internal energy** — a slow plasma field emits only through
  mid-density membranes (thick cores occlude their own light) and
  through ridged fracture veins raised to the sixth power; a
  back-sheet-through-gaps term makes depth visible as light.
- **The ramp** — five constants from deep emerald to a yellow-green
  core, the core capped under the bloom threshold: the sky still never
  blooms, brightness stays rare and precious.
- **Framing** — an aspect-corrected center-open mask keeps negative
  space over the bridge; formations wrap the frame's edges and corners.
- **Movement** — driftSpeed cut to 0.0015 with three counter-migrating
  tempos: the formation breathes rather than drifts.

Tuning took three capture rounds: the first pass was nearly invisible
(thresholds and framing all too strict — a lesson in fbm value ranges:
four octaves at 0.54 amplitude centre on ~0.5 with most mass between
0.25 and 0.75, so smoothstep windows must straddle that band).

Closed green: palette re-based again (the nebula's lit membranes sit in
the accent band, giving every act a ~3.5-point sky floor; the dormant
row — nearly all sky — needed a wider tolerance against wall-clock
drift), verify.mjs 7/7 PASS, production build clean.

---

## Round 4: the ribbon deck and the nebula, second pass (2026-08-03)

Two directives: keep the roadway at ~74 units wide but cut the deck's
VERTICAL thickness by 70-80% — a paper-thin ribbon of light, elegance
through eliminated mass, not a narrower road; and the nebula still short
of the brief.

- **Deck**: deckThickness 3.2 → 0.8, camber 1.4 → 0.5, the deck reduced
  to a top surface only (nothing generated beneath), railing pulled to
  hug the surface. Width and the six-lane weave untouched. Verified in
  capture: a wide, near-zero-thickness ribbon with a bright leading edge.
- **Nebula**: the failure mode was BROAD MILKY WASHES — backlit-smoke
  reading instead of plasma. Emission rebalanced: membrane light made
  subordinate to the ridged fracture VEINS (concentrated cracks of
  light), a micro-field multiply breaks any remaining wash into
  filament-scale structure, the energy field made rarer and stronger,
  occlusion deepened, and the framing mask now boosts the far corners so
  formations visibly wrap the frame while the centre stays negative
  space over the bridge.

A verification lesson recorded for the future: while files are being
saved concurrently (a second working session was reworking terrain,
particles and streams in parallel), every dev-served capture — probe and
check-suite alike — can catch an HMR remount mid-intro-fade and come out
uniformly dim, and palette rows go absurd. Dim + "no page problems"
during concurrent editing means RETAKE, not regression. Palette targets
are pending a re-base from a quiet tree after the parallel rework lands.

---

## Round 5: the build reversed, and Pass 1 of the bridge refinement (2026-08-03)

Two directives landed together: the construction must run FROM the camera
TOWARD the mountains, and a full architectural refinement brief ("Pass 1")
for the bridge as an object — same bridge, same framing, more elegance.

**The reversal.** Position-as-pure-function pays off again: the build
direction lived in four linear formulas, and reversing the entire
choreography was four sign flips — seatAtFor, the orb's build leg, the
deck-traffic existence gate, and the ground glow's schedule. The Act IV
rewind was flipped the OPPOSITE way (mountains → viewer) to preserve the
design invariant that the two fronts never travel the same direction.
A nice accident of geometry: at the build's first instant the orb stands
just behind the camera plane, so on the page the construction front
visibly ignites at the bottom edge of the frame and races away — the
"starts at the viewer" beat, delivered by the coordinates themselves.

One real defect surfaced: with the near-end start, the boarding flights
(every particle arcing cross-country to join the orb) converged THROUGH
the camera and blanketed the frame at page open. In no-loop mode those
flights now fly dark — a particle first appears inside the comet's own
glow, and the orb reads as printing the bridge out of itself.

**Pass 1.** The round-4 rework had already delivered most of the brief
(paper-thin fiber-ribbon deck, 1.6u tower strokes, hairline hangers at
spacing 7, thread piers). On top of it: hanger spacing 7 → 6 with two
budget points moved from the slimmed towers (a denser curtain must not
cost each thread its continuity), fiber line cap 22 → 18 and near-bias
1.75 → 2.0 (the directive prefers one continuous gesture over lane
count — fewer, denser lines close into unbroken light).

Deferred, recorded in memory: the full check-suite re-run, palette
re-base and production build wait for a QUIET tree — concurrent saves
from the parallel working session kept catching captures mid-HMR-remount
all afternoon.

---

## Round 6: the camera correction (2026-08-03)

The client sent an annotated composition sheet: the bridge occupied only
the central 40% of the frame while the reference fills nearly the full
width — and the fix must be camera language (position, lens, framing,
perspective), never scale. Numeric targets: road from the bottom edge,
lower 50-60% of the frame, FOV 28-35, camera very low and further back,
strong leading lines, an S-curve pulling the eye to the towers.

Solved numerically in _camsolve.mjs, geometry untouched:

- **Camera** [140, 62, 980] → [440, 52, -240], fov 35 (portrait 58).
  The eye hovers 26 units above the road's own starting point, just
  behind u=0 — so the roadway projects to y=1.14, BELOW the frame,
  erupting from the bottom edge, and its 74-unit width overfills both
  bottom corners. Edge-to-edge coverage at the bottom came free from
  proximity, exactly as the sheet demanded ("perspective, not scale").
- The S-curve now reads as drawn: bottom edge → left swing to x 0.28 →
  sweep right through the main tower at 0.45 (top at 0.13, monumental)
  → deck exit at (0.73, 0.49) against a 0.487 horizon.
- The near/mid brightness fades — tuned for three earlier cameras —
  would have blacked out the new foreground: re-ranged in all three
  road systems (particles, bridgeFibers, groundStreams) so the leading
  lines burn where the directive wants them.

One solve detail worth keeping: with the old camera the road START sat
110u ahead of the lens, which is precisely why the foreground felt
empty — no roadway existed under the viewer. Moving the camera to
within 35u of u=0 (not merely lower) is what put the viewer ON the
highway.

---

## Round 7: the surface reconstruction (2026-08-03)

The client identified a structural fault in the visual language: the
bridge consisted of a visible deck (continuous filament lanes) with
particle streams travelling ON TOP of it — vehicles on a road. The
reference has no road: the particles ARE the road. "Think of it as a
particle simulation that accidentally becomes a bridge."

What changed:

- **The static roadway died.** bridgeFibers lost its deck weave and its
  railing hairlines; filaments now draw only STRUCTURE — the cable
  drapes, the tower cores, the hanger curtain.
- **The river was born.** groundStreams is the roadway now: packet
  counts ×2.5, lanes abolished in favour of a continuous triangular
  lateral distribution (densest at the centreline, thinning linearly),
  a slow per-packet lateral wander so streams visibly merge, separate
  and reconnect, a ±0.9u depth spread (volume without thickness), and
  edges that dissolve past 60% of the half-width instead of ending.
  Brightness comes from concentration — where the flow piles up, the
  road burns; where it thins, the road fades.
- **The seated deck became sediment.** The orb now deposits a
  center-weighted dust field with vertical spread — suspended luminous
  grains inside the flow, not a platform under it. The railing budget
  turned into soft dissolving margins.
- The existence gate survives untouched, so during the build the river
  literally weaves itself into existence behind the advancing orb — and
  stopping the flow would erase the road, which is now true in the code,
  not just in the metaphor.

---

## Round 8: the correct visual language (2026-08-03)

The client sent an annotated philosophy sheet with three corrections and
one principle: "at no point is a visible surface created first — the
surface exists only because particles are flowing."

1. **Supports must be realistic.** The towers, piers, cables and hangers
   no longer contain a single particle. Their entire budgets went to the
   roadway; the structure is drawn exclusively by bridgeFibers as clean,
   thin, architectural geometry — including new slender pier verticals.
   The intended contrast is now structural: towers are architecture,
   the roadway is energy.
2. **No surface at the start.** Already delivered by round 7's river;
   the remaining static residue (dust snap-flashes sweeping in a front)
   was removed for no-loop mode: each grain now fades up slowly from its
   own seat time. Nothing ever plates over.
3. **The build animation reversed philosophically.** No front, no comet
   laying a deck. With the loop off: a few pioneer packets begin flowing
   the invisible spline right at the window's start, more trajectories
   join by the second (per-hash staging across the whole window), the
   path becomes visible purely because density increases, and only after
   the roadway is recognizable do the cables and towers illuminate —
   subtly, globally, staggered by layer. The orb and its deposit spray
   are now invisible outside loop mode; the full gathering choreography
   remains intact behind the SCENE.loop flag.

Captures confirm the sequence: at T+9 there is only a river of light
discovering its path through empty terrain — no structure, no orb, no
front; at completion the slender architecture stands lit above a roadway
that is nothing but flow.

---

## Round 8 reverted (2026-08-03)

The client rejected the visual-language redesign outright ("undo the
last change, I did not like it at all"). Everything from round 8 was
rolled back precisely to the round-7 state:

- targetDistribution restored — towers, piers, cables and hangers are
  particle-bodied again (deck .38 / hangers .12 / cables .18 / towers
  .17 / piers .07 / railing .08);
- the pier filament verticals removed; filament weights back to their
  round-7 values;
- the construction FRONT restored in both the filaments and the river
  (existence gated by u again, near to far);
- the dust snap-seating and the visible orb comet restored for the
  no-loop build (only round 5's boarding-flight hiding remains).

Verified by capture: the round-7 composition is back — particle-bodied
structure over the flowing river roadway, front-swept build. Recorded in
memory that round 8 must not be re-applied without a fresh explicit ask.

---

## Round 7 reverted too (2026-08-03)

After seeing round 8 rolled back to round 7, the client rejected round 7
as well ("this is not good either — make it like it was before this
one"). The surface-reconstruction experiment is fully removed:

- groundStreams back to SIX LANES with tight jitter, original packet
  counts, ride height +2 over the deck — no wander, no triangular
  distribution, no dissolving edges;
- bridgeFibers roadway weave and crisp railing filaments restored;
- bridgeTargets fiber rows (snapped to the filament lattice) and the
  crisp railing particle line restored.

The shipped roadway is the pass-2 WOVEN RIBBON: continuous parallel
filament lanes with particle micro-detail living in them and discrete
packet traffic riding them. Both round 7 and round 8 are recorded in
memory as rejected directions never to be re-applied without a fresh
explicit request.

---

## Round 9: honest supports (2026-08-03)

The client asked why the bridge stood on two different kinds of columns
- thin double lines AND blocky particle masses. The answer was that two
systems drew supports: particle piers (fat scatter cylinders every 78u)
and the tower legs (filament hairlines + a merged particle pylon shaft).

Resolution, per the client's direction:

- The pier columns are GONE — budget zeroed with a guard against the
  one-particle-per-pier floor. Nothing stands under the approaches.
- The bridge's only supports are the TOWERS' OWN LEGS, made realistic:
  each leg is now three parallel filaments (a solid luminous column with
  actual width instead of a hairline) running unbroken from the ground
  to past the cable saddle, and the below-deck particle pylon follows
  the two legs at ±legSpacing/2 instead of pooling into a central blob.

Verified by capture: under the deck only the towers' slim leg pairs
reach the ground, matching the reference's clean architectural pylons.

---

## Round 10: the towers become real columns (2026-08-03)

The client sent a close-up reference of the tower and asked for the same
realism. Read from the image: a leg is a SOLID tapering column expressed
through its edges — two bright converging outlines with a soft luminous
fill between them — not a bundle of hairlines.

Implemented in both bodies at once: the filament legs became two bright
tapered edge lines (half-width 3.6 at the ground, 1.9 at the top) with a
dim core line between; the particle legs became the glowing FILL inside
those edges, tapering with them and given along-span depth; the pylon
continuation below the deck fills the same width; and the portal braces
became box sections drawn by their top and bottom edges. Verified by
capture: solid luminous masts with engineering taper, matching the
close-up reference.

---

## Round 11: the architecture redesign (2026-08-04)

The client came back with a complete structural philosophy — notably
re-embracing, in their own detailed words, the direction rejected in
rounds 7-8, but with one decisive difference: the towers must be REAL.

The bridge is now a three-tier hierarchy:

1. **Real objects** — only the two tower pairs. A new towerStructures.ts
   renders them as opaque, depth-writing meshes: tapered box-section legs
   rising from the terrain past the cable saddles, tied by box portal
   beams, in a custom material that keeps the scene's grammar (near-black
   body, saturated green fresnel rim concentrating toward the saddle, the
   terrain's own fog law). They grow out of the ground when the
   construction front reaches them and shrink back during the rewind —
   pure functions of the clock, like everything else.
2. **Semi-physical** — the suspension. The particle system now generates
   ONLY the cable drapes (tightened to a 0.12 scatter — threads of
   aligned points) and the hanger curtain. The budget under-spends
   nominal deliberately; the population shrank to what the suspension
   needs.
3. **Pure energy** — the roadway does not exist. bridgeFibers.ts was
   deleted outright; the road is the flowing river of packets alone:
   lanes abolished for a triangular distribution with slow per-packet
   wander, wide speed variance, depth inside the flow, dissolving edges,
   and a density arc that is born sparse at the viewer, peaks at the
   towers and dissolves into the mountains past the far tower — no hard
   endpoint, per the brief.

Verified by capture: solid dark masts with green edge light anchoring a
suspension of delicate particle curves over a roadway that is nothing
but flow.

---

## Round 12: the tower blueprint (2026-08-04)

The client sent an engineering sheet — "Bridge Main Towers Design
Breakdown" — with front/side/top views, cross-sections, a foundation
detail and four close-ups, and asked for faithful recreation, not
reinterpretation. Decisions extracted from it and rebuilt into
towerStructures.ts:

- Legs are DEEPER than wide (blueprint cross-section 6.5 × 12 m at 120 m
  height), the depth halving toward the top; both extents taper through
  a two-segment loft so the mast eases rather than cones.
- The portal CONVERGES toward the top (24 → 18 m in the sheet). Ours
  runs 80 → 70 — chosen so the leg centres land exactly on the
  main-cable line at ±35: the cable rides its saddle and the anchorage
  reads as genuine load transfer.
- No sharp box corners anywhere: every member is a chamfered prism, and
  a per-vertex aEdge attribute puts the green light ONLY on the bevel
  facets — the sheet's "glowing accents on edges and key lines", never
  a full outline. (The first attempt scaled edge light by camera-facing
  and turned the crossbeam into a glowing billboard; the fix was a
  whisper-level seam tag and a darker body everywhere.)
- ONE massive structural crossbeam with the close-up's arched underside
  (an extruded shape), plus a slab-level deck tie derived from deckY.
- A widened foundation pedestal continues below the terrain — most of
  the tower exists underground, the landscape wraps it.
- Cable-saddle caps sit slightly proud at the top as the brightest
  pieces, where the particles' energy would naturally accumulate.

Verified by capture: dark monumental masts with seam-light accents,
believable saddle-to-cable anchorage, one arched beam, buried feet.

---

## Round 13: the art-direction revision (2026-08-04)

Three mandatory changes, delivered together:

1. **The orb is gone — from the code, not just the screen.** The
   particle choreography no longer contains a join, a ride or a deposit:
   each particle lifts off its own patch of ground a few seconds before
   its seat time and SPIRALS directly into its place in the structure —
   a bézier lifted along the terrain normal, wound with a helix whose
   radius is zero at both ends, so a flight begins as a lift-off and
   ends as construction with no intermediate shape ever existing.
   Thousands of these staggered by the seating schedule read exactly as
   briefed: the entire world deciding to build the bridge. (A stale
   reference to the removed rising-state in the cursor-avoidance block
   briefly killed the whole particle draw with a shader VALIDATE
   failure — cleaned.)
2. **The towers joined the environment.** Same geometry, new language:
   glow vector cut to a saturated cool green, fresnel and seam lights
   halved, face glow whispered. The masts now read as dark silhouettes
   the landscape produced, legible only through edge light.
3. **The bridge became a journey.** The centreline gained a seventh
   point at each concern: the near end now starts BEHIND the camera, so
   the roadway passes beneath the viewer and out of the bottom of the
   frame; the far end runs 340 units past the old exit while sinking,
   so it drops into the fog behind the mountain silhouettes with no
   visible endpoint. Interior anchors kept their world positions; only
   the arc-length normalisation moved (towers at u .457/.683, arc 2280).

Captures confirm all three: a build with no orb anywhere, towers that
belong to the world, and a road that arrives from behind you and leaves
for somewhere you cannot see.

---

## Round 14: the landscape deck and the graphite towers (2026-08-04)

Two refinements to reach the reference's quality bar, no redesign:

**The deck became a landscape.** The particle river gained a width field:
underfoot it fans to ~2.6× the span width — monumental, wide enough to
stand on, spilling across the valley floor — and funnels down to the
tower portal by the main mast, so the far half stays narrow only through
perspective. Packet counts rose ×1.6 to keep the density worthy of the
area; the flow gained a second, faster wander octave (micro-turbulence),
a ±2u vertical layer spread with per-packet oscillation, and a slow
spatial clumping field that breaks the surface into drifts, pools and
small gaps. The edges dissolve against the LOCAL width — density is the
only border. Everything remains particles; there is no plane, no mesh,
no faked width anywhere.

**The towers became graphite.** Every green term in the tower material
is now gated by how much a surface faces the sky's glow bank — the same
direction the terrain's distant rims use — so green reads as REFLECTED
environmental light, never emission; faces turned away stay black. A
neutral cool sheen carries the matte-composite feel, thin horizontal
panel seams mark the segmental construction on lit faces only, the legs
thickened ~15% for mass (height and portal untouched), and each saddle
gained reinforced cable-entry housings on both span faces, where the
suspension physically locks into the mast.

---

## Round 15: three precision corrections (2026-08-04)

1. **The bridge now passes THROUGH the towers.** The road was correctly
   occluded in the main pass all along — the giveaway was the TRAIL
   pass: accumulated packet streaks had no tower depth to test against
   and glowed straight through the mast legs. The towers now join the
   trail pass as depth-only occluders (the same colorWrite trick the
   terrain uses), and a portal pinch narrows the river to the portal
   width within ~0.05u of each tower, so every packet funnels between
   the legs and none passes through a column. The deck visibly enters
   the portal, disappears behind the front leg, and emerges beyond.
2. **The neon identity came back, engineered.** The graphite pass had
   drained the Claradix green; the glow vector returned to full
   saturation with the environmental gate relaxed to a floor of 0.45 —
   lit rather than flat-emissive, but unmistakably neon. The legs gained
   thin lofted groove strips following their own lean and taper (the
   brief's "illuminated vertical grooves"), the panel seams brightened,
   and the strongest camera-facing edge runs now cross the bloom
   threshold for the subtle halo on key edges only.
3. **Both rear legs grounded.** The pedestals had been built at the
   tower's shared pivot height, so on sloping ground the uphill leg's
   foot hovered. Each pedestal now rises from its own leg's terrain
   contact and sinks 22 units deep — both feet emerge from the earth
   with equal weight, on both towers.

---

## Round 16: the pre-dawn atmosphere (2026-08-04)

The client asked for the sky to stop being an effect and become a
physically believable environment — before sunrise, silent, expensive.
The domain-warped foundation stayed (it is what keeps procedural
patterning invisible); everything expressive above it was rebuilt into
five independently drifting layers:

1. **The great haze** — fog that originates AT the terrain: a dark
   emerald breath hugging the ridgelines, decaying exponentially with
   elevation, over a blue-black pre-dawn lift. The mountains, valley and
   sky now share one atmosphere.
2. **Softened energy** — the fracture-vein plasma language was cut to a
   whisper; light now ACCUMULATES softly in the thin of the haze, and a
   vertical law keeps brightness at the horizon and in the framed
   upper-right energy region while the top of the sky stays dark.
   Darkness became the artistic tool the brief demanded.
3. **Volumetric scattering** — a broad, dim softness in the air around
   bright regions, read from the same energy field through a wider
   window. Light bleeding into atmosphere, not bloom.
4. **A real starfield** — temperatures (mostly cold blue-white, a few
   subtly warm), the existing astronomical clustering, and twinkle cut
   to near-imperceptible.
5. **Micro drift** — a nearly invisible layer of tiny particles adrift
   at their own slow tempo. Motion felt, never seen.

Five tempos, none synchronized; every layer occluded correctly by the
energy bodies; everything still under the bloom threshold — the sky
never blooms, and it no longer competes with the bridge.
