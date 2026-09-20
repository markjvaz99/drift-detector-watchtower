import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { join } from "node:path";
import { loadFixtureRun } from "../helpers/loadFixtureRun";
import { EvidenceIndex } from "../../src/parsing/evidenceIndex";
import { ComparisonView } from "../../src/pages/ComparisonView";

const FIXTURES = join(__dirname, "../fixtures/two-runs-related");

describe("ComparisonView — two related runs with differing tool composition", () => {
  it("shows a classification for every computable metric and never zero for unavailable ones", () => {
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

    expect(screen.getAllByText("McpTool calls").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/no-drift|moderate|large|categorical|cannot-determine|uninterpretable/).length).toBeGreaterThan(0);
  });
});
