import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { join } from "node:path";
import { loadFixtureRun } from "../helpers/loadFixtureRun";
import { EvidenceIndex } from "../../src/parsing/evidenceIndex";
import { ComparisonView } from "../../src/pages/ComparisonView";

const FIXTURES = join(__dirname, "../fixtures/two-runs-related");

describe("ComparisonView — full comparison table completeness", () => {
  it("always lists every computed metric regardless of headline status", () => {
    const a = loadFixtureRun(join(FIXTURES, "run-a.jsonl"), "Run 1");
    const b = loadFixtureRun(join(FIXTURES, "run-b.jsonl"), "Run 2");
    const logFilesById = new Map([
      [a.logFile.id, a.logFile],
      [b.logFile.id, b.logFile],
    ]);
    const evidenceIndex = new EvidenceIndex();
    evidenceIndex.register(a.logFile);
    evidenceIndex.register(b.logFile);

    render(
      <ComparisonView
        runs={[a.run, b.run]}
        logFilesById={logFilesById}
        relatednessAssessment={null}
        evidenceIndex={evidenceIndex}
      />,
    );

    const fullTable = document.getElementById("full-comparison-table")!;
    // A no-drift metric (e.g. Turns) is absent from the headline but present in the full table.
    const headline = screen.getByRole("region", { name: /headline drift summary/i });
    expect(within(headline).queryByText("Turns")).not.toBeInTheDocument();
    expect(within(fullTable).getByText("Turns")).toBeInTheDocument();
    expect(within(fullTable).getByText("McpTool calls")).toBeInTheDocument();
  });
});
