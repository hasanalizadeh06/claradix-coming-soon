# Review

**Reviewer's position:** Senior Creative Director, Active Theory.
**Brief:** would this win Awwwards Site of the Day?
**Verdict up front: no.** Not close. It would take a Developer Award nomination
and lose SOTD to something with half the engineering and twice the presence.

What follows is a system-by-system score with the reasoning, and then exactly what
each one needs to reach 10.

I am going to be harder on this than the code deserves, because the code is not
the problem. **The problem is that a great deal of extremely disciplined
engineering has been spent producing an image that does not arrive.**

---

## Score summary

| System | Score |
|---|---|
| Architecture | **8** / 10 |
| Code Quality | **8** / 10 |
| Visual Design | **5** / 10 |
| Lighting | **7** / 10 |
| Composition | **4** / 10 |
| Environment | **6** / 10 |
| Interaction | **4** / 10 |
| Bridge | **4** / 10 |
| Particles | **8** / 10 |
| Shaders | **7** / 10 |
| Animation | **6** / 10 |
| Brand Identity | **5** / 10 |
| Innovation | **4** / 10 |
| Technical Quality | **7** / 10 |
| Performance | **5** / 10 |
| Emotional Impact | **4** / 10 |
| | |
| **Weighted overall** | **5.6** / 10 |

An Awwwards SOTD winner sits at 8.5+ on Design, Usability and Creativity. This
project's *engineering* would score there. Its *design* would not clear 6.

---

## 1. Architecture — 8/10

This is the strongest thing in the project and I want to be precise about why,
because the reasons are unfashionable.

There is no react-three-fiber. There is no drei. There is no
`postprocessing` library. There is no GSAP. There is no state manager. For a
project of this ambition in 2026 that is a genuinely contrarian set of choices,
and every one of them has paid off in a way that is visible in the source.

The single decision that carries the whole architecture is that **a particle's
position is a pure function of its attributes and time.** Not `pos += vel * dt`.
That one commitment gives determinism, frame-rate independence, seekability and
an enforceable deformation clamp, and it gives them *structurally* rather than by
discipline. Because `seek(10.5)` renders exactly the T+10.500 frame from a cold
start, the entire acceptance suite becomes possible — seven scripts that measure
colour ratios, interaction fields, reveal ordering and cycle repeatability against
real rendered pixels. Almost nobody building a site like this can measure anything
about it. This project can measure most of it.

The `config.ts` discipline is real and enforced in both directions. Every constant
lives in one 1,433-line file with no imports; `hygiene-check.mjs` fails the build
if a constant is exported and never read. That inverse check is unusual and it has
already caught three separate cases where a value was declared, documented at
length, and wired to nothing — a seven-point bloom curve pinned to one of its
values, a mip count the renderer never read, and the fifth point of a light curve
that was skipped over. Each of those looked like a *tuning* problem for as long as
it went unnoticed. Catching them statically is worth more than any amount of
careful reading.

The `SceneHandle` interface is well judged. `atmosphere`, `bloomStrength`,
`degrade`/`restore` and `trailLayer` are all **optional**, and the pattern is
consistently "the scene reports, the Stage decides". A scene that implements none
of them still works. That is the correct boundary: post-processing belongs to the
Stage because the Stage is the only place that knows whether bloom is even enabled
on this device.

The construction-order dependency (`centreline → terrain → targets → particles`)
is documented at the point where it matters and the consequence of violating it is
stated in measurable terms — flight durations scatter from a 4.5–5.7 s band to
1.8–14 s. That is what good architectural documentation looks like.

**Why not 10.** Three things.

First, there are **251 lines of dead code** — `lib/noise3d.ts` and `gl/glsl.ts`,
imported by nothing, containing a full simplex 3D implementation, curl noise and a
hash library that the project does not use. Every shader defines its own noise
inline. A senior engineer opening this repository will assume that infrastructure
is live and will waste time on it. The hygiene check audits `config.ts` exports
and does not audit modules.

Second, the **`Stage`/`BridgeScene` camera ownership is muddled**. `Stage`
constructs the camera with `near: 0.1, far: 400`; `SceneCanvas` passes
`cameraFov: 40`; `BridgeScene` overwrites fov, near and far with 38/1/4000. Three
places specify a FOV and one wins. Worse, the `400` far plane would clip the
entire far half of this world, and it works only because `BridgeScene` overwrites
it immediately. Any future scene factory that does not set its own frustum
inherits one that cannot contain the scene.

Third, `perf.ts` and `Stage.applyQuality` split the degradation ladder across two
files with a string-keyed switch. It works, and the split is defensible
(post-processing vs scene), but `DegradeStep` being a string union means a typo
routes silently to the scene's `default: return false` and the governor
cheerfully records "this rung is not actionable here" for a rung that is.

**To reach 10:** delete the dead modules, extend hygiene to catch unimported
modules, move camera construction entirely into the scene (or entirely into the
Stage — either, but not both), and make the ladder exhaustive over the union type
so a missing case is a compile error.

---

## 2. Code Quality — 8/10

The comments in this codebase are better than the comments in most commercial
codebases I have reviewed, and they are better in a specific way: **they explain
what was tried and rejected, with numbers.**

> *"Sweeping this 0.34 → 0.05 moved the deep band by 0.2 points, which I filed as
> 'the rim is not the problem'. The useful reading is the opposite."*

> *"Five lights over a 1624u bridge sit about 325u apart. At distance 320 the
> falloff still returns 0.5 at 320u… Terrain then contributed 27% of the frame to
> the deep band against a 10% budget."*

That is not documentation, that is a laboratory notebook, and it is exactly what
the next engineer needs. The comment density is high — perhaps 40% of `config.ts`
is prose — but almost none of it restates the code. It records *why the number is
that number*, which is the only thing about a magic constant worth writing down.

The naming is disciplined. `u` means normalised arc length and never anything
else. World units appear in prose as `90u` and never as a bare identifier. Layer
order is load-bearing order. `aSeatAt` is a deadline and the code says so where it
enforces it.

