import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildRunFromText } from "../../src/parsing/buildRun";
import { computeDurationBreakdown } from "../../src/metrics/duration";
import type { LogFile, OrderedEvent } from "../../src/types";

const fixturePath = join(__dirname, "../fixtures/single-run-normal.jsonl");

function makeLogFile(events: OrderedEvent[], unrecognizedEventTimestamps: string[] = []): LogFile {
  return {
    id: "lf",
    fileName: "lf.jsonl",
    sessionIdentifier: "s",
    buildVersion: "",
    workingDirectory: "",
    startingRepositoryState: { branch: null, headCommit: null, workingDirectory: "" },
    events,
    unrecognizedEventCount: unrecognizedEventTimestamps.length,
    unrecognizedEventTimestamps,
  };
}

describe("duration breakdown formula", () => {
  it("splits total duration into approval-wait, other-idle, and active time that sum to the total", () => {
    const text = readFileSync(fixturePath, "utf8");
    const { logFile } = buildRunFromText("single-run-normal.jsonl", text);
    const breakdown = computeDurationBreakdown(logFile);

    expect(breakdown.totalMs).toBeGreaterThan(0);
    expect(breakdown.approvalWaitMs + breakdown.otherIdleMs + breakdown.activeMs).toBe(
      breakdown.totalMs,
    );
    // No human-approval decision sources in this fixture, so approval-wait is zero.
    expect(breakdown.approvalWaitMs).toBe(0);
  });

  it("attributes the gap ENDING at a human tool_decision to approval-wait, not the gap after it", () => {
    // A tool_decision's timestamp is logged when the decision is actually
    // made; the human's wait happens before that timestamp, not after it.
    const events: OrderedEvent[] = [
      { sequence: 1, timestamp: "2026-01-01T00:00:00.000Z", type: "api_call", queryType: null, attributes: {} },
      // Long gap while a human decides — this should count as approval-wait.
      {
        sequence: 2,
        timestamp: "2026-01-01T00:10:00.000Z",
        type: "tool_decision",
        queryType: null,
        attributes: { source: "user_temporary" },
      },
      // Short gap after the decision — this is just execution time, and the
      // event itself carries the real time it took (see next test): active
      // time is attributed from duration_ms, not the surrounding gap size.
      {
        sequence: 3,
        timestamp: "2026-01-01T00:10:01.000Z",
        type: "tool_result",
        queryType: null,
        attributes: { duration_ms: 250 },
      },
    ];

    const breakdown = computeDurationBreakdown(makeLogFile(events));
    expect(breakdown.approvalWaitMs).toBe(600_000); // the 10-minute gap before the decision
    expect(breakdown.activeMs).toBe(250); // the tool_result's own duration_ms, not the 1s gap it sits in
  });

  it("computes active time as the direct sum of duration_ms across tool_result and api_call events, not gap inference", () => {
    // Real Claude Code telemetry records exactly how long each tool_result
    // and api_call (aliased from "api_request") actually took via its own
    // duration_ms attribute. Two calls can pack far more active work into a
    // gap than the gap-inference approach would ever credit, and duration_ms
    // sums are non-overlapping by construction (calls are sequential within
    // a session), so summing them directly is the correct measure — this is
    // the fix for the real-telemetry undercount this test locks in.
    const events: OrderedEvent[] = [
      { sequence: 1, timestamp: "2026-01-01T00:00:00.000Z", type: "user_prompt", queryType: null, attributes: {} },
      {
        sequence: 2,
        timestamp: "2026-01-01T00:00:05.000Z",
        type: "api_call",
        queryType: null,
        attributes: { duration_ms: 3_000 },
      },
      {
        sequence: 3,
        timestamp: "2026-01-01T00:00:06.000Z",
        type: "tool_result",
        queryType: null,
        attributes: { duration_ms: 1_500 },
      },
      // A non-task api_call (e.g. away-summary) still represents real
      // processing time and is included in the active-time sum, even though
      // it's excluded from the total-duration span and token/cost metrics.
      {
        sequence: 4,
        timestamp: "2026-01-01T00:00:07.000Z",
        type: "api_call",
        queryType: "away_summary",
        attributes: { duration_ms: 500 },
      },
    ];

    const breakdown = computeDurationBreakdown(makeLogFile(events));
    expect(breakdown.activeMs).toBe(5_000); // 3000 + 1500 + 500
    expect(breakdown.approvalWaitMs + breakdown.otherIdleMs + breakdown.activeMs).toBe(breakdown.totalMs);
  });

  it("excludes trailing/leading non-task API calls (session-title, prompt-suggestion, away-summary) from the measured span", () => {
    const events: OrderedEvent[] = [
      { sequence: 1, timestamp: "2026-01-01T00:00:00.000Z", type: "user_prompt", queryType: null, attributes: {} },
      { sequence: 2, timestamp: "2026-01-01T00:00:10.000Z", type: "api_call", queryType: null, attributes: {} },
      // A trailing away-summary call happens long after the real task work
      // finished — it must not inflate the measured session duration.
      { sequence: 3, timestamp: "2026-01-01T01:00:00.000Z", type: "api_call", queryType: "away_summary", attributes: {} },
    ];

    const breakdown = computeDurationBreakdown(makeLogFile(events));
    expect(breakdown.totalMs).toBe(10_000); // only the gap between the first two (real) events
  });

  it("splits a large gap at an unrecognized-event boundary (e.g. a housekeeping marker), reclassifying the portion before it as idle", () => {
    // The gap from the prior event to the marker is idle/away time; the
    // remaining gap from the marker to the human decision is still approval-wait.
    const events: OrderedEvent[] = [
      { sequence: 1, timestamp: "2026-01-01T00:00:00.000Z", type: "api_call", queryType: null, attributes: {} },
      {
        sequence: 2,
        timestamp: "2026-01-01T00:20:00.000Z", // 20 minutes later
        type: "tool_decision",
        queryType: null,
        attributes: { source: "user_temporary" },
      },
    ];
    // The marker sits 12 minutes after the api_call, 8 minutes before the decision.
    const unrecognizedEventTimestamps = ["2026-01-01T00:12:00.000Z"];

    const breakdown = computeDurationBreakdown(makeLogFile(events, unrecognizedEventTimestamps));
    expect(breakdown.otherIdleMs).toBe(12 * 60_000);
    expect(breakdown.approvalWaitMs).toBe(8 * 60_000);
  });
});
