import { reconstructTrueLength } from "../parsing/reconstructTruncatedLength";
import { pairToolCalls } from "../parsing/pairToolCalls";
import type { LogFile, OrderedEvent } from "../types";
import type { RunMetricValue } from "./types";

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

interface EditContent {
  newContent: string | null;
  oldContent: string | null;
}

/**
 * Resolves an Edit/Write call's before/after content. Synthetic fixtures
 * (and the original spec's assumed schema) put plain new_content/old_content
 * strings directly on the tool_decision event. Real Claude Code telemetry
 * instead embeds them as a JSON-encoded object in the tool_result's
 * tool_input ({old_string, new_string} for Edit, {content} for Write).
 */
function resolveEditContent(
  toolName: string | null,
  decisionEvent: OrderedEvent,
  resultEvent: OrderedEvent | undefined,
): EditContent {
  const legacyNew = asString(decisionEvent.attributes["new_content"]);
  const legacyOld = asString(decisionEvent.attributes["old_content"]);
  if (legacyNew !== null) {
    return { newContent: legacyNew, oldContent: legacyOld };
  }

  const rawToolInput = resultEvent ? asString(resultEvent.attributes["tool_input"]) : null;
  if (rawToolInput === null) return { newContent: null, oldContent: null };

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(rawToolInput);
  } catch {
    return { newContent: null, oldContent: null };
  }

  if (toolName === "Write") {
    return { newContent: asString(parsed["content"]), oldContent: null };
  }
  if (toolName === "Edit") {
    return { newContent: asString(parsed["new_string"]), oldContent: asString(parsed["old_string"]) };
  }
  return { newContent: null, oldContent: null };
}

export function computeCodeVolumeMetrics(logFile: LogFile): RunMetricValue[] {
  const eventsBySequence = new Map(logFile.events.map((event) => [event.sequence, event]));
  const outcomes = pairToolCalls(logFile.events).filter((outcome) => outcome.executed);

  let netCharsAdded = 0;
  let netCharsRemoved = 0;

  for (const outcome of outcomes) {
    if (outcome.toolName !== "Edit" && outcome.toolName !== "Write") continue;
    const decisionEvent = eventsBySequence.get(outcome.decisionSequence);
    if (!decisionEvent) continue;
    const resultEvent = outcome.resultSequence !== null ? eventsBySequence.get(outcome.resultSequence) : undefined;

    const { newContent, oldContent } = resolveEditContent(outcome.toolName, decisionEvent, resultEvent);
    if (newContent === null) continue;

    if (outcome.toolName === "Write") {
      netCharsAdded += reconstructTrueLength(newContent);
    } else {
      const newLength = reconstructTrueLength(newContent);
      const oldLength = oldContent !== null ? reconstructTrueLength(oldContent) : 0;
      const delta = newLength - oldLength;
      if (delta >= 0) {
        netCharsAdded += delta;
      } else {
        netCharsRemoved += -delta;
      }
    }
  }

  return [
    { key: "net_chars_added", label: "Net characters added", value: netCharsAdded, denominatorLabel: "" },
    { key: "net_chars_removed", label: "Net characters removed", value: netCharsRemoved, denominatorLabel: "" },
  ];
}
