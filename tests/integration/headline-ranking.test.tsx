import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { HeadlineKpiSection } from "../../src/components/HeadlineKpiSection";
import type { Comparison, DriftClassification, GroupStatistics, Metric, Run } from "../../src/types";

function makeMetric(key: string): Metric {
  return {
    key,
    label: key,
    valuesByRun: new Map([
      ["a", 100],
      ["b", 200],
    ]),
    denominatorLabel: "",
  };
}

function makeStats(key: string, deviation: number): GroupStatistics {
  return {
    metricKey: key,
    median: 150,
    min: 100,
    max: 200,
    spread: 50,
    deviationByRun: new Map([
      ["a", -deviation],
      ["b", deviation],
    ]),
    outlierRunIds: ["b"],
  };
}

function makeClassification(key: string): DriftClassification {
  return { metricKey: key, severity: "moderate", basis: "", overriddenByConfound: null };
}

describe("HeadlineKpiSection — ranking cap at 6", () => {
  it("shows only the top 6 by relative magnitude, ranked, with a view-full-table link", () => {
    const keys = Array.from({ length: 8 }, (_, i) => `m${i}`);
    const metrics = keys.map(makeMetric);
    const groupStatistics = keys.map((key, i) => makeStats(key, i + 1));
    const driftClassifications = keys.map(makeClassification);

    const comparison: Comparison = {
      runIds: ["a", "b"],
      title: "t",
      relatednessAssessment: null,
      metrics,
      groupStatistics,
      driftClassifications,
      headlineMetricKeys: keys
        .slice()
        .sort((x, y) => Number(y.slice(1)) - Number(x.slice(1)))
        .slice(0, 6),
      pinnedMetricKeys: [],
      dominantDriverFinding: null,
      sessionSummary: null,
    };

    const runs: Run[] = [
      { id: "a", sourceLogFileId: "a", label: "Run 1", taskPromptText: "", dataQualityNotes: [], rejectedToolCalls: [], hasCompletedTaskActivity: true },
      { id: "b", sourceLogFileId: "b", label: "Run 2", taskPromptText: "", dataQualityNotes: [], rejectedToolCalls: [], hasCompletedTaskActivity: true },
    ];

    render(<HeadlineKpiSection comparison={comparison} runs={runs} />);

    const headline = screen.getByRole("region", { name: /headline drift summary/i });
    expect(within(headline).getAllByRole("listitem")).toHaveLength(6);
    // Ranked descending by magnitude: m7 (deviation 8) first.
    const cardTitles = within(headline)
      .getAllByRole("heading", { level: 3 })
      .map((h) => h.textContent);
    expect(cardTitles).toEqual(["m7", "m6", "m5", "m4", "m3", "m2"]);
    expect(within(headline).getByText(/\+2 more drifted metrics — view full table/i)).toBeInTheDocument();
  });
});
