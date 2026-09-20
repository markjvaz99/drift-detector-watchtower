import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildRunFromText } from "../../src/parsing/buildRun";
import { SingleRunView } from "../../src/pages/SingleRunView";

const fixturePath = join(__dirname, "../fixtures/single-run-aborted.jsonl");

describe("SingleRunView aborted session", () => {
  it("shows a plain 'no completed task activity' state instead of zeroed metrics", () => {
    const text = readFileSync(fixturePath, "utf8");
    const { logFile, run } = buildRunFromText("single-run-aborted.jsonl", text);
    run.label = "Run 1";

    render(<SingleRunView logFile={logFile} run={run} />);

    expect(run.hasCompletedTaskActivity).toBe(false);
    expect(screen.getByText(/no completed task activity/i)).toBeInTheDocument();
    expect(screen.queryByText("Turns")).not.toBeInTheDocument();
  });
});
