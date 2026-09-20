import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { join } from "node:path";
import { loadFixtureRun } from "../helpers/loadFixtureRun";
import { EvidenceIndex } from "../../src/parsing/evidenceIndex";
import { ComparisonView } from "../../src/pages/ComparisonView";

const FIXTURES = join(__dirname, "../fixtures");

describe("ComparisonView — rejected tool call", () => {
  it("keeps a rejected call as a distinct rejection, not a failure or normal completed call, and reflects it in the Rejected calls metric row (the comparison page no longer shows a per-call badge, per user decision)", () => {
    const rejected = loadFixtureRun(join(FIXTURES, "rejected-tool-call.jsonl"), "Run 1");
    const normal = loadFixtureRun(join(FIXTURES, "single-run-normal.jsonl"), "Run 2");

    expect(rejected.run.rejectedToolCalls).toHaveLength(1);
    expect(rejected.run.rejectedToolCalls[0].executed).toBe(false);
    expect(rejected.run.rejectedToolCalls[0].result).toBeNull();

    const logFilesById = new Map([
      [rejected.logFile.id, rejected.logFile],
      [normal.logFile.id, normal.logFile],
    ]);
    const evidenceIndex = new EvidenceIndex();
    evidenceIndex.register(rejected.logFile);
    evidenceIndex.register(normal.logFile);

    render(
      <ComparisonView
        runs={[rejected.run, normal.run]}
        logFilesById={logFilesById}
        relatednessAssessment={null}
        evidenceIndex={evidenceIndex}
      />,
    );

    expect(screen.getAllByText("Rejected calls").length).toBeGreaterThan(0);
  });
});
