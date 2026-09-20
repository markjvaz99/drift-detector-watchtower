import { isMainTaskApiCall } from "../parsing/excludeNonTaskCalls";
import type { EvidenceReference, LogFile } from "../types";

function toRef(logFile: LogFile, sequence: number): EvidenceReference {
  return { logFileId: logFile.id, sequence, sessionIdentifier: logFile.sessionIdentifier };
}

export function findEvidenceForMetric(logFile: LogFile, metricKey: string): EvidenceReference[] {
  if (metricKey.startsWith("tool_usage_")) {
    const toolName = metricKey.replace("tool_usage_", "");
    return logFile.events
      .filter((e) => e.type === "tool_decision" && e.attributes["tool_name"] === toolName)
      .map((e) => toRef(logFile, e.sequence));
  }

  if (metricKey.startsWith("duration_")) {
    if (logFile.events.length === 0) return [];
    return [
      toRef(logFile, logFile.events[0].sequence),
      toRef(logFile, logFile.events[logFile.events.length - 1].sequence),
    ];
  }

  return logFile.events.filter(isMainTaskApiCall).map((e) => toRef(logFile, e.sequence));
}
