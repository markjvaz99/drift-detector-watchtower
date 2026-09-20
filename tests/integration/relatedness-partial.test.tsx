import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { join } from "node:path";
import { loadFixtureRun } from "../helpers/loadFixtureRun";
import { buildRelatednessAssessment } from "../../src/relatedness/buildRelatednessAssessment";
import { RelatednessCheckView } from "../../src/pages/RelatednessCheckView";
import { RelatednessReminderBadge } from "../../src/components/RelatednessReminderBadge";

const FIXTURES = join(__dirname, "../fixtures/two-runs-partial");

describe("RelatednessCheckView — partial pair", () => {
  it("rates the pair 'Review recommended' and keeps a reminder badge visible after continuing", () => {
    const a = loadFixtureRun(join(FIXTURES, "run-a.jsonl"), "Run 1");
    const b = loadFixtureRun(join(FIXTURES, "run-b.jsonl"), "Run 2");
    const runs = [a.run, b.run];
    const logFilesById = new Map([
      [a.logFile.id, a.logFile],
      [b.logFile.id, b.logFile],
    ]);
    const assessment = buildRelatednessAssessment(runs, logFilesById)!;
    const runsById = new Map(runs.map((r) => [r.id, r]));

    const { unmount } = render(
      <RelatednessCheckView
        assessment={assessment}
        runsById={runsById}
        onContinue={vi.fn()}
        onViewIndividually={vi.fn()}
      />,
    );
    expect(screen.getByText("Review recommended")).toBeInTheDocument();
    unmount();

    render(<RelatednessReminderBadge assessment={assessment} runsById={runsById} />);
    expect(screen.getByRole("note")).toBeInTheDocument();
  });
});
