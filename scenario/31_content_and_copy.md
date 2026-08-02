# 31 — CONTENT AND COPY

**The actual words, the language policy, and the open questions.**

---

## 31.1 The complete copy

Everything the page says.

| Element | Text | Language |
|---|---|---|
| Logo wordmark | `Claradix` | — |
| Eyebrow | `COMING SOON` | English |
| Headline 1 | `Something new` | English |
| Headline 2 | `is taking shape.` | English |
| Headline 3 | `Coming soon` | English |
| Sub-headline | `Claradix ideyanızla reallıq arasında körpüdür` | **Azerbaijani** |
| CTA | `Get notified` | English |
| Countdown labels | `DAYS` `HOURS` `MINUTES` `SECONDS` | English |
| Footer items | `ABOUT US` `INNOVATION` `SPEED` `RELIABILITY` `YOU` | English |
| Copyright | `© {year} Claradix. All rights reserved.` | English |

**Total word count: 27.** That is the entire page.

---

## 31.2 The sub-headline is the specification

> *Claradix ideyanızla reallıq arasında körpüdür.*
> **Claradix is the bridge between your idea and reality.**

This sentence is not a tagline that happens to sit under a picture of a bridge.
**It is the specification for the entire scene.**

| Sentence | Scene |
|---|---|
| *your idea* — scattered, latent, unformed | Specks lying on the ground |
| *reality* — structured, spanning, load-bearing | The bridge |
| *is the bridge between* — the transformation itself | The flight |

Everything in this pack is downstream of taking that sentence literally. See
[`03_brand_philosophy.md`](03_brand_philosophy.md).

> **This means the sub-headline cannot be cut or reworded without changing the
> scene.** If the copy changes to something that is not about bridging, the
> animation stops illustrating anything.

---

## 31.3 Open questions

These are flagged, not silently ratified. Each has a current implementation and
a decision that has not been made.

### Q-01 — The language mix

**The headline is English. The sub-headline is Azerbaijani.**

Everything else on the page is English.

| Possibility | Implication |
|---|---|
| **(a)** Deliberate — English for the global claim, Azerbaijani for the local audience | Keep. It is unusual and it works. |
| **(b)** Incomplete localisation — the sub-headline was translated and the rest was not | Finish the job: translate everything, or revert the sub-headline. |
| **(c)** Placeholder — the Azerbaijani is a stand-in | Replace. |

**Current implementation:** the copy ships as-is. No assumption is made.

> **Recommendation, if asked:** (a) is defensible and distinctive. A visitor in
> Baku reads a global-sounding English headline and then a sentence in their own
> language — that ordering says *"international company, here."* The reverse
> would say the opposite. But it should be a decision, not an accident.

**Blocking?** No. Build with current copy.

### Q-02 — "Coming soon" appears twice

```
COMING SOON            ← eyebrow
Something new
is taking shape.
Coming soon            ← headline line 3
```

The same two words, 15% of frame height apart.

| Option | Effect |
|---|---|
| **(a)** Keep both | The repetition is rhythmic; the second is the reveal payoff |
| **(b)** Cut the eyebrow | Headline becomes the only voice. Cleaner. Loses the wide-tracked type. |
| **(c)** Change the eyebrow | e.g. `CLARADIX` or `LAUNCHING` |
| **(d)** Change headline line 3 | e.g. `Almost here` |

**Current implementation:** both kept, as in the reference.

> **Note:** the reveal choreography gives line 3 its own 200ms of isolation and
> makes it lime — the payoff of the whole sequence. That payoff is weaker when
> the viewer has already read the same words 950ms earlier. This is the strongest
> argument for (c) or (d).

**Blocking?** No.

### Q-03 — Copyright year

The reference reads `© 2024`.

**Current implementation:**

```js
`© ${new Date().getFullYear()} Claradix. All rights reserved.`
```

Generated at render. In the prerendered HTML it is generated at build time, so a
site left undeployed across a new year will show a stale year until the next
build.

> **Acceptable.** A coming-soon page is deployed frequently by definition. If
> it is not, the year being stale is the least of its problems.

**Blocking?** No.

### Q-04 — Only one countdown unit is accented

The reference shows `23 / DAYS` in lime and the other three in white.

| Interpretation | Behaviour |
|---|---|
| **(a) Largest non-zero unit** | Accent migrates to HOURS when days hit zero |
| **(b) Days always** | Accent stays on DAYS even at `0` |
| **(c) Decorative** | Whichever cell the designer liked |

**Current implementation: (a).**

```js
const accentUnit = days > 0 ? 'days'
                 : hours > 0 ? 'hours'
                 : minutes > 0 ? 'minutes'
                 : 'seconds'
```

