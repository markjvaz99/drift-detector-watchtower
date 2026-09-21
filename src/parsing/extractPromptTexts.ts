import type { OrderedEvent } from "../types";

export interface PromptRecord {
  text: string;
  timestamp: string;
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

/**
 * Every "user_prompt" event in the session, in order. Real telemetry carries
 * the text as "prompt"; synthetic fixtures (and the original spec's assumed
 * schema) use "prompt_text".
 */
export function extractPromptRecords(events: OrderedEvent[]): PromptRecord[] {
  return events
    .filter((event) => event.type === "user_prompt")
    .map((event) => ({
      text: asString(event.attributes["prompt"]) || asString(event.attributes["prompt_text"]),
      timestamp: event.timestamp,
    }))
    .filter((record) => record.text.trim().length > 0);
}
