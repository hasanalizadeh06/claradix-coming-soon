import { StrictMode } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import { App } from "@/App";
import { initAnalytics } from "@/lib/analytics";
import { initVitals } from "@/lib/vitals";

export function mount() {
  const root = document.getElementById("root");
  if (!root) throw new Error("#root missing");

  const tree = (
    <StrictMode>
      <App />
    </StrictMode>
  );

  // Production builds are prerendered, so we hydrate and the painted headline
  // is never replaced. `vite dev` serves the raw template with an empty root,
  // so fall back to a normal client render there.
  //
  // firstElementChild, NOT firstChild. The template's root is
  // `<div id="root"><!--app-html--></div>`, and that placeholder is a comment
  // node — which is a perfectly good firstChild. So dev took the hydrate branch
  // every single time, tried to reconcile the whole app against an empty root,
  // and threw a hydration mismatch on every load. Harmless in production, where
  // the placeholder has been replaced by real markup, which is exactly why it
  // survived: the bug only existed in the environment where nobody was checking
  // the console, and the comment above it asserted the opposite.
  if (root.firstElementChild) hydrateRoot(root, tree);
  else createRoot(root).render(tree);

  initAnalytics();
  initVitals();
}
