import type { GroupStatistics } from "../types";

/**
 * A metric's relative magnitude of change for ranking purposes. Categorical
 * metrics (no GroupStatistics, since they aren't numeric) are treated as tied
 * for the maximum possible magnitude, since a present/absent difference has
 * no natural continuous scale (contracts/dominant-driver-rules.md).
 */
export function magnitudeForRanking(stats: GroupStatistics | undefined): number {
  if (!stats) return Infinity;
  const deviations = Array.from(stats.deviationByRun.values()).map((d) => Math.abs(d));
  return deviations.length > 0 ? Math.max(...deviations) : 0;
}