TypeScript is `strict` and the build gates on `tsc --noEmit`. `satisfies
Record<Tier, number>` is used correctly to keep tier tables exhaustive.

The acceptance scripts are themselves well-engineered. They wait on **values, not
durations**, because under a software rasteriser the frame rate is a tenth of real
and a fixed wall-clock wait would report a half-finished recovery as a failure.
`reveal-check` reads `data-reveal` attributes and computed `animation-delay` back
out of the DOM and asserts monotonicity, so config and component tree cannot
drift. `loop-check` establishes a **drift floor** from two captures at the same
scene time before comparing across a cycle, which correctly isolates the particle
system from the deliberately wall-clock nebula and camera drift. That is a subtle
and correct piece of test design.

**Why not 10.** Four things, and one of them is serious.

The serious one: **the same idea is implemented correctly and incorrectly eight
lines apart.** Pointer smoothing uses `1 - Math.pow(0.0015, frame.delta)` —
frame-rate independent, correct. The camera and dolly use `camPos.lerp(target,
0.045)` and `dolly += (target - dolly) * 0.07` — naive, frame-rate dependent,
converging twice as fast at 120 fps. The comment claims a "0.36 s time constant"
which is only true at 60 fps. A reader cannot tell which convention the project
holds.

Second, **magic numbers have leaked back into `src/`** despite the header rule.
`parallax.yaw` and `parallax.pitch` are declared in config and unread, while the
actual yaw factor is a literal `0.45` in `BridgeScene.ts`. The `9.0` gravity term
in the lift branch is a literal. The `0.35` mist thickness floor is a literal.

Third, the vertex shader is built by string interpolation inside a JS template
literal, which means **a backtick in a GLSL comment terminates the string.** This
broke the build three separate times. It is a real ergonomic hazard with no guard.

Fourth, `hygiene-check.mjs`'s nested-key heuristic is weak enough to have missed
an entire unimplemented subsystem — the ripple, five of whose six constants sit
unread in `INTERACTION`.

**To reach 10:** unify the smoothing convention, move the remaining literals into
config, add a lint that rejects backticks inside the shader template regions, and
strengthen the nested-key audit (or accept that it cannot be done statically and
build a runtime "which config keys were read this session" probe instead).

---

## 3. Visual Design — 5/10

Here is where the project stops being impressive.

Open the finished frame and describe what you see, without knowing what it is
supposed to be. You see: a black page, white and green type on the left, a thin
circle on the right, and **a horizontal band of green light running across the
lower third.** That band is the bridge. It does not look like a bridge. It looks
like a light leak, or a horizon, or an aurora.

The palette is monochrome green on near-black. That is brand-correct and it is
also **visually monotonous over a 16-second film**. There is no second hue
anywhere except the nebula, which is also green. There is no warm accent, no
complementary note, no colour event. The lime is beautiful in isolation and it
never does anything but be lime. Sixteen seconds of one hue at one saturation is a
long time.

Value structure is the strongest part of the design. The 85/10/5 discipline
produces a genuinely deep, filmic black and the frame never muddies. The ACES
tone-map keeps saturated greens from clipping to white at the bloom cores, which
is a real and often-missed detail on a monochrome palette. The triangular dither
before the 8-bit write means the large dark gradients do not band, which almost
nobody bothers with and which matters enormously here.

But value structure is not composition, and it is not design. **The frame has one
tonal idea (dark) and one chromatic idea (green) and no third idea at all.**

The typography is the weakest visual element and it is barely considered.
"Something new / is taking shape." set in what appears to be a system-adjacent
grotesque, two lines, one accented in lime. It could be any coming-soon page from
the last eight years. There is no type personality, no custom treatment, no
interesting scale relationship, no tension between the type and the image. The
countdown ring is a stroked circle with a label in it. The social icons are
circles. The form is a pill.

**Every UI element in this design is a shape you could describe in one word.**

The scrim is doing real work — the left 52% is darkened so the type clears 4.5:1 —
but the consequence is that the left half of the frame is a **black rectangle with
text on it**. That is a legibility solution, not a design solution. The best dark
sites solve this by putting something *interesting* behind the type and shaping
the light around it, not by turning the light off.

**To reach 10:** the composition needs a second colour event — not a hue shift
across the whole palette, but one moment or one element that is not green.
Typography needs an actual point of view: a display face, a real scale
relationship, something that could not be swapped for Inter without anyone
noticing. The scrim needs to become a gradient shaped by the scene rather than a
rectangle. And the finished frame needs to look, unmistakably and at a glance,
like a bridge.

---

## 4. Lighting — 7/10

Technically this is the most sophisticated system in the project and it is let
down by what it is lighting.

There are zero `THREE.Light` objects. Every term is arithmetic in a fragment
shader, and every term has a stated job:

- **Ambient** exists only so surfaces facing away from the skyglow are not
  mathematically zero, because pure black regions clip once grain and bloom are
  applied on top.
- **Key** at 0.03 is "skyglow, not a sun" — it produces no visible highlight and
  no discernible shadow direction; its job is *normal disambiguation*.
- **Rim** is how the mountains are visible at all.
- **Swarm** is the one moment the environment acknowledges the bridge exists.

That is a real lighting design with a real hierarchy, and the numbers were arrived
at by measurement rather than by eye. The band-edge derivation is exemplary: the
edges come from the *luminance of the palette tokens*, not from chosen values, and
when they were previously 0.06/0.22/0.55 the middle boundary was so wrong that
every lit ridgeline counted as a neon violation. Fixing that required noticing that
`--rim` is 0.387 and the accent edge was 0.22.

