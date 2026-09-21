import { describe, expect, it } from "vitest";
import type { Comparison, DataQualityNote, LogFile, OrderedEvent, Run } from "../../src/types";
import { buildBusinessInsightsPayload } from "../../src/recommendations/buildBusinessInsightsPayload";

const NO_LOG_FILES = new Map<string, LogFile>();

function promptEvent(sequence: number, prompt: string): OrderedEvent {
  return { sequence, timestamp: "2026-01-01T00:00:00Z", type: "user_prompt", queryType: null, attributes: { prompt } };
}

function makeLogFile(id: string, events: OrderedEvent[]): LogFile {
  return {
    id,
    fileName: `${id}.jsonl`,
    sessionIdentifier: id,
    buildVersion: "1.0.0",
    workingDirectory: "/repo",
    startingRepositoryState: { branch: null, headCommit: null, workingDirectory: "/repo" },
    events,
    unrecognizedEventCount: 0,
  };
}

// Mirrors the shape (and some exact values) of
// sample-logs/new-expense-budgets-feature.driftreport.json: Run 1 did
// noticeably more work and spent much longer waiting on approvals; Run 2
// contains a resent-prompt data-quality note.
function makeRun(id: string, label: string, dataQualityNotes: DataQualityNote[] = []): Run {
  return {
    id,
    sourceLogFileId: id,
    label,
    taskPromptText: `${label} prompt`,
    dataQualityNotes,
    rejectedToolCalls: [],
    hasCompletedTaskActivity: true,
  };
}

const run1 = makeRun("run-1", "Run 1");
const run2 = makeRun("run-2", "Run 2", [
  {
    type: "resent-prompt",
    description: "This session contains 2 incomplete prompts that were corrected by an immediate resend.",
    estimatedCostImpact: 0.1623236,
    estimatedTurnImpact: 4,
    evidenceRefs: [],
  },
]);

function metric(key: string, label: string, run1Value: number, run2Value: number) {
  return {
    key,
    label,
    denominatorLabel: "",
    valuesByRun: new Map([
      [run1.id, run1Value],
      [run2.id, run2Value],
    ]),
  };
}

const comparison: Comparison = {
  runIds: [run1.id, run2.id],
  title: "New Expense Budgets Feature",
  relatednessAssessment: null,
  metrics: [
    metric("cost_usd", "Cost", 12.828437599999994, 3.2497009999999986),
    metric("total_tokens", "Total tokens (incl. cache)", 48309785, 10687652),
    metric("tokens_per_turn", "Tokens per turn", 513.6120689655172, 700.0243902439024),
    metric("turns", "Turns", 232, 82),
    metric("duration_approval_wait_ms", "Approval-wait time", 1286251, 100602),
    metric("tool_usage_mcp_tool", "mcp_tool calls", 82, 19),
    metric("ignored_metric", "Ignored metric", 5, 5),
  ],
  groupStatistics: [],
  driftClassifications: [
    { metricKey: "cost_usd", severity: "large", basis: "3.9x group spread", overriddenByConfound: null },
    { metricKey: "turns", severity: "moderate", basis: "0.91x group spread", overriddenByConfound: null },
    { metricKey: "tokens_per_turn", severity: "no-drift", basis: "0.27x group spread", overriddenByConfound: null },
    { metricKey: "ignored_metric", severity: "no-drift", basis: "0x group spread", overriddenByConfound: null },
  ],
  headlineMetricKeys: ["cost_usd", "total_tokens"],
  pinnedMetricKeys: [],
  dominantDriverFinding: null,
  sessionSummary: null,
};

