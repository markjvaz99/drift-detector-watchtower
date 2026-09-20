import { describe, expect, it } from "vitest";
import { join } from "node:path";
import { installNetworkEgressGuard } from "../../src/parsing/assertNoNetworkEgress";
import { loadFixtureRun } from "../helpers/loadFixtureRun";
import { assessPairwiseRelatedness } from "../../src/relatedness/assessPairwiseRelatedness";
import { buildRelatednessAssessment } from "../../src/relatedness/buildRelatednessAssessment";

const FIXTURES = join(__dirname, "../fixtures/two-runs-related");

describe("relatedness module network-egress guard", () => {
  it("computes pairwise and full relatedness assessments without any network call", () => {
    installNetworkEgressGuard();

    const a = loadFixtureRun(join(FIXTURES, "run-a.jsonl"), "Run 1");
    const b = loadFixtureRun(join(FIXTURES, "run-b.jsonl"), "Run 2");

    expect(() => assessPairwiseRelatedness(a.run, a.logFile, b.run, b.logFile)).not.toThrow();

    const logFilesById = new Map([
      [a.logFile.id, a.logFile],
      [b.logFile.id, b.logFile],
    ]);
    expect(() => buildRelatednessAssessment([a.run, b.run], logFilesById)).not.toThrow();
  });
});
