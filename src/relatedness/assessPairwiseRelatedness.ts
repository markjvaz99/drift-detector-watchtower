import { computePromptSimilarity } from "./promptSimilarity";
import { compareRepositoryState } from "./repositoryStateComparison";
import { compareWorkingDirectory } from "./workingDirectoryComparison";
import type { LogFile, PairwiseRelatedness, Run } from "../types";

const TOPICAL_SIMILARITY_THRESHOLD = 0.2;

function excerpt(text: string, maxLength = 60): string {
  const trimmed = text.trim();
  return trimmed.length > maxLength ? `${trimmed.slice(0, maxLength)}…` : trimmed;
}

function buildReasoning(
  confidence: PairwiseRelatedness["confidence"],
  runA: Run,
  runB: Run,
  repoDescription: string,
): string {
  if (confidence === "unrelated") {
    return `${runA.label} ("${excerpt(runA.taskPromptText)}") and ${runB.label} ("${excerpt(
      runB.taskPromptText,
    )}") do not appear to describe the same task.`;
  }
  if (confidence === "partial") {
    return `${runA.label} and ${runB.label} appear to describe a similar task, but ${repoDescription} — review before trusting this comparison.`;
  }
  return `${runA.label} and ${runB.label} both describe the same task on the same repository (${repoDescription}).`;
}

export function assessPairwiseRelatedness(
  runA: Run,
  logA: LogFile,
  runB: Run,
  logB: LogFile,
): PairwiseRelatedness {
  const promptSimilarityScore = computePromptSimilarity(runA.taskPromptText, runB.taskPromptText);
  const repoComparison = compareRepositoryState(
    logA.startingRepositoryState,
    logB.startingRepositoryState,
  );
  const dirComparison = compareWorkingDirectory(logA.workingDirectory, logB.workingDirectory);

  const topicallyRelated = promptSimilarityScore >= TOPICAL_SIMILARITY_THRESHOLD;

  let confidence: PairwiseRelatedness["confidence"];
  if (!topicallyRelated) {
    confidence = "unrelated";
  } else if (repoComparison.sameBranch && repoComparison.sameCommit) {
    // Working-directory differences are surfaced separately as metadata
    // (workingDirectoryComparison) but must not downgrade confidence — an
    // A/B comparison of the same repo/commit checked out into two different
    // working directories is the expected, correct setup, not a mismatch.
    confidence = "related";
  } else {
    confidence = "partial";
  }

  return {
    runIdA: runA.id,
    runIdB: runB.id,
    confidence,
    promptSimilarityScore,
    repositoryStateComparison: repoComparison.description,
    workingDirectoryComparison: dirComparison.description,
    reasoning: buildReasoning(confidence, runA, runB, repoComparison.description),
  };
}
