import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildRunFromText } from "../../src/parsing/buildRun";
import { EvidenceIndex } from "../../src/parsing/evidenceIndex";
import { ComparisonView } from "../../src/pages/ComparisonView";

const FIXTURE_PATH = join(__dirname, "../fixtures/single-run-normal.jsonl");

describe("ComparisonView — headline with zero drifted metrics", () => {
  it("shows an explicit no-significant-drift state, not empty/forced KPI cards", () => {
    const text = readFileSync(FIXTURE_PATH, "utf8");
    const a = buildRunFromText(`${FIXTURE_PATH}#a`, text);
    a.run.label = "Run 1";
    const b = buildRunFromText(`${FIXTURE_PATH}#b`, text);
    b.run.label = "Run 2";
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
    expect(within(headline).getByText(/no significant drift detected/i)).toBeInTheDocument();
    expect(within(headline).queryAllByRole("listitem")).toHaveLength(0);
  });
});
