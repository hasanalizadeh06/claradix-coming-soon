# 01 — GLOSSARY

**Every technical term used in this pack, explained from zero.**

---

## How to use this file

This pack assumes **no prior knowledge**. Not "no knowledge of this project" —
no knowledge of 3D graphics, animation, or web development at all.

Terms are grouped by topic rather than alphabetised, because they are easier to
learn in clusters than in isolation. An alphabetical index is at the bottom
(§1.12).

Each entry follows the same shape:

> **Term** — plain-language definition.
> *Analogy, if one helps.*
> **In this project:** how it specifically applies here.

---

## 1.1 The absolute basics

### Pixel

The smallest dot of colour a screen can display. Your screen is a grid of
millions of them. Every image, every letter, every glow is just a pattern of
pixels being told what colour to be.

**In this project:** the finished scene is roughly 1536 × 1024 = **1.57 million
pixels**, recalculated 60 times per second.

### Frame

One complete still image. Video and animation are just still images shown in
rapid succession, fast enough that your eye reads them as motion.

**In this project:** we target **60 frames per second (fps)**. That means the
computer has **16.667 milliseconds** to draw everything — the terrain, the sky,
140,000 particles, the glow — before it must start the next one. This budget is
the single hardest constraint in the entire project.

### Frame rate / FPS

How many frames are drawn per second.

- **60 fps** — smooth. The target.
- **30 fps** — noticeably less smooth, acceptable on weak phones. The floor.
- **Below 24 fps** — reads as broken.

**In this project:** see [`34_performance_budget.md`](34_performance_budget.md).
If the computer cannot keep up, the scene **reduces its own quality** rather than
stuttering.

### Render

To calculate and draw an image. "Rendering the scene" = "computing what all
1.57 million pixels should be".

### Real-time vs pre-rendered

- **Pre-rendered:** the images were computed in advance and saved as a video
  file. Playing it back is easy; nothing can change.
- **Real-time:** the images are computed *right now*, as you watch. This is
  harder, but it means the scene can **respond to you**.

**In this project:** everything is **real-time**. This is why the bridge can
scatter under your cursor. A video could not do that.

> **Why this matters for reading this pack:** because the scene is real-time and
> procedural, **there is no reference video**. Nobody can watch the "correct"
> version to check the build. The only ground truth is one still image of the
> final frame plus these documents. That is why the documents are so long.

---

## 1.2 3D space

### 3D scene

A description of objects positioned in an imaginary three-dimensional space,
plus a virtual camera looking at them. The computer works out what the camera
would see and draws that.

### Axis / coordinate

Three numbers describe any position in 3D space:

```
        +Y  (up)
         |
         |
         |______ +X  (right)
        /
       /
     +Z  (toward the viewer, out of the screen)
```

A position is written `(x, y, z)`. So `(-60, 42, -160)` means: 60 units left of
centre, 42 units up, 160 units away from the viewer.

**In this project:** we use **Three.js conventions** — +X right, +Y up, +Z
toward the viewer. The camera looks in the **−Z** direction, i.e. "into" the
screen. Full map: [`16_world_map.md`](16_world_map.md).

### World unit

The scene's unit of measurement. It is arbitrary — the computer does not care
whether "1" means a millimetre or a mile — but choosing a consistent meaning
keeps everything sane.

**In this project:** **1 world unit = 1 metre**, conceptually. So the bridge's
main span being `468` units means a plausible 468-metre bridge, not an abstract
number. Written with a `u` suffix: `90u`.

### Origin

The point `(0, 0, 0)`. The centre of the world.

### Vector

A list of numbers used together. A 3D vector has three: `(x, y, z)`.

Vectors are used for two different things and it is worth keeping them apart:

- **A position vector** describes *where something is*: `(-60, 42, -160)`.
- **A direction vector** describes *which way something points*, usually
  normalised to length 1: `(0, 1, 0)` means "straight up".

### Normalise

To scale a vector so its length becomes exactly 1, keeping its direction. Used
when you care about *which way* but not *how far*.

### Camera

A virtual eye. It has a position, a direction it is looking, and a field of
view.

### Field of view (FOV)

How wide the camera's cone of vision is, in degrees.

