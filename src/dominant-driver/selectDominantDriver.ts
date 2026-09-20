import type { Comparison } from "../types";
import { magnitudeForRanking } from "../drift/metricMagnitude";

const QUALIFYING_SEVERITIES = new Set(["moderate", "large", "categorical"]);
const DOMINANCE_MARGIN = 1.5;

export interface DominantDriverSelection {
  hasDominantDriver: boolean;
  metricKey: string | null;
}

/**
 * Selects the single metric most responsible for a comparison's drift, per
 * contracts/dominant-driver-rules.md: excludes uninterpretable/cannot-determine
 * metrics, ranks the rest by |deviationByRun| of their outlier run, and
 * requires the top-ranked metric to lead the runner-up by at least 1.5x.
 */
export function selectDominantDriver(comparison: Comparison): DominantDriverSelection {
  const statsByKey = new Map(comparison.groupStatistics.map((s) => [s.metricKey, s]));

  const qualifying = comparison.driftClassifications.filter((c) => QUALIFYING_SEVERITIES.has(c.severity));
  const ranked = [...qualifying].sort(
    (a, b) => magnitudeForRanking(statsByKey.get(b.metricKey)) - magnitudeForRanking(statsByKey.get(a.metricKey)),
  );

  if (ranked.length === 0) {
    return { hasDominantDriver: false, metricKey: null };
  }

  if (ranked.length === 1) {
    return { hasDominantDriver: true, metricKey: ranked[0].metricKey };
  }

  const topMagnitude = magnitudeForRanking(statsByKey.get(ranked[0].metricKey));
  const runnerUpMagnitude = magnitudeForRanking(statsByKey.get(ranked[1].metricKey));

  if (runnerUpMagnitude === 0 || topMagnitude / runnerUpMagnitude >= DOMINANCE_MARGIN) {
    return { hasDominantDriver: true, metricKey: ranked[0].metricKey };
  }

  return { hasDominantDriver: false, metricKey: null };
}
