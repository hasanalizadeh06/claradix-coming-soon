# 03 — BRAND PHILOSOPHY

**Why Claradix looks like this.**

---

## 3.1 What the brand claims

Claradix's stated purpose:

> **Transform ideas into reality.**

And its own metaphor for itself, from the page's sub-headline:

> *Claradix ideyanızla reallıq arasında körpüdür.*
> **Claradix is the bridge between your idea and reality.**

That sentence is not decoration. **It is the specification for the entire
scene.** The page does not illustrate the claim; the page *performs* it.

- An idea is scattered, latent, unformed — **specks on the ground**
- Reality is structured, spanning, load-bearing — **a bridge**
- Claradix is the transformation between them — **the flight**

Everything in this pack is downstream of taking that sentence literally.

---

## 3.2 The seven words

| Word | What it forbids |
|---|---|
| **Intelligent** | Nothing decorative. Every effect must have a reason. |
| **Elegant** | No excess. The scene has one colour and one idea. |
| **Premium** | No cheapness tells: no lens flares, no glitch, no stock "tech" tropes. |
| **Calm** | Nothing frantic. No fast cuts, no strobing, no aggressive motion. |
| **Timeless** | Nothing that dates. See §3.6. |
| **Precise** | Nothing sloppy. Alignment is exact; timings are specified. |
| **Transformation** | Nothing static. The brand is a *process*, not a state. |

These are the words to hold a proposed change against. "Would this feel calm?"
is a more useful review question than "do we like this?"

---

## 3.3 The founding sentence

From the original brief, and preserved verbatim because it is the most useful
sentence anyone has written about this project:

> **"The bridge should never feel placed inside the world. The world should feel
> like it evolved around the bridge."**

### What it rules out

The obvious way to build this scene: generate a landscape, then position a
bridge model in it. That produces a **bridge in a place**.

What we want is **a place with a bridge in it** — which sounds identical and is
completely different.

### How it becomes a technical requirement

`TERRAIN.corridor` exists because of this sentence.

```ts
corridor: {
  halfWidth: 210,
  depth: 132,
  falloffExp: 2.4,
}
```

The terrain is generated from noise, and then the ground **beneath the bridge's
path is pushed down** by up to 132 units, tapering out over 210 units either
side.

The valley exists *because* the bridge crosses there. The bridge is not spanning
a gap that happened to be convenient — the gap is the reason the bridge is there
at all.

Nobody consciously notices this. Everybody notices its absence: a bridge over
terrain that does not need bridging looks like a 3D asset dropped into a
landscape, and no amount of lighting rescues it.

**Related:** the framing ridges in `TERRAIN.framingRidges` are placed to
compose the frame around the bridge, not scattered randomly. The mountain at
`(640, 0, −560)` exists to sit behind the far tower.

---

## 3.4 The priority stack

When two elements compete for attention, this decides which wins.

```
1. WORLD          ← the valley, the mountains, the sense of place
2. ATMOSPHERE     ← haze, fog, depth, the quality of the darkness
3. BRIDGE         ← the structure
4. PARTICLES      ← the individual points
5. UI             ← the text
```

Read it as: *if making the bridge better would damage the world, the world
wins.*

### This ordering is unusual and deliberate

Most agency work would put the UI first (it carries the message), or the bridge
first (it is the hero object). Putting the **world** first is a real choice with
real consequences.

**What it produces in practice:**

| Decision | Justified by the stack |
|---|---|
| Camera FOV is 38° — wide enough to show the valley, not tight on the bridge | World > Bridge |
| Swarm lights exist at all — they cost performance and only light the terrain | World > Particles |
| The bridge runs off both edges of the frame rather than sitting neatly inside it | World > Bridge |
| Phase 0 exists — 1.2s of nothing but place | World > everything |
| The UI does not appear until the scene is finished | World > UI |
| Bloom is capped even though more would make the bridge more impressive | Atmosphere > Bridge |

### Where the stack is *not* used

**Accessibility and legibility outrank the entire stack.** If text contrast
fails, the text scrim gets darker even though it damages the world. There is no
negotiation on that, and it is why the scrim exists at 86% opacity from
`T+0.000`.

---

## 3.5 Bridge, energy, matter

From the original brief:

> **"The bridge is always between energy and matter; never fully solid."**

This becomes **Law 3** in [`00_START_HERE.md`](00_START_HERE.md): the bridge is
permanently a point cloud. It never becomes a mesh, never becomes opaque, never
"finishes" into a solid object.

### Why the brand needs this

If the bridge became solid at `T+12.400`, the story would be:

> *Idea → process → **finished product**.*

Which is a fine story, and it is the wrong one. Claradix is not claiming to
deliver a finished object. It is claiming to *be* the transformation. A bridge
that remains visibly made of moving light is a bridge that is still doing
something.

