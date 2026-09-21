import type { DataQualityNote, EvidenceReference, OrderedEvent } from "../types";
import { extractPromptRecords } from "./extractPromptTexts";

// A session with several user_prompt events isn't necessarily a data-quality
// defect — it's often just genuine multi-turn use (a detailed task prompt,
// then "start the server", "restart on port 8000", "/exit", ...). Only a
// prompt immediately followed by another prompt — with the agent barely (if
// at all) underway on the first one — looks like an incomplete send that got
// caught and corrected. Real multi-turn follow-ups happen after the agent
// has actually done substantive work, and/or well after this window.
const MAX_INTERVENING_API_CALLS = 2;
const RESEND_TIME_WINDOW_MS = 5 * 60 * 1000;

interface ResentPair {
  interveningCalls: OrderedEvent[];
}

export function detectResentPrompt(
  events: OrderedEvent[],
  logFileId: string,
  sessionIdentifier: string,
): DataQualityNote | null {
  // extractPromptRecords excludes system-injected content (e.g. a background
  // task-completion notice) that isn't something the user actually typed —
  // detecting a "resend" against those would be meaningless.
  const prompts = extractPromptRecords(events);
  if (prompts.length < 2) return null;

  const resentPairs: ResentPair[] = [];
  for (let i = 0; i < prompts.length - 1; i++) {
    const abandoned = prompts[i];
    const resend = prompts[i + 1];
    const interveningCalls = events.filter(
      (event) => event.type === "api_call" && event.sequence > abandoned.sequence && event.sequence < resend.sequence,
    );
    const gapMs = new Date(resend.timestamp).getTime() - new Date(abandoned.timestamp).getTime();
    if (interveningCalls.length <= MAX_INTERVENING_API_CALLS && gapMs >= 0 && gapMs <= RESEND_TIME_WINDOW_MS) {
      resentPairs.push({ interveningCalls });
    }
  }
  if (resentPairs.length === 0) return null;

  // Cost/turns spent between each abandoned prompt and its resend only — not
  // everything up to the session's last prompt, which would sweep in real
  // work done in response to later, unrelated prompts.
  let estimatedCostImpact = 0;
  let estimatedTurnImpact = 0;
  for (const { interveningCalls } of resentPairs) {
    estimatedCostImpact += interveningCalls.reduce((total, event) => {
      const cost = event.attributes["cost_usd"];
      return total + (typeof cost === "number" ? cost : 0);
    }, 0);
    estimatedTurnImpact += interveningCalls.length;
  }

  const evidenceRefs: EvidenceReference[] = prompts.map((prompt) => ({
    logFileId,
    sequence: prompt.sequence,
    sessionIdentifier,
  }));

  return {
    type: "resent-prompt",
    description:
      resentPairs.length === 1
        ? `This session contains an incomplete prompt that was corrected by an immediate resend (${prompts.length} user-task prompts in total).`
        : `This session contains ${resentPairs.length} incomplete prompts that were corrected by an immediate resend (${prompts.length} user-task prompts in total).`,
    estimatedCostImpact,
    estimatedTurnImpact,
    evidenceRefs,
  };
}
