/**
 * Provider-agnostic analytics facade.
 *
 * Nothing here loads a vendor script by itself. `VITE_ANALYTICS_PROVIDER`
 * decides what gets injected, and injection always happens after the page is
 * interactive so a tag manager can never compete with the first paint.
 *
 * Default is "none": the build ships zero third-party JavaScript until someone
 * makes a deliberate decision about it.
 */

type Provider = "none" | "plausible" | "umami" | "ga4";

const provider = (import.meta.env.VITE_ANALYTICS_PROVIDER ?? "none") as Provider;
const domain = import.meta.env.VITE_ANALYTICS_DOMAIN ?? "";
const scriptUrl = import.meta.env.VITE_ANALYTICS_SCRIPT ?? "";
const websiteId = import.meta.env.VITE_ANALYTICS_ID ?? "";

type Props = Record<string, string | number | boolean>;

declare global {
  interface Window {
    plausible?: (event: string, opts?: { props?: Props }) => void;
    umami?: { track: (event: string, data?: Props) => void };
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

let ready = false;
const queue: Array<[string, Props | undefined]> = [];

function injectScript(src: string, attrs: Record<string, string> = {}) {
  const el = document.createElement("script");
  el.src = src;
  el.defer = true;
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  document.head.appendChild(el);
}

function whenIdle(fn: () => void) {
  if ("requestIdleCallback" in window) {
    (window as Window & { requestIdleCallback: (cb: () => void, o?: { timeout: number }) => void })
      .requestIdleCallback(fn, { timeout: 4000 });
  } else {
    setTimeout(fn, 2000);
  }
}

export function initAnalytics() {
  if (provider === "none") {
    ready = true;
    queue.length = 0;
    return;
  }

  whenIdle(() => {
    switch (provider) {
      case "plausible":
        injectScript(
          scriptUrl || "https://plausible.io/js/script.tagged-events.js",
          { "data-domain": domain },
        );
        break;
      case "umami":
        injectScript(scriptUrl, { "data-website-id": websiteId });
        break;
      case "ga4":
        window.dataLayer = window.dataLayer || [];
        window.gtag = function gtag() {
          // eslint-disable-next-line prefer-rest-params
          window.dataLayer!.push(arguments);
        };
        window.gtag("js", new Date());
        window.gtag("config", websiteId, { send_page_view: true });
        injectScript(`https://www.googletagmanager.com/gtag/js?id=${websiteId}`);
        break;
    }
    ready = true;
    for (const [event, props] of queue) dispatch(event, props);
    queue.length = 0;
  });
}

function dispatch(event: string, props?: Props) {
  switch (provider) {
    case "plausible":
      window.plausible?.(event, props ? { props } : undefined);
      break;
    case "umami":
      window.umami?.track(event, props);
      break;
    case "ga4":
      window.gtag?.("event", event, props);
      break;
  }
}

/**
 * The KPI surface for this page. A coming-soon page has exactly one job, so the
 * event list is deliberately short — every event here maps to a question
 * somebody will actually ask.
 */
export function track(event: string, props?: Props) {
  if (provider === "none") return;
  if (!ready) {
    queue.push([event, props]);
    return;
  }
  dispatch(event, props);
}

/** Fires once when the WebGL scene has actually rendered its first frame. */
export function trackSceneReady(tier: string, ms: number) {
  track("scene_ready", { tier, ms: Math.round(ms) });
}

/** Fires when we had to fall back to the static poster instead of the scene. */
export function trackSceneFallback(reason: string) {
  track("scene_fallback", { reason });
}
