import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { join } from "node:path";
import { loadFixtureRun } from "../helpers/loadFixtureRun";
import { buildRelatednessAssessment } from "../../src/relatedness/buildRelatednessAssessment";
import { RelatednessCheckView } from "../../src/pages/RelatednessCheckView";
import { RelatednessReminderBadge } from "../../src/components/RelatednessReminderBadge";

const FIXTURES = join(__dirname, "../fixtures/two-runs-related");

describe("RelatednessCheckView — related pair", () => {
  it("rates the pair Related with confirming reasoning and shows no dashboard reminder", () => {
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
    expect(screen.getByText("Related")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /view runs individually instead/i }),
    ).not.toBeInTheDocument();

    const { container } = render(
      <RelatednessReminderBadge assessment={assessment} runsById={runsById} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
