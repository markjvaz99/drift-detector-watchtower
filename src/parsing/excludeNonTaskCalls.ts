import type { OrderedEvent } from "../types";

export const NON_TASK_QUERY_SOURCES = new Set([
  "generate_session_title",
  "prompt_suggestion",
  "away_summary",
]);

export function isMainTaskApiCall(event: OrderedEvent): boolean {
  if (event.type !== "api_call") return false;
  return !event.queryType || !NON_TASK_QUERY_SOURCES.has(event.queryType);
}

export function splitApiCalls(events: OrderedEvent[]): {
  mainTaskCalls: OrderedEvent[];
  nonTaskCalls: OrderedEvent[];
} {
  const apiCalls = events.filter((event) => event.type === "api_call");
  const mainTaskCalls = apiCalls.filter(isMainTaskApiCall);
  const nonTaskCalls = apiCalls.filter((event) => !isMainTaskApiCall(event));
  return { mainTaskCalls, nonTaskCalls };
}
