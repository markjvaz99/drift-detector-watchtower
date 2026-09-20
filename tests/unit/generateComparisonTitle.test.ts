import { describe, expect, it } from "vitest";
import { generateComparisonTitle } from "../../src/drift/generateComparisonTitle";
import type { Run } from "../../src/types";

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
});