- **Small FOV (20–35°)** — like a telephoto lens. Compresses depth, feels
  cinematic and calm, makes distant things loom.
- **Large FOV (70–100°)** — like a wide-angle lens. Exaggerates depth, feels
  fast and aggressive, distorts edges.

**In this project:** `CAMERA.fov` = **38°**, vertical. A restrained, cinematic
lens. The choice is discussed in [`25_camera.md`](25_camera.md).

### Near plane / far plane

The camera only draws things between two distances. Closer than the **near
plane** or further than the **far plane**, and an object is simply not drawn.

**In this project:** `near = 1`, `far = 4000`.

### Perspective

Distant things appear smaller. This is what makes a 3D image read as depth.

**In this project:** perspective is why the far tower looks much shorter than
the main tower in the reference frame, even though in world space they are
`175u` and `140u` — a much smaller difference than the image suggests.

---

## 1.3 Geometry

### Mesh

A solid 3D object, built from triangles. A cube is 12 triangles; a detailed
character might be 100,000.

**In this project:** the **terrain is a mesh**. The **bridge is not** — that is
Law 3 in [`00_START_HERE.md`](00_START_HERE.md).

### Vertex (plural: vertices)

A single corner point of a triangle. Meshes are lists of vertices plus
instructions on how to connect them.

### Geometry

The shape data of an object: its vertices and how they connect.

### Heightfield

A way of describing terrain: instead of arbitrary 3D shapes, you store a grid of
*heights*. Position `(x, z)` has height `y`. Simple, fast, and perfect for
landscapes — but it cannot represent overhangs or caves.

**In this project:** the valley is a heightfield, `384 × 384` samples. See
[`17_terrain.md`](17_terrain.md).

### Spline / curve

A smooth curved line defined by a handful of control points. Rather than
listing thousands of points along a curve, you give five, and the maths fills in
everything between them smoothly.

### Catmull-Rom spline

A specific kind of spline that **passes exactly through** all of its control
points. (Some splines only get *near* their control points; Catmull-Rom hits
them.) This makes it intuitive to author with.

**In this project:** the bridge centreline is a Catmull-Rom spline through five
control points. See `BRIDGE.centreline` in
[`36_CONFIGURATION.md`](36_CONFIGURATION.md).

### Catenary

The curve a heavy chain makes when it hangs freely between two points under its
**own** weight.

*Analogy: hold a necklace by both ends and let it droop. That droop is a
catenary.*

Mathematically: `y = a · cosh(x / a)`.

**In this project: the main cables are NOT catenaries.** See below.

### Parabola *(and why the cables are one)*

The curve a cable makes when the load it carries is **uniform along the
horizontal**, rather than along the cable itself.

A suspension bridge's main cable carries the deck through its hangers, and that
deck load is far heavier than the cable's own mass. So the governing curve is a
**parabola**, not a catenary. Golden Gate, Brooklyn, Akashi — all parabolic.

Mathematically: `y = a·x²`.

The two curves are very close near the bottom, which is why they get confused.
The difference over a long span is small but structural: a catenary is what the
cable would do *unloaded*, and an unloaded suspension cable is not a thing.

**In this project:** the main cables between the two towers are parabolas with a
**sag ratio of 0.094** — the cable's lowest point sits 9.4% of the span length
below the tower tops. Real suspension bridges run 8–11%.

> **Corrected.** This pack originally specified catenaries and argued that a
> parabola "reads subtly wrong". That was backwards. The existing implementation
> in `src/scene/centreline.ts` had it right, and its comment is what caught the
> error. See [`40_decision_log.md`](40_decision_log.md) entry **D-016**.

### Sag ratio

For a hanging cable: how far it droops, divided by how far it spans.

### Arc length

The distance measured *along* a curve, as opposed to straight-line distance
between its ends.

**In this project:** the bridge centreline's arc length is ~**1624u**. The
parameter `u` is normalised arc length: `u = 0.5` is the point halfway *along
the curve*, not halfway between the endpoints.

---

## 1.4 Particles

### Particle

A single point in space that gets drawn as a small dot of light. It has a
position and usually a colour, size, and velocity. On its own it is nothing;
100,000 of them together can look like smoke, fire, dust, water, or — here — a
bridge.

