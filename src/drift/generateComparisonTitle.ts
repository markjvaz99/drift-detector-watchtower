import type { LogFile, Run } from "../types";
import { extractPromptRecords } from "../parsing/extractPromptTexts";

const STOPWORDS = new Set([
  "a", "an", "the", "this", "that", "and", "or", "to", "of", "in", "on", "for",
  "with", "is", "are", "it", "be", "as", "at", "by", "we", "our", "please",
  "implement", "add", "update", "fix", "refactor", "create", "make",
  "you", "your", "working", "session", "pasted", "content", "existing",
]);

function titleCase(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

// The longest real prompt across all runs is almost always the actual task
// description — trailing operational prompts ("start the server", "/exit")
// are short and would otherwise dominate if we just took the last one (or
// the first run's taskPromptText, which is itself the *last* prompt of that
// run — see src/parsing/buildRun.ts).
function pickSourcePrompt(runs: Run[], logFilesById: Map<string, LogFile>): string {
  const allPrompts = runs.flatMap((run) => {
    const logFile = logFilesById.get(run.sourceLogFileId);
    return logFile ? extractPromptRecords(logFile.events).map((record) => record.text) : [];
  });
  if (allPrompts.length > 0) {
    return allPrompts.reduce((longest, text) => (text.length > longest.length ? text : longest), "");
  }
  // No raw events available (e.g. logFilesById wasn't populated) — fall back
  // to whichever run's last-prompt field is non-empty.
  return runs.find((run) => run.taskPromptText.trim().length > 0)?.taskPromptText ?? "";
}

export function generateComparisonTitle(runs: Run[], logFilesById: Map<string, LogFile> = new Map()): string {
  const sourcePrompt = pickSourcePrompt(runs, logFilesById);
  if (!sourcePrompt) return "Comparison";

  const tokens = sourcePrompt
    // Strip wrapper markup some clients add around pasted prompt text
    // (e.g. <pasted_content id="...">...</pasted_content>) before tokenizing.
    .replace(/<[^>]+>/g, " ")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 2 && !STOPWORDS.has(token));

  const keywords = tokens.slice(0, 4).map(titleCase);
  return keywords.length > 0 ? keywords.join(" ") : "Comparison";
}
