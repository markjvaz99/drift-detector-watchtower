import type { Comparison, DriftClassification, GroupStatistics, Metric, MetricValue, Run } from "../types";

export interface RecommendationMetricSummary {
  key: string;
  label: string;
  severity: DriftClassification["severity"];
  basis: string;
  confound: string | null;
  median: number | null;
  min: number | null;
  max: number | null;
  spread: number | null;
  outlierRunIds: string[];
  valuesByRun: Record<string, MetricValue>;
}

export interface RecommendationRunSummary {
  runId: string;
  label: string;
  promptCharCount: number;
  promptText: string;
  dataQualityNotes: {
    type: string;
    description: string;
    estimatedCostImpact: number | null;
    estimatedTurnImpact: number | null;
  }[];
}

export interface RecommendationDurationBreakdown {
  runId: string;
  totalMs: number;
  activePct: number | null;
  approvalWaitPct: number | null;
  otherIdlePct: number | null;
}

export interface RecommendationPayload {
  title: string;
  runs: RecommendationRunSummary[];
  relatedness: {
    hasAnyBelowFullConfidence: boolean;
    pairs: { confidence: string; reasoning: string }[];
  } | null;
  dominantDriver: {
    metricKey: string | null;
    explanation: string;
    supportingNumbers: number[];
    supportingNumberLabels: string[];
  } | null;
  sessionSummary: string | null;
  durationBreakdownByRun: RecommendationDurationBreakdown[];
  metrics: RecommendationMetricSummary[];
}

// Caps the prompt payload to what an LLM needs: headline/pinned metrics (what
// the user is already looking at), anything actually classified as drifted,
// and — unconditionally — tool-usage, duration, and code-volume metrics,
// since a "did the detailed prompt actually help" analysis is meaningless
// without those even when no single one of them individually drifted.
const MAX_METRICS = 60;
const MAX_PROMPT_CHARS = 4000;
const ALWAYS_INCLUDE_PREFIXES = ["tool_usage_", "duration_"];
const ALWAYS_INCLUDE_KEYS = new Set(["net_chars_added", "net_chars_removed"]);

function truncatePrompt(text: string): string {
  return text.length > MAX_PROMPT_CHARS ? `${text.slice(0, MAX_PROMPT_CHARS)}…` : text;
}

function percentOfTotal(value: MetricValue | undefined, totalMs: number): number | null {
  return typeof value === "number" && totalMs > 0 ? Math.round((value / totalMs) * 1000) / 10 : null;
}

export function buildRecommendationPayload(comparison: Comparison, runs: Run[]): RecommendationPayload {
  const statsByKey = new Map<string, GroupStatistics>(comparison.groupStatistics.map((g) => [g.metricKey, g]));
  const classificationByKey = new Map<string, DriftClassification>(
    comparison.driftClassifications.map((d) => [d.metricKey, d]),
  );
  const metricByKey = new Map<string, Metric>(comparison.metrics.map((m) => [m.key, m]));

  const notableKeys = new Set<string>([...comparison.headlineMetricKeys, ...comparison.pinnedMetricKeys]);
  for (const classification of comparison.driftClassifications) {
    if (classification.severity !== "no-drift") {
      notableKeys.add(classification.metricKey);
    }
  }
  for (const metric of comparison.metrics) {
    if (ALWAYS_INCLUDE_KEYS.has(metric.key) || ALWAYS_INCLUDE_PREFIXES.some((prefix) => metric.key.startsWith(prefix))) {
      notableKeys.add(metric.key);
    }
  }

  const metrics: RecommendationMetricSummary[] = [...notableKeys].slice(0, MAX_METRICS).map((key) => {
    const metric = metricByKey.get(key);
    const stats = statsByKey.get(key);
    const classification = classificationByKey.get(key);
    return {
      key,
      label: metric?.label ?? key,
      severity: classification?.severity ?? "cannot-determine",
      basis: classification?.basis ?? "",
      confound: classification?.overriddenByConfound?.description ?? null,
      median: stats?.median ?? null,
      min: stats?.min ?? null,
      max: stats?.max ?? null,
      spread: stats?.spread ?? null,
      outlierRunIds: stats?.outlierRunIds ?? [],
      valuesByRun: metric ? Object.fromEntries(metric.valuesByRun) : {},
    };
  });

  const durationBreakdownByRun: RecommendationDurationBreakdown[] = runs.map((run) => {
    const totalValue = metricByKey.get("duration_total_ms")?.valuesByRun.get(run.id);
    const totalMs = typeof totalValue === "number" ? totalValue : 0;
    return {
      runId: run.id,
      totalMs,
      activePct: percentOfTotal(metricByKey.get("duration_active_ms")?.valuesByRun.get(run.id), totalMs),
      approvalWaitPct: percentOfTotal(metricByKey.get("duration_approval_wait_ms")?.valuesByRun.get(run.id), totalMs),
      otherIdlePct: percentOfTotal(metricByKey.get("duration_other_idle_ms")?.valuesByRun.get(run.id), totalMs),
    };
  });

  const runSummaries: RecommendationRunSummary[] = runs.map((run) => ({
    runId: run.id,
    label: run.label,
    promptCharCount: run.taskPromptText.length,
    promptText: truncatePrompt(run.taskPromptText),
    dataQualityNotes: run.dataQualityNotes.map((note) => ({
      type: note.type,
      description: note.description,
      estimatedCostImpact: note.estimatedCostImpact,
      estimatedTurnImpact: note.estimatedTurnImpact,
    })),
  }));

  return {
    title: comparison.title,
    runs: runSummaries,
    relatedness: comparison.relatednessAssessment
      ? {
          hasAnyBelowFullConfidence: comparison.relatednessAssessment.hasAnyBelowFullConfidence,
          pairs: comparison.relatednessAssessment.pairs.map((pair) => ({
            confidence: pair.confidence,
            reasoning: pair.reasoning,
          })),
        }
      : null,
    dominantDriver: comparison.dominantDriverFinding
      ? {
          metricKey: comparison.dominantDriverFinding.metricKey,
          explanation: comparison.dominantDriverFinding.explanation,
          supportingNumbers: comparison.dominantDriverFinding.supportingNumbers,
          supportingNumberLabels: comparison.dominantDriverFinding.supportingNumberLabels,
        }
      : null,
    sessionSummary: comparison.sessionSummary?.summaryText ?? null,
    durationBreakdownByRun,
    metrics,
  };
}
