import type {
  Comparison,
  DataQualityNote,
  GroupStatistics,
  Metric,
  MetricValue,
  Run,
  ToolCallOutcome,
} from "../types";

export const CURRENT_FORMAT_VERSION = 1;

export interface ExportedRunIdentity {
  id: string;
  label: string;
  sourceLogFileId: string;
  dataQualityNotes: DataQualityNote[];
  rejectedToolCalls: ToolCallOutcome[];
  hasCompletedTaskActivity: boolean;
}

interface SerializedMetric {
  key: string;
  label: string;
  denominatorLabel: string;
  valuesByRun: [string, MetricValue][];
}

interface SerializedGroupStatistics {
  metricKey: string;
  median: number;
  min: number;
  max: number;
  spread: number;
  deviationByRun: [string, number][];
  outlierRunIds: string[];
}

export interface SerializedComparison {
  runIds: string[];
  title: string;
  relatednessAssessment: Comparison["relatednessAssessment"];
  metrics: SerializedMetric[];
  groupStatistics: SerializedGroupStatistics[];
  driftClassifications: Comparison["driftClassifications"];
  headlineMetricKeys: string[];
  pinnedMetricKeys: string[];
  dominantDriverFinding: Comparison["dominantDriverFinding"];
  sessionSummary: Comparison["sessionSummary"];
}

export interface ReportExportFile {
  formatVersion: number;
  exportedAt: string;
  runs: ExportedRunIdentity[];
  comparison: SerializedComparison;
}

function serializeMetric(metric: Metric): SerializedMetric {
  return {
    key: metric.key,
    label: metric.label,
    denominatorLabel: metric.denominatorLabel,
    valuesByRun: Array.from(metric.valuesByRun.entries()),
  };
}

function deserializeMetric(serialized: SerializedMetric): Metric {
  return {
    key: serialized.key,
    label: serialized.label,
    denominatorLabel: serialized.denominatorLabel,
    valuesByRun: new Map(serialized.valuesByRun),
  };
}

function serializeGroupStatistics(stats: GroupStatistics): SerializedGroupStatistics {
  return {
    metricKey: stats.metricKey,
    median: stats.median,
    min: stats.min,
    max: stats.max,
    spread: stats.spread,
    deviationByRun: Array.from(stats.deviationByRun.entries()),
    outlierRunIds: stats.outlierRunIds,
  };
}

function deserializeGroupStatistics(serialized: SerializedGroupStatistics): GroupStatistics {
  return {
    metricKey: serialized.metricKey,
    median: serialized.median,
    min: serialized.min,
    max: serialized.max,
    spread: serialized.spread,
    deviationByRun: new Map(serialized.deviationByRun),
    outlierRunIds: serialized.outlierRunIds,
  };
}

/**
 * Per contracts/export-format.md's privacy boundary: raw LogFile.events, the
 * full Run.taskPromptText, and any file/code content beyond a Metric's
 * already-computed numeric value are never included.
 */
export function serializeComparison(comparison: Comparison, runs: Run[]): ReportExportFile {
  return {
    formatVersion: CURRENT_FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    runs: runs.map((run) => ({
      id: run.id,
      label: run.label,
      sourceLogFileId: run.sourceLogFileId,
      dataQualityNotes: run.dataQualityNotes,
      rejectedToolCalls: run.rejectedToolCalls,
      hasCompletedTaskActivity: run.hasCompletedTaskActivity,
    })),
    comparison: {
      runIds: comparison.runIds,
      title: comparison.title,
      relatednessAssessment: comparison.relatednessAssessment,
      metrics: comparison.metrics.map(serializeMetric),
      groupStatistics: comparison.groupStatistics.map(serializeGroupStatistics),
      driftClassifications: comparison.driftClassifications,
      headlineMetricKeys: comparison.headlineMetricKeys,
      pinnedMetricKeys: comparison.pinnedMetricKeys,
      dominantDriverFinding: comparison.dominantDriverFinding,
      sessionSummary: comparison.sessionSummary,
    },
  };
}

export class UnrecognizedFormatVersionError extends Error {
  constructor(version: number) {
    super(
      `This report was exported by a newer version of the app (format version ${version}); ` +
        "please upgrade to reopen it.",
    );
    this.name = "UnrecognizedFormatVersionError";
  }
}

export function deserializeComparison(file: ReportExportFile): { comparison: Comparison; runs: Run[] } {
  if (file.formatVersion !== CURRENT_FORMAT_VERSION) {
    throw new UnrecognizedFormatVersionError(file.formatVersion);
  }

  const runs: Run[] = file.runs.map((identity) => ({
    id: identity.id,
    sourceLogFileId: identity.sourceLogFileId,
    label: identity.label,
    taskPromptText: "",
    dataQualityNotes: identity.dataQualityNotes,
    rejectedToolCalls: identity.rejectedToolCalls,
    hasCompletedTaskActivity: identity.hasCompletedTaskActivity,
  }));

  const comparison: Comparison = {
    runIds: file.comparison.runIds,
    title: file.comparison.title,
    relatednessAssessment: file.comparison.relatednessAssessment,
    metrics: file.comparison.metrics.map(deserializeMetric),
    groupStatistics: file.comparison.groupStatistics.map(deserializeGroupStatistics),
    driftClassifications: file.comparison.driftClassifications,
    headlineMetricKeys: file.comparison.headlineMetricKeys,
    pinnedMetricKeys: file.comparison.pinnedMetricKeys,
    dominantDriverFinding: file.comparison.dominantDriverFinding,
    sessionSummary: file.comparison.sessionSummary,
  };

  return { comparison, runs };
}