**In this project:** particles are the entire story. See
[`21_anatomy_of_a_particle.md`](21_anatomy_of_a_particle.md).

### Particle system

The machinery that manages many particles at once: creating them, updating their
positions every frame, and drawing them.

### Point cloud

A shape described as a collection of points rather than as solid surfaces.

*Analogy: a constellation. You can clearly see the shape, but it is made of
separate dots with gaps between them.*

**In this project:** the bridge is a point cloud. **This is permanent** — the
bridge never becomes solid, even when complete.

### Target position

Where a particle is trying to get to.

**In this project:** every particle is assigned exactly one target on the bridge
before the animation starts. The entire scene is 140,000 particles travelling
from where they are to where they belong. See
[`24_target_assignment.md`](24_target_assignment.md).

### Seed position

Where a particle starts — lying on the terrain in Phase 0.

### Seated

Our word for a particle that has arrived at its target and stopped travelling.
A seated particle still breathes and still reacts to the cursor; it simply has
no further journey.

### Emitter

The thing that creates particles. Some systems continuously spawn new ones.

**In this project: there is no emitter.** All particles exist from the first
frame; they are simply dormant. This is unusual and deliberate — it is what
allows the exact particle count to equal the exact number of bridge targets, so
that the bridge is guaranteed to complete perfectly.

### Instancing

Drawing many copies of the same thing in one command, instead of issuing one
command per copy. Issuing 140,000 separate draw commands would be impossibly
slow; issuing one command that says "draw this dot 140,000 times, here are the
positions" is fast.

**In this project:** essential. Without instancing the scene is not possible.

### Additive blending

A way of combining overlapping transparent things: instead of the front one
hiding the back one, their brightnesses **add together**.

*Analogy: shining two torches at the same spot on a wall. The spot gets
brighter, not "more torch-coloured".*

**In this project:** particles use additive blending. This is why dense regions
— the towers, the cable anchor points — read as solid bars of light while sparse
regions read as scattered sparks. It happens for free, from density alone.

### Depth write / depth test

- **Depth test:** "is something already drawn in front of this? Then skip it."
- **Depth write:** "record how far away this pixel is, so later objects know."

**In this project:** particles have `depthTest: true` (so terrain can hide them)
but `depthWrite: false` (so they do not hide each other). Turning depth write on
would make particles occlude one another and destroy the additive glow.

---

## 1.5 Motion and timing

### Interpolation

Calculating in-between values. If something is at 0 at the start and 100 at the
end, interpolation tells you it is at 50 halfway through.

### Lerp (linear interpolation)

The simplest interpolation: a straight line between two values.

```
lerp(a, b, t) = a + (b - a) * t
```

where `t` runs 0 → 1.

### Easing

Making motion non-linear so it feels natural. Real objects do not start and stop
instantly — they accelerate and decelerate.

Common ones:

| Name | Behaviour | Feels like |
|---|---|---|
| `linear` | constant speed | mechanical, robotic |
| `easeIn` | slow start, fast end | falling, gaining commitment |
| `easeOut` | fast start, slow end | arriving, settling |
| `easeInOutCubic` | slow, fast, slow | a considered, deliberate move |

**In this project:** `FLIGHT.easing` = `easeInOutCubic`. A particle releases
gently, commits through the middle of its flight, and arrives with control.

### Cubic-bezier

A way of writing a custom easing curve using four numbers, as used in CSS.

**In this project:** the UI reveal uses `cubic-bezier(0.16, 1, 0.3, 1)` — a
strong "arrive and settle" curve with no overshoot.

### Stagger

Starting the same animation at slightly different times for different elements,
so they cascade instead of moving in unison.

**In this project:** stagger *is* the choreography. Assembly order comes entirely
from staggering 140,000 particles by their `u` value. See
[`24_target_assignment.md`](24_target_assignment.md).

### Jitter

Small random variation added to a value, so a pattern does not look
mechanically perfect.

**In this project:** `LIFT.jitter` = ±90ms. Without it, the lift-off wave is a
perfectly straight line sweeping across the ground, which reads as a machine
scanning rather than as a field waking up.

### Spring

A physics simulation that pulls something toward a target position, with
momentum. Springs have two main settings:

