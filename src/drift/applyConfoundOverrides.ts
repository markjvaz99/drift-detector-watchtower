import type {
  ConfoundFinding,
  DriftClassification,
  Metric,
  RelatednessAssessment,
  Run,
} from "../types";

const RESENT_PROMPT_AFFECTED_KEYS = [
  "turns",
  "tokens_per_turn",
  "total_tokens",
  "cost_usd",
  "tool_calls_per_turn",
];

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
): ConfoundFinding[] {
  const findings: ConfoundFinding[] = [];

  for (const run of runs) {
    const resentPromptNote = run.dataQualityNotes.find((note) => note.type === "resent-prompt");
    if (resentPromptNote) {
      findings.push({
        type: "resent-prompt",
        affectedRunIds: [run.id],
        affectedMetricKeys: RESENT_PROMPT_AFFECTED_KEYS.filter((key) =>
          metrics.some((m) => m.key === key),
        ),
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
