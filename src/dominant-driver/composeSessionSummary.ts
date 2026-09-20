import { computeRunMetrics } from "../metrics/computeRunMetrics";
import type { LogFile, Run, SessionSummary } from "../types";

function findValue(metrics: ReturnType<typeof computeRunMetrics>, key: string): number | null {
  const found = metrics.find((m) => m.key === key);
  return found && typeof found.value === "number" ? found.value : null;
}

/**
 * A plain, non-comparative summary of a single run's own characteristics
 * (FR-35): no "vs.", no drift/severity language, no reference to any other
 * run — generated entirely from that run's own already-computed metrics.
 */
export function composeSessionSummary(run: Run, logFile: LogFile): SessionSummary {
  const metrics = computeRunMetrics(logFile);
  const turns = findValue(metrics, "turns");
  const toolCalls = findValue(metrics, "tool_calls");
  const cost = findValue(metrics, "cost_usd");

  const parts: string[] = [];
  if (turns !== null) parts.push(`${turns} turn${turns === 1 ? "" : "s"}`);
  if (toolCalls !== null) parts.push(`${toolCalls} tool call${toolCalls === 1 ? "" : "s"}`);
  if (cost !== null) parts.push(`$${cost.toFixed(4)} in cost`);

  const summaryText =
    parts.length > 0
      ? `${run.label} completed its task activity over ${parts.join(", ")}.`
      : `${run.label} has no completed task activity to summarize.`;

  const supportingNumbers = [turns, toolCalls, cost].filter((n): n is number => n !== null).slice(0, 3);

  return { runId: run.id, summaryText, supportingNumbers };
}
