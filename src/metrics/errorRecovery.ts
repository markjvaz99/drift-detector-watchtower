import { pairToolCalls } from "../parsing/pairToolCalls";
import type { LogFile } from "../types";
import type { RunMetricValue } from "./types";

export function computeErrorRecoveryMetrics(logFile: LogFile): RunMetricValue[] {
  const allCalls = pairToolCalls(logFile.events);
  const executedCalls = allCalls.filter((call) => call.executed);
  const failedCalls = executedCalls.filter((call) => call.result === "failure");
  const rejectedCalls = allCalls.filter((call) => call.decision === "rejected");

  const sortedExecuted = [...executedCalls].sort(
    (a, b) => (a.resultSequence ?? 0) - (b.resultSequence ?? 0),
  );
  let immediateRecoveries = 0;
  for (let i = 0; i < sortedExecuted.length - 1; i += 1) {
    if (sortedExecuted[i].result === "failure" && sortedExecuted[i + 1].toolName === sortedExecuted[i].toolName) {
      immediateRecoveries += 1;
    }
  }

  const toolCallCount = executedCalls.length;

  return [
    { key: "failed_call_count", label: "Failed calls", value: failedCalls.length, denominatorLabel: "" },
    {
      key: "failed_call_rate",
      label: "Failed-call rate",
      value: toolCallCount > 0 ? failedCalls.length / toolCallCount : "not-available",
      denominatorLabel: `per tool call (${toolCallCount})`,
    },
    { key: "rejection_count", label: "Rejected calls", value: rejectedCalls.length, denominatorLabel: "" },
    {
      key: "immediate_recovery_count",
      label: "Immediate recoveries after failure",
      value: immediateRecoveries,
      denominatorLabel: "",
    },
  ];
}
