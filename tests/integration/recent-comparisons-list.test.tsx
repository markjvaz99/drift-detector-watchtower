import { describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { join } from "node:path";
import { loadFixtureRun } from "../helpers/loadFixtureRun";
import { buildComparison } from "../../src/drift/buildComparison";
import { writeRecentComparison } from "../../src/state/localHistoryStore";
import { RecentComparisonsList } from "../../src/components/RecentComparisonsList";

const FIXTURES = join(__dirname, "../fixtures/two-runs-related");

describe("RecentComparisonsList", () => {
  it("shows a generated comparison's title, run labels, and timestamp after 'reopening the app'", async () => {
    const a = loadFixtureRun(join(FIXTURES, "run-a.jsonl"), "Run 1");
    const b = loadFixtureRun(join(FIXTURES, "run-b.jsonl"), "Run 2");
    const logFilesById = new Map([
      [a.logFile.id, a.logFile],
      [b.logFile.id, b.logFile],
    ]);
    const runs = [a.run, b.run];
    const comparison = buildComparison(runs, logFilesById, null);
    await writeRecentComparison(comparison, runs);

    render(<RecentComparisonsList onOpen={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText(comparison.title)).toBeInTheDocument();
    });
    expect(screen.getByText(/Run 1, Run 2/)).toBeInTheDocument();
  });
});