describe("buildBusinessInsightsPayload", () => {
  const payload = buildBusinessInsightsPayload(comparison, [run1, run2], NO_LOG_FILES);
  const candidatesByKey = new Map(payload.businessStatCandidates.map((c) => [c.metricKey, c]));

  it("includes headline, drifted, and always-include-prefix metrics", () => {
    expect(candidatesByKey.has("cost_usd")).toBe(true);
    expect(candidatesByKey.has("total_tokens")).toBe(true);
    expect(candidatesByKey.has("turns")).toBe(true);
    expect(candidatesByKey.has("tool_usage_mcp_tool")).toBe(true);
  });

  it("excludes metrics that are neither headline, drifted, nor tool_usage_ prefixed", () => {
    expect(candidatesByKey.has("ignored_metric")).toBe(false);
  });

  it("excludes duration_* metrics (approval-wait/idle time) even though present in the report", () => {
    expect(candidatesByKey.has("duration_approval_wait_ms")).toBe(false);
  });

  it("excludes a duration_* metric even when it's a headline metric", () => {
    const result = buildBusinessInsightsPayload(
      { ...comparison, headlineMetricKeys: [...comparison.headlineMetricKeys, "duration_approval_wait_ms"] },
      [run1, run2],
      NO_LOG_FILES,
    );
    expect(result.businessStatCandidates.some((c) => c.metricKey === "duration_approval_wait_ms")).toBe(false);
  });

  it("pulls in a workload metric's paired efficiency metric even though it wasn't independently notable", () => {
    // tokens_per_turn is classified "no-drift" and isn't headline/pinned, but
    // total_tokens is headline and pairs with it — it should still show up
    // so the model can check whether the workload gap is really an
    // efficiency gap.
    expect(candidatesByKey.has("tokens_per_turn")).toBe(true);
    expect(candidatesByKey.get("total_tokens")?.pairedMetricKey).toBe("tokens_per_turn");
    expect(candidatesByKey.get("tokens_per_turn")?.pairedMetricKey).toBe("total_tokens");
  });

  it("computes correctly formatted values and comparison text from real numbers", () => {
    const cost = candidatesByKey.get("cost_usd")!;
    expect(cost.values.map((v) => v.formattedValue)).toEqual(["$12.83", "$3.25"]);
    expect(cost.comparisonText).toBe("3.9x");

    const tokens = candidatesByKey.get("total_tokens")!;
    expect(tokens.values.map((v) => v.formattedValue)).toEqual(["48.3M", "10.7M"]);
  });

  it("carries each candidate's drift severity and category/shape", () => {
    const cost = candidatesByKey.get("cost_usd")!;
    expect(cost.severity).toBe("large");
    expect(cost.category).toBe("cost");
    expect(cost.shape).toBe("absolute");

    const tokensPerTurn = candidatesByKey.get("tokens_per_turn")!;
    expect(tokensPerTurn.category).toBe("efficiency");
    expect(tokensPerTurn.shape).toBe("efficiency");
  });

  it("surfaces each run's data-quality notes for the model to reflect as caveats", () => {
    expect(payload.runs[0].dataQualityNotes).toEqual([]);
    expect(payload.runs[1].dataQualityNotes).toEqual([
      {
        type: "resent-prompt",
        description: "This session contains 2 incomplete prompts that were corrected by an immediate resend.",
        estimatedCostImpact: 0.1623236,
        estimatedTurnImpact: 4,
      },
    ]);
  });

  it("has no promptDetailComparison when both runs' prompts are the same length", () => {
    // run1/run2 fixture prompts ("Run 1 prompt" / "Run 2 prompt") are equal length.
    expect(payload.promptDetailComparison).toBeNull();
  });
});

describe("buildBusinessInsightsPayload — promptDetailComparison", () => {
  it("identifies which run had the more detailed prompt and the size of the gap", () => {
    const generic: Run = { ...run1, taskPromptText: "fix the bug" };
    const detailed: Run = {
      ...run2,
      taskPromptText: "Fix the null-pointer exception in the expense-budget save handler when the category field is left blank — see repro steps in issue #482.",
    };
    const result = buildBusinessInsightsPayload({ ...comparison, metrics: [] }, [generic, detailed], NO_LOG_FILES);
    expect(result.promptDetailComparison).not.toBeNull();
    expect(result.promptDetailComparison!.moreDetailedRunId).toBe(detailed.id);
    expect(result.promptDetailComparison!.lessDetailedRunId).toBe(generic.id);
    expect(result.promptDetailComparison!.moreDetailedCharCount).toBe(detailed.taskPromptText.length);
    expect(result.promptDetailComparison!.lessDetailedCharCount).toBe(generic.taskPromptText.length);
    expect(result.promptDetailComparison!.charCountRatio).toBeGreaterThan(1);
  });

  it("is null when there aren't exactly two runs", () => {
    const result = buildBusinessInsightsPayload({ ...comparison, metrics: [] }, [run1], NO_LOG_FILES);
    expect(result.promptDetailComparison).toBeNull();
  });

  it("synthesizes a prompt_detail_char_count business stat candidate so it can be featured as its own card", () => {
    const generic: Run = { ...run1, taskPromptText: "fix the bug" };
    const detailed: Run = {
      ...run2,
      taskPromptText: "Fix the null-pointer exception in the expense-budget save handler when the category field is left blank.",
    };
    const result = buildBusinessInsightsPayload({ ...comparison, metrics: [] }, [generic, detailed], NO_LOG_FILES);
    const candidate = result.businessStatCandidates.find((c) => c.metricKey === "prompt_detail_char_count");
    expect(candidate).toBeDefined();
    expect(candidate!.values).toEqual([
      { runId: detailed.id, runLabel: detailed.label, formattedValue: `${detailed.taskPromptText.length} chars` },
      { runId: generic.id, runLabel: generic.label, formattedValue: `${generic.taskPromptText.length} chars` },
    ]);
    expect(candidate!.comparisonText).toMatch(/x longer$/);
  });

  it("does not synthesize a prompt-detail candidate when prompts are equal length", () => {
    const result = buildBusinessInsightsPayload({ ...comparison, metrics: [] }, [run1, run2], NO_LOG_FILES);
    expect(result.businessStatCandidates.some((c) => c.metricKey === "prompt_detail_char_count")).toBe(false);
  });
});

