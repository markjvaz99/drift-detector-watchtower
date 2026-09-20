import type { RepositoryState } from "../types";

export interface RepositoryStateComparisonResult {
  sameBranch: boolean;
  sameCommit: boolean;
  description: string;
}

export function compareRepositoryState(
  a: RepositoryState,
  b: RepositoryState,
): RepositoryStateComparisonResult {
  const bothKnown = a.branch !== null && b.branch !== null && a.headCommit !== null && b.headCommit !== null;

  if (!bothKnown) {
    // Genuinely unknown (e.g. no gitStatus block could be parsed) is a
    // distinct state from "different" — it must not be reported as a repo
    // mismatch when we simply couldn't determine one or both runs' state.
    return { sameBranch: false, sameCommit: false, description: "starting repository state unknown for one or both runs" };
  }

  const sameBranch = a.branch === b.branch;
  const sameCommit = a.headCommit === b.headCommit;

  let description: string;
  if (sameBranch && sameCommit) {
    description = "same repository, same starting commit";
  } else if (sameBranch && !sameCommit) {
    description = "same repository, different starting commit";
  } else {
    description = "different repository or branch";
  }

  return { sameBranch, sameCommit, description };
}
