import { describe, expect, it } from "vitest";
import { generateComparisonTitle } from "../../src/drift/generateComparisonTitle";
import type { LogFile, OrderedEvent, Run } from "../../src/types";

function makeRun(taskPromptText: string): Run {
  return {
    id: "r1",
    sourceLogFileId: "lf1",
    label: "Run 1",
    taskPromptText,
    dataQualityNotes: [],
    rejectedToolCalls: [],
    hasCompletedTaskActivity: true,
  };
}

function promptEvent(sequence: number, prompt: string): OrderedEvent {
  return { sequence, timestamp: "2026-01-01T00:00:00Z", type: "user_prompt", queryType: null, attributes: { prompt } };
}

function makeLogFile(events: OrderedEvent[]): LogFile {
  return {
    id: "lf1",
    fileName: "run.jsonl",
    sessionIdentifier: "session-1",
    buildVersion: "1.0.0",
    workingDirectory: "/repo",
    startingRepositoryState: { branch: null, headCommit: null, workingDirectory: "/repo" },
    events,
    unrecognizedEventCount: 0,
  };
}

describe("generateComparisonTitle", () => {
  it("derives a short title from the shared task description", () => {
    const title = generateComparisonTitle([
      makeRun("Implement a monthly-budget feature that lets users set spending limits."),
    ]);
    expect(title.length).toBeGreaterThan(0);
    expect(title).not.toBe("Comparison");
  });

  it("falls back to a generic title when no run has prompt text", () => {
    const title = generateComparisonTitle([makeRun("")]);
    expect(title).toBe("Comparison");
  });

  it("handles a run with only stopwords by falling back to a generic title", () => {
    const title = generateComparisonTitle([makeRun("the a an")]);
    expect(title).toBe("Comparison");
  });

  it("strips <pasted_content> wrapper markup real clients add around pasted prompts", () => {
    const title = generateComparisonTitle([
      makeRun(
        '<pasted_content id="92c6">\nYou are working on an existing simple expense-tracker codebase.\n\nImplement a Monthly Budget feature.\n</pasted_content>',
      ),
    ]);
    expect(title.toLowerCase()).not.toContain("pasted");
    expect(title.toLowerCase()).not.toContain("content");
    expect(title.toLowerCase()).not.toContain("92c6");
    expect(title.toLowerCase()).toMatch(/simple|expense|tracker|codebase/);
  });

  it("titles from the real task description, not a trailing trivial prompt like /exit", () => {
    const run = makeRun("/exit"); // taskPromptText is deliberately the LAST prompt (see buildRun.ts)
    const logFile = makeLogFile([
      promptEvent(1, "Implement a monthly-budget feature that lets users set spending limits per category."),
      promptEvent(2, "start the server"),
      promptEvent(3, "/exit"),
    ]);
    const title = generateComparisonTitle([run], new Map([[logFile.id, logFile]]));
    expect(title.toLowerCase()).not.toBe("exit");
    expect(title.toLowerCase()).toMatch(/budget|monthly|spending|category/);
  });
});
