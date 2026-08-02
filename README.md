# Claradix — placeholder site

A single page announcing that the new Claradix site is being built, with a
real-time WebGL scene behind it.

Stack: Vite 5 · React 18 · TypeScript · three.js. No UI framework, no animation
library, no icon package, no CSS framework — the page is hand-written, and that
is why it weighs what it does.

---

## The scene

A suspension bridge assembles itself out of unformed matter, then carries code
across it. The company line is *"the bridge between your idea and reality"*, so
the scene is the positioning rather than a backdrop behind it.

Five layers, because a structure on its own reads as a diagram rather than a
place:

| Layer | What it is |
|---|---|
| **Backdrop** | A painted plate — sky, horizon, terrain — as a screen-space quad. Parallaxes with the camera, graded down so it becomes atmosphere rather than a photograph competing with the type. |
| **River** | A current of light beneath the span, drawn as particles along baked flow paths. |
| **Structure** | Piers, lattice towers, main cables, deck and rails, under-deck truss, suspenders, anchorages. ~180,000 points, one draw call. |
| **Traffic** | Glyphs travelling the deck, drawn from an atlas rendered into a canvas at runtime — no file is downloaded for it. |
| **Lit air** | The halo a bright object casts into haze, hugging the structure. |

Assembly, sway, light pulses, glyph motion and pointer response all happen in
vertex shaders. Per frame, JavaScript updates three uniforms.

Source lives in `src/scene/`. The scene talks to the renderer through one
interface — `SceneHandle` in `src/gl/Stage.ts` — so replacing it means writing a
new factory, not touching anything else.

---

## Commands

```bash
npm install
npm run dev        # localhost:5173
npm run build      # type-check → client build → SSR build → prerender
npm run preview    # serve dist on :4173
npm run shoot      # screenshot the built page into shots/
npm run og         # regenerate public/img/og.png
```

`npm run shoot` drives a real browser against `npm run preview` and reports any
console or shader errors. It waits on the scene's own assembly progress rather
than on a fixed delay — under software rendering the animation advances per
frame, and a wall-clock wait photographs a half-built bridge.

Re-encoding a backdrop plate after replacing the source:

```bash
node scripts/optimize-image.mjs assets-src/backdrop-source.png backdrop 0.74
```

Sources in `assets-src/` are never deployed; only the encoded output in
`public/img/` is.

---

## Configuration

Copy `.env.example` to `.env`. Everything is optional; the site runs with none of
it set.

| Variable | Effect when unset |
|---|---|
| `VITE_LAUNCH_DATE` | Shows a build-status readout instead of a countdown. |
| `VITE_SUBSCRIBE_ENDPOINT` | Email form falls back to a `mailto:` link. |
| `VITE_ANALYTICS_PROVIDER` | No third-party JavaScript is loaded at all. |

Two of these are deliberate refusals rather than missing features:

- **No countdown without a real date.** A timer that expires and resets teaches
  visitors the site lies, and they apply that lesson to everything else on it.
- **No fake form success.** With no endpoint the form opens a mail client, which
  actually reaches somebody, instead of showing a checkmark and dropping the
  address.

---

## How it is fast

The scene is 117KB gzipped of three.js. It is never on the critical path.

```
First paint       index.html (prerendered, complete) + 3.7KB CSS
Interactive       ~53KB gzip of JS  (React + app)
After load, idle  ~131KB gzip       (three.js + stage + scene) + 89KB plate
```

- **Prerendered, then hydrated.** `npm run build` renders the page to static
  HTML with `react-dom/server` and the client hydrates it. Without this a Vite
  SPA ships an empty `<div id="root">`, and — subtler — React replacing painted
  markup would register a *second*, later Largest Contentful Paint. The headline
  is painted once, from HTML, and never repainted.
- **The canvas is never the LCP element.** three.js is imported only after the
  `load` event and then only in an idle slot.
- **Nothing per-particle on the main thread.**
- **The render loop stops when the tab is hidden**, clamps delta time, and sheds
  resolution if it cannot hold 40fps for two and a half seconds.