> **Why (a):** it is the only reading that produces sensible behaviour in the
> final hours of the campaign. Under (b), the last day of the countdown shows
> `0 DAYS` in bright lime — accenting the least informative number on the page.

**Blocking?** No. But it will become visible in the final 24 hours, and if the
client disagrees it is better to know before then.

### Q-05 — Footer items: links or labels?

```
ABOUT US • INNOVATION • SPEED • RELIABILITY • YOU
```

They are **styled** like navigation — uppercase, tracked, dot-separated — but
they **read** like brand values. `SPEED` and `YOU` are not pages.

| Option | |
|---|---|
| **(a) Non-interactive labels** | They are a values statement |
| **(b) Anchor links** | To sections that do not exist on a one-screen page |
| **(c) Cut** | The footer becomes just the copyright |

**Current implementation: (a).** Rendered as `<span>`, not `<a>`. No hover
state, no cursor change, no focus stop.

> **Why:** styling something as a link that does not navigate is a small
> usability lie, and it costs a tab stop for a screen-reader user. As labels they
> are honest.

**Blocking?** No.

### Q-06 — Twitter icon

The reference uses the **legacy bird**, not the X mark.

**Current implementation:** the bird, matching the reference.

> Straightforward to change; needs a decision, not a discussion.

**Blocking?** No.

### Q-07 — Intro duration

12.4 seconds. The client has stated this may change.

**Current implementation:** all timings derive from `SCENE.timeScale`. Changing
the duration is a one-line edit — see
[`36_CONFIGURATION.md`](36_CONFIGURATION.md) §36.19.

**Floor:** below `timeScale = 0.55` the assembly stops reading as construction
and becomes a wipe. If a much shorter intro is required, **cut a phase rather
than compressing all of them** — see [`40_decision_log.md`](40_decision_log.md)
**D-004**.

**Blocking?** No.

### Q-08 — Device orientation permission

Should the page offer orientation-based parallax on mobile via a permission
prompt?

**Current implementation: no prompt.** Orientation parallax is used only if
permission was already granted for the origin. Otherwise idle drift is the only
camera motion.

> **Why:** an iOS permission dialog appearing over a coming-soon page before the
> visitor has done anything is hostile, and will mostly be denied. The cost of a
> denied prompt exceeds the benefit of a granted one.

**Blocking?** No.

---

## 31.4 The countdown target

**Not a design decision. Deployment configuration.**

```bash
VITE_LAUNCH_AT=2026-09-15T09:00:00Z
```

| Property | Requirement |
|---|---|
| Format | ISO 8601 with explicit timezone |
| Storage | Environment variable, not source |
| Timezone | **UTC in config**; displayed relative to the viewer's local clock |

### Behaviour at zero

```js
if (remaining <= 0) { /* all four units show 00 */ }
```

The page does **not** change state, redirect, or reveal anything. It shows
`00 / 00 / 00 / 00` until someone deploys the real site.

> **Why no auto-transition:** a coming-soon page that silently becomes something
> else at a timestamp is a deployment risk. If the launch slips by an hour, the
> page has already told everyone it launched.
>
> The countdown reaching zero is a signal to a human, not a trigger.

### The ring's total duration

```
progress = 1 − (remaining / totalCampaignDuration)
```

`totalCampaignDuration` is fixed at first render and stored, so the arc does not
jump if the launch date is edited mid-campaign.

```bash
VITE_CAMPAIGN_START=2026-07-01T00:00:00Z
```

---

## 31.5 Typography of the copy

Details that are copy decisions rather than layout decisions.

### The full stop in line 2

```
is taking shape.
```

Line 2 ends with a period. Line 1 and line 3 do not.

This makes the headline two sentences:

> *Something new is taking shape.*
> *Coming soon*

Not one run-on. The period is doing real work and must not be tidied away.

### The accented word

```
Claradix ideyanızla reallıq arasında körpüdür
                    ^^^^^^^
```

**`reallıq`** (*reality*) is the lime word — not `körpüdür` (*is the bridge*).

> Accenting *reality* rather than *bridge* points at the **destination**, not at
> the mechanism. It is the more confident claim, and it avoids the sub-headline
> pointing at the picture directly above it.

### Special characters

The sub-headline requires:

| Character | Name |
|---|---|
| `ı` | dotless i (U+0131) |
| `ö` | o with diaeresis |
| `ü` | u with diaeresis |

**The font subset must include Latin Extended-A.** A Latin-only subset renders
`ı` as `.notdef`.

> **Trap:** invisible when testing with English placeholder copy. Always test
> with the real string. See [`29_ui_layout.md`](29_ui_layout.md) §29.8.

### No smart-quote or ellipsis substitution

