import type { Run } from "../types";

const STOPWORDS = new Set([
  "a", "an", "the", "this", "that", "and", "or", "to", "of", "in", "on", "for",
  "with", "is", "are", "it", "be", "as", "at", "by", "we", "our", "please",
  "implement", "add", "update", "fix", "refactor", "create", "make",
]);

function titleCase(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

export function generateComparisonTitle(runs: Run[]): string {
  const sourcePrompt = runs.find((run) => run.taskPromptText.trim().length > 0)?.taskPromptText ?? "";
  if (!sourcePrompt) return "Comparison";

  const tokens = sourcePrompt
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 2 && !STOPWORDS.has(token));

  const keywords = tokens.slice(0, 4).map(titleCase);
  return keywords.length > 0 ? keywords.join(" ") : "Comparison";
}
