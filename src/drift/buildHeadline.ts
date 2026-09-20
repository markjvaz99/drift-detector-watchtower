import type { Comparison } from "../types";
import { magnitudeForRanking } from "./metricMagnitude";

const HEADLINE_SEVERITIES = new Set(["moderate", "large", "categorical"]);
const HEADLINE_CAP = 6;

/**
 * Selects which metrics qualify for the headline/KPI section (FR-25, FR-26):
 * a metric qualifies if its severity is above "no-drift" (moderate/large/
 * categorical — explicitly excluding cannot-determine/uninterpretable, per
 * SC-006) or it's pinned. When more than 6 qualify, keep only the top 6 by
 * relative magnitude of change.
 */
export function buildHeadline(comparison: Comparison): { headlineMetricKeys: string[] } {
  const statsByKey = new Map(comparison.groupStatistics.map((s) => [s.metricKey, s]));

  const qualifying = comparison.driftClassifications.filter(
    (c) => HEADLINE_SEVERITIES.has(c.severity) || comparison.pinnedMetricKeys.includes(c.metricKey),
  );

  const ranked = [...qualifying].sort(
    (a, b) => magnitudeForRanking(statsByKey.get(b.metricKey)) - magnitudeForRanking(statsByKey.get(a.metricKey)),
  );

  return { headlineMetricKeys: ranked.slice(0, HEADLINE_CAP).map((c) => c.metricKey) };
}
