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
});