- **Stiffness** — how strongly it pulls. Higher = faster, snappier.
- **Damping** — how much it resists motion. Higher = less bouncing.

Too little damping and it **oscillates** (wobbles back and forth). Too much and
it feels sluggish.

**In this project:** `INTERACTION.spring` — stiffness `6.0`, damping `0.86`.
Tuned so a displaced particle returns to its target **without visible overshoot**.
Oscillation is explicitly forbidden; see
[`26_interaction_rules.md`](26_interaction_rules.md).

### Damping

Resistance to motion; what makes a swinging thing eventually stop.

### Envelope

A predetermined shape for how a value changes over time — e.g. "rise for 200ms,
hold for 300ms, fall for 500ms".

**In this project:** envelopes are **banned for interaction**. This is decision
**D-001** in [`40_decision_log.md`](40_decision_log.md). The reason: an envelope
runs on its own clock, so it starts returning while the viewer is still
pointing at the bridge, which reads as a flicker rather than a response.
Interaction is driven by **distance alone**, which can never do that.

### Falloff

How an effect weakens with distance from its centre.

**In this project:** the cursor's push uses a `smoothstep` falloff from
`innerRadius` (26u, full strength) to `influenceRadius` (90u, zero strength).

### Smoothstep

A specific S-shaped falloff curve that starts at 0, ends at 1, and has zero
slope at both ends — so it blends in and out with no visible seam.

```
smoothstep(t) = t * t * (3 - 2t)
```

---

## 1.6 Light and colour

### Emissive

An object that **produces** light rather than reflecting it. A light bulb is
emissive; a table is not.

**In this project:** bridge particles are emissive. They are never lit by
anything; they generate their own brightness. This is why they read as energy
rather than as painted objects.

### Bloom

The glow that spreads out from very bright things.

*Analogy: look at a streetlight at night, especially through slightly wet eyes
or a dirty windscreen — the light does not stop at its edge; it bleeds outward.*

Technically: find the brightest pixels, blur them, add the blur back over the
image.

**In this project:** bloom is **the entire visual identity**. Without it the
scene is a field of hard green dots. With it, the scene glows. Its strength is
animated across the phases — dim during Phase 0, brightest at the completion
pulse. See `POSTFX.bloom` in [`36_CONFIGURATION.md`](36_CONFIGURATION.md).

### Bloom threshold

How bright a pixel must be before it starts to glow. Too low and *everything*
glows, turning the image to mush. Too high and only a few points glow, and the
scene looks flat.

**In this project:** `0.62`.

### Post-processing / post-FX

Effects applied to the finished image, after the 3D has been drawn. Bloom,
vignette, grain, and colour grading are all post-processing.

*Analogy: the 3D render is the photograph; post-processing is the darkroom.*

### Vignette

Darkening toward the corners of the image. Nearly every cinematic image has one;
it pulls the eye toward the centre.

**In this project:** `0.34` strength.

### Film grain

Fine animated noise added over the image.

**In this project:** `0.035` — very subtle, and **not optional**. Near-black
gradients on 8-bit displays produce visible **banding** (stripes where there
should be a smooth fade). Grain hides banding by dithering it. Remove the grain
and the sky develops stripes.

### Banding

Visible steps in what should be a smooth gradient, caused by not having enough
distinct colour values available.

### Rim light

Light that catches only the edges of an object, outlining it against the
background.

**In this project:** this is how the mountains are visible at all. The terrain
is almost pure black (`#0B0F18`); its shape is read entirely from a faint green
rim (`#41750F`) along ridgelines.

### Ambient light

A flat, directionless base amount of light applied to everything, standing in for
all the bounced light a real scene would have.

**In this project:** very low — `intensity 0.22`, colour `#14240A`. The scene is
meant to be dark.

### Directional light

Light from an infinitely distant source, so all its rays are parallel. Sunlight
and moonlight are directional.

**In this project:** one, at `intensity 0.16`. It reads as diffuse skyglow, not
as a sun — there is no visible light source in the sky.

### Point light

Light radiating outward from a single position, getting weaker with distance.
A bare bulb.

**In this project:** five **swarm lights** — point lights that follow clusters of
flying particles, so the mountains are faintly lit by the passing river. This
approximates "every particle emits light" without the impossible cost of
140,000 real lights. Capped hard at `intensity 0.35`. See
[`20_lighting_design.md`](20_lighting_design.md).

