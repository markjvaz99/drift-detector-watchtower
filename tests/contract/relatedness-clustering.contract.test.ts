import { describe, expect, it } from "vitest";
import { join } from "node:path";
import { loadFixtureRun } from "../helpers/loadFixtureRun";
import { buildRelatednessAssessment } from "../../src/relatedness/buildRelatednessAssessment";

const FIXTURES = join(__dirname, "../fixtures/n-runs-mixed-relatedness");

describe("relatedness clustering", () => {
  it("groups the 3 related runs into one cluster and leaves the unrelated run out of it", () => {
    const built = [1, 2, 3, 4].map((i) => loadFixtureRun(join(FIXTURES, `run-${i}.jsonl`), `Run ${i}`));
    const runs = built.map((b) => b.run);
    const logFilesById = new Map(built.map((b) => [b.logFile.id, b.logFile]));

    const assessment = buildRelatednessAssessment(runs, logFilesById);
    expect(assessment).not.toBeNull();
    expect(assessment!.clusters).toHaveLength(1);
    expect(assessment!.clusters[0].runIds).toHaveLength(3);
    expect(assessment!.clusters[0].runIds).not.toContain(runs[3].id);

    const pairsInvolvingFourth = assessment!.pairs.filter(
      (pair) => pair.runIdA === runs[3].id || pair.runIdB === runs[3].id,
    );
    expect(pairsInvolvingFourth.every((pair) => pair.confidence === "unrelated")).toBe(true);
    expect(assessment!.hasAnyBelowFullConfidence).toBe(true);
  });
});
