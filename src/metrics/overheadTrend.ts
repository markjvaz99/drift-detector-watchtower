import { isMainTaskApiCall } from "../parsing/excludeNonTaskCalls";
import type { LogFile } from "../types";
import type { RunMetricValue } from "./types";

function num(value: unknown): number {
  return typeof value === "number" ? value : 0;
}

export interface OverheadTrendPoint {
  bucketIndex: number;
  ratio: number;
}

export function computeOverheadTrend(logFile: LogFile, bucketCount = 4): OverheadTrendPoint[] {
  const calls = logFile.events.filter(isMainTaskApiCall);
  if (calls.length === 0) return [];

  const effectiveBuckets = Math.min(bucketCount, calls.length);
  const bucketSize = Math.ceil(calls.length / effectiveBuckets);
  const points: OverheadTrendPoint[] = [];

  for (let bucketIndex = 0; bucketIndex < effectiveBuckets; bucketIndex += 1) {
    const start = bucketIndex * bucketSize;
    const bucketCalls = calls.slice(start, start + bucketSize);
    const cacheRead = bucketCalls.reduce((sum, e) => sum + num(e.attributes["cache_read_tokens"]), 0);
    const output = bucketCalls.reduce((sum, e) => sum + num(e.attributes["output_tokens"]), 0);
    points.push({ bucketIndex, ratio: output > 0 ? cacheRead / output : 0 });
  }

  return points;
}

export function computeOverheadTrendMetrics(logFile: LogFile): RunMetricValue[] {
  const points = computeOverheadTrend(logFile);
  if (points.length === 0) {
    return [
      { key: "overhead_growth_multiple", label: "Overhead-ratio growth", value: "not-available", denominatorLabel: "" },
    ];
  }
  const first = points[0].ratio || 0.0001;
  const last = points[points.length - 1].ratio;
  return [
    {
      key: "overhead_growth_multiple",
      label: "Overhead-ratio growth",
      value: last / first,
      denominatorLabel: `across ${points.length} quartiles`,
    },
  ];
}
