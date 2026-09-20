import { afterEach, describe, expect, it } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildRunFromText } from "../../src/parsing/buildRun";
import { useSessionStore } from "../../src/state/sessionStore";
import { AppRoot } from "../../src/pages/AppRoot";

const FIXTURES = join(__dirname, "../fixtures/two-runs-unrelated");

afterEach(() => {
  cleanup();
  useSessionStore.getState().reset();
});

describe("AppRoot — view runs individually instead", () => {
  it("skips the head-to-head comparison and opens each run's own single-run view", () => {
    const a = buildRunFromText("run-a.jsonl", readFileSync(join(FIXTURES, "run-a.jsonl"), "utf8"));
    const b = buildRunFromText("run-b.jsonl", readFileSync(join(FIXTURES, "run-b.jsonl"), "utf8"));
    useSessionStore.getState().addBuiltRuns([a, b]);

    render(<AppRoot />);

    fireEvent.click(screen.getByRole("button", { name: /view runs individually instead/i }));

    expect(screen.queryByText(/comparison content/i)).not.toBeInTheDocument();
    expect(screen.getByText("Run 1")).toBeInTheDocument();
    expect(screen.getByText("Run 2")).toBeInTheDocument();
  });
});
