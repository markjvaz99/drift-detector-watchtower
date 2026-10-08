import type { DriftClassification } from "../types";

export const MIN_RUNS_FOR_DRIFT = 3;

export function isBelowRunCountGate(runCount: number): boolean {
  return runCount < MIN_RUNS_FOR_DRIFT;
}

export function runCountGateBasis(runCount: number): string {
  return `${runCount} run${runCount === 1 ? "" : "s"} provided; at least ${MIN_RUNS_FOR_DRIFT} needed to label drift`;
}

/**
 * With fewer than MIN_RUNS_FOR_DRIFT runs there is no group to measure a
 * difference against, so every drift label (including "no-drift") is replaced
 * with "cannot-determine". "uninterpretable" is kept: it already says the
 * metric can't be read, and its confound explanation is still useful.
 */
export function applyRunCountGate(
  classifications: DriftClassification[],
  runCount: number,
): DriftClassification[] {
  if (!isBelowRunCountGate(runCount)) return classifications;
  return classifications.map((c) =>
    c.severity === "uninterpretable"
      ? c
      : { ...c, severity: "cannot-determine", basis: runCountGateBasis(runCount) },
  );
}
