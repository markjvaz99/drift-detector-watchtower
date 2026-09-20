import { describe, expect, it } from "vitest";
import { computeGroupStatistics } from "../../src/drift/groupStatistics";
import { identifyOutliers } from "../../src/drift/identifyOutliers";
import type { Metric } from "../../src/types";

function makeMetric(values: Record<string, number>): Metric {
  return {
    key: "sample",
    label: "Sample",
    valuesByRun: new Map(Object.entries(values)),
    denominatorLabel: "",
  };
}

describe("group statistics formulas (N-run, N >= 3)", () => {
  it("computes median/min/max/spread across the full run set", () => {
    const metric = makeMetric({ a: 100, b: 102, c: 104, d: 900 });
    const stats = computeGroupStatistics(metric)!;

    expect(stats.median).toBe(103);
    expect(stats.min).toBe(100);
    expect(stats.max).toBe(900);
    // MAD around the median: |100-103|=3, |102-103|=1, |104-103|=1, |900-103|=797 -> median of [3,1,1,797] = 2
    expect(stats.spread).toBe(2);
  });

  it("identifies the run(s) furthest from central tendency as outliers", () => {
    const metric = makeMetric({ a: 100, b: 102, c: 104, d: 900 });
    const stats = computeGroupStatistics(metric)!;
    expect(stats.outlierRunIds).toEqual(["d"]);

    const outliers = identifyOutliers(stats, metric);
    expect(outliers).toHaveLength(1);
    expect(outliers[0].runId).toBe("d");
    expect(outliers[0].value).toBe(900);
  });

  it("excludes not-available values from the group-statistics input", () => {
    const metric: Metric = {
      key: "m",
      label: "m",
      valuesByRun: new Map<string, number | "not-available">([
        ["a", 100],
        ["b", "not-available"],
        ["c", 120],
      ]),
      denominatorLabel: "",
    };
    const stats = computeGroupStatistics(metric)!;
    expect(stats.deviationByRun.has("b")).toBe(false);
    expect(stats.deviationByRun.size).toBe(2);
  });
});