### Decay

How quickly a point light's brightness drops with distance. `decay: 2` is
physically correct (inverse square law).

### Fog

Distant objects fading toward a background colour. Essential for depth.

**In this project:** linear fog from `420u` to `2100u`, tinted `#070A13` so the
horizon dissolves rather than ending at a visible edge.

### Scrim

A darkening overlay placed over part of the image so text on top of it stays
readable.

**In this project:** a gradient from 86% opaque black on the left to fully
transparent at 52% of the viewport width. Without it, the headline sits over the
bridge's brightest region and becomes unreadable.

---

## 1.7 Shaders and the GPU

### GPU

The chip in your computer specialised for graphics. Unlike the main processor
(CPU), which does a few things very fast one after another, a GPU does
**thousands of things at once**, slightly slower each.

*Analogy: a CPU is one brilliant mathematician. A GPU is ten thousand school
children who can each do simple arithmetic simultaneously.*

**In this project:** moving 140,000 particles is exactly the kind of job a GPU
is built for — the same simple calculation, repeated 140,000 times, with no
particle needing to know about any other.

### Shader

A small program that runs on the GPU. It is the instruction sheet handed to each
of those ten thousand school children.

Two kinds matter here:

- **Vertex shader** — runs once per point. Decides *where on screen* it goes.
- **Fragment shader** — runs once per pixel. Decides *what colour* it is.

**In this project:** particle movement is computed in the **vertex shader**. All
140,000 particles are repositioned every frame, on the GPU, without the CPU
touching them.

### GLSL

The programming language shaders are written in. Looks a bit like C.

**In this project:** shader source lives in `src/gl/glsl.ts`.

### Attribute

A piece of per-particle data handed to the vertex shader — this particle's seed
position, its target, its schedule.

**In this project:** see [`21_anatomy_of_a_particle.md`](21_anatomy_of_a_particle.md)
for the complete list of attributes each particle carries.

### Uniform

A value that is the same for every particle in a given frame — the current time,
the cursor position, the bloom strength.

*The distinction matters: **attributes** vary per particle, **uniforms** are
shared. Current time is a uniform; a particle's target is an attribute.*

### Draw call

One instruction from the CPU to the GPU: "draw this". Each one has overhead, so
fewer is better.

**In this project:** the entire particle system is **one draw call**.

### Buffer

A block of memory on the GPU holding data — such as 140,000 particle positions.

### Framebuffer / render target

An off-screen image the GPU can draw into, to be used as input to a later step.
Bloom needs several.

### Fill rate

How many pixels the GPU can colour per second. Additive particles are
**fill-rate bound**: the maths per particle is trivial, but many particles
overlapping the same pixels means that pixel gets written many times.

**In this project:** this is the real performance limit, and it is why particle
*size* matters as much as particle *count*. Doubling particle size quadruples
the pixels touched.

### Overdraw

Drawing the same pixel multiple times in one frame. The cause of fill-rate
problems.

---

## 1.8 Noise and procedural generation

### Procedural

Generated by rules and maths rather than authored by hand.

**In this project:** the terrain is procedural — nobody sculpted those mountains;
they come out of a noise function. The bridge is *authored* (five control points
placed by a human) and then procedurally detailed.

### Noise

A function that produces smooth pseudo-random values. Unlike pure randomness —
which is chaotic static — noise varies *smoothly*, so nearby inputs give nearby
outputs. This is what makes it look like nature.

**In this project:** `src/lib/noise3d.ts`. Terrain height comes from layered
noise.

### Octave

One layer of noise at a particular scale. Real landscapes have features at every
scale: continents, mountains, hills, boulders, pebbles. Adding several octaves of
noise together — each at higher frequency and lower amplitude — reproduces this.

**In this project:** five octaves. See `TERRAIN.octaves`:

```
[0.00042, 148]   ← continental ridgelines
[0.00120,  62]   ← hills
[0.00380,  19]   ← undulation
[0.01100,  6.5]  ← surface roughness
[0.03400,  1.8]  ← micro detail
```

### Frequency / amplitude

