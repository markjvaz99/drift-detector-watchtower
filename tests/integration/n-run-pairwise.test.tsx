import { describe, expect, it } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { join } from "node:path";
import { loadFixtureRun } from "../helpers/loadFixtureRun";
import { EvidenceIndex } from "../../src/parsing/evidenceIndex";
import { ComparisonView } from "../../src/pages/ComparisonView";

const FIXTURES = join(__dirname, "../fixtures/n-runs-outlier");

describe("ComparisonView — pairwise selection among N runs", () => {
  it("renders a correct pairwise view for any two of the five loaded runs", () => {
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

    const pairwiseSection = screen.getByRole("region", { name: /pairwise comparison/i });
    fireEvent.change(within(pairwiseSection).getByLabelText(/pairwise run a/i), {
      target: { value: loaded[1].run.id },
    });
    fireEvent.change(within(pairwiseSection).getByLabelText(/pairwise run b/i), {
      target: { value: loaded[2].run.id },
    });

    const pairwiseTable = within(pairwiseSection).getByRole("table");
    expect(within(pairwiseTable).getByText("Run 2")).toBeInTheDocument();
    expect(within(pairwiseTable).getByText("Run 3")).toBeInTheDocument();
    expect(within(pairwiseTable).queryByText("Run 1")).not.toBeInTheDocument();
  });
});
