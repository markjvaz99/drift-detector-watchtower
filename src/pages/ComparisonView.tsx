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
import { SuggestNamesButton } from "../components/SuggestNamesButton";
import { Icon } from "../components/Icon";
import { buildComparison } from "../drift/buildComparison";
import { useSessionStore } from "../state/sessionStore";
import { writeRecentComparison } from "../state/localHistoryStore";
import { extractPromptRecords } from "../parsing/extractPromptTexts";
import { generateComparisonNames } from "../recommendations/generateComparisonNames";
import { getEffectiveApiKey } from "../recommendations/apiKeyStore";
import { describeAnthropicError } from "../recommendations/describeAnthropicError";
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
  // AI-suggested title/run labels are a display-only overlay on top of the
  // deterministic defaults — nothing about the underlying Comparison (which
  // metrics drifted, evidence, etc.) depends on them, so they live as local
  // state here rather than in the session store or the Comparison object.
  const [aiTitle, setAiTitle] = useState<string | null>(null);
  const [aiRunLabels, setAiRunLabels] = useState<Map<string, string> | null>(null);
  const [namingLoading, setNamingLoading] = useState(false);
  const [namingError, setNamingError] = useState<string | null>(null);

  async function runNaming(apiKey: string) {
    setNamingLoading(true);
    setNamingError(null);
    try {
      const runSummaries = runs.map((run) => {
        const logFile = logFilesById.get(run.sourceLogFileId);
        return {
          runId: run.id,
          currentLabel: run.label,
          prompts: logFile ? extractPromptRecords(logFile.events).map((record) => record.text) : [],
        };
      });
      const result = await generateComparisonNames(runSummaries, apiKey);
      setAiTitle(result.title);
      setAiRunLabels(new Map(result.runLabels.map((entry) => [entry.runId, entry.label])));
    } catch (err) {
      setNamingError(describeAnthropicError(err));
    } finally {
      setNamingLoading(false);
    }
  }

  const displayRuns = useMemo(
    () =>
      aiRunLabels
        ? runs.map((run) => (aiRunLabels.has(run.id) ? { ...run, label: aiRunLabels.get(run.id)! } : run))
        : runs,
    [runs, aiRunLabels],
  );
  const runsById = useMemo(() => new Map(displayRuns.map((run) => [run.id, run])), [displayRuns]);
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

  const autoNamedKeyRef = useRef<string | null>(null);
  useEffect(() => {
    const key = runs.map((r) => r.id).join(",");
    if (isReopened || autoNamedKeyRef.current === key) return;
    // Only auto-fires when a key is already saved — never prompts for one or
    // makes a network call the user hasn't already opted into by saving a
    // key. Without one, the "Suggest names" button stays available to
    // trigger this manually (and to enter a key for the first time).
    const apiKey = getEffectiveApiKey();
    if (!apiKey) return;
    autoNamedKeyRef.current = key;
    void runNaming(apiKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReopened, runs.map((r) => r.id).join(",")]);

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
          <h1 className="app-header-subtitle">{aiTitle ?? comparison.title}</h1>
          {!isReopened && (
            <SuggestNamesButton loading={namingLoading} error={namingError} onGenerate={(apiKey) => void runNaming(apiKey)} />
          )}
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
          <ExportButton comparison={comparison} runs={displayRuns} />
        </div>
      </header>

      <RelatednessReminderBadge assessment={relatednessAssessment} runsById={runsById} />

      <RunSummaryCards runs={displayRuns} logFilesById={logFilesById} comparison={comparison} />

      {isReopened && (
        <p role="status" className="reopened-report-notice">
          <Icon name="history" size={14} />
          Reopened from recent comparisons — evidence drill-down uses the already-computed values only.
        </p>
      )}

      <HeadlineKpiSection
        comparison={comparison}
        runs={displayRuns}
        onViewFullTable={() => document.getElementById("full-comparison-table")?.scrollIntoView({ behavior: "smooth" })}
      />

      <RecommendationsPanel comparison={comparison} runs={displayRuns} logFilesById={logFilesById} />

      {!isReopened && (
        <section className="comparison-charts section-grid-2" aria-label="Comparison charts">
          <CacheIntensityChart runs={displayRuns} logFilesById={logFilesById} />
          <ToolUsageChart runs={displayRuns} logFilesById={logFilesById} />
          <OverheadTrendChart runs={displayRuns} logFilesById={logFilesById} />
          <DurationBreakdownChart runs={displayRuns} logFilesById={logFilesById} />
        </section>
      )}

      <div id="full-comparison-table" className="card">
        <p className="card-title">Full comparison</p>
        <ComparisonTable
          comparison={comparison}
          runs={displayRuns}
          logFilesById={logFilesById}
          evidenceIndex={evidenceIndex}
          pinnedMetricKeys={pinnedMetricKeys}
          onPinMetric={pinMetric}
          onUnpinMetric={unpinMetric}
        />
      </div>

      <SignalLegend runs={displayRuns} />

      {!isReopened && runs.length > 2 && (
        <section className="pairwise-view card" aria-label="Pairwise comparison">
          <p className="card-title">Compare two runs</p>
          <PairwiseSelector
            runs={displayRuns}
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
