import { describe, expect, it } from "vitest";
import { join } from "node:path";
import { loadFixtureRun } from "../helpers/loadFixtureRun";
import { buildComparison } from "../../src/drift/buildComparison";

const FIXTURES = join(__dirname, "../fixtures");

describe("confound-forced uninterpretable override", () => {
  it("forces duration_total_ms to uninterpretable when approval-wait dominates duration", () => {
    const normal = loadFixtureRun(join(FIXTURES, "single-run-normal.jsonl"), "Run 1");
    const waitDominated = loadFixtureRun(join(FIXTURES, "duration-confound.jsonl"), "Run 2");
    const logFilesById = new Map([
      [normal.logFile.id, normal.logFile],
      [waitDominated.logFile.id, waitDominated.logFile],
    ]);
    const comparison = buildComparison([normal.run, waitDominated.run], logFilesById, null);

    const durationClassification = comparison.driftClassifications.find(
      (c) => c.metricKey === "duration_total_ms",
    );
    expect(durationClassification?.severity).toBe("uninterpretable");
    expect(durationClassification?.overriddenByConfound?.type).toBe("approval-wait-dominated");
  });

  it("forces resent-prompt-affected metrics to uninterpretable", () => {
    const resent = loadFixtureRun(join(FIXTURES, "resent-prompt.jsonl"), "Run 1");
    const normal = loadFixtureRun(join(FIXTURES, "single-run-normal.jsonl"), "Run 2");
    const logFilesById = new Map([
      [resent.logFile.id, resent.logFile],
      [normal.logFile.id, normal.logFile],
    ]);
    const comparison = buildComparison([resent.run, normal.run], logFilesById, null);

    const turnsClassification = comparison.driftClassifications.find((c) => c.metricKey === "turns");
    expect(turnsClassification?.severity).toBe("uninterpretable");
    expect(turnsClassification?.overriddenByConfound?.type).toBe("resent-prompt");
  });
});
