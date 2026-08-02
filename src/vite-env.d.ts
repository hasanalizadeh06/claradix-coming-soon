/// <reference types="vite/client" />

/**
 * Typed environment. Declaring these means a typo in an env var name is a build
 * error rather than a feature that silently does nothing in production.
 */
interface ImportMetaEnv {
  readonly VITE_LAUNCH_DATE?: string;
  readonly VITE_SUBSCRIBE_ENDPOINT?: string;
  readonly VITE_ANALYTICS_PROVIDER?: "none" | "plausible" | "umami" | "ga4";
  readonly VITE_ANALYTICS_DOMAIN?: string;
  readonly VITE_ANALYTICS_SCRIPT?: string;
  readonly VITE_ANALYTICS_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
