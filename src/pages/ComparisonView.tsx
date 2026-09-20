import { useEffect, useMemo, useRef, useState } from "react";
import type { LogFile, RelatednessAssessment, Run } from "../types";
import { RelatednessReminderBadge } from "../components/RelatednessReminderBadge";
import { ComparisonTable } from "../components/ComparisonTable";
import { DataQualityNoteBadge } from "../components/DataQualityNoteBadge";
import { RejectedCallBadge } from "../components/RejectedCallBadge";
import { UnrecognizedEventsNotice } from "../components/UnrecognizedEventsNotice";
import { PairwiseSelector } from "../components/PairwiseSelector";
import { CacheIntensityChart } from "../components/CacheIntensityChart";
import { OverheadTrendChart } from "../components/OverheadTrendChart";
import { ToolUsageChart } from "../components/ToolUsageChart";
import { DurationBreakdownChart } from "../components/DurationBreakdownChart";
import { HeadlineKpiSection } from "../components/HeadlineKpiSection";
import { DominantDriverPanel } from "../components/DominantDriverPanel";
import { ExportButton } from "../components/ExportButton";
import { buildComparison } from "../drift/buildComparison";
import { useSessionStore } from "../state/sessionStore";
import { writeRecentComparison } from "../state/localHistoryStore";
import type { Comparison } from "../types";
import type { EvidenceIndex } from "../parsing/evidenceIndex";

export interface ComparisonViewProps {
  runs: Run[];
  logFilesById: Map<string, LogFile>;
  relatednessAssessment: RelatednessAssessment | null;
  evidenceIndex: EvidenceIndex;
  /** When set (e.g. a reopened/imported report), skip recomputation and render this Comparison as-is. */
  precomputedComparison?: Comparison;
}

export function ComparisonView({
  runs,
  logFilesById,
  relatednessAssessment,
  evidenceIndex,
  precomputedComparison,
}: ComparisonViewProps) {
  const runsById = useMemo(() => new Map(runs.map((run) => [run.id, run])), [runs]);
  const pinnedMetricKeys = useSessionStore((state) => state.pinnedMetricKeys);
  const pinMetric = useSessionStore((state) => state.pinMetric);
  const unpinMetric = useSessionStore((state) => state.unpinMetric);
  const isReopened = Boolean(precomputedComparison);
  const comparison = useMemo(
    () =>
      precomputedComparison ?? buildComparison(runs, logFilesById, relatednessAssessment, pinnedMetricKeys),
    [precomputedComparison, runs, logFilesById, relatednessAssessment, pinnedMetricKeys],
  );

  const lastWrittenHistoryKeyRef = useRef<string | null>(null);
  useEffect(() => {
    const key = runs.map((r) => r.id).join(",");
    if (isReopened || logFilesById.size === 0 || lastWrittenHistoryKeyRef.current === key) {
      return;
    }
    // Guards against React StrictMode's dev-only double-invoke of this effect
    // (mount → cleanup → mount again) writing a duplicate history entry —
    // the ref persists across that double-invoke within the same instance.
    lastWrittenHistoryKeyRef.current = key;
    void writeRecentComparison(comparison, runs);
    // Only write once per freshly-built comparison, not on every pin toggle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReopened, runs.map((r) => r.id).join(","), logFilesById.size]);

  const [pairwiseRunIdA, setPairwiseRunIdA] = useState(runs[0]?.id ?? "");
  const [pairwiseRunIdB, setPairwiseRunIdB] = useState(runs[1]?.id ?? "");
  const pairwiseRuns = useMemo(
    () => [runsById.get(pairwiseRunIdA), runsById.get(pairwiseRunIdB)].filter((r): r is Run => Boolean(r)),
    [runsById, pairwiseRunIdA, pairwiseRunIdB],
  );
  const pairwiseComparison = useMemo(
    () =>
      !isReopened && pairwiseRuns.length === 2 ? buildComparison(pairwiseRuns, logFilesById, null) : null,
    [isReopened, pairwiseRuns, logFilesById],
  );

  return (
    <div className="comparison-view">
      <h1>{comparison.title}</h1>
      <RelatednessReminderBadge assessment={relatednessAssessment} runsById={runsById} />

      {runs.map((run) => {
        const logFile = logFilesById.get(run.sourceLogFileId);
        return (
          <div key={run.id}>
            {logFile && (
              <UnrecognizedEventsNotice runLabel={run.label} unrecognizedEventCount={logFile.unrecognizedEventCount} />
            )}
            {run.dataQualityNotes.map((note) => (
              <DataQualityNoteBadge key={note.type} note={note} />
            ))}
            {run.rejectedToolCalls.map((outcome) => (
              <RejectedCallBadge key={outcome.toolUseId} outcome={outcome} />
            ))}
          </div>
        );
      })}

      {isReopened && (
        <p role="status" className="reopened-report-notice">
          Reopened from recent comparisons — evidence drill-down uses the already-computed values only.
        </p>
      )}

      <ExportButton comparison={comparison} runs={runs} />

      {comparison.dominantDriverFinding && <DominantDriverPanel finding={comparison.dominantDriverFinding} />}

      <HeadlineKpiSection
        comparison={comparison}
        runs={runs}
        onViewFullTable={() => document.getElementById("full-comparison-table")?.scrollIntoView({ behavior: "smooth" })}
      />

      <div id="full-comparison-table">
        <ComparisonTable
          comparison={comparison}
          runs={runs}
          logFilesById={logFilesById}
          evidenceIndex={evidenceIndex}
          pinnedMetricKeys={pinnedMetricKeys}
          onPinMetric={pinMetric}
          onUnpinMetric={unpinMetric}
        />
      </div>

      {!isReopened && (
        <section className="comparison-charts" aria-label="Comparison charts">
          <CacheIntensityChart runs={runs} logFilesById={logFilesById} />
          <OverheadTrendChart runs={runs} logFilesById={logFilesById} />
          <ToolUsageChart runs={runs} logFilesById={logFilesById} />
          <DurationBreakdownChart runs={runs} logFilesById={logFilesById} />
        </section>
      )}

      {!isReopened && runs.length > 2 && (
        <section className="pairwise-view" aria-label="Pairwise comparison">
          <h2>Compare two runs</h2>
          <PairwiseSelector
            runs={runs}
            selectedRunIdA={pairwiseRunIdA}
            selectedRunIdB={pairwiseRunIdB}
            onChange={(idA, idB) => {
              if (idA === idB) {
                // Keep A/B distinct: swap the two slots rather than
                // momentarily selecting the same run for both.
                setPairwiseRunIdA(pairwiseRunIdB);
                setPairwiseRunIdB(pairwiseRunIdA);
                return;
              }
              setPairwiseRunIdA(idA);
              setPairwiseRunIdB(idB);
            }}
          />
          {pairwiseComparison && (
            <ComparisonTable
              comparison={pairwiseComparison}
              runs={pairwiseRuns}
              logFilesById={logFilesById}
              evidenceIndex={evidenceIndex}
            />
          )}
        </section>
      )}
    </div>
  );
}
