import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { join } from "node:path";
import { loadFixtureRun } from "../helpers/loadFixtureRun";
import { EvidenceIndex } from "../../src/parsing/evidenceIndex";
import { ComparisonView } from "../../src/pages/ComparisonView";
import { SingleRunView } from "../../src/pages/SingleRunView";

const FIXTURES = join(__dirname, "../fixtures");

describe("unrecognized-event surfacing (contracts/input-log-schema.md)", () => {
  it("SingleRunView reports unrecognized events as 'unrecognized, not included in metrics'", () => {
    const { logFile, run } = loadFixtureRun(join(FIXTURES, "unknown-schema-fields.jsonl"), "Run 1");
    expect(logFile.unrecognizedEventCount).toBeGreaterThan(0);

    render(<SingleRunView logFile={logFile} run={run} />);
    expect(screen.getByText(/unrecognized, not included in metrics/i)).toBeInTheDocument();
  });

  it("ComparisonView reports unrecognized events for the affected run without corrupting the rest of parsing", () => {
    const unknown = loadFixtureRun(join(FIXTURES, "unknown-schema-fields.jsonl"), "Run 1");
    const normal = loadFixtureRun(join(FIXTURES, "single-run-normal.jsonl"), "Run 2");
    const logFilesById = new Map([
      [unknown.logFile.id, unknown.logFile],
      [normal.logFile.id, normal.logFile],
    ]);
    const evidenceIndex = new EvidenceIndex();
    evidenceIndex.register(unknown.logFile);
    evidenceIndex.register(normal.logFile);

    render(
      <ComparisonView
        runs={[unknown.run, normal.run]}
        logFilesById={logFilesById}
        relatednessAssessment={null}
        evidenceIndex={evidenceIndex}
      />,
    );

    expect(screen.getByText(/unrecognized, not included in metrics/i)).toBeInTheDocument();
    expect(screen.getAllByText("Read calls").length).toBeGreaterThan(0);
  });

  it("does not render a notice when there are no unrecognized events", () => {
    const { logFile, run } = loadFixtureRun(join(FIXTURES, "single-run-normal.jsonl"), "Run 1");
    expect(logFile.unrecognizedEventCount).toBe(0);

    render(<SingleRunView logFile={logFile} run={run} />);
    expect(screen.queryByText(/unrecognized/i)).not.toBeInTheDocument();
  });
});
