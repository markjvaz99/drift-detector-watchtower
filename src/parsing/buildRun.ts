import { flattenLogRecords } from "./flattenLogRecords";
import { sequenceEvents } from "./sequenceEvents";
import { parseJsonlText } from "./readJsonl";
import { isMainTaskApiCall } from "./excludeNonTaskCalls";
import { detectResentPrompt } from "./detectResentPrompt";
import { pairToolCalls } from "./pairToolCalls";
import type { LogFile, Run } from "../types";

export interface BuiltRun {
  logFile: LogFile;
  run: Run;
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

export function buildRunFromText(fileName: string, text: string): BuiltRun {
  const rawLines = parseJsonlText(text);
  const flattened = flattenLogRecords(rawLines);
  const events = sequenceEvents(flattened.records);

  const logFileId = `${fileName}:${flattened.sessionIdentifier || fileName}`;

  const logFile: LogFile = {
    id: logFileId,
    fileName,
    sessionIdentifier: flattened.sessionIdentifier,
    buildVersion: flattened.buildVersion,
    workingDirectory: flattened.workingDirectory,
    startingRepositoryState: flattened.startingRepositoryState,
    events,
    unrecognizedEventCount: flattened.unrecognizedEventCount,
  };

  const promptEvents = events.filter((event) => event.type === "user_prompt");
  const taskPromptText =
    promptEvents.length > 0 ? asString(promptEvents[promptEvents.length - 1].attributes["prompt_text"]) : "";

  const resentPromptNote = detectResentPrompt(events, logFileId, flattened.sessionIdentifier);
  const dataQualityNotes = resentPromptNote ? [resentPromptNote] : [];

  const toolCallOutcomes = pairToolCalls(events);
  const rejectedToolCalls = toolCallOutcomes.filter((outcome) => outcome.decision === "rejected");

  const mainTaskCallCount = events.filter(isMainTaskApiCall).length;

  const run: Run = {
    id: logFileId,
    sourceLogFileId: logFileId,
    label: "",
    taskPromptText,
    dataQualityNotes,
    rejectedToolCalls,
    hasCompletedTaskActivity: mainTaskCallCount > 0,
  };

  return { logFile, run };
}

export async function buildRun(file: File): Promise<BuiltRun> {
  const text = await file.text();
  return buildRunFromText(file.name, text);
}
