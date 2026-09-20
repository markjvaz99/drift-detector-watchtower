import type { GroupStatistics, Metric } from "../types";

export interface OutlierInfo {
  runId: string;
  value: number;
  deviation: number;
}

/**
 * Resolves GroupStatistics.outlierRunIds back to each outlier's raw metric
 * value, so the UI can show the counts that actually drove the outlier
 * status (FR-12) rather than just the deviation number.
 */
export function identifyOutliers(stats: GroupStatistics, metric: Metric): OutlierInfo[] {
  return stats.outlierRunIds.map((runId) => {
    const value = metric.valuesByRun.get(runId);
    return {
      runId,
      value: typeof value === "number" ? value : NaN,
      deviation: stats.deviationByRun.get(runId) ?? 0,
    };
  });
}
