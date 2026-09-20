import { describe, expect, it } from "vitest";
import { join } from "node:path";
import { loadFixtureRun } from "../helpers/loadFixtureRun";
import { assessPairwiseRelatedness } from "../../src/relatedness/assessPairwiseRelatedness";

const FIXTURES = join(__dirname, "../fixtures");

describe("pairwise relatedness rating table", () => {
  it("rates a same-task, same-repo, same-commit pair as related", () => {
    const a = loadFixtureRun(join(FIXTURES, "two-runs-related/run-a.jsonl"), "Run 1");
    const b = loadFixtureRun(join(FIXTURES, "two-runs-related/run-b.jsonl"), "Run 2");
    const pair = assessPairwiseRelatedness(a.run, a.logFile, b.run, b.logFile);
    expect(pair.confidence).toBe("related");
  });

  it("rates a same-task, different-commit pair as partial", () => {
    const a = loadFixtureRun(join(FIXTURES, "two-runs-partial/run-a.jsonl"), "Run 1");
    const b = loadFixtureRun(join(FIXTURES, "two-runs-partial/run-b.jsonl"), "Run 2");
    const pair = assessPairwiseRelatedness(a.run, a.logFile, b.run, b.logFile);
    expect(pair.confidence).toBe("partial");
  });

  it("rates an unrelated-task pair as unrelated", () => {
    const a = loadFixtureRun(join(FIXTURES, "two-runs-unrelated/run-a.jsonl"), "Run 1");
    const b = loadFixtureRun(join(FIXTURES, "two-runs-unrelated/run-b.jsonl"), "Run 2");
    const pair = assessPairwiseRelatedness(a.run, a.logFile, b.run, b.logFile);
    expect(pair.confidence).toBe("unrelated");
  });

  // Real Claude Code telemetry never carries vcs.branch/vcs.commit resource
  // attributes — starting repository state instead has to be parsed out of a
  // "# gitStatus" text block embedded in the first api_request_body event's
  // body. These fixtures mimic that real shape (unlike the fixtures above,
  // which use the synthetic vcs.branch/vcs.commit attributes directly).
  it("parses branch/commit from an embedded gitStatus text block and rates same-branch/same-commit runs as related even with different working directories", () => {
    const a = loadFixtureRun(join(FIXTURES, "two-runs-gitstatus-related/run-a.jsonl"), "Run 1");
    const b = loadFixtureRun(join(FIXTURES, "two-runs-gitstatus-related/run-b.jsonl"), "Run 2");

    expect(a.logFile.startingRepositoryState).toEqual({
      branch: "dev2",
      headCommit: "81d4cea",
      workingDirectory: "/Users/dev/sample-test-1",
    });

    const pair = assessPairwiseRelatedness(a.run, a.logFile, b.run, b.logFile);
    expect(pair.confidence).toBe("related");
    expect(pair.repositoryStateComparison).toBe("same repository, same starting commit");
    // Working-directory difference stays visible as metadata...
    expect(pair.workingDirectoryComparison).toBe("different project path");
    // ...but must not itself downgrade confidence below "related".
  });

  it("reports starting repository state as unknown (not 'different') when no gitStatus block is parseable", () => {
    const a = loadFixtureRun(join(FIXTURES, "two-runs-gitstatus-unknown/run-a.jsonl"), "Run 1");
    const b = loadFixtureRun(join(FIXTURES, "two-runs-gitstatus-unknown/run-b.jsonl"), "Run 2");

    expect(a.logFile.startingRepositoryState.branch).toBeNull();

    const pair = assessPairwiseRelatedness(a.run, a.logFile, b.run, b.logFile);
    expect(pair.repositoryStateComparison).toBe("starting repository state unknown for one or both runs");
    expect(pair.confidence).not.toBe("related");
  });
});
