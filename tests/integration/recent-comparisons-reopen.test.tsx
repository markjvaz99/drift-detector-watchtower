import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { join } from "node:path";
import { loadFixtureRun } from "../helpers/loadFixtureRun";
import { buildComparison } from "../../src/drift/buildComparison";
import { writeRecentComparison, listRecentComparisons, getRecentComparison } from "../../src/state/localHistoryStore";
import { EvidenceIndex } from "../../src/parsing/evidenceIndex";
import { ComparisonView } from "../../src/pages/ComparisonView";

const FIXTURES = join(__dirname, "../fixtures/two-runs-related");

describe("recent comparisons — reopen without re-upload", () => {
  it("reopens the full report from a selected entry using only the stored payload, no original log files", async () => {
    const a = loadFixtureRun(join(FIXTURES, "run-a.jsonl"), "Run 1");
    const b = loadFixtureRun(join(FIXTURES, "run-b.jsonl"), "Run 2");
    const logFilesById = new Map([
      [a.logFile.id, a.logFile],
      [b.logFile.id, b.logFile],
    ]);
    const runs = [a.run, b.run];
    const comparison = buildComparison(runs, logFilesById, null);
    const id = await writeRecentComparison(comparison, runs);

    const list = await listRecentComparisons();
    expect(list.some((entry) => entry.id === id)).toBe(true);

    const reopened = await getRecentComparison(id);
    expect(reopened).not.toBeNull();

    render(
      <ComparisonView
        runs={reopened!.runs}
        logFilesById={new Map()}
        relatednessAssessment={reopened!.comparison.relatednessAssessment}
        evidenceIndex={new EvidenceIndex()}
        precomputedComparison={reopened!.comparison}
      />,
    );

    expect(screen.getByText(comparison.title)).toBeInTheDocument();
    const fullTable = document.getElementById("full-comparison-table")!;
    expect(within(fullTable).getByText("Turns")).toBeInTheDocument();
    expect(within(fullTable).getByText("McpTool calls")).toBeInTheDocument();
    expect(screen.getByText(/reopened from recent comparisons/i)).toBeInTheDocument();
  });
});
