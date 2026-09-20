import { isMainTaskApiCall } from "../parsing/excludeNonTaskCalls";
import { pairToolCalls } from "../parsing/pairToolCalls";
import type { LogFile } from "../types";
import type { RunMetricValue } from "./types";

function num(value: unknown): number {
  return typeof value === "number" ? value : 0;
}

export function computeEfficiencyMetrics(logFile: LogFile): RunMetricValue[] {
  const mainTaskCalls = logFile.events.filter(isMainTaskApiCall);
  const turns = mainTaskCalls.length;

  const inputTokens = mainTaskCalls.reduce((sum, e) => sum + num(e.attributes["input_tokens"]), 0);
  const outputTokens = mainTaskCalls.reduce((sum, e) => sum + num(e.attributes["output_tokens"]), 0);
  const cacheReadTokens = mainTaskCalls.reduce(
    (sum, e) => sum + num(e.attributes["cache_read_tokens"]),
    0,
  );
  const cacheCreationTokens = mainTaskCalls.reduce(
    (sum, e) => sum + num(e.attributes["cache_creation_tokens"]),
    0,
  );
  const totalTokens = inputTokens + outputTokens + cacheReadTokens + cacheCreationTokens;
  const cost = mainTaskCalls.reduce((sum, e) => sum + num(e.attributes["cost_usd"]), 0);

  const toolCalls = pairToolCalls(logFile.events).filter((call) => call.executed).length;

  return [
    { key: "turns", label: "Turns", value: turns, denominatorLabel: "" },
    { key: "input_tokens", label: "Input tokens", value: inputTokens, denominatorLabel: "" },
    { key: "output_tokens", label: "Output tokens", value: outputTokens, denominatorLabel: "" },
    {
      key: "cache_read_tokens",
      label: "Cache-read tokens",
      value: cacheReadTokens,
      denominatorLabel: "",
    },
    {
      key: "cache_creation_tokens",
      label: "Cache-creation tokens",
      value: cacheCreationTokens,
      denominatorLabel: "",
    },
    {
      key: "tokens_per_turn",
      label: "Tokens per turn",
      value: turns > 0 ? totalTokens / turns : "not-available",
      denominatorLabel: `per turn (${turns})`,
    },
    { key: "total_tokens", label: "Total tokens (incl. cache)", value: totalTokens, denominatorLabel: "" },
    { key: "cost_usd", label: "Cost", value: cost, denominatorLabel: "" },
    { key: "tool_calls", label: "Tool calls", value: toolCalls, denominatorLabel: "" },
    {
      key: "tool_calls_per_turn",
      label: "Tool calls per turn",
      value: turns > 0 ? toolCalls / turns : "not-available",
      denominatorLabel: `per turn (${turns})`,
    },
  ];
}
