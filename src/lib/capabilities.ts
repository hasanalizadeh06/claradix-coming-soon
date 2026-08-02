/**
 * Device capability probing.
 *
 * The scene must never be the reason a low-end phone burns to the ground, and it
 * must never be the reason someone with a vestibular disorder gets motion sick.
 * Everything downstream reads its budget from here rather than hardcoding
 * particle counts.
 */

export type QualityTier = "high" | "medium" | "low" | "static";

export interface Capabilities {
  tier: QualityTier;
  /** Upper bound for renderer.setPixelRatio. Retina at 3x is never worth it. */
  maxPixelRatio: number;
  /** Multiplier applied to a scene's nominal particle/strand count. */
  densityScale: number;
  /** Post-processing bloom is the single most expensive pass we run. */
  bloom: boolean;
  prefersReducedMotion: boolean;
  supportsWebGL: boolean;
  isTouch: boolean;
}

/**
 * One probe, one context.
 *
 * Browsers cap the number of live WebGL contexts and drop the oldest when the
 * cap is hit. Opening a throwaway context per question — one to test support,
 * another to read the GPU name — burns two slots and leaves "CONTEXT_LOST"
 * warnings in the console before the real renderer has even started. So the
 * probe answers everything in a single pass and then explicitly releases the
 * context instead of waiting for garbage collection.
 *
 * The unmasked renderer string is the only reliable way to tell an integrated
 * laptop GPU from a discrete one; privacy-hardened browsers withhold it, and
 * null is treated as "no information", not as "weak".
 */
function probeGpu(): { supported: boolean; name: string | null } {
  try {
    if (!window.WebGLRenderingContext) return { supported: false, name: null };

    const canvas = document.createElement("canvas");
    const gl = (canvas.getContext("webgl2") ??
      canvas.getContext("webgl")) as WebGLRenderingContext | null;
    if (!gl) return { supported: false, name: null };

    let name: string | null = null;
    const info = gl.getExtension("WEBGL_debug_renderer_info");
    if (info) {
      const value = gl.getParameter(info.UNMASKED_RENDERER_WEBGL);
      if (typeof value === "string") name = value.toLowerCase();
    }

    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return { supported: true, name };
  } catch {
    return { supported: false, name: null };
  }
}

export function detectCapabilities(): Capabilities {
  const prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;
  const { supported: supportsWebGL, name: gpu } = probeGpu();
  const isTouch = window.matchMedia("(pointer: coarse)").matches;

  if (!supportsWebGL || prefersReducedMotion) {
    return {
      tier: "static",
      maxPixelRatio: 1,
      densityScale: 0,
      bloom: false,
      prefersReducedMotion,
      supportsWebGL,
      isTouch,
    };
  }

  const cores = navigator.hardwareConcurrency ?? 4;
  // deviceMemory is Chromium-only; absence is not evidence of a weak device.
  const memory = (navigator as Navigator & { deviceMemory?: number })
    .deviceMemory;
  const shortestSide = Math.min(window.screen.width, window.screen.height);

  let score = 0;
  if (cores >= 8) score += 2;
  else if (cores >= 4) score += 1;
  if (memory === undefined) score += 1;
  else if (memory >= 8) score += 2;
  else if (memory >= 4) score += 1;
  if (gpu) {
    if (/apple m\d|rtx|radeon rx|geforce (gtx|rtx)/.test(gpu)) score += 3;
    else if (/apple a\d{2}|adreno 7|mali-g7|iris xe/.test(gpu)) score += 2;
    else if (/intel|uhd|mali|adreno|powervr/.test(gpu)) score += 0;
  }
  if (isTouch && shortestSide < 400) score -= 1;

  if (score >= 5) {
    return {
      tier: "high",
      maxPixelRatio: 2,
      densityScale: 1,
      bloom: true,
      prefersReducedMotion,
      supportsWebGL,
      isTouch,
    };
  }
  if (score >= 3) {
    return {
      tier: "medium",
      maxPixelRatio: 1.75,
      densityScale: 0.6,
      bloom: true,
      prefersReducedMotion,
      supportsWebGL,
      isTouch,
    };
  }
  return {
    tier: "low",
    maxPixelRatio: 1.25,
    densityScale: 0.35,
    bloom: false,
    prefersReducedMotion,
    supportsWebGL,
    isTouch,
  };
}