- **Frequency** — how rapidly the noise varies. High frequency = small features.
- **Amplitude** — how large the variation is. High amplitude = tall features.

### Seed

A starting number for a random generator. The same seed always produces the same
"random" result.

**In this project:** essential for reproducibility. Without a fixed seed, the
terrain would be different on every page load and the reference frame could never
be matched.

### Hash

A function that turns an input into a scrambled but *deterministic* output.
Used to give each particle its own consistent randomness without storing a
random number for each one.

**In this project:** a particle's breathing phase is `hash(particleIndex)`, so it
is stable across frames and costs no memory.

---

## 1.9 Web and UI

### DOM

The structure of a web page — its headings, paragraphs, buttons. The part that
is real text, that a screen reader can read and a search engine can index.

**In this project:** all the words — headline, sub-headline, countdown, footer —
are **DOM elements layered on top of the 3D canvas**, not drawn inside it. This
is not a technical convenience; it is an accessibility requirement. Text drawn
into a canvas is invisible to assistive technology. See
[`35_accessibility.md`](35_accessibility.md).

### Canvas

The HTML element the 3D scene is drawn into. To a screen reader it is a blank
rectangle, which is why it is marked `aria-hidden`.

### Viewport

The visible area of the browser window.

### Breakpoint

A screen width at which the layout changes.

### Device pixel ratio (DPR)

How many physical screen pixels correspond to one CSS pixel. A standard monitor
is 1. A modern phone or Retina display is 2 or 3 — meaning it has to draw 4× or
9× as many pixels.

**In this project:** a major performance factor. Rendering the particle scene at
DPR 3 on a phone means nine times the fill rate of DPR 1. We cap the render DPR;
see [`34_performance_budget.md`](34_performance_budget.md).

### `prefers-reduced-motion`

A setting the user turns on in their operating system to say "large animations
make me unwell or distracted; please stop". Browsers expose it to pages.

**In this project:** honouring it is **mandatory**, not optional. A 12-second
sweeping build animation is exactly the kind of motion that triggers vestibular
discomfort. When set, the scene skips to its final frame. See
[`35_accessibility.md`](35_accessibility.md).

### Prerender

Generating the page's HTML in advance so the text exists before any JavaScript
runs — good for search engines and for users on slow connections.

**In this project:** `npm run build` runs a prerender step (`src/prerender.tsx`
→ `scripts/prerender.mjs`).

---

## 1.10 Project-specific vocabulary

Words that mean something particular *here*, and would not be understood outside
this pack.

### `u`

**Normalised position along the bridge centreline.** `u = 0` is the near end
(closest to camera, running off the bottom-left of frame). `u = 1` is the far
end (vanishing toward the right horizon).

Assembly runs `u = 1` → `u = 0`. Rewind runs `u = 0` → `u = 1`.

This is the most important symbol in the pack.

### The river

The mass of particles in flight during Phase 2, seen as a continuous stream of
light rather than as individual dots. Its trails are the streaks visible in the
foreground of the reference frame.

### Seat / seating

The moment a particle arrives at its target and stops travelling.

### The wave

The spreading front of lift-offs during Phase 1. It is not a hard line — jitter
softens it.

### Snap

The one-frame brightness flash when a particle seats.

### Completion pulse

The single wave of brightness that travels the bridge's length in Phase 4,
marking the end of the build.

### Breathing

The permanent, tiny idle motion of seated particles (`±0.9u`, `0.21 Hz`,
scattered phase). Keeps the bridge alive rather than frozen.

### Swarm light

One of the five point lights that follow flying-particle clusters, faintly
illuminating the mountains.

### Scrim

The left-side darkening gradient that guarantees text contrast.

### Tier

One of five quality levels (`ultra` / `high` / `medium` / `low` / `minimal`)
selected by measured performance.

### Layer

A structural component of the bridge — `piers`, `towers`, `deck`, `mainCables`,
`hangers`, `railing`. Layers assemble in load-bearing order.

### Corridor

The band of terrain either side of the bridge centreline that is pushed downward,
so the bridge has a valley to span. `TERRAIN.corridor`.

---

## 1.11 Terms you will hear that we deliberately do NOT use

Listed so that if they appear in a review, someone can say "that is not what we
are building".