It is also the reason the interaction works at all. You cannot put your hand
through a solid bridge. The scene's central interaction — the thing a visitor
remembers — is only possible because Law 3 holds.

### And it is why gliding is brighter than seated

```
brightness.gliding = 0.92
brightness.seated  = 0.74
```

The particles are at their most alive **in transit**. The finished bridge is
calmer than the journey that made it. This is the brand argument expressed as
two numbers, and it is discussed at length in
[`11_phase_2_glide.md`](11_phase_2_glide.md) §11.6.

---

## 3.6 Timeless — what it forbids

"Timeless" is the hardest of the seven words to act on, because it is a negative
requirement: it names things the work must *not* resemble.

### The trap

Neon green on near-black, particles, a glowing structure — these are, on their
face, the visual vocabulary of a decade of generic "tech/AI/crypto/cyber"
marketing. The reference frame is one bad decision away from looking like
everything else.

**What separates it is restraint, and only restraint.**

| Generic version | This project |
|---|---|
| Two or three neon hues (cyan + magenta + green) | **One** accent colour |
| Glow everywhere | 85% of the frame is near-black |
| Grid floors, HUD frames, scan lines | None |
| Fast, aggressive motion | 12 seconds, mostly gliding |
| Text with glitch/typewriter effects | Plain fades |
| Chromatic aberration as a feature | 0.0012 — barely present |
| Bloom as loud as possible | Capped, measured, enforced |

### The enforcement mechanism

Taste cannot hold this line, because every individual change toward "more" is
defensible in isolation. Ten defensible changes produce a generic page.

So it is measured:

```
85% near-black · 10% deep green · 5% neon accent   (±3 points)
```

`scripts/palette-check.mjs` runs on every capture. It is a **hard acceptance
criterion**, not a guideline. See
[`38_acceptance_criteria.md`](38_acceptance_criteria.md).

> This is the single most useful thing in the whole pack for keeping the work
> good over time. A ratio can be checked by a script; "does this feel premium?"
> cannot.

### The explicit ban list

Named in [`01_GLOSSARY.md`](01_GLOSSARY.md) §1.11 and
[`39_do_and_dont.md`](39_do_and_dont.md):

**hologram · cyberpunk · glitch · Matrix / data stream · HUD · scan lines ·
explosion · lens flare · grid floor**

If a proposal is best described by one of those words, it is out of scope by
definition, regardless of how well executed it is.

---

## 3.7 Why a bridge, structurally

The metaphor could have been a seed growing, a shape assembling, a network
forming. A suspension bridge earns its place for reasons beyond the sub-headline.

**It has two ends.** Idea on one side, reality on the other. The metaphor is
built into the object; nothing has to be explained.

**It is load-bearing.** A bridge is not decorative — it carries weight, and it
fails catastrophically if built wrong. That is a stronger claim than "we connect
things."

**It assembles in a legible order.** Piers, towers, deck, cables, hangers. The
build sequence in Phase 3 is comprehensible to anyone, without narration,
because they have seen construction.

**It is beautiful without ornament.** A suspension bridge's form is entirely
determined by the forces in it. The catenary is not a designed curve; it is what
a hanging cable *does*. That is the definition of elegance the brand is claiming.

**It reads at any scale.** Recognisable as a silhouette, at thumbnail size, in
one colour. Important for OG images and social cards.

---

## 3.8 What the scene is arguing

Stated plainly, so that it can be checked against:

> **Transformation is not instantaneous, and it is not effortless. It has a
> direction, it has an order, and the parts that make it are the same parts that
> were lying dormant before it started.**

Each clause maps onto a mechanism:

| Claim | Mechanism |
|---|---|
| *not instantaneous* | 12.4 seconds. Phase 0 exists. |
| *not effortless* | Return is 4× slower than displacement (`riseResponse` 0.34 / `returnResponse` 1.40) |
| *has a direction* | Far → near, toward the viewer |
| *has an order* | Piers before towers before cables |
| *made of the same parts* | Law 1 — particles rise from the ground of this valley, not from off-screen |

The last one is the most important and the easiest to lose. If particles flew in
from outside the frame, the story would become *"something was delivered here"*
— a service being applied to a client. Rising from the ground makes it *"this
place transformed itself"* — which is the difference between a vendor and a
partner, and it is what the brand is claiming.

---

## 3.9 The one-sentence test

Any proposed change can be checked against this:

> **Does it make the transformation more legible, or does it make the frame more
> impressive?**

The first is always right. The second is almost always wrong.

---

**Next:** [`04_story_seed_to_bridge.md`](04_story_seed_to_bridge.md) — the
narrative, beat by beat.
