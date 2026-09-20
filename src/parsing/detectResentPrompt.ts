import type { DataQualityNote, EvidenceReference, OrderedEvent } from "../types";

export function detectResentPrompt(
  events: OrderedEvent[],
  logFileId: string,
  sessionIdentifier: string,
): DataQualityNote | null {
  const prompts = events.filter((event) => event.type === "user_prompt");
  if (prompts.length < 2) return null;

  const lastPromptSequence = prompts[prompts.length - 1].sequence;
  const abandonedCalls = events.filter(
    (event) => event.type === "api_call" && event.sequence < lastPromptSequence,
  );
  const estimatedCostImpact = abandonedCalls.reduce((total, event) => {
    const cost = event.attributes["cost_usd"];
    return total + (typeof cost === "number" ? cost : 0);
  }, 0);
  const estimatedTurnImpact = abandonedCalls.length;

  const evidenceRefs: EvidenceReference[] = prompts.map((prompt) => ({
    logFileId,
    sequence: prompt.sequence,
    sessionIdentifier,
  }));

  return {
    type: "resent-prompt",
    description: `This session contains ${prompts.length} real user-task prompts — an incomplete prompt was followed by ${prompts.length - 1} resend(s).`,
    estimatedCostImpact,
    estimatedTurnImpact,
    evidenceRefs,
  };
}
