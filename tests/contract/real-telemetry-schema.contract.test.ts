import { describe, expect, it } from "vitest";
import { join } from "node:path";
import { loadFixtureRun } from "../helpers/loadFixtureRun";
import { computeRunMetrics } from "../../src/metrics/computeRunMetrics";

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
    // 3 accepted calls (Read, Edit, Bash) — the rejected Bash call doesn't count.
    expect(toolCalls?.value).toBe(3);
  });

  it("extracts Edit old_string/new_string from the result's JSON-encoded tool_input", () => {
    const { logFile } = loadFixtureRun(FIXTURE_PATH, "Real Run");
    const metrics = computeRunMetrics(logFile);
    const added = metrics.find((m) => m.key === "net_chars_added");
    const removed = metrics.find((m) => m.key === "net_chars_removed");
    // old_string "return a - b" (12 chars) -> new_string "return a + b # fixed" (20 chars)
    expect(added?.value).toBe(8);
    expect(removed?.value).toBe(0);
  });
});
