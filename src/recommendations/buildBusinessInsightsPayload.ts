import type { Comparison, DriftClassification, GroupStatistics, LogFile, Metric, Run } from "../types";
import type { BusinessStatCategory } from "./types";
import { extractPromptRecords } from "../parsing/extractPromptTexts";
import {
  categoryForMetricKey,
  formatComparisonText,
  formatMetricValue,
  shapeForMetricKey,
  type MetricShape,
} from "./formatBusinessValue";

export interface BusinessStatCandidateValue {
  runId: string;
  runLabel: string;
  formattedValue: string;
}

export interface BusinessStatCandidate {
  metricKey: string;
  label: string;
  category: BusinessStatCategory;
  shape: MetricShape;
  values: BusinessStatCandidateValue[];
  comparisonText: string;
  // max/min across runs — a quick prioritization signal for "how big is this
  // gap", not a statistical measure.
  ratioSpread: number | null;
  severity: DriftClassification["severity"];
  confound: string | null;
  // Cross-reference to this metric's absolute<->efficiency counterpart (e.g.
  // total_tokens <-> tokens_per_turn), so a big total can be checked against
  // whether the per-unit rate actually moved too.
  pairedMetricKey: string | null;
}

export interface BusinessInsightsRunSummary {
  runId: string;
  label: string;
  // Every real user-typed prompt in the session, joined together — not just
  // the last one (which is often a trivial "/exit" or similar).
  promptText: string;
  promptCharCount: number;
  promptCount: number;
  dataQualityNotes: {
    type: string;
    description: string;
    estimatedCostImpact: number | null;
    estimatedTurnImpact: number | null;
  }[];
}

export interface PromptDetailComparison {
  moreDetailedRunId: string;
  moreDetailedRunLabel: string;
  moreDetailedCharCount: number;
  lessDetailedRunId: string;
  lessDetailedRunLabel: string;
  lessDetailedCharCount: number;
  // moreDetailedCharCount / lessDetailedCharCount — how much longer the more
  // detailed prompt was, computed here so the model states this ratio
  // rather than estimating it.
  charCountRatio: number;
}

export interface BusinessInsightsPayload {
  title: string;
  runs: BusinessInsightsRunSummary[];
  // Only set for exactly two runs with distinct, non-empty prompt lengths —
  // grounds any "a more detailed prompt did better" claim in an actual,
  // computed character-count gap instead of the model guessing which run
  // was "the detailed one".
  promptDetailComparison: PromptDetailComparison | null;
  relatedness: {
    hasAnyBelowFullConfidence: boolean;
    pairs: { confidence: string; reasoning: string }[];
  } | null;
  sessionSummary: string | null;
  businessStatCandidates: BusinessStatCandidate[];
}

interface RunPromptInfo {
  runId: string;
  runLabel: string;
  text: string;
  charCount: number;
  promptCount: number;
}

// Every real user-authored "user_prompt" event for this run, joined together
// — run.taskPromptText is deliberately just the LAST prompt (often a trivial
// "/exit" or similar), which is the wrong basis for both what gets sent to
// Claude and any "how detailed was the prompt" comparison.
function getRunPromptInfo(run: Run, logFilesById: Map<string, LogFile>): RunPromptInfo {
  const logFile = logFilesById.get(run.sourceLogFileId);
  const records = logFile ? extractPromptRecords(logFile.events) : [];
  if (records.length === 0) {
    // No log file available (e.g. a reopened/precomputed report) — fall
    // back to the one thing we still have rather than sending nothing.
    return {
      runId: run.id,
      runLabel: run.label,
      text: run.taskPromptText,
      charCount: run.taskPromptText.length,
      promptCount: run.taskPromptText.trim().length > 0 ? 1 : 0,
    };
  }
  return {
    runId: run.id,
    runLabel: run.label,
    text: records.map((record) => record.text).join("\n\n---\n\n"),
    charCount: records.reduce((sum, record) => sum + record.text.length, 0),
    promptCount: records.length,
  };
}