describe("buildBusinessInsightsPayload — real prompts from the log file", () => {
  it("joins every real user prompt in the session, not just the last one", () => {
    const logFile = makeLogFile("lf-1", [
      promptEvent(1, "Add a monthly budget feature."),
      promptEvent(50, "Also add a warning when the user is close to the limit."),
      promptEvent(90, "/exit"),
    ]);
    const run: Run = { ...run1, sourceLogFileId: logFile.id };
    const result = buildBusinessInsightsPayload(
      { ...comparison, metrics: [] },
      [run, run2],
      new Map([[logFile.id, logFile]]),
    );
    const summary = result.runs.find((r) => r.runId === run.id)!;
    expect(summary.promptText).toContain("Add a monthly budget feature.");
    expect(summary.promptText).toContain("Also add a warning when the user is close to the limit.");
    // "/exit" is itself a real, if trivial, user-typed prompt — the fix is
    // to stop sending ONLY it (the old behavior), not to filter it out.
    expect(summary.promptText).toContain("/exit");
    expect(summary.promptCount).toBe(3);
    expect(summary.promptCharCount).toBe(
      "Add a monthly budget feature.".length + "Also add a warning when the user is close to the limit.".length + "/exit".length,
    );
  });

  it("excludes system-injected task-notification events from the extracted prompt text", () => {
    const logFile = makeLogFile("lf-2", [
      promptEvent(1, "Fix the bug."),
      promptEvent(2, "<task-notification>Background dev server exited</task-notification>"),
    ]);
    const run: Run = { ...run1, sourceLogFileId: logFile.id };
    const result = buildBusinessInsightsPayload(
      { ...comparison, metrics: [] },
      [run, run2],
      new Map([[logFile.id, logFile]]),
    );
    const summary = result.runs.find((r) => r.runId === run.id)!;
    expect(summary.promptCount).toBe(1);
    expect(summary.promptText).not.toContain("task-notification");
  });

  it("falls back to taskPromptText when no log file is available (e.g. a reopened report)", () => {
    const result = buildBusinessInsightsPayload({ ...comparison, metrics: [] }, [run1, run2], NO_LOG_FILES);
    const summary = result.runs.find((r) => r.runId === run1.id)!;
    expect(summary.promptText).toBe(run1.taskPromptText);
    expect(summary.promptCharCount).toBe(run1.taskPromptText.length);
    expect(summary.promptCount).toBe(1);
  });

  it("bases promptDetailComparison on the real extracted prompts, not the last-prompt-only taskPromptText", () => {
    const genericLog = makeLogFile("lf-generic", [promptEvent(1, "fix the bug"), promptEvent(2, "/exit")]);
    const detailedLog = makeLogFile("lf-detailed", [
      promptEvent(
        1,
        "Fix the null-pointer exception in the expense-budget save handler when the category field is left blank.",
      ),
      promptEvent(2, "/exit"),
    ]);
    const generic: Run = { ...run1, sourceLogFileId: genericLog.id, taskPromptText: "/exit" };
    const detailed: Run = { ...run2, sourceLogFileId: detailedLog.id, taskPromptText: "/exit" };
    const result = buildBusinessInsightsPayload(
      { ...comparison, metrics: [] },
      [generic, detailed],
      new Map([
        [genericLog.id, genericLog],
        [detailedLog.id, detailedLog],
      ]),
    );
    // Both taskPromptText values are identical ("/exit"), so a correct fix
    // must use the extracted real prompts to tell these apart at all.
    expect(result.promptDetailComparison).not.toBeNull();
    expect(result.promptDetailComparison!.moreDetailedRunId).toBe(detailed.id);
    expect(result.promptDetailComparison!.lessDetailedRunId).toBe(generic.id);
  });
});
