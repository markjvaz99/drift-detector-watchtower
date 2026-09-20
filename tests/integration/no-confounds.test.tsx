import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { join } from "node:path";
import { loadFixtureRun } from "../helpers/loadFixtureRun";
import { EvidenceIndex } from "../../src/parsing/evidenceIndex";
import { ComparisonView } from "../../src/pages/ComparisonView";
import { buildRelatednessAssessment } from "../../src/relatedness/buildRelatednessAssessment";

const FIXTURES = join(__dirname, "../fixtures/two-runs-related");

describe("ComparisonView — zero confound findings", () => {
  it("renders no confound-related UI anywhere when nothing needs flagging", () => {
    const a = loadFixtureRun(join(FIXTURES, "run-a.jsonl"), "Run 1");
    // Reuse run-a's content as a second, unrelated-in-file-name but identical run
    // so there is no resent prompt, no repo mismatch, and no approval-wait confound.
    const b = loadFixtureRun(join(FIXTURES, "run-a.jsonl"), "Run 2");
    b.run.id = "run-2-copy";
    b.logFile.id = "run-2-copy-logfile";

    const logFilesById = new Map([
      [a.logFile.id, a.logFile],
      [b.logFile.id, b.logFile],
    ]);
    const evidenceIndex = new EvidenceIndex();
    evidenceIndex.register(a.logFile);
    evidenceIndex.register(b.logFile);
    b.run.sourceLogFileId = b.logFile.id;

    const relatednessAssessment = buildRelatednessAssessment(
      [a.run, b.run],
      logFilesById,
    );

    render(
      <ComparisonView
        runs={[a.run, b.run]}
        logFilesById={logFilesById}
        relatednessAssessment={relatednessAssessment}
        evidenceIndex={evidenceIndex}
      />,
    );

    expect(screen.queryAllByRole("note")).toHaveLength(0);
    expect(document.querySelectorAll(".confound-flag")).toHaveLength(0);
  });
});
