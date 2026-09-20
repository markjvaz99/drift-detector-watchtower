import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { join } from "node:path";
import { loadFixtureRun } from "../helpers/loadFixtureRun";
import { buildRelatednessAssessment } from "../../src/relatedness/buildRelatednessAssessment";
import { RelatednessCheckView } from "../../src/pages/RelatednessCheckView";

const FIXTURES = join(__dirname, "../fixtures/n-runs-mixed-relatedness");

describe("RelatednessCheckView — mixed relatedness across 4 runs", () => {
  it("shows one cluster row for the 3 related runs and separate rows for the unrelated run's pairs", () => {
    const built = [1, 2, 3, 4].map((i) => loadFixtureRun(join(FIXTURES, `run-${i}.jsonl`), `Run ${i}`));
    const runs = built.map((b) => b.run);
    const logFilesById = new Map(built.map((b) => [b.logFile.id, b.logFile]));
    const assessment = buildRelatednessAssessment(runs, logFilesById)!;
    const runsById = new Map(runs.map((r) => [r.id, r]));

    render(
      <RelatednessCheckView
        assessment={assessment}
        runsById={runsById}
        onContinue={vi.fn()}
        onViewIndividually={vi.fn()}
      />,
    );

    expect(screen.getByText("Checking task relatedness across 4 runs")).toBeInTheDocument();
    expect(screen.getAllByText("Related")).toHaveLength(1);
    expect(screen.getAllByText("Unrelated").length).toBeGreaterThanOrEqual(1);
  });
});
