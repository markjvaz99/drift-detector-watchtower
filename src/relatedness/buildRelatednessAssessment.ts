import { assessPairwiseRelatedness } from "./assessPairwiseRelatedness";
import type { LogFile, PairwiseRelatedness, RelatednessAssessment, RelatednessCluster, Run } from "../types";

class UnionFind {
  private parent = new Map<string, string>();

  find(id: string): string {
    if (!this.parent.has(id)) {
      this.parent.set(id, id);
      return id;
    }
    const parent = this.parent.get(id)!;
    if (parent === id) return id;
    const root = this.find(parent);
    this.parent.set(id, root);
    return root;
  }

  union(a: string, b: string): void {
    const rootA = this.find(a);
    const rootB = this.find(b);
    if (rootA !== rootB) this.parent.set(rootA, rootB);
  }
}

export function buildRelatednessAssessment(
  runs: Run[],
  logFilesById: Map<string, LogFile>,
): RelatednessAssessment | null {
  if (runs.length < 2) return null;

  const pairs: PairwiseRelatedness[] = [];
  const unionFind = new UnionFind();

  for (let i = 0; i < runs.length; i += 1) {
    for (let j = i + 1; j < runs.length; j += 1) {
      const runA = runs[i];
      const runB = runs[j];
      const logA = logFilesById.get(runA.sourceLogFileId);
      const logB = logFilesById.get(runB.sourceLogFileId);
      if (!logA || !logB) continue;

      const pair = assessPairwiseRelatedness(runA, logA, runB, logB);
      pairs.push(pair);
      if (pair.confidence === "related") {
        unionFind.union(runA.id, runB.id);
      }
    }
  }

  const clusterMembers = new Map<string, Set<string>>();
  for (const run of runs) {
    const root = unionFind.find(run.id);
    if (!clusterMembers.has(root)) clusterMembers.set(root, new Set());
    clusterMembers.get(root)!.add(run.id);
  }

  const clusters: RelatednessCluster[] = Array.from(clusterMembers.values())
    .filter((members) => members.size >= 2)
    .map((members) => ({
      runIds: Array.from(members),
      pairwiseDetails: pairs.filter(
        (pair) => members.has(pair.runIdA) && members.has(pair.runIdB),
      ),
    }));

  const hasAnyBelowFullConfidence = pairs.some((pair) => pair.confidence !== "related");

  return {
    runIds: runs.map((run) => run.id),
    pairs,
    clusters,
    hasAnyBelowFullConfidence,
  };
}
