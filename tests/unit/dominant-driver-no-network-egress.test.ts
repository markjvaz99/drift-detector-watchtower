import { describe, expect, it } from "vitest";
import { join } from "node:path";
import { installNetworkEgressGuard } from "../../src/parsing/assertNoNetworkEgress";
import { loadFixtureRun } from "../helpers/loadFixtureRun";
import { buildComparison } from "../../src/drift/buildComparison";
import { selectDominantDriver } from "../../src/dominant-driver/selectDominantDriver";
import { composeExplanation } from "../../src/dominant-driver/composeExplanation";
import { composeSessionSummary } from "../../src/dominant-driver/composeSessionSummary";

const FIXTURES = join(__dirname, "../fixtures/two-runs-related");

describe("dominant-driver module network-egress guard", () => {
  it("selects and explains a dominant driver, and composes a session summary, without any network call", () => {
    installNetworkEgressGuard();

    const a = loadFixtureRun(join(FIXTURES, "run-a.jsonl"), "Run 1");
    const b = loadFixtureRun(join(FIXTURES, "run-b.jsonl"), "Run 2");
    const logFilesById = new Map([
      [a.logFile.id, a.logFile],
      [b.logFile.id, b.logFile],
    ]);
    const runs = [a.run, b.run];

    expect(() => {
      const comparison = buildComparison(runs, logFilesById, null);
      const selection = selectDominantDriver(comparison);
      composeExplanation(comparison, selection, runs, logFilesById);
      composeSessionSummary(a.run, a.logFile);
    }).not.toThrow();
  });
});
