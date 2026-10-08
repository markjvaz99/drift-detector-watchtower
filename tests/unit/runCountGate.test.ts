import { describe, expect, it } from "vitest";
import { join } from "node:path";
import { loadFixtureRun } from "../helpers/loadFixtureRun";
import { buildComparison } from "../../src/drift/buildComparison";
import { MIN_RUNS_FOR_DRIFT } from "../../src/drift/runCountGate";

const DRIFT_LABELS = new Set(["moderate", "large", "categorical"]);

function compare(dir: string, files: string[]) {
  const built = files.map((f, i) => loadFixtureRun(join(__dirname, "../fixtures", dir, f), `Run ${i + 1}`));
  const logFilesById = new Map(built.map((b) => [b.logFile.id, b.logFile]));
  return buildComparison(built.map((b) => b.run), logFilesById, null);
}

describe("run-count gate", () => {
  it("requires 3 runs", () => {
    expect(MIN_RUNS_FOR_DRIFT).toBe(3);
  });

  it("does not label drift or a dominant driver for a 2-run comparison", () => {
    const c = compare("dominant-driver-clear", ["run-a.jsonl", "run-b.jsonl"]);
    expect(c.driftClassifications.some((d) => DRIFT_LABELS.has(d.severity))).toBe(false);
    expect(c.driftClassifications.some((d) => d.severity === "no-drift")).toBe(false);
    expect(c.driftClassifications.some((d) => d.severity === "cannot-determine")).toBe(true);
    expect(c.dominantDriverFinding?.hasDominantDriver).toBe(false);
    expect(c.dominantDriverFinding?.explanation).toMatch(/at least 3/);
  });

  it("can label drift for a 3-run comparison", () => {
    const c = compare("n-runs-outlier", ["run-1.jsonl", "run-2.jsonl", "run-3.jsonl"]);
    expect(c.driftClassifications.some((d) => DRIFT_LABELS.has(d.severity))).toBe(true);
  });
});
