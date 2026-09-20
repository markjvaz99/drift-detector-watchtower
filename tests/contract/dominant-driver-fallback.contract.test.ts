import { describe, expect, it } from "vitest";
import { selectDominantDriver } from "../../src/dominant-driver/selectDominantDriver";
import { composeExplanation } from "../../src/dominant-driver/composeExplanation";
import type { Comparison, DriftClassification, GroupStatistics } from "../../src/types";

function classification(metricKey: string, severity: DriftClassification["severity"]): DriftClassification {
  return { metricKey, severity, basis: "", overriddenByConfound: null };
}

function stats(metricKey: string, deviation: number): GroupStatistics {
  return {
    metricKey,
    median: 0,
    min: 0,
    max: 0,
    spread: 0,
    deviationByRun: new Map([["a", deviation], ["b", -deviation]]),
    outlierRunIds: ["a"],
  };
}

function makeComparison(overrides: Partial<Comparison>): Comparison {
  return {
    runIds: ["a", "b"],
    title: "t",
    relatednessAssessment: null,
    metrics: [],
    groupStatistics: [],
    driftClassifications: [],
    headlineMetricKeys: [],
    pinnedMetricKeys: [],
    dominantDriverFinding: null,
    sessionSummary: null,
    ...overrides,
  };
}

describe("dominant-driver 'no dominant driver' fallback", () => {
  it("returns hasDominantDriver: false when the top two qualifying metrics are within the 1.5x margin", () => {
    const comparison = makeComparison({
      driftClassifications: [classification("m1", "moderate"), classification("m2", "moderate")],
      groupStatistics: [stats("m1", 5), stats("m2", 4)], // 5 / 4 = 1.25, within margin
    });
    const selection = selectDominantDriver(comparison);
    expect(selection).toEqual({ hasDominantDriver: false, metricKey: null });
  });

  it("emits the fixed no-dominant-driver message with empty evidence/numbers", () => {
    const comparison = makeComparison({
      driftClassifications: [classification("m1", "moderate"), classification("m2", "moderate")],
      groupStatistics: [stats("m1", 5), stats("m2", 4)],
    });
    const selection = selectDominantDriver(comparison);
    const finding = composeExplanation(comparison, selection, [], new Map());

    expect(finding.hasDominantDriver).toBe(false);
    expect(finding.metricKey).toBeNull();
    expect(finding.explanation).toBe(
      "No single dominant driver identified; see the full comparison table for the complete picture.",
    );
    expect(finding.supportingEvidence).toEqual([]);
    expect(finding.supportingNumbers).toEqual([]);
  });

  it("treats zero qualifying metrics the same as the fallback case", () => {
    const comparison = makeComparison({ driftClassifications: [classification("m1", "no-drift")] });
    const selection = selectDominantDriver(comparison);
    expect(selection).toEqual({ hasDominantDriver: false, metricKey: null });
  });
});
