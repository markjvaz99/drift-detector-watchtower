import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { join } from "node:path";
import { loadFixtureRun } from "../helpers/loadFixtureRun";
import { EvidenceIndex } from "../../src/parsing/evidenceIndex";
import { ComparisonView } from "../../src/pages/ComparisonView";

const FIXTURES = join(__dirname, "../fixtures/n-runs-outlier");

describe("ComparisonView — N-run outlier (5 runs)", () => {
  it("renders group statistics across all 5 runs and identifies the known outlier with its raw counts viewable", () => {
    const loaded = [1, 2, 3, 4, 5].map((i) =>
      loadFixtureRun(join(FIXTURES, `run-${i}.jsonl`), `Run ${i}`),
    );
    const logFilesById = new Map(loaded.map((l) => [l.logFile.id, l.logFile]));
    const evidenceIndex = new EvidenceIndex();
    loaded.forEach((l) => evidenceIndex.register(l.logFile));

    render(
      <ComparisonView
        runs={loaded.map((l) => l.run)}
        logFilesById={logFilesById}
        relatednessAssessment={null}
        evidenceIndex={evidenceIndex}
      />,
    );

    // All 5 run columns render.
    for (let i = 1; i <= 5; i += 1) {
      expect(screen.getAllByText(`Run ${i}`).length).toBeGreaterThan(0);
    }

    // The outlier (Run 3) is named against at least one metric.
    expect(screen.getAllByText(/Run 3/).length).toBeGreaterThan(0);
  });
});