The windowed swarm falloff is the best single fix in the codebase. The original
`1/(1+d²)` **never reaches zero**, and because swarm-lit terrain is deep-band by
definition (the light's colour is luminance 0.87), the tail stayed above the band
edge out to 310 units against a 325-unit light spacing. Every light reached every
other light's territory: a flat valley-wide wash, 25 points of deep against a
10-point budget — while the config comment claimed in detail that the pools were
discrete. Replacing it with `(1-x²)^decay` moved `awakening` from 74.4% near-black
to 89.5%.

The bloom discipline is correct and rare. Threshold 0.62 against terrain peaking at
0.09, stars at 0.34, dormant particles at 0.17 — **only particles bloom.** Stated
three times in three files. That single rule is what keeps the scene from turning
to milk, and most dark WebGL sites get it wrong.

**Why not 10.** The lighting is *disciplined* rather than *expressive*.

There is no key light with a direction you could point at. There is no rim
separating the subject from the background — the terrain rim lights the terrain,
but the bridge has no rim, no edge light, no separation pass. There is no colour
temperature anywhere; every light is the same green. There is no bounce, no fill
with a different hue, no practical.

Most damningly: **nothing casts a shadow.** Not one thing. A 175-unit tower stands
in a valley lit by five travelling lights and puts no shadow on the ground. The
ground glow is a decal driven by a completion schedule, not by the light. When you
push in and the bridge disperses, the light on the ground does not change.

The scene is lit like a diagram — every surface gets exactly the light it needs to
be legible and no light interacts with anything else.

**To reach 10:** give the swarm lights a real shadow (even a single cheap
projected one from the brightest), give the bridge a rim or edge treatment that
separates it from the sky, introduce one colour temperature difference so the
frame has warm and cool, and make the ground glow respond to the actual light
position rather than to a clock.

---

## 5. Composition — 4/10

This is the lowest technical score and it is the one that costs the most.

The camera was solved by brute-force search against five explicit constraints and
the solve is *documented*: tower top at x57.6%/y31.7%, base at y69.1%, both ends
off frame, horizon at 69.6%. That is a rigorous process. **It produced a bad
composition**, and the rigour is part of why: the constraints encoded where things
should sit in the frame, and none of them encoded whether the result would read.

The camera sits at `(-60, 40, 510)` looking at `(-150, 190, -600)`. The bridge
runs from `(-520, 34, 300)` to `(520, 50, -880)`. **The camera is looking almost
straight down the bridge's own axis.** The consequence is severe foreshortening:
the 1,624-unit span compresses into a horizontal band across the lower third, and
the two towers — the single most identifiable feature of a suspension bridge —
are seen nearly edge-on and read as slightly brighter vertical smudges.

Compare what a suspension bridge looks like when it is photographed well. It is
photographed from the side, or from a three-quarter angle low to the water, so the
cable's parabola is legible as a curve and the towers stand clear of the deck. The
parabola is the *iconography*. This scene computes a correct parabola —
deliberately, with a decision-log entry explaining why it is not a catenary — and
then views it from an angle where a parabola and a straight line are
indistinguishable.

The layout is the most conventional thing about the project: **type block left,
3D right, countdown ring upper-right, footer keywords bottom.** That is the
default dark-hero composition and it has been the default for years. There is no
asymmetry that surprises, no element that breaks its box, no overlap between type
and image, no moment where the scene and the layout acknowledge each other.

The left 52% is darkened by the scrim into a near-black rectangle. So the actual
compositional statement of the frame is: *a black rectangle on the left, a green
horizontal band on the right.* Two rectangles.

The nebula is placed with real thought — upper right, diagonally opposite the
headline, behind where the far tower resolves so it has something to be seen
against. That is the one genuinely composed element in the frame and it is
subtle to the point of near-invisibility.

The frame also has a large dead zone. The lower-left quadrant, below the form and
left of the bridge, is empty near-black for the entire film. The mist populates
some of it and the third framing ridge was added specifically to stop the scrim
reading as a flat rectangle, but the fix is faint and the zone is large.

**To reach 10:** move the camera to a three-quarter view where the cable's
parabola is legible and the towers stand clear against sky. Accept that the type
block will then have to move or overlap. Break at least one element out of the
grid. Give the lower-left quadrant a reason to exist — the near abutment, the
river's source, the valley floor descending toward camera. And re-solve the camera
against a constraint that is about *legibility of the silhouette*, not about
percentages of frame height.

---

## 6. Environment — 6/10

The environment is more considered than it looks and less present than it should
be.

The corridor carve is the best idea in the world-building. The ground beneath the
bridge is pushed down 132 units so **the valley exists because the bridge crosses
there.** Without it you get a bridge over terrain that did not need bridging,
which reads as a 3D asset dropped onto a landscape — everyone can tell, nobody can
say why. That is exactly right and almost nobody does it.

The fifth noise octave exists purely for silhouettes: the terrain is read almost
entirely from rim light along ridgelines, and a ridge built from four octaves is a
smooth mathematical curve that looks it. Documenting *"first thing dropped by
anyone optimising the noise. Do not."* is the kind of institutional knowledge that
usually gets lost.

The mist is the best-reasoned element in the project. The requirement was that the
ground's existence is established by the design, not the particles, and the scene
was failing it exactly backwards — the opening frame's landscape *was* 140,000
seeded particles, and the moment they lifted off the valley went black. The
diagnosis that rim light cannot fix this (a valley seen down its own length
presents almost no silhouette edges) and that the answer is *a thing lying on the
ground rather than a property of the ground's surface* is genuinely good
environmental thinking. And it costs zero against the colour budget, because
near-black is not black.

The sky is well built. Elevation-based rather than screen-height so the horizon
tracks the camera. Stars screen-space so they do not parallax into fireflies.
Nebula drift at 0.6 u/s explicitly so that *no two frames are identical*, which
the eye detects even when it cannot name it.

**Why not higher.** The environment does not *do* anything.

The terrain is completely static for sixteen seconds. There is no wind because
there is nothing for wind to move. There is no vegetation, no water, no
atmosphere volume, no god rays, no weather. The sky "never changes state" — the
pack says so explicitly and the implementation honours it, which means **the sky
is the one element that never acknowledges the bridge exists.** A hundred and
forty thousand points of light fly across it and it does not register.

The mountains are also barely visible in the composite. Rendered in isolation the
rim light is plainly working — rolling ridgelines across the whole right of the
frame — but in the finished shot the bridge's brightness swamps them and the left
half is scrim. So the "real, undulating, mountainous environment" that was
explicitly asked for exists in the geometry and does not arrive on screen.

And there is no reflection anywhere. No water in the valley floor, no wet ground,
no cube map. The decision is defensible (wet ground in a dry mountain valley
raises a question the scene cannot answer) but the *consequence* is that a scene
made entirely of emissive light has nothing to bounce off, which is why it reads
as flat.

**To reach 10:** give the valley floor something reflective — a river, which the
metaphor already names. Let the sky respond to the completion pulse even slightly.
Add one atmospheric volume so the swarm lights scatter rather than only
illuminating. And find a camera angle where the mountains are actually in the
picture.

---

## 7. Interaction — 4/10

The interaction model is intellectually excellent and experientially almost
absent.

Law 4 — *the cursor may deflect a particle, it may not stop one* — is a genuinely
sophisticated idea, correctly implemented. Projecting the push onto the plane
perpendicular to travel means progress along the path is untouchable *by
construction*, so the river never stalls under the pointer. The alternative,
which was shipped first, made the cursor read as an obstruction rather than a
disturbance. Very few people would notice the difference; the difference is real.

The asymmetric spring — 0.34 s to scatter, 1.40 s to return — is the right
instinct. *Things easy to disturb and effortful to restore have mass.* And the
field being **held** rather than an envelope (a stationary cursor produces a
constant field, so nothing decays underneath it) is correct; the envelope version
began rebuilding while the viewer was still pointing at the bridge and read as a
flicker.

The touch handling is correct in a way most sites get wrong: a touch is a hold, a
mouse is a hover, and they disengage on opposite signals. This was broken —
`pointermove` alone fires only while a finger is *sliding*, so press-and-hold
produced nothing at all, and the scene was inert to the one input most of its
visitors have.

**Now the problems.**

**Nothing invites you to interact.** There is no cursor treatment, no hover state,
no hint, no affordance, no copy that suggests it, no first-visit nudge. The
default cursor is the OS arrow. A visitor who does not happen to move the mouse
over the right third of the screen will never discover that the scene responds at
all. On a site whose entire premise is "put your hand through it", that is a
failure of the premise.

**The response is too subtle to register.** `maxDisplacement` is 30 units against
a 468-unit span — 6.4%. That number was chosen so the silhouette survives, and it
does, but the visible result is that a few dozen points move slightly. There is no
sound, no colour shift, no ripple, no acknowledgement. Move the cursor across the
bridge and the honest description is "some of the dots wobble".

**The specified ripple does not exist.** `INTERACTION.ripple` declares speed 340,
amplitude 11, lifetime 0.9, bandWidth 40, `rearmRequiresExit: true` — six
constants, fully specified, **read by nothing**. A travelling band radiating from
where you touched the bridge is exactly the missing acknowledgement, and it was
designed and never built.

**The specified flight avoidance does not exist either.** `INTERACTION.flight`
declares `avoidRadius`, `speedFloor: 0.92`, `maxDeflection: 62`,
`approachAvoidScale: 0.35` — also unread. The flight-time interaction that *is*
implemented reuses the seated constants, so the guarantee that a particle never
drops below 92% of its speed, and the reduced deflection during final approach so
landings are not disturbed, are specified behaviours that do not happen.

**Push-in is undiscoverable.** Scroll on a page that does not scroll, and the
camera moves. There is no scroll hint, no indicator, and the gesture is the same
one a visitor uses to look for more content — so the most likely first
interpretation is "the page is broken".

**To reach 10:** build the ripple. Design a cursor. Add a discoverable invitation
— even a single line of copy or a subtle pulse toward the pointer on first entry.
Make one interaction produce an unambiguous, satisfying, *loud* response. And add
sound, because a scene about light and structure with no audio is leaving the
easiest emotional lever on the table.

---

## 8. Bridge — 4/10

The bridge is the subject of the site and it is the weakest deliverable in it.

The generation is thorough. A centripetal Catmull-Rom spline with arc-length
reparameterisation. Parallel-transport frames by double reflection because Frenet
frames flip through zero-curvature regions and our centreline has near-straight
sections. Six structural layers built in load-bearing order. A **parabolic** main
cable with a correction and a decision-log entry explaining that a catenary is an
unloaded chain and a loaded suspension cable is a parabola. Section-aware
construction so the near and far thirds are cable-free approach spans. A budget
distribution that is deliberately *not* proportional to surface area, because
particle count buys legibility of thin things and hangers at proportional sampling
would read as dotted lines.

All of that is correct, and almost none of it is visible.

**In the finished frame, the bridge does not read as a bridge.** The camera is
nearly along its axis, so:

- the cable's parabola — the iconography of the entire building type — is
  compressed into something indistinguishable from a straight line
- the two towers are seen edge-on and read as slightly brighter vertical patches
  rather than as gates
- the hangers, which got 20% of the particle budget specifically so they would be
  legible, become a fine vertical texture inside a horizontal band
- the deck, at 34% of the budget, is the brightest thing and reads as a solid bar

The result is a **horizontal streak of green light**. It is beautiful as an
abstract image. It is not a bridge, and the site's one sentence is *"Claradix is
the bridge between your idea and reality."* If the viewer cannot name the object,
the metaphor does not land, and every one of the thousand correct decisions
underneath it is invisible.

There is a second, subtler problem. Additive blending means density reads as
brightness, so the parts of the bridge with the most particles per screen pixel —
the deck, seen nearly edge-on — are the brightest. **The bridge's tonal structure
is driven by perspective foreshortening rather than by design.** The far end,
which should recede, is compressed and therefore bright; the near end, which
should be present, is spread and therefore dim. The depth read is fighting itself,
and the fog is doing the opposite of what the geometry is doing.

The structure also never gets a moment to itself. It completes at T+11.2, the
pulse fires at T+11.4, and the UI begins arriving at T+12.4 — **one second later.**
The bridge exists unobstructed for about a second before the page starts covering
it.

**To reach 10:** re-frame. A three-quarter view, lower, closer to the deck line,
where the parabola is a visible curve and at least one tower stands clear against
sky. Give the bridge two seconds of unobstructed screen time before the UI
arrives. Consider a brief camera move at completion — the only camera animation in
the film — that reveals the span. And reconsider the budget: if the towers are the
iconography, they should not be at 14%.

---

## 9. Particles — 8/10

The particle system is the best-executed piece of engineering here and it earns
its score on craft rather than on spectacle.

Eighty-two thousand points, one draw call, fourteen attributes, all written once
at init and never touched again. No per-frame buffer uploads. No GPGPU ping-pong.
No sorting. Position recomputed from scratch every frame from a pure function.

The details that matter:

**Seeds are generated from targets, never independently.** A particle destined for
the main tower starts near the main tower's footprint, which keeps every flight
inside a 4.5–5.7 s band. Seeding independently scatters durations from 1.8 s to
14 s and the stream stops reading as a stream. That is a non-obvious causal
insight and it is what makes the river read as one current at one characteristic
speed.

**Particles lift perpendicular to the ground they were lying on**, not straight
up. On a 30° hillside the hill appears to exhale. One line, and it is
disproportionately responsible for Phase 1 feeling physical.

**Brightening during lift is a function of distance from seed, not elapsed time**,
so a particle on a steep slope brightens more slowly and the whole field brightens
unevenly following the landscape — for free, with nobody authoring it.

**The barrel roll radius is ~1% of the stream width, deliberately.** The comment
notes that at 3–6u the river fragments into traceable strands and above 8u it is
confetti; the roll is never seen, only felt, as the reason the river shimmers
instead of sliding. That is a designer's observation written down by an engineer.

**`aSpeedVar` is ±11% on the roll rate**, so faster particles gradually overtake
slower ones and the stream develops braided internal shear over its length — with
no flocking, no turbulence and no noise field.

**Three separate roll attributes rather than one derived hash**, because deriving
them from one value produces visible correlation and the eye picks it out as
banding.

**The Fisher-Yates shuffle** exists so `setDrawRange` thins the population
uniformly. The span gets sparser; it never gets shorter.

**Why not 10.** Two things.

First, the particles all look identical. One sprite shape, one colour ramp, one
size distribution. There are no types — no larger "seed" particles, no rare bright
ones, no debris, no dust, no scale variation beyond ±15%. The scene calls them
"seed thrown on the ground" in its own brief and they are uniform dots. A handful
of distinct particle classes would cost almost nothing and would add the textural
variety the frame badly needs.

Second, the trail pass **doubles the vertex cost** — 165,198 invocations per frame
— by running the full state machine a second time to draw three of six states. A
dedicated cheap shader that computes only the glide branch would halve the most
expensive thing in the project.

**To reach 10:** introduce two or three particle classes with different sizes,
brightness curves and sprite treatments. Split the trail pass onto a minimal
shader. And hoist the duplicated `frameRow` fetches — the barrel roll re-fetches
`centrelineBin` that `guidePoint` already read.

---

## 10. Shaders — 7/10

Nine programs, all hand-written, no library.

The composite is the most complete piece: ACES tone-mapping (Narkowicz 2015) chosen
specifically because Reinhard clips saturated greens to white at bloom cores; a
proper linear→sRGB encode; vignette applied *after* encoding so it reads as a lens
property rather than as scene lighting; radial chromatic aberration weighted by r²
so it is absent at centre where the headline sits — **text never smears**; and
triangular dither from two subtracted hash samples immediately before the 8-bit
write, which removes the residual banding a single uniform sample leaves and which
the eye integrates away entirely.

The bloom chain is a correct Karis 13-tap downsample and 3×3 tent upsample with a
soft-knee prefilter. The mip-depth insight is genuinely useful: `bloom.radius` is
a trap that reads like the halo's size and is not, and sweeping it 0.42 → 0.10
moves the colour ratio by under half a point, while mip depth is worth seven
points.

The generalisation drawn from that is the single most transferable idea in the
project:

> In a scene budgeted by **pixel count**, every parameter that sets an AREA is
> expensive and every parameter that sets a BRIGHTNESS is cheap.

`mips` vs `strength`; `rimPower` vs `rimStrength`; `swarmRange` vs
`swarmIntensity`; `sizeAttenuation` vs `brightness`. That is a real principle and
it was arrived at by measurement.

The additive fog handling is right and almost always got wrong: opaque surfaces
`mix()` toward the fog colour, additive geometry must **attenuate toward zero**,
or a dense distant region *adds* fog colour and gets brighter and the entire depth
read inverts.

The trail accumulator's clamp is the clean fix of the project. `min(accum, 1.0)` —
*a streak may never be brighter than the particle that made it* — and with it the
whole feature costs **zero** against the colour ratio, because the saturation
blow-out was its entire cost.

**Why not 10.**

The shaders are conservative. There is **no simplex noise, no curl noise, no
domain warping, no FBM, no raymarching, no SDF, no volumetrics** anywhere. All
noise in the project is 2D value noise with smoothstep interpolation. A full
simplex 3D implementation and curl noise sit in `gl/glsl.ts`, **unused**.

The nebula is two-dimensional screen-space noise. The mist is two-dimensional
noise on a flat plane. Neither has any volume. There is no participating medium
anywhere, which is why the swarm lights illuminate surfaces but never scatter — a
scene about light travelling through a valley at night has no visible light *in
the air*.

The particle sprite is a single `smoothstep` disc. No soft-particle depth fade
(so particles intersect the terrain with a hard edge), no anisotropy, no
orientation, no motion stretch on the sprite itself.

And the shader-building-by-string-interpolation pattern is fragile enough that a
backtick in a comment has broken the build three times.

**To reach 10:** add one volumetric element — even cheap analytic scattering along
the swarm lights would transform the frame. Use the curl noise that is already
sitting in the repository for the river's internal motion instead of relying on
`speedVar` alone. Add soft-particle depth fade. And give the sprite a velocity
stretch so fast particles are elongated, which is free and reads as speed.

---

## 11. Animation — 6/10

The timing craft is real and the choreography is over-subtle.

The best decisions:

**Two orderings at once.** Assembly runs spatially far→near *and* bottom-up in
load-bearing order within any cross-section, with a ~9:1 ratio between the spatial
sweep (5,220 ms) and the layer sequence (580 ms). That ratio is what makes it look
like watching real construction from a distance — a slow front advancing with fast
detail inside it.

**Causal honesty.** Lift-off begins at the far end because far particles have
furthest to travel and must arrive first. Everything that happens early happens
because of something that must happen later.

**Phases describe the scene, not particles.** At T+4 the frame contains dormant,
lifting and gliding particles simultaneously, and that overlap is what makes it
read as a process rather than three animations in sequence.

**The snap is one frame.** Two or three and the construction front develops a
bright leading edge that reads as a scanning beam sweeping the bridge into
existence — a completely different, far more generic idea.

**The rewind is 0.65× the build.** At 1.0× it reads as an error; faster than 0.5×
it reads as a collapse. *The bridge is not failing; it is being put away.*

**The completion pulse fires exactly once.** A bridge that pulses rhythmically is
a heartbeat, and a heartbeat is a much cheaper idea.

**Why not higher.**

The film has **one beat**. Dark → lift → fly → assemble → done. There is no
reversal, no surprise, no moment where the viewer's expectation is set and then
broken. Sixteen seconds is a long time for a single monotonic gesture, and the
middle — Phase 2 into Phase 3, roughly seconds 3 through 10 — is the same event
continuing.

The camera does not move during the entire film, deliberately, on the grounds that
camera motion would compete with the particle motion. That is a sound argument and
it is also why nothing about the framing ever changes: the viewer sees one
composition for sixteen seconds.

The easing vocabulary is thin. `easeInOutCubic`, `smoothstep`, `easeOutQuad`, one
cubic ease-out on the fade, one quadratic on the snap decay. **No overshoot, no
anticipation, no elastic, no hold, no stagger with character.** Everything eases
in and out symmetrically, which is the safest and least expressive choice
available.

There is a real inconsistency: the camera and dolly use naive lerps that are
frame-rate dependent, eight lines from a pointer smoothing that does it correctly.

And the completion pulse is **not reset by the loop** — on the second cycle the
bridge completes with no pulse at all — and not reset by `seek()`, so scrubbing
backwards past T+11.4 permanently disarms it for the session.

**To reach 10:** add a second beat. A held moment before the assembly starts — the
river arrives, and *hangs* — would cost nothing and would make the assembly land.
Give the completion a camera move, the only one in the film. Widen the easing
vocabulary. Fix the pulse latch. And unify the smoothing convention.

---

## 12. Brand Identity — 5/10

The brand execution is *correct* and not *ownable*.

What is right: the palette is lifted verbatim from the real Claradix Tailwind
config rather than eyeballed from a JPEG — `green.500 #7CFC00`, the blue-black
dark ramp `#040610`. That matters more than it sounds. An earlier version had
estimated `#A3E635` (yellow-lime) on `#050505` (neutral/green-black), and the dark
ramp was the bigger error: **a green accent on a blue-black dark is a
complementary relationship, which is what makes the lime read as emitted light.**
A green accent on a green dark reads as a monochrome wash.

The metaphor is also genuinely well-aligned. "Claradix is the bridge between your
idea and reality" and the scene builds a bridge out of scattered light. The
particle-to-structure transformation is a real visual argument for what the
company claims to do. That is better brand thinking than most agency coming-soon
pages manage.

**But.**

The metaphor is **literal to the point of being on-the-nose.** The company says
"bridge", the site draws a bridge. There is no interpretation, no abstraction, no
second reading. A viewer does not have to do any work, and there is nothing to
discover on a second visit. The best brand-led sites give you an image that means
the thing without depicting it.

**Nothing in the frame is unmistakably Claradix.** Remove the wordmark and this
could be any developer-tools, fintech, infrastructure or crypto brand with a green
accent on black. There is no proprietary shape, no signature motion, no custom
type, no recurring graphic device, no visual system that would survive being
applied to a second page. The logo appears once, top-left, at 132×85, and is
otherwise absent from the visual language.

The green-on-black dark-tech palette is, bluntly, the single most crowded visual
territory on the web right now. Doing it *well* — and the value control here is
genuinely good — does not make it distinct. **Doing it well is table stakes.**

The typography carries no brand at all. The copy is fine and generic: "Something
new is taking shape." / "Claradix is the bridge between your idea and reality." /
"In development". Nothing in the writing has a voice.

And the countdown is a build-status readout rather than a countdown, because
`LAUNCH_DATE` is unset. The reasoning is sound — *a countdown to a date you will
not hit is worse than no countdown, because visitors who return to a reset timer
stop believing the rest of the page* — but the consequence is a circle with the
word "BUILDING" in it, which communicates nothing and occupies the second-most
prominent position in the frame.

**To reach 10:** find the abstraction. The bridge does not have to be a bridge —
it has to *mean* bridge. Develop one proprietary graphic device that could appear
on a business card, a slide and this page and be recognised in all three. Commission
or select display type with a point of view. Rewrite the copy in a voice. And
either set a launch date or replace the ring with something that earns its
position.

---

## 13. Innovation — 4/10

This is the score that would keep it out of SOTD more than any other, and it needs
to be separated carefully from technical difficulty.

**What is genuinely novel here is invisible.** The pure-function-of-time particle
architecture, and the acceptance suite it makes possible, is a real contribution —
I have not seen a site-scale WebGL project with seven automated visual acceptance
checks measuring colour ratios against palette-derived band edges. Being able to
`seek()` to any frame and screenshot it deterministically is a capability most
studios do not have. The band-edge derivation, the area-vs-brightness principle,
the isolation methodology — these are engineering contributions.

**None of them are visible to a judge.** Awwwards does not measure your test
harness.

What a viewer actually experiences is: **a particle system that assembles into a
shape.** That is a well-established genre. Particles-forming-an-object has been
done at every scale from `three.js` examples to Active Theory's own work, and the
form is old enough that the bar for it is now very high — you need either an
unprecedented scale, an unprecedented subject, or an unprecedented interaction to
clear it.

This has none of those. 82,599 particles is a modest count in 2026; GPU
particle systems ship a million routinely. The subject is a bridge, rendered
literally. The interaction is a proximity displacement.

There is no idea in this project that a viewer will not have seen before:

- no novel input (no audio reactivity, no camera, no device motion, no
  multiplayer, no persistence)
- no novel output (no sound, no haptics, no unusual canvas shape)
- no unusual navigation or structure — it is a single static hero
- no generative variation — the scene is seeded and identical for every visitor,
  which is *deliberate* and correct for verification, but means nobody has an
  experience anyone else did not
- no AI, no physics, no simulation

The most innovative *user-facing* decision in the project is the push-in
dispersion — *what you find when you get close to something made of light is that
it was never solid* — which is a real idea, elegantly justified. It is triggered
by a scroll wheel on a page that does not scroll, and most visitors will never
find it.

**To reach 10:** the project needs one idea nobody has seen. Candidates that fit
the existing metaphor: let the visitor *place* the bridge (draw a line, the
centreline follows it, the bridge builds along what they drew — the site becomes a
demonstration of "your idea, made real"); make the particle count reflect
something real (subscriber count, commits, days to launch); make the second
visitor's bridge different from the first's; add sound that the structure
generates as it assembles. Any one of those turns a well-made demo into a piece.

---

## 14. Technical Quality — 7/10

Correctness is high; verification of the right things is uneven.

What is solid: TypeScript strict with a build gate. Determinism enforced statically
— `Math.random()` banned in `scene/` and `lib/`, seeded mulberry32 everywhere. SSR
with correct hydration. Progressive enhancement that actually works: the page is
readable with JavaScript disabled, readable with WebGL unavailable, and readable
if the scene never finishes loading, all three verified by
`reveal-check.mjs`. Reduced-motion handled by *not playing* rather than by playing
faster. Accessibility considered at the right level — `visibility: hidden` on
waiting elements because an opacity-0 element still takes keyboard focus and is
still announced.

Chunk splitting is correct: three.js and the scene are in separate bundles loaded
after `load` + idle, so the headline paints before three.js is downloaded.

The seven acceptance scripts are the strongest technical asset. Every one waits on
values rather than durations. `verify.mjs` runs all seven and reports all seven,
because chaining with `&&` meant two deliberately-failing colour captures hid the
other five permanently.

**Now the bugs, and there are real ones.**

The **fifteenth vertex attribute** incident is the most instructive failure in the
project's history. Adding one attribute took the particle system past the driver's
limit; the program failed validation with `Too many attributes`; **three.js
skipped the draw without throwing**; and the entire bridge was absent from every
frame while every inspectable property — attributes, uniforms, generated shader
source, bounding sphere, scene membership, blending, draw range — stayed perfectly
valid. It took a long time to find because the message goes to `console.error` and
every capture script listened only for `pageerror`.

And the colour checker reported it as a **pass on five of seven captures**, because
a frame with no bridge in it is a very dark frame and the rule rewards darkness. A
silent renderer failure moves the metric in the direction the metric calls good.
That is the most dangerous class of bug there is and the suite was blind to it.

Both are fixed. But the lesson — *a harness that measures rendering must fail on
`console.error`* — was learned the expensive way.

Other outstanding issues:

- **Two dead modules**, 251 lines, imported by nothing.
- **Two `DataTexture`s never disposed** — a real leak on anything that creates and
  destroys Stages.
- **`CAMERA.portrait` entirely unimplemented.** No aspect-ratio branch exists. On a
  phone in portrait the scene renders a landscape composition into a tall frame.
- **`INTERACTION.ripple` and `INTERACTION.flight`** — eleven constants, fully
  specified, read by nothing.
- **`A11Y.disableLoop`, `disableCameraParallax`, `disableIdleBreathe`** — declared,
  unread. The parallax happens to be gated correctly by a separate `if (!reduced)`,
  but not by the constant that names it.
- **`TERRAIN.material.roughness` / `metalness`** — leftovers from a PBR path that
  no longer exists.
- **The completion pulse latch** survives `seek()` and the loop.
- **Frame-rate-dependent lerps** on the camera and dolly.

**To reach 10:** clear the unimplemented-constant backlog (build them or delete
them — a constant nothing reads is a lie about what the project does), implement
portrait, fix the disposal leak, reset the pulse latch, and unify the smoothing.

---

## 15. Performance — 5/10

The score is low for one reason that overrides everything else.

**Nobody has profiled this on a real GPU.**

Every measurement in the repository was taken under SwiftShader in headless
Chromium, where the scene runs at roughly a tenth of real speed. That is fine for
colour and geometry — those are deterministic — and useless for performance. There
is no Chrome trace, no `EXT_disjoint_timer_query`, no per-pass GPU timing, no
frame-time histogram from a phone, no thermal soak test. `PERF.targetFps = 60` and
`floorFps = 30` are aspirations with no evidence attached.

The degradation ladder exists to defend a budget that has never been measured.

The architecture that *is* there is good. Fourteen draw calls for the whole page is
excellent. One draw call for 82,599 particles. Two textures total. No sorting, no
instancing overhead, no per-frame buffer uploads. The chunking keeps three.js off
the critical path entirely.

The governor is well designed. Median rather than mean over a 90-frame window, so
one 400 ms texture-upload stall does not cost a device a quality tier. Asymmetric
hysteresis — one bad window to downgrade, three good ones plus a higher bar to
upgrade — because oscillating between tiers is more visible than running at the
lower one. A thermal guard comparing against the best *recent* window rather than
an absolute threshold, because a phone slides rather than falling off a cliff.
Blocked during Phases 3–4 because a particle-count change mid-assembly is a visible
pop. Fed `frame.raw` rather than the clamped delta, because the clamp would hide
exactly the long frames it is looking for.

And the ladder's *order* is the right order: aberration → grain → trails → swarm
lights → bloom radius → terrain → particle count. **Particle count last, because
the particles are the scene and everything above them is atmosphere.** A page that
drops half its particles to keep its film grain has its priorities inverted.

**The costs that are visible in the code:**

The trail pass **doubles the vertex work** — 165,198 invocations per frame, running
the full six-state machine a second time to draw three states. Roughly 991,000
vertex texture fetches per frame, which is the slowest operation in the shader and
the single largest cost in the project.

Render targets at DPR 2 are **~136 MB**. That is the dominant memory cost by a wide
margin and it is why the DPR cap exists, but it is a lot of VRAM for a coming-soon
page and it will be the thing that fails on a mid-range Android.

The terrain is 294,338 triangles for a static mesh that is largely below the
horizon, behind the camera, or fogged to nothing. The 384 segments exist for
*silhouette* quality along the ridgelines, which is a property of a small fraction
of the mesh.

There is a `position` attribute of 82,599 × 3 zeros — 0.99 MB of VRAM uploaded to
communicate a draw count, occupying one of the fourteen precious attribute slots.

**To reach 10:** profile on real hardware — a mid-range Android and a MacBook Air
at minimum — and publish the numbers. Split the trail pass onto a minimal shader.
Hoist the duplicated frame fetches. Reduce terrain resolution away from the
ridgelines. And validate that the ladder actually recovers a device rather than
merely believing it has.

---

## 16. Emotional Impact — 4/10

This is what SOTD is actually scored on, and it is where the project is furthest
from where it needs to be.

Here is the honest experience of a first-time visitor:

You land. The page is black with a headline. Nothing happens for a moment. Then a
green glow gathers along the bottom of the frame, lifts, and streams across the
screen from right to left. It is genuinely beautiful for about three seconds — the
glide phase, with the trails on, is the best image in the film. Then the stream
settles into a horizontal band of light and stops. The text arrives. You read it.
You leave.

**Total elapsed emotional arc: about four seconds of "oh, nice", followed by
twelve seconds of waiting for something that does not come.**

The problems, in order of severity:

**There is no payoff.** The film builds for eleven seconds toward a moment — the
completion — and the moment is a single brightness pulse travelling along a shape
you cannot quite identify. Then it settles into stillness. The build promises a
reveal and the reveal is that the light stops moving.

**There is no sound.** None. A scene entirely about light, motion and assembly,
with silence. Sound is the cheapest and most powerful emotional lever available on
the web and it is completely unused. Add a low drone that swells with the glide, a
soft impact per structural layer landing, and a single resonant tone at
completion, and the emotional impact of this exact frame doubles. Nothing else in
this list is as high-leverage.

**The subject is unreadable.** The emotional argument is "your idea becomes real",
and the *real* thing at the end has to be unmistakably a bridge for that to land.
It is a light band. The transformation completes and the viewer cannot name what
it completed into.

**There is no invitation.** After the build finishes, the scene is waiting for
interaction that nothing signals. Most visitors will read the headline and leave
without ever touching it, which means the most emotionally engaging part of the
project — putting your hand through the structure — is experienced by a minority.

**The pacing is flat.** One monotonic gesture across sixteen seconds. There is no
held breath, no acceleration, no reversal, no moment of stillness before the
finish. Compare a well-cut title sequence: something always happens *just* after
you thought it was over.

**Nothing is at stake.** The scene has no jeopardy, no fragility, no sense that it
could fail. The bridge assembles because it was always going to. The push-in
dispersion is the only moment with any tension in it — the structure comes apart in
your hands — and it is hidden behind an undiscoverable gesture.

**What *does* work**, and it should be protected: the depth of the black. The scene
has a genuinely filmic value structure and the dither means the gradients are
clean. The glide phase is a real image. And the loop's rewind — layers leaving
top-down, the front travelling *away* from camera, easing gentler on the way out
because *arriving is an event and leaving is a decision* — is emotionally
intelligent design that nobody will ever see, because the loop is off by default.

**To reach 10:** sound, first and above everything. Then a readable subject. Then
one held beat before the assembly. Then a completion that earns eleven seconds of
build — a camera move, a bloom event, a moment where the structure is the only
thing on screen. Then an invitation to touch it.

---

## What would actually stop it winning

If this were submitted tomorrow, in order:

1. **The bridge does not read as a bridge.** The core metaphor fails at the moment
   it should land.
2. **No sound.** In 2026 an award-tier WebGL site without audio is submitting with
   one hand tied.
3. **Mobile portrait is unimplemented.** A large share of judging traffic sees a
   landscape composition crushed into a tall frame.
4. **The composition is the default dark hero.** Type left, 3D right, ring
   upper-right. Judges have seen it a thousand times.
5. **Interaction is undiscoverable.** The best ideas in the project are hidden
   behind gestures nobody is invited to make.
6. **No innovation a viewer can perceive.** The real contributions are
   architectural and invisible.
7. **Typography has no point of view.**
8. **One beat, sixteen seconds.** The pacing has no second act.

None of the top three are engineering problems. That is the summary of this
review: **the engineering is award-tier and the direction is not.**
