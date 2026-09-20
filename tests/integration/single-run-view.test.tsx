import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildRunFromText } from "../../src/parsing/buildRun";
import { SingleRunView } from "../../src/pages/SingleRunView";

const fixturePath = join(__dirname, "../fixtures/single-run-normal.jsonl");

describe("SingleRunView", () => {
  it("renders per-run metrics with no drift/comparison language", () => {
    const text = readFileSync(fixturePath, "utf8");
    const { logFile, run } = buildRunFromText("single-run-normal.jsonl", text);
    run.label = "Run 1";

    render(<SingleRunView logFile={logFile} run={run} />);

    expect(screen.getByText("Turns")).toBeInTheDocument();
    const bodyText = document.body.textContent ?? "";
    expect(bodyText).not.toMatch(/drift/i);
    expect(bodyText).not.toMatch(/\bvs\.\b/i);
  });
});
