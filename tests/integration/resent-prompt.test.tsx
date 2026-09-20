import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { join } from "node:path";
import { loadFixtureRun } from "../helpers/loadFixtureRun";
import { EvidenceIndex } from "../../src/parsing/evidenceIndex";
import { ComparisonView } from "../../src/pages/ComparisonView";

const FIXTURES = join(__dirname, "../fixtures");

describe("ComparisonView — resent prompt", () => {
  it("shows a labeled data-quality note with non-null estimated cost/turn impact", () => {
    const resent = loadFixtureRun(join(FIXTURES, "resent-prompt.jsonl"), "Run 1");
    const normal = loadFixtureRun(join(FIXTURES, "single-run-normal.jsonl"), "Run 2");
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

    expect(screen.getByText(/real user-task prompts/i)).toBeInTheDocument();
    expect(screen.getByText(/estimated cost impact/i)).toBeInTheDocument();
    expect(screen.getByText(/estimated turn impact/i)).toBeInTheDocument();
  });
});
