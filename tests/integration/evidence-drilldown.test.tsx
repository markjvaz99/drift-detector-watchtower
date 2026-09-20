import { describe, expect, it } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { join } from "node:path";
import { loadFixtureRun } from "../helpers/loadFixtureRun";
import { EvidenceIndex } from "../../src/parsing/evidenceIndex";
import { ComparisonView } from "../../src/pages/ComparisonView";

const FIXTURES = join(__dirname, "../fixtures/two-runs-related");

describe("ComparisonView — evidence drill-down", () => {
  it("shows the raw log evidence behind a displayed metric value when clicked", () => {
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

    fireEvent.click(screen.getByRole("button", { name: "Turns" }));
    expect(screen.getByRole("region", { name: /evidence/i })).toBeInTheDocument();
    expect(screen.getAllByText(new RegExp(a.logFile.id)).length).toBeGreaterThan(0);
  });
});
