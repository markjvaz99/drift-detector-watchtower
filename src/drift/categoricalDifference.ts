import type { Metric } from "../types";

export function isCategoricalToolUsageDifference(metric: Metric): boolean {
  if (!metric.key.startsWith("tool_usage_")) return false;
  const values = Array.from(metric.valuesByRun.values()).filter(
    (v): v is number => typeof v === "number",
  );
  const hasNonZero = values.some((v) => v > 0);
  const hasZero = values.some((v) => v === 0);
  return hasNonZero && hasZero;
}
