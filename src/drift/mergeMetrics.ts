import type { Metric } from "../types";
import type { RunMetricValue } from "../metrics/types";

export function mergeMetrics(perRun: Array<{ runId: string; metrics: RunMetricValue[] }>): Metric[] {
  const byKey = new Map<string, Metric>();

  for (const { runId, metrics } of perRun) {
    for (const metric of metrics) {
      if (!byKey.has(metric.key)) {
        byKey.set(metric.key, {
          key: metric.key,
          label: metric.label,
          valuesByRun: new Map(),
          denominatorLabel: metric.denominatorLabel,
        });
      }
      byKey.get(metric.key)!.valuesByRun.set(runId, metric.value);
    }
  }

  for (const [, metric] of byKey) {
    const isToolUsageMetric = metric.key.startsWith("tool_usage_");
    for (const { runId } of perRun) {
      if (!metric.valuesByRun.has(runId)) {
        metric.valuesByRun.set(runId, isToolUsageMetric ? 0 : "not-available");
      }
    }
  }

  return Array.from(byKey.values());
}
