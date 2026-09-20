import { describe, expect, it } from "vitest";
import { buildHeadline } from "../../src/drift/buildHeadline";
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

describe("headline qualification/ranking rule", () => {
  it("includes metrics with severity above no-drift, excludes cannot-determine/uninterpretable", () => {
    const comparison = makeComparison({
      driftClassifications: [
        classification("m1", "moderate"),
        classification("m2", "no-drift"),
        classification("m3", "cannot-determine"),
        classification("m4", "uninterpretable"),
        classification("m5", "large"),
        classification("m6", "categorical"),
      ],
      groupStatistics: [stats("m1", 2), stats("m5", 4), stats("m6", 0)],
    });

    const { headlineMetricKeys } = buildHeadline(comparison);
    expect(headlineMetricKeys.sort()).toEqual(["m1", "m5", "m6"]);
  });

  it("includes a pinned metric even when its severity is no-drift", () => {
    const comparison = makeComparison({
      driftClassifications: [classification("m1", "no-drift")],
      groupStatistics: [stats("m1", 0.2)],
      pinnedMetricKeys: ["m1"],
    });
    const { headlineMetricKeys } = buildHeadline(comparison);
    expect(headlineMetricKeys).toEqual(["m1"]);
  });

  it("ranks by |deviationByRun| of the outlier run and caps at the top 6", () => {
    const classifications = Array.from({ length: 8 }, (_, i) => classification(`m${i}`, "moderate"));
    const groupStatistics = classifications.map((c, i) => stats(c.metricKey, i + 1));
    const comparison = makeComparison({ driftClassifications: classifications, groupStatistics });

    const { headlineMetricKeys } = buildHeadline(comparison);
    expect(headlineMetricKeys).toHaveLength(6);
    // The 6 largest-magnitude metrics are m7..m2 (deviation i+1, descending).
    expect(headlineMetricKeys).toEqual(["m7", "m6", "m5", "m4", "m3", "m2"]);
  });
});
