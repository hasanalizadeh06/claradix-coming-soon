/**
 * Real User Monitoring for Core Web Vitals.
 *
 * A Lighthouse score is a lab measurement on a simulated device. It tells you
 * nothing about a visitor in Baku on a mid-range Android over 4G. This reports
 * the field data, which is the number that actually ranks.
 *
 * Values are bucketed against Google's own thresholds so the analytics
 * dashboard can show "how many users had a good LCP" without post-processing.
 */

import { onCLS, onINP, onLCP, onFCP, onTTFB, type Metric } from "web-vitals";
import { track } from "./analytics";

const THRESHOLDS: Record<string, [number, number]> = {
  LCP: [2500, 4000],
  INP: [200, 500],
  CLS: [0.1, 0.25],
  FCP: [1800, 3000],
  TTFB: [800, 1800],
};

function rate(name: string, value: number): "good" | "needs-improvement" | "poor" {
  const t = THRESHOLDS[name];
  if (!t) return "good";
  if (value <= t[0]) return "good";
  if (value <= t[1]) return "needs-improvement";
  return "poor";
}

function report(metric: Metric) {
  const value =
    metric.name === "CLS"
      ? Math.round(metric.value * 1000) / 1000
      : Math.round(metric.value);

  track("web_vital", {
    metric: metric.name,
    value,
    rating: rate(metric.name, metric.value),
  });

  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.info(
      `[vitals] ${metric.name} ${value} — ${rate(metric.name, metric.value)}`,
    );
  }
}

export function initVitals() {
  onLCP(report);
  onCLS(report);
  onINP(report);
  onFCP(report);
  onTTFB(report);
}