function buildPromptDetailComparison(promptInfoByRunId: Map<string, RunPromptInfo>, runs: Run[]): PromptDetailComparison | null {
  if (runs.length !== 2) return null;
  const [a, b] = runs.map((run) => promptInfoByRunId.get(run.id)!);
  if (a.charCount === 0 || b.charCount === 0 || a.charCount === b.charCount) return null;
  const [more, less] = a.charCount > b.charCount ? [a, b] : [b, a];
  return {
    moreDetailedRunId: more.runId,
    moreDetailedRunLabel: more.runLabel,
    moreDetailedCharCount: more.charCount,
    lessDetailedRunId: less.runId,
    lessDetailedRunLabel: less.runLabel,
    lessDetailedCharCount: less.charCount,
    charCountRatio: Math.round((more.charCount / less.charCount) * 10) / 10,
  };
}

// Not a real metric from the report — synthesized so "a more detailed
// prompt produced a better outcome" can be featured as its own grounded
// card (with real character counts) instead of needing a dedicated summary
// section to make that case.
function buildPromptDetailCandidate(comparison: PromptDetailComparison | null): BusinessStatCandidate | null {
  if (!comparison) return null;
  return {
    metricKey: "prompt_detail_char_count",
    label: "Task prompt length (specification detail)",
    category: "other",
    shape: "absolute",
    values: [
      {
        runId: comparison.moreDetailedRunId,
        runLabel: comparison.moreDetailedRunLabel,
        formattedValue: `${comparison.moreDetailedCharCount.toLocaleString("en-US")} chars`,
      },
      {
        runId: comparison.lessDetailedRunId,
        runLabel: comparison.lessDetailedRunLabel,
        formattedValue: `${comparison.lessDetailedCharCount.toLocaleString("en-US")} chars`,
      },
    ],
    comparisonText: `${comparison.charCountRatio}x longer`,
    ratioSpread: comparison.charCountRatio,
    severity: "cannot-determine",
    confound: null,
    pairedMetricKey: null,
  };
}

const MAX_CANDIDATES = 40;
const MAX_PROMPT_CHARS = 4000;
const ALWAYS_INCLUDE_PREFIXES = ["tool_usage_"];
const ALWAYS_INCLUDE_KEYS = new Set(["net_chars_added", "net_chars_removed"]);
// Approval-wait / idle-time / other wall-clock breakdown metrics reflect
// human and workflow latency, not the agent's own cost/efficiency — excluded
// outright from business-insight candidates regardless of how they'd
// otherwise qualify (headline, pinned, or classified as drifted).
const EXCLUDED_PREFIXES = ["duration_"];

// Absolute/workload metrics paired with the efficiency metric that reveals
// whether a big total is genuinely more (in)efficient, or just more work.
const PAIRED_EFFICIENCY_METRIC: Record<string, string> = {
  total_tokens: "tokens_per_turn",
  tool_calls: "tool_calls_per_turn",
  cache_creation_tokens: "cache_creation_per_tool_call",
};

function truncatePrompt(text: string): string {
  return text.length > MAX_PROMPT_CHARS ? `${text.slice(0, MAX_PROMPT_CHARS)}…` : text;
}

function numericValuesByRun(metric: Metric, runs: Run[]): { runId: string; value: number }[] | null {
  const out: { runId: string; value: number }[] = [];
  for (const run of runs) {
    const value = metric.valuesByRun.get(run.id);
    if (typeof value !== "number") return null;
    out.push({ runId: run.id, value });
  }
  return out;
}

