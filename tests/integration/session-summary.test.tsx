import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { join } from "node:path";
import { loadFixtureRun } from "../helpers/loadFixtureRun";
import { SingleRunView } from "../../src/pages/SingleRunView";

const FIXTURE_PATH = join(__dirname, "../fixtures/single-run-normal.jsonl");

describe("SingleRunView — plain session summary", () => {
  it("shows a non-comparative, non-causal session summary when only one run is uploaded", () => {
    const { logFile, run } = loadFixtureRun(FIXTURE_PATH, "Run 1");
    render(<SingleRunView logFile={logFile} run={run} />);

    const panel = screen.getByRole("region", { name: /session summary/i });
    expect(panel.textContent).not.toMatch(/vs\.|drift|compared to/i);
    expect(panel.textContent).toMatch(/Run 1/);
  });
});