There are no quotes or ellipses in the copy. If any are added, use real
characters (`"` `"` `…`), not ASCII approximations.

---

## 31.6 Where the copy lives

```
src/lib/copy.ts
```

**All 27 words in one file.** Nothing hard-coded in components.

```ts
export const COPY = {
  brand: 'Claradix',
  eyebrow: 'COMING SOON',
  headline: ['Something new', 'is taking shape.', 'Coming soon'],
  headlineAccentLine: 2,
  sub: { before: 'Claradix ideyanızla ', accent: 'reallıq', after: ' arasında körpüdür' },
  cta: 'Get notified',
  countdownLabels: ['DAYS', 'HOURS', 'MINUTES', 'SECONDS'],
  footerItems: ['ABOUT US', 'INNOVATION', 'SPEED', 'RELIABILITY', 'YOU'],
  copyright: (year: number) => `© ${year} Claradix. All rights reserved.`,
  socials: [
    { name: 'LinkedIn',  href: '#', icon: 'linkedin' },
    { name: 'Twitter',   href: '#', icon: 'twitter' },
    { name: 'Instagram', href: '#', icon: 'instagram' },
  ],
} as const
```

The sub-headline is split into three parts rather than stored with markup, so
the accent is data rather than HTML embedded in a string.

---

## 31.7 Metadata

Not on the page, but part of what it says.

### `<title>` and description

```html
<title>Claradix — Something new is taking shape</title>
<meta name="description" content="Claradix is the bridge between your idea and reality. Launching soon.">
```

### Open Graph

```html
<meta property="og:title" content="Claradix — Something new is taking shape">
<meta property="og:description" content="Claradix is the bridge between your idea and reality.">
<meta property="og:image" content="/img/og.png">
<meta property="og:type" content="website">
```

**`og.png` is a static render of the reference frame** — generated by
`npm run og`, captured at `T+10.500` (the `assembly-late` state), with the UI
composited on top.

> `T+10.500` rather than `T+16.000` because the light trails are present, and
> the trails are what make the still image read as *motion* rather than as a
> photograph of a bridge.

### `llms.txt`

`public/llms.txt` — a plain-text summary for language models crawling the site.
Contains the brand statement, the launch window, and a contact route. It should
say what the page says, not describe the animation.

---

## 31.8 The prerendered HTML

**All copy exists in the served HTML before any JavaScript runs.**

```bash
npm run build   # includes prerender
```

| Consumer | Gets |
|---|---|
| Search engines | Full copy, no JS execution needed |
| Social scrapers | OG tags + copy |
| Screen readers | Full DOM immediately |
| JS disabled | Complete page, no canvas |
| Slow connection | Text before the 3D loads |

> **This is the mitigation for the UI not appearing until `T+12.400`.** The
> visual reveal is a choice about the *experience*; the copy's availability to
> machines and assistive technology is not delayed by it at all.

---

## 31.9 Voice

For anyone writing new copy.

| Do | Don't |
|---|---|
| Short declaratives | Marketing superlatives |
| Present tense | Future-hype (*"will revolutionise"*) |
| Concrete nouns | Abstractions (*"solutions"*, *"synergy"*) |
| One idea per line | Compound claims |
| Sentence case in body | ALL CAPS outside the three tracked elements |

**The seven brand words** — *intelligent, elegant, premium, calm, timeless,
precise, transformation* — apply to copy exactly as they apply to the visuals.

> **The test:** would this sentence still make sense in five years? *"Something
> new is taking shape"* would. *"AI-powered next-generation platform"* would not.

---

## 31.10 Checklist

- [ ] All copy lives in `src/lib/copy.ts`. Nothing hard-coded in components.
- [ ] The sub-headline's accent is data, not embedded markup.
- [ ] The full stop after `is taking shape.` is present.
- [ ] `reallıq` — not `körpüdür` — is the accented word.
- [ ] Font subset includes Latin Extended-A; tested with the real Azerbaijani
      string.
- [ ] Copyright year is generated.
- [ ] Countdown target comes from `VITE_LAUNCH_AT`, not from source.
- [ ] At zero the countdown shows `00 00 00 00` and does **not** transition.
- [ ] `totalCampaignDuration` is fixed at first render.
- [ ] The largest non-zero unit is accented.
- [ ] Footer items are `<span>`, not `<a>`. No tab stop.
- [ ] All copy is present in the prerendered HTML.
- [ ] `og.png` is captured at `T+10.500`, with trails visible.
- [ ] OG title, description, and image are set.
- [ ] `llms.txt` describes the product, not the animation.
- [ ] Open questions Q-01 through Q-08 are tracked, not silently resolved.

---

**Next:** [`32_technical_architecture.md`](32_technical_architecture.md) — how
this maps onto code.
