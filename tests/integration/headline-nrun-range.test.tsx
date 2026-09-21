import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { join } from "node:path";
import { loadFixtureRun } from "../helpers/loadFixtureRun";
import { EvidenceIndex } from "../../src/parsing/evidenceIndex";
import { ComparisonView } from "../../src/pages/ComparisonView";

const FIXTURES = join(__dirname, "../fixtures/n-runs-outlier");

describe("ComparisonView — headline range display for N > 2 runs", () => {
  it("shows the group's value range (min-max) and names the outlier run for a drifted metric's headline card", () => {
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

    const headline = screen.getByRole("region", { name: /headline drift summary/i });
    // The min/max values render inside AnimatedNumber's own <span>, so the
    // "Range: X–Y" text is no longer a single direct text node of one
    // element — check the section's full aggregate text instead of
    // getByText, which only matches an element's own direct text nodes.
    expect(headline.textContent).toMatch(/Range: .+–.+/);
    expect(headline.textContent).toMatch(/outlier: Run 3/);
  });
});
