import { flattenLogRecords } from "./flattenLogRecords";
import { sequenceEvents } from "./sequenceEvents";
import { parseJsonlText } from "./readJsonl";
import { isMainTaskApiCall } from "./excludeNonTaskCalls";
import { detectResentPrompt } from "./detectResentPrompt";
import { pairToolCalls } from "./pairToolCalls";
import { extractPromptRecords } from "./extractPromptTexts";
import type { LogFile, Run } from "../types";

export interface BuiltRun {
  logFile: LogFile;
  run: Run;
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
    unrecognizedEventTimestamps: flattened.unrecognizedEventTimestamps,
  };

  // The task prompt is deliberately the LAST user_prompt event, not the
  // first: an incomplete prompt followed by a corrected resend (see
  // detectResentPrompt below) means the final one is the one actually acted
  // on. Consumers that need every prompt the user sent — not just this
  // "effective" one — read extractPromptRecords(logFile.events) directly.
  const promptRecords = extractPromptRecords(events);
  const taskPromptText = promptRecords[promptRecords.length - 1]?.text ?? "";

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
