import type { OrderedEvent, ToolCallOutcome, ToolDecision, ToolResultOutcome } from "../types";

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

// Real Claude Code telemetry uses "accept"/"reject" for tool_decision.decision;
// synthetic fixtures (and this app's own internal type) use "approved"/"rejected".
// Normalize both to the canonical internal form.
const DECISION_ALIASES: Record<string, ToolDecision> = {
  accept: "approved",
  reject: "rejected",
  approved: "approved",
  rejected: "rejected",
};

function normalizeDecision(raw: string): ToolDecision {
  return DECISION_ALIASES[raw] ?? "approved";
}

function resolveOutcome(resultEvent: OrderedEvent): ToolResultOutcome {
  // Real telemetry carries "success" on tool_result, but inconsistently —
  // some records use a native boolean, others a stringified "true"/"false"
  // (occasionally even both, as duplicate attributes on the same record).
  // Synthetic fixtures carry a string "outcome" ("success"/"failure") instead.
  const success = resultEvent.attributes["success"];
  if (typeof success === "boolean") {
    return success ? "success" : "failure";
  }
  if (success === "true" || success === "false") {
    return success === "true" ? "success" : "failure";
  }
  return asString(resultEvent.attributes["outcome"], "success") as ToolResultOutcome;
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
    const decisionValue = normalizeDecision(asString(decision.attributes["decision"], "approved"));
    const matchingResult = resultByToolUseId.get(toolUseId);
    const executed = decisionValue === "approved" && matchingResult !== undefined;
    const result: ToolResultOutcome = executed ? resolveOutcome(matchingResult!) : null;

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
