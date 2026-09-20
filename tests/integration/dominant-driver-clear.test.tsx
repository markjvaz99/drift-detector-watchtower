import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { join } from "node:path";
import { loadFixtureRun } from "../helpers/loadFixtureRun";
import { EvidenceIndex } from "../../src/parsing/evidenceIndex";
import { ComparisonView } from "../../src/pages/ComparisonView";

const FIXTURES = join(__dirname, "../fixtures/dominant-driver-clear");

describe("ComparisonView — clear dominant driver", () => {
  it("names the dominant metric, cites supporting evidence, and shows supporting numbers", () => {
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

    const panel = screen.getByRole("region", { name: /dominant driver/i });
    expect(panel.textContent).toMatch(/McpTool calls/);
    expect(panel.querySelectorAll(".dominant-driver-numbers li").length).toBeGreaterThanOrEqual(2);
  });
});
