import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildRunFromText } from "../../src/parsing/buildRun";

const fixturePath = join(__dirname, "../fixtures/single-run-normal.jsonl");

describe("buildRunFromText contract", () => {
  it("flattens, sequences, and pairs tool calls per contracts/input-log-schema.md", () => {
    const text = readFileSync(fixturePath, "utf8");
    const { logFile, run } = buildRunFromText("single-run-normal.jsonl", text);

    expect(logFile.sessionIdentifier).toBe("session-normal-1");
    expect(logFile.unrecognizedEventCount).toBe(0);

    const sequences = logFile.events.map((event) => event.sequence);
    expect(sequences).toEqual([...sequences].sort((a, b) => a - b));

    const toolDecisions = logFile.events.filter((event) => event.type === "tool_decision");
    const toolResults = logFile.events.filter((event) => event.type === "tool_result");
    expect(toolDecisions.length).toBeGreaterThan(0);
    expect(toolResults.length).toBeGreaterThan(0);

    expect(run.hasCompletedTaskActivity).toBe(true);
    expect(run.taskPromptText).toContain("monthly-budget");
  });

  it("excludes non-task query sources from main-task accounting", () => {
    const text = readFileSync(fixturePath, "utf8");
    const { logFile } = buildRunFromText("single-run-normal.jsonl", text);
    const titleCall = logFile.events.find(
      (event) => event.queryType === "generate_session_title",
    );
    expect(titleCall).toBeDefined();
  });
});
