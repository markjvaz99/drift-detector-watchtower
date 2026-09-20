import { describe, expect, it } from "vitest";
import { computeGroupStatistics } from "../../src/drift/groupStatistics";
import type { Metric } from "../../src/types";

function makeMetric(values: Record<string, number>): Metric {
  return {
    key: "sample",
    label: "Sample",
    valuesByRun: new Map(Object.entries(values)),
    denominatorLabel: "",
  };
}

describe("group statistics formulas (2-run)", () => {
  it("computes median/min/max/spread and deviation for a two-run pair", () => {
    const metric = makeMetric({ run1: 100, run2: 140 });
    const stats = computeGroupStatistics(metric)!;

    expect(stats.median).toBe(120);
    expect(stats.min).toBe(100);
    expect(stats.max).toBe(140);
    // For exactly 2 runs, spread is the smaller value used as a relative-magnitude
    // baseline (contracts/drift-classification-rules.md: "spread reduces to a
    // single-pair difference measure") rather than the MAD of the pair — MAD of two
    // points is always exactly half their difference, which would make deviation
    // always ±1 regardless of the pair's actual relative magnitude.
    expect(stats.spread).toBe(100);
    expect(stats.deviationByRun.get("run1")).toBeCloseTo(-0.2);
    expect(stats.deviationByRun.get("run2")).toBeCloseTo(0.2);
    expect(stats.outlierRunIds.sort()).toEqual(["run1", "run2"]);
  });

  it("returns zero deviation when both runs have the same value", () => {
    const metric = makeMetric({ run1: 50, run2: 50 });
    const stats = computeGroupStatistics(metric)!;
    expect(stats.deviationByRun.get("run1")).toBe(0);
    expect(stats.deviationByRun.get("run2")).toBe(0);
  });
});
