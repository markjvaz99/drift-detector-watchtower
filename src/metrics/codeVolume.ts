import { reconstructTrueLength } from "../parsing/reconstructTruncatedLength";
import type { LogFile } from "../types";
import type { RunMetricValue } from "./types";

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

export function computeCodeVolumeMetrics(logFile: LogFile): RunMetricValue[] {
  const decisions = logFile.events.filter((event) => event.type === "tool_decision");

  let netCharsAdded = 0;
  let netCharsRemoved = 0;

  for (const decision of decisions) {
    const toolName = asString(decision.attributes["tool_name"]);
    const newContent = asString(decision.attributes["new_content"]);
    const oldContent = asString(decision.attributes["old_content"]);

    if (toolName === "Write" && newContent !== null) {
      netCharsAdded += reconstructTrueLength(newContent);
    } else if (toolName === "Edit" && newContent !== null) {
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