- **Device-aware budgets.** One WebGL probe classifies the device and scales
  particle count, pixel ratio, bloom and which backdrop plate is fetched.
  `prefers-reduced-motion` and absent WebGL both fall back to a CSS gradient,
  and the page loses nothing but motion.
- **Hand-written post-processing.** Dual-filter bloom, ACES tone mapping, grain,
  vignette and radial chromatic aberration in ~300 lines, instead of 80KB of
  `postprocessing` or three's heavier `UnrealBloomPass`.
- **Self-hosted font, one subset.** Figtree, English only, nothing outside
  basic Latin ever needed — 20KB, preloaded.
- **Backdrop transcoded to WebP.** The source plate was a 1.8MB PNG; the shipped
  file is 89KB, and narrow viewports get a 31KB one.

Targets: LCP < 1.2s, CLS 0, INP < 100ms.

---

## SEO and answer engines

- Full semantic content in the HTML, no JavaScript required to read the page.
- `Organization` / `WebSite` / `WebPage` JSON-LD with address, contact and
  `sameAs` links.
- `public/llms.txt` states plainly who Claradix is, what it does, and that no
  launch date has been published — so an assistant asked about the company has
  something correct to quote.
- `robots.txt` names GPTBot, ClaudeBot, PerplexityBot, Google-Extended and
  others explicitly rather than relying on the wildcard.
- `og.png` is generated from the bridge geometry by `scripts/generate-og.mjs`
  (a small PNG encoder over zlib — no image dependency).

---

## What gets measured

`src/lib/vitals.ts` reports field Core Web Vitals — lab scores say nothing about
a mid-range Android in Baku on 4G. Alongside them:

| Event | Question it answers |
|---|---|
| `scene_ready` | How long until the scene appears, split by device tier. |
| `scene_fallback` | How many visitors never see it, and why. |
| `subscribe_submit` / `_success` / `_error` | The only conversion this page has. |
| `social_click` | Where attention goes when there is nothing else to click. |
| `web_vital` | Real LCP/CLS/INP/FCP/TTFB, bucketed good / needs work / poor. |

Plausible or Umami are the right default: cookieless, no consent banner, ~1KB
against GA4's ~45KB. GA4 is supported and loads in an idle callback if required.

---

## Accessibility

- Real `<h1>`, landmarks, and a stable `aria-label` on the animated headline so
  a screen reader never receives it character by character.
- The countdown is `aria-live="off"`; announcing a ticking clock every second
  makes a page unusable.
- Canvas is `aria-hidden`.
- `prefers-reduced-motion` disables the scene, the headline reveal, the ring
  sweep and every entrance.
- Green `#7CFC00` on `#040610` clears WCAG AAA. A four-layer scrim plus a text
  shadow guarantees contrast in every frame of a generative scene, not just the
  frames someone previewed.

---

## Deploying

`dist/` is fully static — any host works.

**Existing DigitalOcean droplet.** No `next start` and no Node process; point
nginx at `dist/` and serve files. Suggested headers:

```nginx
root /usr/claradix/claradix-front/dist;

location /assets/ { add_header Cache-Control "public, max-age=31536000, immutable"; }
location /fonts/  { add_header Cache-Control "public, max-age=31536000, immutable"; }
location /img/    { add_header Cache-Control "public, max-age=2592000"; }
location = /index.html { add_header Cache-Control "no-cache"; }

add_header X-Content-Type-Options nosniff;
add_header Referrer-Policy strict-origin-when-cross-origin;
```

Filenames under `/assets/` are content-hashed, so they are safe to cache
forever. `index.html` must not be.

**Vercel / Netlify / Cloudflare Pages.** Build `npm run build`, publish `dist`.

### Before going live

- [ ] Replace `public/img/claradix-logo.png` (currently a 2000px PNG at 62KB
      used at ~130px) with an SVG from the brand files.
- [ ] Set `VITE_LAUNCH_DATE` only when the date is real.
- [ ] Decide the analytics provider and point `VITE_SUBSCRIBE_ENDPOINT` at a
      working endpoint — note that the tokens in the old backend client expired
      in 2024.
- [ ] Confirm the Behance URL; `SITE.social.behance` is still the generic
      behance.net link inherited from the current site.
