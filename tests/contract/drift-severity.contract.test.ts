import { describe, expect, it } from "vitest";
import { computeGroupStatistics } from "../../src/drift/groupStatistics";
import { classifySeverityFromStatistics } from "../../src/drift/classifySeverity";
import { isCategoricalToolUsageDifference } from "../../src/drift/categoricalDifference";
import type { Metric } from "../../src/types";

function makeMetric(key: string, values: Record<string, number>): Metric {
  return { key, label: key, valuesByRun: new Map(Object.entries(values)), denominatorLabel: "" };
}

describe("drift severity threshold table", () => {
  it("classifies |deviation| < 1 as no-drift", () => {
    const metric = makeMetric("m", { a: 100, b: 105 });
    const stats = computeGroupStatistics(metric)!;
    expect(Math.abs(stats.deviationByRun.get("a")!)).toBeLessThan(1);
    expect(classifySeverityFromStatistics(stats).severity).toBe("no-drift");
  });

  it("classifies 1 <= |deviation| <= 3 as moderate", () => {
    const metric = makeMetric("m", { a: 100, b: 300 });
    const stats = computeGroupStatistics(metric)!;
    expect(classifySeverityFromStatistics(stats).severity).toBe("moderate");
  });

  it("classifies |deviation| > 3 as large when one run is a strong outlier", () => {
    const metric = makeMetric("m", { a: 100, b: 102, c: 104, d: 900 });
    const stats = computeGroupStatistics(metric)!;
    expect(classifySeverityFromStatistics(stats).severity).toBe("large");
  });

  it("flags a tool present in some but not all runs as categorical", () => {
    const metric = makeMetric("tool_usage_McpTool", { a: 0, b: 2 });
    expect(isCategoricalToolUsageDifference(metric)).toBe(true);
  });

  it("marks an uncomputable metric as cannot-determine when no numeric values exist", () => {
    const metric: Metric = {
      key: "m",
      label: "m",
      valuesByRun: new Map([["a", "not-available"]]),
      denominatorLabel: "",
    };
    expect(computeGroupStatistics(metric)).toBeNull();
  });
});
