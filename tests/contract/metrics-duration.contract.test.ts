import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildRunFromText } from "../../src/parsing/buildRun";
import { computeDurationBreakdown } from "../../src/metrics/duration";

const fixturePath = join(__dirname, "../fixtures/single-run-normal.jsonl");

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
});
