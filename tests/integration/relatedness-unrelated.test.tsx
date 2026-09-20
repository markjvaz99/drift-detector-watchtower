import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { join } from "node:path";
import { loadFixtureRun } from "../helpers/loadFixtureRun";
import { buildRelatednessAssessment } from "../../src/relatedness/buildRelatednessAssessment";
import { RelatednessCheckView } from "../../src/pages/RelatednessCheckView";

const FIXTURES = join(__dirname, "../fixtures/two-runs-unrelated");

describe("RelatednessCheckView — unrelated pair", () => {
  it("rates the pair Unrelated, shows reasoning, and keeps Continue enabled alongside 'view individually'", () => {
    const a = loadFixtureRun(join(FIXTURES, "run-a.jsonl"), "Run 1");
    const b = loadFixtureRun(join(FIXTURES, "run-b.jsonl"), "Run 2");
    const runs = [a.run, b.run];
    const logFilesById = new Map([
      [a.logFile.id, a.logFile],
      [b.logFile.id, b.logFile],
    ]);
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

    expect(screen.getByText("Unrelated")).toBeInTheDocument();
    expect(screen.getByText(/do not appear to describe the same task/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /continue to comparison/i })).toBeEnabled();
    expect(screen.getByRole("button", { name: /view runs individually instead/i })).toBeInTheDocument();
  });
});
