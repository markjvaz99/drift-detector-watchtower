import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { join } from "node:path";
import { loadFixtureRun } from "../helpers/loadFixtureRun";
import { EvidenceIndex } from "../../src/parsing/evidenceIndex";
import { ComparisonView } from "../../src/pages/ComparisonView";

const FIXTURES = join(__dirname, "../fixtures");

describe("ComparisonView — resent prompt", () => {
  it("still flags metrics affected by a resent prompt as an uninterpretable confound in the comparison table (the standalone banner is intentionally removed per user decision)", () => {
    const resent = loadFixtureRun(join(FIXTURES, "resent-prompt.jsonl"), "Run 1");
    const normal = loadFixtureRun(join(FIXTURES, "single-run-normal.jsonl"), "Run 2");

    expect(resent.run.dataQualityNotes).toHaveLength(1);
    expect(resent.run.dataQualityNotes[0].type).toBe("resent-prompt");

    const logFilesById = new Map([
      [resent.logFile.id, resent.logFile],
      [normal.logFile.id, normal.logFile],
    ]);
    const evidenceIndex = new EvidenceIndex();
    evidenceIndex.register(resent.logFile);
    evidenceIndex.register(normal.logFile);

    render(
      <ComparisonView
        runs={[resent.run, normal.run]}
        logFilesById={logFilesById}
        relatednessAssessment={null}
        evidenceIndex={evidenceIndex}
      />,
    );

    expect(screen.getAllByText(/resent-prompt/i).length).toBeGreaterThan(0);
  });
});
