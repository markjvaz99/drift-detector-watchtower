import type { OrderedEvent, ToolCallOutcome, ToolDecision, ToolResultOutcome } from "../types";

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

export function pairToolCalls(events: OrderedEvent[]): ToolCallOutcome[] {
  const decisions = events.filter((event) => event.type === "tool_decision");
  const results = events.filter((event) => event.type === "tool_result");
  const resultByToolUseId = new Map<string, OrderedEvent>();
  for (const result of results) {
    resultByToolUseId.set(asString(result.attributes["tool_use_id"]), result);
  }

  return decisions.map((decision) => {
    const toolUseId = asString(decision.attributes["tool_use_id"]);
    const decisionValue = asString(decision.attributes["decision"], "approved") as ToolDecision;
    const matchingResult = resultByToolUseId.get(toolUseId);
    const executed = decisionValue === "approved" && matchingResult !== undefined;
    const result: ToolResultOutcome = executed
      ? (asString(matchingResult!.attributes["outcome"], "success") as ToolResultOutcome)
      : null;

    return {
      toolUseId,
      toolName: asString(decision.attributes["tool_name"]),
      decision: decisionValue,
      executed,
      result,
      decisionSequence: decision.sequence,
      resultSequence: matchingResult ? matchingResult.sequence : null,
    };
  });
}
