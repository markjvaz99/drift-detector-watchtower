import type { DriftClassification, DriftSeverity, GroupStatistics } from "../types";

export function classifySeverityFromStatistics(stats: GroupStatistics): DriftClassification {
  const maxAbsDeviation = Math.max(
    ...Array.from(stats.deviationByRun.values()).map((d) => Math.abs(d)),
  );

  let severity: DriftSeverity;
  let basis: string;
  if (maxAbsDeviation < 1) {
    severity = "no-drift";
    basis = `${maxAbsDeviation.toFixed(2)}× group spread`;
  } else if (maxAbsDeviation <= 3) {
    severity = "moderate";
    basis = `${maxAbsDeviation.toFixed(2)}× group spread`;
  } else {
    severity = "large";
    basis = `${maxAbsDeviation.toFixed(2)}× group spread`;
  }

  return { metricKey: stats.metricKey, severity, basis, overriddenByConfound: null };
}
