import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { join } from "node:path";
import { loadFixtureRun } from "../helpers/loadFixtureRun";
import { EvidenceIndex } from "../../src/parsing/evidenceIndex";
import { ComparisonView } from "../../src/pages/ComparisonView";
import { SingleRunView } from "../../src/pages/SingleRunView";

const FIXTURES = join(__dirname, "../fixtures");

// Per user decision, the comparison page intentionally does not render this
// notice (or the resent-prompt/rejected-call notices) — it stays on the
// single-run view only.
describe("unrecognized-event surfacing (contracts/input-log-schema.md)", () => {
  it("SingleRunView reports unrecognized events as 'unrecognized, not included in metrics'", () => {
    const { logFile, run } = loadFixtureRun(join(FIXTURES, "unknown-schema-fields.jsonl"), "Run 1");
    expect(logFile.unrecognizedEventCount).toBeGreaterThan(0);

    render(<SingleRunView logFile={logFile} run={run} />);
    expect(screen.getByText(/unrecognized, not included in metrics/i)).toBeInTheDocument();
  });

  it("ComparisonView still parses and renders the rest of the comparison for the affected run without corrupting parsing, even though it no longer surfaces the notice itself", () => {
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

    expect(screen.getAllByText("Read calls").length).toBeGreaterThan(0);
  });

  it("does not render a notice when there are no unrecognized events", () => {
    const { logFile, run } = loadFixtureRun(join(FIXTURES, "single-run-normal.jsonl"), "Run 1");
    expect(logFile.unrecognizedEventCount).toBe(0);

    render(<SingleRunView logFile={logFile} run={run} />);
    expect(screen.queryByText(/unrecognized/i)).not.toBeInTheDocument();
  });
});
