import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { join } from "node:path";
import { loadFixtureRun } from "../helpers/loadFixtureRun";
import { EvidenceIndex } from "../../src/parsing/evidenceIndex";
import { ComparisonView } from "../../src/pages/ComparisonView";

const FIXTURES = join(__dirname, "../fixtures/two-runs-related");

describe("ComparisonView — export report", () => {
  beforeEach(() => {
    if (!URL.createObjectURL) {
      URL.createObjectURL = vi.fn(() => "blob:mock");
    }
    if (!URL.revokeObjectURL) {
      URL.revokeObjectURL = vi.fn();
    }
  });

  it("downloads a local file with zero outgoing network requests", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const createObjectURLSpy = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:mock");
    const revokeObjectURLSpy = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});

    const a = loadFixtureRun(join(FIXTURES, "run-a.jsonl"), "Run 1");
    const b = loadFixtureRun(join(FIXTURES, "run-b.jsonl"), "Run 2");
    const logFilesById = new Map([
      [a.logFile.id, a.logFile],
      [b.logFile.id, b.logFile],
    ]);
    const evidenceIndex = new EvidenceIndex();
    evidenceIndex.register(a.logFile);
    evidenceIndex.register(b.logFile);

    render(
      <ComparisonView
        runs={[a.run, b.run]}
        logFilesById={logFilesById}
        relatednessAssessment={null}
        evidenceIndex={evidenceIndex}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /export report/i }));

    expect(createObjectURLSpy).toHaveBeenCalledTimes(1);
    expect(revokeObjectURLSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy).not.toHaveBeenCalled();

    fetchSpy.mockRestore();
    createObjectURLSpy.mockRestore();
    revokeObjectURLSpy.mockRestore();
  });
});
