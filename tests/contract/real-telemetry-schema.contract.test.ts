import { describe, expect, it } from "vitest";
import { join } from "node:path";
import { loadFixtureRun } from "../helpers/loadFixtureRun";
import { computeRunMetrics } from "../../src/metrics/computeRunMetrics";
import { pairToolCalls } from "../../src/parsing/pairToolCalls";

const FIXTURE_PATH = join(__dirname, "../fixtures/real-schema-sample.jsonl");

/**
 * Verifies the parser handles the *actual* Claude Code OTLP export shape
 * (confirmed against real telemetry, 2026-09-20) — not just the shape
 * originally assumed by contracts/input-log-schema.md and this app's other
 * synthetic fixtures. See tests/fixtures/generate.mjs's realSchemaResourceLogs
 * comment for the full list of real-vs-assumed differences.
 */
describe("real Claude Code telemetry schema", () => {
  it("captures session identity from per-record attributes when resource attributes carry none", () => {
    const { logFile } = loadFixtureRun(FIXTURE_PATH, "Real Run");
    expect(logFile.sessionIdentifier).toBe("real-schema-session-1");
  });

  it("recognizes 'api_request' as the main-task API-call event", () => {
    const { logFile, run } = loadFixtureRun(FIXTURE_PATH, "Real Run");
    expect(run.hasCompletedTaskActivity).toBe(true);

    const metrics = computeRunMetrics(logFile);
    const turns = metrics.find((m) => m.key === "turns");
    expect(turns?.value).toBe(3);
    const cost = metrics.find((m) => m.key === "cost_usd");
    expect(cost?.value).toBeCloseTo(0.12);
  });

  it("captures the task prompt text from the 'prompt' attribute", () => {
    const { run } = loadFixtureRun(FIXTURE_PATH, "Real Run");
    expect(run.taskPromptText).toMatch(/monthly-budget feature/i);
  });

  it("normalizes accept/reject decisions and boolean success into approved/rejected + success/failure", () => {
    const { run } = loadFixtureRun(FIXTURE_PATH, "Real Run");
    expect(run.rejectedToolCalls).toHaveLength(1);
    expect(run.rejectedToolCalls[0].toolName).toBe("Bash");

    const { logFile } = loadFixtureRun(FIXTURE_PATH, "Real Run");
    const metrics = computeRunMetrics(logFile);
    const toolCalls = metrics.find((m) => m.key === "tool_calls");
    // 5 accepted calls (Read, Edit, Bash/user_temporary, Bash/failed, Edit/truncated)
    // — the rejected Bash call doesn't count.
    expect(toolCalls?.value).toBe(5);
  });

  it("computes tokens per turn as (input + output) / turns, excluding cache tokens", () => {
    const { logFile } = loadFixtureRun(FIXTURE_PATH, "Real Run");
    const metrics = computeRunMetrics(logFile);
    const tokensPerTurn = metrics.find((m) => m.key === "tokens_per_turn");
    // (500+400+300 input + 300+250+150 output) / 3 turns = 633.33...
    expect(tokensPerTurn?.value).toBeCloseTo((1200 + 700) / 3);
  });

  it("detects a failure encoded as tool_result.success = the STRING \"false\", not just a boolean", () => {
    const { logFile } = loadFixtureRun(FIXTURE_PATH, "Real Run");
    const outcomes = pairToolCalls(logFile.events);
    const failed = outcomes.find((o) => o.toolUseId === "tu_real_failed");
    expect(failed?.executed).toBe(true);
    expect(failed?.result).toBe("failure");

    const metrics = computeRunMetrics(logFile);
    const failedCount = metrics.find((m) => m.key === "failed_call_count");
    expect(failedCount?.value).toBe(1);
  });

  it("extracts Edit old_string/new_string from the result's JSON-encoded tool_input", () => {
    const { logFile } = loadFixtureRun(FIXTURE_PATH, "Real Run");
    const metrics = computeRunMetrics(logFile);
    const added = metrics.find((m) => m.key === "net_chars_added");
    const removed = metrics.find((m) => m.key === "net_chars_removed");
    // Edit #1: "return a - b" (12 chars) -> "return a + b # fixed" (20 chars) = +8
    // Edit #2 (truncated "…[N chars]" marker): "pass" (4 chars) -> true length
    // 120 visible + 4880 marked-truncated = 5000 chars = +4996
    expect(added?.value).toBe(8 + 4996);
    expect(removed?.value).toBe(0);
  });
});
