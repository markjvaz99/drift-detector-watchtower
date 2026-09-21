import { useEffect, useMemo, useRef, useState } from "react";
import type { LogFile, RelatednessAssessment, Run } from "../types";
import { RelatednessReminderBadge } from "../components/RelatednessReminderBadge";
import { ComparisonTable } from "../components/ComparisonTable";
import { RunSummaryCards } from "../components/RunSummaryCards";
import { PairwiseSelector } from "../components/PairwiseSelector";
import { CacheIntensityChart } from "../components/CacheIntensityChart";
import { OverheadTrendChart } from "../components/OverheadTrendChart";
import { ToolUsageChart } from "../components/ToolUsageChart";
import { DurationBreakdownChart } from "../components/DurationBreakdownChart";
import { HeadlineKpiSection } from "../components/HeadlineKpiSection";
import { RecommendationsPanel } from "../components/RecommendationsPanel";
import { ExportButton } from "../components/ExportButton";
import { SignalLegend } from "../components/SignalLegend";
import { Icon } from "../components/Icon";
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
  onNewComparison?: () => void;
}

export function ComparisonView({
  runs,
  logFilesById,
  relatednessAssessment,
  evidenceIndex,
  precomputedComparison,
  onNewComparison,
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
    <div className="comparison-view app-shell">
      <header className="app-header">
        <div className="app-header-title">
          <span className="app-header-logo">
            <span className="app-header-logo-mark" />
            DRIFT
          </span>
          <span className="app-header-subtitle-divider" aria-hidden="true">/</span>
          <h1 className="app-header-subtitle">{comparison.title}</h1>
        </div>
        <div className="app-header-actions">
          {onNewComparison && (
            <button type="button" className="btn btn-ghost" onClick={onNewComparison}>
              <Icon name="plus" size={14} />
              New comparison
            </button>
          )}
          <button type="button" className="btn btn-ghost" onClick={() => window.print()}>
            <Icon name="download" size={14} />
            Download PDF
          </button>
          <ExportButton comparison={comparison} runs={runs} />
        </div>
      </header>

      <RelatednessReminderBadge assessment={relatednessAssessment} runsById={runsById} />

      <RunSummaryCards runs={runs} logFilesById={logFilesById} comparison={comparison} />

      {isReopened && (
        <p role="status" className="reopened-report-notice">
          <Icon name="history" size={14} />
          Reopened from recent comparisons — evidence drill-down uses the already-computed values only.
        </p>
      )}

      <HeadlineKpiSection
        comparison={comparison}
        runs={runs}
        onViewFullTable={() => document.getElementById("full-comparison-table")?.scrollIntoView({ behavior: "smooth" })}
      />

      <RecommendationsPanel comparison={comparison} runs={runs} />

      {!isReopened && (
        <section className="comparison-charts section-grid-2" aria-label="Comparison charts">
          <CacheIntensityChart runs={runs} logFilesById={logFilesById} />
          <ToolUsageChart runs={runs} logFilesById={logFilesById} />
          <OverheadTrendChart runs={runs} logFilesById={logFilesById} />
          <DurationBreakdownChart runs={runs} logFilesById={logFilesById} />
        </section>
      )}

      <div id="full-comparison-table" className="card">
        <p className="card-title">Full comparison</p>
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

      <SignalLegend runs={runs} />

      {!isReopened && runs.length > 2 && (
        <section className="pairwise-view card" aria-label="Pairwise comparison">
          <p className="card-title">Compare two runs</p>
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
