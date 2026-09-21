import type {
  ConfoundFinding,
  DriftClassification,
  GroupStatistics,
  Metric,
  RelatednessAssessment,
  Run,
} from "../types";

// Metrics a resent prompt can distort — deliberately absolute-count metrics
// only. A resend adds extra turns, cost, and tokens roughly proportionally,
// so per-turn RATIO metrics (tokens_per_turn, tool_calls_per_turn) aren't
// meaningfully skewed by it even though the totals are; including them here
// previously compared a raw turn-count impact against those metrics' own
// (tiny, ratio-scale) gap, which is a dimensional mismatch that made almost
// any nonzero resend look "significant" regardless of its real size.
const RESENT_PROMPT_AFFECTED_KEYS: { key: string; impact: "cost" | "turns" }[] = [
  { key: "turns", impact: "turns" },
  { key: "total_tokens", impact: "turns" },
  { key: "cost_usd", impact: "cost" },
];

// A resent prompt shouldn't blanket-suppress a metric it can't plausibly
// explain: if the abandoned attempt's estimated cost/turn impact accounts
// for only a sliver of the actual gap between runs, that gap is real signal,
// not resend noise. Only force "uninterpretable" when the confound could
// plausibly account for a meaningful share of what's observed.
const CONFOUND_SIGNIFICANCE_THRESHOLD = 0.3;

function isConfoundSignificant(impact: number, stats: GroupStatistics | undefined): boolean {
  if (!stats) return true; // no data to judge against — err toward the existing cautious behavior
  const observedGap = stats.max - stats.min;
  if (observedGap <= 0) return true; // no drift to wrongly suppress either way
  return impact / observedGap >= CONFOUND_SIGNIFICANCE_THRESHOLD;
}

const MISMATCHED_REPO_AFFECTED_KEYS = [
  "net_chars_added",
  "net_chars_removed",
  "cache_creation_per_edit",
  "cache_creation_per_read",
  "cache_creation_per_tool_call",
];

export function detectConfoundFindings(
  runs: Run[],
  metrics: Metric[],
  relatednessAssessment: RelatednessAssessment | null,
  groupStatistics: GroupStatistics[] = [],
): ConfoundFinding[] {
  const findings: ConfoundFinding[] = [];
  const statsByKey = new Map(groupStatistics.map((s) => [s.metricKey, s]));

  for (const run of runs) {
    const resentPromptNote = run.dataQualityNotes.find((note) => note.type === "resent-prompt");
    if (resentPromptNote) {
      const affectedMetricKeys = RESENT_PROMPT_AFFECTED_KEYS.filter(({ key, impact }) => {
        if (!metrics.some((m) => m.key === key)) return false;
        const estimatedImpact = impact === "cost" ? resentPromptNote.estimatedCostImpact : resentPromptNote.estimatedTurnImpact;
        return isConfoundSignificant(estimatedImpact ?? 0, statsByKey.get(key));
      }).map(({ key }) => key);

      findings.push({
        type: "resent-prompt",
        affectedRunIds: [run.id],
        affectedMetricKeys,
        description: resentPromptNote.description,
        evidenceRefs: resentPromptNote.evidenceRefs,
        forcesUninterpretable: true,
      });
    }
  }

  if (relatednessAssessment) {
    for (const pair of relatednessAssessment.pairs) {
      if (pair.repositoryStateComparison === "same repository, different starting commit") {
        findings.push({
          type: "mismatched-repo-state",
          affectedRunIds: [pair.runIdA, pair.runIdB],
          affectedMetricKeys: MISMATCHED_REPO_AFFECTED_KEYS.filter((key) =>
            metrics.some((m) => m.key === key),
          ),
          description: `${pair.repositoryStateComparison} between the compared runs.`,
          evidenceRefs: [],
          forcesUninterpretable: true,
        });
      }
    }
  }

  const durationTotalMetric = metrics.find((m) => m.key === "duration_total_ms");
  const durationApprovalWaitMetric = metrics.find((m) => m.key === "duration_approval_wait_ms");
  if (durationTotalMetric && durationApprovalWaitMetric) {
    for (const run of runs) {
      const total = durationTotalMetric.valuesByRun.get(run.id);
      const approvalWait = durationApprovalWaitMetric.valuesByRun.get(run.id);
      if (typeof total === "number" && typeof approvalWait === "number" && total > 0) {
        if (approvalWait / total > 0.5) {
          findings.push({
            type: "approval-wait-dominated",
            affectedRunIds: [run.id],
            affectedMetricKeys: ["duration_total_ms"],
            description: `${run.label}'s wall-clock duration is dominated by human approval-wait time (${Math.round((approvalWait / total) * 100)}%).`,
            evidenceRefs: [],
            forcesUninterpretable: true,
          });
        }
      }
    }
  }

  return findings;
}

export function applyConfoundOverrides(
  classifications: DriftClassification[],
  confoundFindings: ConfoundFinding[],
): DriftClassification[] {
  return classifications.map((classification) => {
    const applicable = confoundFindings.find(
      (finding) =>
        finding.forcesUninterpretable &&
        finding.affectedMetricKeys.includes(classification.metricKey),
    );
    if (!applicable) return classification;
    return { ...classification, severity: "uninterpretable", overriddenByConfound: applicable };
  });
}
