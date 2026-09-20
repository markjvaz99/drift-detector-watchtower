import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { join } from "node:path";
import { loadFixtureRun } from "../helpers/loadFixtureRun";
import { EvidenceIndex } from "../../src/parsing/evidenceIndex";
import { ComparisonView } from "../../src/pages/ComparisonView";

const FIXTURES = join(__dirname, "../fixtures/two-runs-related");

describe("ComparisonView — headline with exactly one drifted metric", () => {
  it("shows only that metric in the headline while the full table still lists everything", () => {
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

    const headline = screen.getByRole("region", { name: /headline drift summary/i });
    expect(within(headline).getByText("McpTool calls")).toBeInTheDocument();
    // The only-drifted metric (McpTool calls, categorical) is the sole headline card.
    expect(within(headline).getAllByRole("listitem")).toHaveLength(1);

    // The full table still lists every metric, drifted or not.
    const fullTable = document.getElementById("full-comparison-table")!;
    expect(within(fullTable).getByText("Turns")).toBeInTheDocument();
  });
});