function buildCandidate(
  metric: Metric,
  runs: Run[],
  classification: DriftClassification | undefined,
  stats: GroupStatistics | undefined,
  pairedMetricKey: string | null,
): BusinessStatCandidate | null {
  const numeric = numericValuesByRun(metric, runs);
  if (!numeric || numeric.length === 0) return null;

  const runLabelById = new Map(runs.map((run) => [run.id, run.label]));
  const values: BusinessStatCandidateValue[] = numeric.map(({ runId, value }) => ({
    runId,
    runLabel: runLabelById.get(runId) ?? runId,
    formattedValue: formatMetricValue(metric.key, value),
  }));

  let comparisonText: string;
  let ratioSpread: number | null = null;
  if (numeric.length === 2) {
    const [a, b] = numeric;
    comparisonText = formatComparisonText(metric.key, a.value, b.value, values[0].formattedValue, values[1].formattedValue);
    if (a.value > 0 && b.value > 0) ratioSpread = Math.max(a.value, b.value) / Math.min(a.value, b.value);
  } else if (stats && stats.min > 0) {
    ratioSpread = stats.max / stats.min;
    comparisonText = `range ${formatMetricValue(metric.key, stats.min)} – ${formatMetricValue(metric.key, stats.max)}`;
  } else {
    comparisonText = values.map((v) => `${v.runLabel}: ${v.formattedValue}`).join(", ");
  }

  return {
    metricKey: metric.key,
    label: metric.label,
    category: categoryForMetricKey(metric.key),
    shape: shapeForMetricKey(metric.key),
    values,
    comparisonText,
    ratioSpread,
    severity: classification?.severity ?? "cannot-determine",
    confound: classification?.overriddenByConfound?.description ?? null,
    pairedMetricKey,
  };
}

export function buildBusinessInsightsPayload(
  comparison: Comparison,
  runs: Run[],
  logFilesById: Map<string, LogFile>,
): BusinessInsightsPayload {
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
  for (const key of [...notableKeys]) {
    if (EXCLUDED_PREFIXES.some((prefix) => key.startsWith(prefix))) {
      notableKeys.delete(key);
    }
  }

  const pairedOf = new Map<string, string>();
  for (const key of [...notableKeys]) {
    const paired = PAIRED_EFFICIENCY_METRIC[key];
    if (paired && metricByKey.has(paired)) {
      notableKeys.add(paired);
      pairedOf.set(key, paired);
      pairedOf.set(paired, key);
    }
  }

  const businessStatCandidates: BusinessStatCandidate[] = [...notableKeys]
    .slice(0, MAX_CANDIDATES)
    .map((key) => {
      const metric = metricByKey.get(key);
      if (!metric) return null;
      return buildCandidate(metric, runs, classificationByKey.get(key), statsByKey.get(key), pairedOf.get(key) ?? null);
    })
    .filter((candidate): candidate is BusinessStatCandidate => candidate !== null);

  const promptInfoByRunId = new Map(runs.map((run) => [run.id, getRunPromptInfo(run, logFilesById)]));

  const promptDetailComparison = buildPromptDetailComparison(promptInfoByRunId, runs);
  const promptDetailCandidate = buildPromptDetailCandidate(promptDetailComparison);
  if (promptDetailCandidate) businessStatCandidates.push(promptDetailCandidate);

  const runSummaries: BusinessInsightsRunSummary[] = runs.map((run) => {
    const promptInfo = promptInfoByRunId.get(run.id)!;
    return {
      runId: run.id,
      label: run.label,
      promptText: truncatePrompt(promptInfo.text),
      promptCharCount: promptInfo.charCount,
      promptCount: promptInfo.promptCount,
      dataQualityNotes: run.dataQualityNotes.map((note) => ({
        type: note.type,
        description: note.description,
        estimatedCostImpact: note.estimatedCostImpact,
        estimatedTurnImpact: note.estimatedTurnImpact,
      })),
    };
  });

  return {
    title: comparison.title,
    runs: runSummaries,
    promptDetailComparison,
    relatedness: comparison.relatednessAssessment
      ? {
          hasAnyBelowFullConfidence: comparison.relatednessAssessment.hasAnyBelowFullConfidence,
          pairs: comparison.relatednessAssessment.pairs.map((pair) => ({
            confidence: pair.confidence,
            reasoning: pair.reasoning,
          })),
        }
      : null,
    sessionSummary: comparison.sessionSummary?.summaryText ?? null,
    businessStatCandidates,
  };
}
