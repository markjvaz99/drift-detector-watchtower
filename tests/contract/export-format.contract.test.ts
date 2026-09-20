import { describe, expect, it } from "vitest";
import { join } from "node:path";
import { loadFixtureRun } from "../helpers/loadFixtureRun";
import { buildComparison } from "../../src/drift/buildComparison";
import {
  serializeComparison,
  deserializeComparison,
  UnrecognizedFormatVersionError,
} from "../../src/reporting/reportSerializer";

const FIXTURES = join(__dirname, "../fixtures/two-runs-related");

describe("export/report format round-trip", () => {
  it("serializes a Comparison, round-trips through JSON, and deep-equals the original", () => {
    const a = loadFixtureRun(join(FIXTURES, "run-a.jsonl"), "Run 1");
    const b = loadFixtureRun(join(FIXTURES, "run-b.jsonl"), "Run 2");
    const logFilesById = new Map([
      [a.logFile.id, a.logFile],
      [b.logFile.id, b.logFile],
    ]);
    const runs = [a.run, b.run];
    const comparison = buildComparison(runs, logFilesById, null);

    const exported = serializeComparison(comparison, runs);
    const roundTripped = JSON.parse(JSON.stringify(exported));
    const { comparison: reimported, runs: reimportedRuns } = deserializeComparison(roundTripped);

    expect(reimported).toEqual(comparison);
    expect(reimportedRuns.map((r) => r.id)).toEqual(runs.map((r) => r.id));
    expect(reimportedRuns.map((r) => r.label)).toEqual(runs.map((r) => r.label));
  });

  it("rejects an unrecognized future format version rather than a best-effort partial read", () => {
    const a = loadFixtureRun(join(FIXTURES, "run-a.jsonl"), "Run 1");
    const b = loadFixtureRun(join(FIXTURES, "run-b.jsonl"), "Run 2");
    const logFilesById = new Map([
      [a.logFile.id, a.logFile],
      [b.logFile.id, b.logFile],
    ]);
    const runs = [a.run, b.run];
    const comparison = buildComparison(runs, logFilesById, null);
    const exported = serializeComparison(comparison, runs);

    expect(() => deserializeComparison({ ...exported, formatVersion: 999 })).toThrow(
      UnrecognizedFormatVersionError,
    );
  });
});
