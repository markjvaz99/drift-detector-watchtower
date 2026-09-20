import type { GroupStatistics, Metric } from "../types";

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

export function computeGroupStatistics(metric: Metric): GroupStatistics | null {
  const numericEntries = Array.from(metric.valuesByRun.entries()).filter(
    (entry): entry is [string, number] => typeof entry[1] === "number",
  );
  if (numericEntries.length === 0) return null;

  const values = numericEntries.map(([, value]) => value);
  const med = median(values);
  const min = Math.min(...values);
  const max = Math.max(...values);

  // With exactly 2 runs, the MAD of the two points is always exactly half their
  // absolute difference, which makes deviationByRun always ±1 regardless of how
  // small the actual relative difference is (contracts/drift-classification-rules.md:
  // "spread reduces to a single-pair difference measure"). Use the smaller value as
  // the baseline instead so deviation scales with the pair's relative magnitude.
  const baseline = min !== 0 ? min : max;
  let spread: number;
  if (numericEntries.length === 2) {
    spread = baseline;
  } else {
    const mad = median(values.map((v) => Math.abs(v - med))) || 0;
    // MAD collapses to 0 whenever a majority of runs share the same value,
    // even when a genuine single-run outlier exists (e.g. [3,3,9,3,3]) —
    // fall back to the same relative-magnitude baseline used for N=2 so that
    // outlier isn't masked as "no variation" (FR-12).
    spread = mad > 0 ? mad : max !== min ? baseline : 0;
  }

  const deviationByRun = new Map<string, number>();
  for (const [runId, value] of numericEntries) {
    deviationByRun.set(runId, spread === 0 ? 0 : (value - med) / spread);
  }

  let outlierRunIds: string[] = [];
  let maxAbsDeviation = -1;
  for (const [runId, deviation] of deviationByRun) {
    const abs = Math.abs(deviation);
    if (abs > maxAbsDeviation) {
      maxAbsDeviation = abs;
      outlierRunIds = [runId];
    } else if (abs === maxAbsDeviation) {
      outlierRunIds.push(runId);
    }
  }

  return { metricKey: metric.key, median: med, min, max, spread, deviationByRun, outlierRunIds };
}

export function computeAllGroupStatistics(metrics: Metric[]): GroupStatistics[] {
  return metrics
    .map(computeGroupStatistics)
    .filter((stats): stats is GroupStatistics => stats !== null);
}
