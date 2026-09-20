import { pairToolCalls } from "../parsing/pairToolCalls";
import type { LogFile } from "../types";
import type { RunMetricValue } from "./types";

export type ActivityCategory = "exploratory" | "validating" | "implementing";

export const ACTIVITY_CATEGORY_RULES: Record<string, ActivityCategory> = {
  Read: "exploratory",
  Grep: "exploratory",
  Glob: "exploratory",
  Bash_search: "exploratory",
  Bash_test: "validating",
  Edit: "implementing",
  Write: "implementing",
};

export function categorizeToolCall(toolName: string): ActivityCategory {
  return ACTIVITY_CATEGORY_RULES[toolName] ?? "exploratory";
}

export function computeActivityRatioMetrics(logFile: LogFile): RunMetricValue[] {
  const executed = pairToolCalls(logFile.events).filter((call) => call.executed);
  const total = executed.length;
  const counts: Record<ActivityCategory, number> = {
    exploratory: 0,
    validating: 0,
    implementing: 0,
  };
  for (const call of executed) {
    counts[categorizeToolCall(call.toolName)] += 1;
  }

  return (Object.keys(counts) as ActivityCategory[]).map((category) => ({
    key: `activity_ratio_${category}`,
    label: `${category[0].toUpperCase()}${category.slice(1)} ratio`,
    value: total > 0 ? counts[category] / total : "not-available",
    denominatorLabel: `per tool call (${total})`,
  }));
}
