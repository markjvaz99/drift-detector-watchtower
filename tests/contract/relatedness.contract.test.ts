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
});
