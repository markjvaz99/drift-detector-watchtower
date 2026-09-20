import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildRunFromText } from "../../src/parsing/buildRun";
import { EvidenceIndex } from "../../src/parsing/evidenceIndex";
import { ComparisonView } from "../../src/pages/ComparisonView";

const FIXTURE_PATH = join(__dirname, "../fixtures/single-run-normal.jsonl");

describe("ComparisonView — layout threshold beyond 8 runs", () => {
  it("switches every chart's layout to its aggregate/distribution fallback when more than 8 related runs are loaded", () => {
    const text = readFileSync(FIXTURE_PATH, "utf8");
    const loaded = Array.from({ length: 9 }, (_, i) => {
      const built = buildRunFromText(`${FIXTURE_PATH}#${i + 1}`, text);
      built.run.label = `Run ${i + 1}`;
      return built;
    });
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

    const chartsSection = screen.getByRole("region", { name: /comparison charts/i });
    expect(chartsSection.querySelector('[data-layout="aggregate"]')).not.toBeNull();
    expect(chartsSection.querySelector('[data-layout="grouped-bars"]')).toBeNull();
    expect(chartsSection.querySelector('[data-layout="lines"]')).toBeNull();
    expect(chartsSection.querySelector('[data-layout="stacked-bars"]')).toBeNull();
  });
});
