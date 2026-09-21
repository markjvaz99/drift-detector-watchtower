import type { MetricValue } from "../types";
import type { BusinessStatCategory } from "./types";

export type MetricShape = "absolute" | "efficiency" | "ratio";

const RATIO_SUFFIX_PATTERN = /(_ratio|_rate)$/;
const DURATION_KEY_PATTERN = /^duration_.*_ms$/;
const PER_UNIT_PATTERN = /_per_/;
const COMPACT_TOKEN_KEYS = new Set([
  "total_tokens",
  "input_tokens",
  "output_tokens",
  "cache_read_tokens",
  "cache_creation_tokens",
]);
const WORKLOAD_KEYS = new Set(["turns", "net_chars_added", "net_chars_removed"]);
const QUALITY_KEYS = new Set([
  "failed_call_count",
  "failed_call_rate",
  "rejection_count",
  "immediate_recovery_count",
]);

// Every business stat's category/shape is derived from its metric key alone
// (never chosen by the AI) so the taxonomy stays consistent and can't be
// silently redefined per-response.
export function categoryForMetricKey(key: string): BusinessStatCategory {
  if (key === "cost_usd") return "cost";
  if (key.startsWith("duration_")) return "time";
  if (key.startsWith("tool_usage_") || key === "tool_calls") return "tool_usage";
  if (QUALITY_KEYS.has(key)) return "quality";
  if (PER_UNIT_PATTERN.test(key) || key === "overhead_growth_multiple" || key.startsWith("activity_ratio_")) {
    return "efficiency";
  }
  if (WORKLOAD_KEYS.has(key) || COMPACT_TOKEN_KEYS.has(key)) return "workload";
  return "other";
}

export function shapeForMetricKey(key: string): MetricShape {
  if (RATIO_SUFFIX_PATTERN.test(key) || key.startsWith("activity_ratio_")) return "ratio";
  if (PER_UNIT_PATTERN.test(key) || key === "overhead_growth_multiple") return "efficiency";
  return "absolute";
}

function formatDurationMs(ms: number): string {
  const totalSeconds = ms / 1000;
  if (totalSeconds < 60) return `${totalSeconds.toFixed(1)} sec`;
  const totalMinutes = totalSeconds / 60;
  if (totalMinutes < 60) return `${totalMinutes.toFixed(1)} min`;
  return `${(totalMinutes / 60).toFixed(1)} hr`;
}

function formatCompactNumber(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toLocaleString("en-US");
}

export function formatMetricValue(key: string, value: MetricValue): string {
  if (value === "not-available") return "N/A";
  const shape = shapeForMetricKey(key);
  if (shape === "ratio") return `${(value * 100).toFixed(1)}%`;
  if (key === "cost_usd") return `$${value.toFixed(2)}`;
  if (DURATION_KEY_PATTERN.test(key)) return formatDurationMs(value);
  if (COMPACT_TOKEN_KEYS.has(key)) return formatCompactNumber(value);
  if (shape === "efficiency") {
    return value.toLocaleString("en-US", { maximumFractionDigits: Math.abs(value) < 10 ? 2 : 1 });
  }
  if (Number.isInteger(value)) return value.toLocaleString("en-US");
  return value.toLocaleString("en-US", { maximumFractionDigits: 1 });
}

// A short delta descriptor for exactly two numeric values. Durations and
// ratios read most clearly as "A vs B" (a percent-of-a-percent, or a
// multiple of minutes, obscures rather than clarifies); everything else
// gets a multiplier once the gap is large, otherwise a signed percentage —
// both computed here, never by the model.
export function formatComparisonText(
  key: string,
  a: number,
  b: number,
  formattedA: string,
  formattedB: string,
): string {
  const shape = shapeForMetricKey(key);
  const isDuration = DURATION_KEY_PATTERN.test(key);
  if (isDuration || shape === "ratio") {
    return `${formattedA} vs ${formattedB}`;
  }
  if (a === 0 && b === 0) return "No difference (both zero)";
  if (a === 0 || b === 0) return `${formattedA} vs ${formattedB}`;
  const bigger = Math.max(a, b);
  const smaller = Math.min(a, b);
  const ratio = bigger / smaller;
  if (ratio < 1.05) return "No material difference";
  if (ratio >= 3) return `${ratio.toFixed(1)}x`;
  const signedPct = ((a - b) / b) * 100;
  const sign = signedPct >= 0 ? "+" : "";
  return `${sign}${Math.round(signedPct)}%`;
}
