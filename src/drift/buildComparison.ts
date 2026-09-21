import { computeRunMetrics } from "../metrics/computeRunMetrics";
import { mergeMetrics } from "./mergeMetrics";
import { computeAllGroupStatistics } from "./groupStatistics";
import { classifySeverityFromStatistics } from "./classifySeverity";
import { isCategoricalToolUsageDifference } from "./categoricalDifference";
import { detectConfoundFindings, applyConfoundOverrides } from "./applyConfoundOverrides";
import { generateComparisonTitle } from "./generateComparisonTitle";
import { buildHeadline } from "./buildHeadline";
import { selectDominantDriver } from "../dominant-driver/selectDominantDriver";
import { composeExplanation } from "../dominant-driver/composeExplanation";
import type { Comparison, DriftClassification, LogFile, RelatednessAssessment, Run } from "../types";

export function buildComparison(
  runs: Run[],
  logFilesById: Map<string, LogFile>,
  relatednessAssessment: RelatednessAssessment | null,
  pinnedMetricKeys: string[] = [],
): Comparison {
  const perRunMetrics = runs.map((run) => ({
    runId: run.id,
    metrics: computeRunMetrics(logFilesById.get(run.sourceLogFileId)!),
  }));

  const metrics = mergeMetrics(perRunMetrics);
  const groupStatistics = computeAllGroupStatistics(metrics);
  const statsByKey = new Map(groupStatistics.map((s) => [s.metricKey, s]));

  let driftClassifications: DriftClassification[] = metrics.map((metric) => {
    const stats = statsByKey.get(metric.key);
    if (!stats) {
      return { metricKey: metric.key, severity: "cannot-determine", basis: "insufficient data", overriddenByConfound: null };
    }
    const classification = classifySeverityFromStatistics(stats);
    if (isCategoricalToolUsageDifference(metric)) {
      return { ...classification, severity: "categorical", basis: "present in some but not all runs" };
    }
    return classification;
  });

  const confoundFindings = detectConfoundFindings(runs, metrics, relatednessAssessment, groupStatistics);
  driftClassifications = applyConfoundOverrides(driftClassifications, confoundFindings);

  const comparisonWithoutHeadline: Comparison = {
    runIds: runs.map((r) => r.id),
    title: generateComparisonTitle(runs, logFilesById),
    relatednessAssessment,
    metrics,
    groupStatistics,
    driftClassifications,
    headlineMetricKeys: [],
    pinnedMetricKeys,
    dominantDriverFinding: null,
    sessionSummary: null,
  };

  const { headlineMetricKeys } = buildHeadline(comparisonWithoutHeadline);
  const comparisonWithHeadline = { ...comparisonWithoutHeadline, headlineMetricKeys };

  const dominantDriverFinding = composeExplanation(
    comparisonWithHeadline,
    selectDominantDriver(comparisonWithHeadline),
    runs,
    logFilesById,
  );

  return { ...comparisonWithHeadline, dominantDriverFinding };
}
