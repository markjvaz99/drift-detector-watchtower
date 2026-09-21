import type { OrderedEvent } from "../types";

export interface PromptRecord {
  text: string;
  timestamp: string;
  sequence: number;
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

// Background-task completion/failure notices (e.g. a backgrounded dev-server
// command exiting) are injected into the conversation as a "user_prompt"
// event by Claude Code's own tooling, not typed by the human user — they're
// recognizable by their structured <task-notification> wrapper and should
// never be treated as a real prompt the user sent.
function isSystemInjectedNotification(text: string): boolean {
  return /^<task-notification>/i.test(text.trim());
}

/**
 * Every real user-authored "user_prompt" event in the session, in order.
 * Real telemetry carries the text as "prompt"; synthetic fixtures (and the
 * original spec's assumed schema) use "prompt_text".
 */
export function extractPromptRecords(events: OrderedEvent[]): PromptRecord[] {
  return events
    .filter((event) => event.type === "user_prompt")
    .map((event) => ({
      text: asString(event.attributes["prompt"]) || asString(event.attributes["prompt_text"]),
      timestamp: event.timestamp,
      sequence: event.sequence,
    }))
    .filter((record) => record.text.trim().length > 0 && !isSystemInjectedNotification(record.text));
}
