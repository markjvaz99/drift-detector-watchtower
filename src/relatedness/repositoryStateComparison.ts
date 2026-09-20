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
  const sameBranch = a.branch !== null && a.branch === b.branch;
  const sameCommit = a.headCommit !== null && a.headCommit === b.headCommit;

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
