import { renderToString } from "react-dom/server";
import { App } from "./App";
import { COPY } from "./lib/copy";
import { SITE } from "./lib/config";

/**
 * Build-time rendering.
 *
 * Without this, a Vite SPA ships `<div id="root"></div>` and the entire page —
 * headline, slogan, contact details — exists only after JavaScript runs. Google
 * will usually render it eventually. The AI crawlers that increasingly decide
 * what gets recommended largely will not, and neither will a link preview.
 *
 * It also fixes a subtler problem: if React replaced already-painted static
 * markup, the browser would record a *second*, later Largest Contentful Paint.
 * Prerendering the same tree the client hydrates means the headline is painted
 * once, from HTML, and never repainted.
 */

export function render(): string {
  return renderToString(<App />);
}

export function meta() {
  return {
    title: `${SITE.name} — ${COPY.headline[0]} ${COPY.headline[1]}`,
    description: `${COPY.documentSummary} ${SITE.name} is a digital agency in Baku, Azerbaijan. Our new site is in development — leave your email to hear first.`,
  };
}
