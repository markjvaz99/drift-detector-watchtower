import { describe, expect, it } from "vitest";
import { reconstructTrueLength, isTruncated } from "../../src/parsing/reconstructTruncatedLength";

describe("reconstructTrueLength", () => {
  it("returns the content length unchanged when there is no truncation marker", () => {
    expect(reconstructTrueLength("hello world")).toBe(11);
    expect(isTruncated("hello world")).toBe(false);
  });

  it("reads the total length directly from the synthetic '...[truncated: original length (N)]' marker", () => {
    const content = "x".repeat(50) + "...[truncated: original length 5000]";
    expect(reconstructTrueLength(content)).toBe(5000);
    expect(isTruncated(content)).toBe(true);
  });

  it("adds the visible prefix to N from the real '…[N chars]' marker (states remaining chars, not total)", () => {
    // Confirmed against real Claude Code telemetry (2026-09-20): the marker
    // states how many MORE characters were cut, not the total original length.
    const content = "x".repeat(120) + "…[4880 chars]";
    expect(reconstructTrueLength(content)).toBe(120 + 4880);
    expect(isTruncated(content)).toBe(true);
  });
});
