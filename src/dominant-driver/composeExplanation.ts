import type { Comparison, DominantDriverFinding, LogFile, Metric, Run } from "../types";
import type { DominantDriverSelection } from "./selectDominantDriver";
import { findEvidenceForMetric } from "../drift/findEvidenceForMetric";
import { isBelowRunCountGate, MIN_RUNS_FOR_DRIFT } from "../drift/runCountGate";

const NO_DOMINANT_DRIVER_MESSAGE =
  "No single dominant driver identified; see the full comparison table for the complete picture.";

function pickOutlierRunId(metric: Metric, stats: Comparison["groupStatistics"][number] | undefined): string | null {
  if (stats && stats.outlierRunIds.length > 0) return stats.outlierRunIds[0];

  // Categorical fallback: the run with the highest raw count is the one that
  // introduced the tool/behavior the other runs don't share.
  let best: string | null = null;
  let bestValue = -Infinity;
  for (const [runId, value] of metric.valuesByRun) {
    if (typeof value === "number" && value > bestValue) {
      bestValue = value;
      best = runId;
    }
  }
  return best;
}

export function composeExplanation(
  comparison: Comparison,
  selection: DominantDriverSelection,
  runs: Run[],
  logFilesById: Map<string, LogFile>,
): DominantDriverFinding {
  if (isBelowRunCountGate(runs.length)) {
    return {
      hasDominantDriver: false,
      metricKey: null,
      explanation: `Dominant driver not assessed: ${runs.length} run${runs.length === 1 ? "" : "s"} provided, and at least ${MIN_RUNS_FOR_DRIFT} are needed to label drift.`,
      supportingEvidence: [],
      supportingNumbers: [],
      supportingNumberLabels: [],
    };
  }

  if (!selection.hasDominantDriver || !selection.metricKey) {
    return {
      hasDominantDriver: false,
      metricKey: null,
      explanation: NO_DOMINANT_DRIVER_MESSAGE,
      supportingEvidence: [],
      supportingNumbers: [],
      supportingNumberLabels: [],
    };
  }

  const metric = comparison.metrics.find((m) => m.key === selection.metricKey);
  if (!metric) {
    return {
      hasDominantDriver: false,
      metricKey: null,
      explanation: NO_DOMINANT_DRIVER_MESSAGE,
      supportingEvidence: [],
      supportingNumbers: [],
      supportingNumberLabels: [],
    };
  }

  const stats = comparison.groupStatistics.find((s) => s.metricKey === selection.metricKey);
  const outlierRunId = pickOutlierRunId(metric, stats);
  const outlierRun = runs.find((r) => r.id === outlierRunId);
  const outlierLabel = outlierRun?.label ?? "One run";
  const outlierValue = outlierRunId ? metric.valuesByRun.get(outlierRunId) : undefined;

  const direction =
    stats && outlierRunId
      ? (stats.deviationByRun.get(outlierRunId) ?? 0) >= 0
        ? "is higher"
        : "is lower"
      : "differs";

  const explanation = `${outlierLabel}'s drift is mainly driven by ${metric.label}, which ${direction} compared to the group.`;

  const logFile = outlierRun ? logFilesById.get(outlierRun.sourceLogFileId) : undefined;
  const supportingEvidence = logFile ? findEvidenceForMetric(logFile, metric.key) : [];

  const supportingNumbers: number[] = [];
  const supportingNumberLabels: string[] = [];
  if (typeof outlierValue === "number") {
    supportingNumbers.push(outlierValue);
    supportingNumberLabels.push(`${outlierLabel} (${metric.label})`);
  }
  if (stats) {
    supportingNumbers.push(stats.median);
    supportingNumberLabels.push("Group median");
    if (outlierRunId) {
      supportingNumbers.push(Math.abs(stats.deviationByRun.get(outlierRunId) ?? 0));
      supportingNumberLabels.push("Deviation from median");
    }
  } else {
    const presentInRunCount = Array.from(metric.valuesByRun.values()).filter(
      (v) => typeof v === "number" && v > 0,
    ).length;
    supportingNumbers.push(presentInRunCount, metric.valuesByRun.size);
    supportingNumberLabels.push("Runs with this behavior", "Total runs compared");
  }

  return {
    hasDominantDriver: true,
    metricKey: selection.metricKey,
    explanation,
    supportingEvidence,
    supportingNumbers: supportingNumbers.slice(0, 3),
    supportingNumberLabels: supportingNumberLabels.slice(0, 3),
  };
}
