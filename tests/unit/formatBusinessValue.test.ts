import { describe, expect, it } from "vitest";
import {
  categoryForMetricKey,
  formatComparisonText,
  formatMetricValue,
  shapeForMetricKey,
} from "../../src/recommendations/formatBusinessValue";

// Real numbers from sample-logs/new-expense-budgets-feature.driftreport.json
// (Run 1 = generic_task, Run 2 = detailed_task), used to lock in the exact
// business-facing formats this feature promises: "$12.83 vs $3.25",
// "21.4 min vs 1.7 min", "48.3M vs 10.7M total tokens".
describe("formatMetricValue", () => {
  it("formats cost in dollars", () => {
    expect(formatMetricValue("cost_usd", 12.828437599999994)).toBe("$12.83");
    expect(formatMetricValue("cost_usd", 3.2497009999999986)).toBe("$3.25");
  });

  it("formats duration_*_ms metrics as minutes", () => {
    expect(formatMetricValue("duration_approval_wait_ms", 1286251)).toBe("21.4 min");
    expect(formatMetricValue("duration_approval_wait_ms", 100602)).toBe("1.7 min");
  });

  it("formats duration under a minute in seconds", () => {
    expect(formatMetricValue("duration_active_ms", 45000)).toBe("45.0 sec");
  });

  it("formats duration an hour or more in hours", () => {
    expect(formatMetricValue("duration_total_ms", 7_200_000)).toBe("2.0 hr");
  });

  it("compact-formats large token counts", () => {
    expect(formatMetricValue("total_tokens", 48309785)).toBe("48.3M");
    expect(formatMetricValue("total_tokens", 10687652)).toBe("10.7M");
  });

  it("formats plain integer counts with thousands separators", () => {
    expect(formatMetricValue("turns", 232)).toBe("232");
    expect(formatMetricValue("tool_calls", 228)).toBe("228");
    expect(formatMetricValue("tool_usage_mcp_tool", 82)).toBe("82");
  });

  it("formats ratio/rate metrics as percentages", () => {
    expect(formatMetricValue("activity_ratio_exploratory", 0.7280701754385965)).toBe("72.8%");
    expect(formatMetricValue("failed_call_rate", 0)).toBe("0.0%");
  });

  it("formats efficiency (per-unit) metrics with limited precision", () => {
    expect(formatMetricValue("tokens_per_turn", 513.6120689655172)).toBe("513.6");
    expect(formatMetricValue("tool_calls_per_turn", 0.9827586206896551)).toBe("0.98");
  });

  it("passes through not-available", () => {
    expect(formatMetricValue("cost_usd", "not-available")).toBe("N/A");
  });
});

describe("categoryForMetricKey / shapeForMetricKey", () => {
  it("categorizes cost, time, tool usage, workload, efficiency, quality", () => {
    expect(categoryForMetricKey("cost_usd")).toBe("cost");
    expect(categoryForMetricKey("duration_approval_wait_ms")).toBe("time");
    expect(categoryForMetricKey("tool_usage_mcp_tool")).toBe("tool_usage");
    expect(categoryForMetricKey("total_tokens")).toBe("workload");
    expect(categoryForMetricKey("tokens_per_turn")).toBe("efficiency");
    expect(categoryForMetricKey("failed_call_rate")).toBe("quality");
  });

  it("shapes ratio/rate metrics distinctly from efficiency and absolute metrics", () => {
    expect(shapeForMetricKey("activity_ratio_exploratory")).toBe("ratio");
    expect(shapeForMetricKey("failed_call_rate")).toBe("ratio");
    expect(shapeForMetricKey("tokens_per_turn")).toBe("efficiency");
    expect(shapeForMetricKey("overhead_growth_multiple")).toBe("efficiency");
    expect(shapeForMetricKey("turns")).toBe("absolute");
  });
});

describe("formatComparisonText", () => {
  it("uses a multiplier once the gap is 3x or more", () => {
    // cost_usd: 12.828437599999994 vs 3.2497009999999986 -> ~3.95x
    expect(
      formatComparisonText("cost_usd", 12.828437599999994, 3.2497009999999986, "$12.83", "$3.25"),
    ).toBe("3.9x");
  });

  it("uses a signed percentage for gaps under 3x", () => {
    // tool_calls_per_turn: 0.9827586206896551 vs 1.0731707317073171 -> ~-8%
    const result = formatComparisonText("tool_calls_per_turn", 0.9827586206896551, 1.0731707317073171, "0.98", "1.07");
    expect(result).toMatch(/^-8%$/);
  });

  it("renders durations as formatted-value-vs-formatted-value, not a multiple", () => {
    expect(
      formatComparisonText("duration_approval_wait_ms", 1286251, 100602, "21.4 min", "1.7 min"),
    ).toBe("21.4 min vs 1.7 min");
  });

  it("renders ratio metrics as formatted-value-vs-formatted-value", () => {
    expect(formatComparisonText("activity_ratio_exploratory", 0.728, 0.716, "72.8%", "71.6%")).toBe(
      "72.8% vs 71.6%",
    );
  });

  it("flags a negligible gap instead of an inflated percentage", () => {
    expect(formatComparisonText("turns", 100, 99, "100", "99")).toBe("No material difference");
  });

  it("falls back to a vs comparison when one side is zero", () => {
    expect(formatComparisonText("rejection_count", 0, 1, "0", "1")).toBe("0 vs 1");
  });
});
