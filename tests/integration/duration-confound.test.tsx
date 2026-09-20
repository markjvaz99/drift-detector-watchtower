import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { join } from "node:path";
import { loadFixtureRun } from "../helpers/loadFixtureRun";
import { EvidenceIndex } from "../../src/parsing/evidenceIndex";
import { ComparisonView } from "../../src/pages/ComparisonView";

const FIXTURES = join(__dirname, "../fixtures");

describe("ComparisonView — approval-wait-dominated duration confound", () => {
  it("shows the duration breakdown and marks the affected metric uninterpretable", () => {
    const normal = loadFixtureRun(join(FIXTURES, "single-run-normal.jsonl"), "Run 1");
    const waitDominated = loadFixtureRun(join(FIXTURES, "duration-confound.jsonl"), "Run 2");
    const logFilesById = new Map([
      [normal.logFile.id, normal.logFile],
      [waitDominated.logFile.id, waitDominated.logFile],
    ]);
    const evidenceIndex = new EvidenceIndex();
    evidenceIndex.register(normal.logFile);
    evidenceIndex.register(waitDominated.logFile);

    render(
      <ComparisonView
        runs={[normal.run, waitDominated.run]}
        logFilesById={logFilesById}
        relatednessAssessment={null}
        evidenceIndex={evidenceIndex}
      />,
    );

    expect(screen.getAllByText("Approval-wait time").length).toBeGreaterThan(0);
    expect(screen.getByText(/uninterpretable/)).toBeInTheDocument();
  });
});
