import { pairToolCalls } from "../parsing/pairToolCalls";
import type { LogFile } from "../types";
import type { RunMetricValue } from "./types";

export function computeToolUsageByName(logFile: LogFile): Map<string, number> {
  const executed = pairToolCalls(logFile.events).filter((call) => call.executed);
  const counts = new Map<string, number>();
  for (const call of executed) {
    counts.set(call.toolName, (counts.get(call.toolName) ?? 0) + 1);
  }
  return counts;
}

export function computeToolUsageMetrics(logFile: LogFile): RunMetricValue[] {
  const counts = computeToolUsageByName(logFile);
  return Array.from(counts.entries()).map(([toolName, count]) => ({
    key: `tool_usage_${toolName}`,
    label: `${toolName} calls`,
    value: count,
    denominatorLabel: "",
  }));
}
