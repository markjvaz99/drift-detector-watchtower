import type { Comparison } from "../types";
import { magnitudeForRanking } from "./metricMagnitude";

const HEADLINE_SEVERITIES = new Set(["moderate", "large", "categorical"]);
const HEADLINE_CAP = 6;

// Human approval-wait/idle time reflects how long a person took to respond,
// not agent behavior — a large swing there is rarely the story worth leading
// with, so it's excluded from the automatic ranking (an explicit pin still
// overrides this, same as any other metric).
const HEADLINE_EXCLUDED_KEYS = new Set(["duration_approval_wait_ms", "duration_other_idle_ms"]);

// Metrics a user evaluating "did this session cost more / take longer" cares
// about first — when they qualify, they're preferred over other drifted
// metrics competing for the same headline slots, not forced in regardless of
// whether they actually drifted.
const PRIORITY_KEYS = new Set(["output_tokens", "cost_usd", "total_tokens", "duration_active_ms"]);

/**
 * Selects which metrics qualify for the headline/KPI section (FR-25, FR-26):
 * a metric qualifies if its severity is above "no-drift" (moderate/large/
 * categorical — explicitly excluding cannot-determine/uninterpretable, per
 * SC-006) or it's pinned. When more than 6 qualify, keep only the top 6,
 * preferring priority metrics first and otherwise ranking by relative
 * magnitude of change.
 */
export function buildHeadline(comparison: Comparison): { headlineMetricKeys: string[] } {
  const statsByKey = new Map(comparison.groupStatistics.map((s) => [s.metricKey, s]));

  const qualifying = comparison.driftClassifications.filter((c) => {
    const pinned = comparison.pinnedMetricKeys.includes(c.metricKey);
    if (pinned) return true;
    if (HEADLINE_EXCLUDED_KEYS.has(c.metricKey)) return false;
    return HEADLINE_SEVERITIES.has(c.severity);
  });

  const ranked = [...qualifying].sort((a, b) => {
    const priorityDelta = Number(PRIORITY_KEYS.has(b.metricKey)) - Number(PRIORITY_KEYS.has(a.metricKey));
    if (priorityDelta !== 0) return priorityDelta;
    return magnitudeForRanking(statsByKey.get(b.metricKey)) - magnitudeForRanking(statsByKey.get(a.metricKey));
  });

  return { headlineMetricKeys: ranked.slice(0, HEADLINE_CAP).map((c) => c.metricKey) };
}
