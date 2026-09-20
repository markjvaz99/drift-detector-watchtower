import { isMainTaskApiCall } from "../parsing/excludeNonTaskCalls";
import { pairToolCalls } from "../parsing/pairToolCalls";
import type { LogFile } from "../types";
import type { RunMetricValue } from "./types";

function num(value: unknown): number {
  return typeof value === "number" ? value : 0;
}

export function computeCacheIntensityMetrics(logFile: LogFile): RunMetricValue[] {
  const totalNewContextTokens = logFile.events
    .filter(isMainTaskApiCall)
    .reduce((sum, e) => sum + num(e.attributes["cache_creation_tokens"]), 0);

  const executedCalls = pairToolCalls(logFile.events).filter((call) => call.executed);
  const readCalls = executedCalls.filter((call) => call.toolName === "Read").length;
  const editCalls = executedCalls.filter((call) => call.toolName === "Edit").length;
  const toolCalls = executedCalls.length;

  const perReadDenominator = `per Read call (${readCalls})`;
  const perEditDenominator = `per Edit call (${editCalls})`;
  const perToolDenominator = `per tool call (${toolCalls})`;

  return [
    {
      key: "cache_creation_per_read",
      label: "Cache-creation per Read call",
      value: readCalls > 0 ? totalNewContextTokens / readCalls : "not-available",
      denominatorLabel: perReadDenominator,
    },
    {
      key: "cache_creation_per_edit",
      label: "Cache-creation per Edit call",
      value: editCalls > 0 ? totalNewContextTokens / editCalls : "not-available",
      denominatorLabel: perEditDenominator,
    },
    {
      key: "cache_creation_per_tool_call",
      label: "Cache-creation per tool call",
      value: toolCalls > 0 ? totalNewContextTokens / toolCalls : "not-available",
      denominatorLabel: perToolDenominator,
    },
  ];
}
