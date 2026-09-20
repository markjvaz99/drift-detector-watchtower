import { describe, expect, it } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import { join } from "node:path";
import { loadFixtureRun } from "../helpers/loadFixtureRun";
import { EvidenceIndex } from "../../src/parsing/evidenceIndex";
import { ComparisonView } from "../../src/pages/ComparisonView";
import { listRecentComparisons } from "../../src/state/localHistoryStore";

const FIXTURES = join(__dirname, "../fixtures/two-runs-related");

describe("ComparisonView — no duplicate recent-comparisons write under StrictMode", () => {
  it("writes exactly one history entry even when effects double-invoke", async () => {
    const a = loadFixtureRun(join(FIXTURES, "run-a.jsonl"), "Run 1");
    const b = loadFixtureRun(join(FIXTURES, "run-b.jsonl"), "Run 2");
    const logFilesById = new Map([
      [a.logFile.id, a.logFile],
      [b.logFile.id, b.logFile],
    ]);
    const evidenceIndex = new EvidenceIndex();
    evidenceIndex.register(a.logFile);
    evidenceIndex.register(b.logFile);

    const before = (await listRecentComparisons()).length;

    render(
      <StrictMode>
        <ComparisonView
          runs={[a.run, b.run]}
          logFilesById={logFilesById}
          relatednessAssessment={null}
          evidenceIndex={evidenceIndex}
        />
      </StrictMode>,
    );

    await waitFor(async () => {
      expect((await listRecentComparisons()).length).toBe(before + 1);
    });

    // Give any errant second write a chance to land, then confirm it didn't.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect((await listRecentComparisons()).length).toBe(before + 1);
  });
});
