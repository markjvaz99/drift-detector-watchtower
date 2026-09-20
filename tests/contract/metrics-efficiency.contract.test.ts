import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildRunFromText } from "../../src/parsing/buildRun";
import { computeEfficiencyMetrics } from "../../src/metrics/efficiency";

const fixturePath = join(__dirname, "../fixtures/single-run-normal.jsonl");

function metricValue(metrics: ReturnType<typeof computeEfficiencyMetrics>, key: string) {
  return metrics.find((m) => m.key === key)?.value;
}

describe("efficiency metric formulas", () => {
  it("computes turns as main-task API call count, excluding non-task calls", () => {
    const text = readFileSync(fixturePath, "utf8");
    const { logFile } = buildRunFromText("single-run-normal.jsonl", text);
    const metrics = computeEfficiencyMetrics(logFile);

    // 3 main-task api_calls; the 4th (generate_session_title) is excluded.
    expect(metricValue(metrics, "turns")).toBe(3);
    expect(metricValue(metrics, "input_tokens")).toBe(500 + 400 + 300);
    expect(metricValue(metrics, "output_tokens")).toBe(300 + 250 + 150);
    expect(metricValue(metrics, "cache_read_tokens")).toBe(100 + 1800 + 2500);
    expect(metricValue(metrics, "cache_creation_tokens")).toBe(2000 + 100 + 50);

    const totalTokens = metricValue(metrics, "total_tokens") as number;
    expect(totalTokens).toBe(1200 + 700 + 4400 + 2150);

    // Deliberately excludes cache tokens (see contracts/metric-formulas.md).
    const inputOutputTokens = (500 + 400 + 300) + (300 + 250 + 150);
    expect(metricValue(metrics, "tokens_per_turn")).toBe(inputOutputTokens / 3);
    expect(metricValue(metrics, "tool_calls")).toBe(3);
    expect(metricValue(metrics, "tool_calls_per_turn")).toBe(1);
  });
});