| Term | Why it is wrong here |
|---|---|
| **Wireframe** | Implies visible connecting lines between points. Our bridge is points only; nothing is joined by drawn edges. |
| **Hologram** | Implies scan lines, flicker, and blue-cyan sci-fi language. Wrong genre. See [`39_do_and_dont.md`](39_do_and_dont.md). |
| **Cyberpunk** | Explicitly rejected in the brand direction. Neon on black is not automatically cyberpunk; the difference is restraint. |
| **Explosion / burst** | The particles never scatter outward from a point. Every motion in this scene is *purposeful travel toward a destination*. |
| **Dissolve** | The bridge never fades away. In rewind it *disassembles*, which is a different, slower, structural motion. |
| **Glitch** | No digital artefacting. The scene is clean; its texture comes from grain and bloom, not from corruption. |
| **Data stream / Matrix** | The river is not made of characters, code, or symbols. It is light. |

---

## 1.12 Alphabetical index

| Term | Section |
|---|---|
| Additive blending | 1.4 |
| Ambient light | 1.6 |
| Amplitude | 1.8 |
| Arc length | 1.3 |
| Attribute | 1.7 |
| Banding | 1.6 |
| Bloom | 1.6 |
| Bloom threshold | 1.6 |
| Breakpoint | 1.9 |
| Breathing | 1.10 |
| Buffer | 1.7 |
| Camera | 1.2 |
| Canvas | 1.9 |
| Catenary | 1.3 |
| Catmull-Rom spline | 1.3 |
| Completion pulse | 1.10 |
| Corridor | 1.10 |
| Cubic-bezier | 1.5 |
| Damping | 1.5 |
| Decay | 1.6 |
| Depth test / write | 1.4 |
| Device pixel ratio | 1.9 |
| Directional light | 1.6 |
| DOM | 1.9 |
| Draw call | 1.7 |
| Easing | 1.5 |
| Emissive | 1.6 |
| Emitter | 1.4 |
| Envelope | 1.5 |
| Falloff | 1.5 |
| Field of view | 1.2 |
| Fill rate | 1.7 |
| Film grain | 1.6 |
| Fog | 1.6 |
| Frame | 1.1 |
| Frame rate | 1.1 |
| Framebuffer | 1.7 |
| Frequency | 1.8 |
| Fragment shader | 1.7 |
| Geometry | 1.3 |
| GLSL | 1.7 |
| GPU | 1.7 |
| Hash | 1.8 |
| Heightfield | 1.3 |
| Instancing | 1.4 |
| Interpolation | 1.5 |
| Jitter | 1.5 |
| Layer | 1.10 |
| Lerp | 1.5 |
| Mesh | 1.3 |
| Noise | 1.8 |
| Normalise | 1.2 |
| Octave | 1.8 |
| Origin | 1.2 |
| Overdraw | 1.7 |
| Particle | 1.4 |
| Particle system | 1.4 |
| Perspective | 1.2 |
| Pixel | 1.1 |
| Point cloud | 1.4 |
| Point light | 1.6 |
| Post-processing | 1.6 |
| `prefers-reduced-motion` | 1.9 |
| Prerender | 1.9 |
| Procedural | 1.8 |
| Real-time | 1.1 |
| Render | 1.1 |
| Rim light | 1.6 |
| The river | 1.10 |
| Sag ratio | 1.3 |
| Scrim | 1.6, 1.10 |
| Seat / seating | 1.4, 1.10 |
| Seed (random) | 1.8 |
| Seed position | 1.4 |
| Shader | 1.7 |
| Smoothstep | 1.5 |
| Snap | 1.10 |
| Spline | 1.3 |
| Spring | 1.5 |
| Stagger | 1.5 |
| Swarm light | 1.6, 1.10 |
| Target position | 1.4 |
| Tier | 1.10 |
| `u` | 1.10 |
| Uniform | 1.7 |
| Vector | 1.2 |
| Vertex | 1.3 |
| Vertex shader | 1.7 |
| Vignette | 1.6 |
| Viewport | 1.9 |
| The wave | 1.10 |
| World unit | 1.2 |

---

**Next:** [`02_ONE_PAGE_SUMMARY.md`](02_ONE_PAGE_SUMMARY.md) — the entire scene
on one page.
