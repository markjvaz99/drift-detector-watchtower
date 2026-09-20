import { describe, expect, it } from "vitest";
import { selectDominantDriver } from "../../src/dominant-driver/selectDominantDriver";
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

describe("dominant-driver selection rule", () => {
  it("selects the top-ranked qualifying metric when its magnitude is at least 1.5x the runner-up's", () => {
    const comparison = makeComparison({
      driftClassifications: [classification("m1", "moderate"), classification("m2", "moderate")],
      groupStatistics: [stats("m1", 6), stats("m2", 4)], // 6 / 4 = 1.5
    });
    const selection = selectDominantDriver(comparison);
    expect(selection).toEqual({ hasDominantDriver: true, metricKey: "m1" });
  });

  it("selects the sole qualifying metric even without a runner-up to compare against", () => {
    const comparison = makeComparison({
      driftClassifications: [classification("m1", "large")],
      groupStatistics: [stats("m1", 5)],
    });
    const selection = selectDominantDriver(comparison);
    expect(selection).toEqual({ hasDominantDriver: true, metricKey: "m1" });
  });
});
