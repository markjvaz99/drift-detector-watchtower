import type { Comparison, Run } from "../types";
import { identifyOutliers } from "../drift/identifyOutliers";
import { SignalBadge } from "./SignalBadge";
import { runColor } from "../ui/runColors";

export interface HeadlineKpiSectionProps {
  comparison: Comparison;
  runs: Run[];
  onViewFullTable?: () => void;
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function percentDelta(a: number, b: number): string | null {
  if (a === 0) return null;
  const pct = ((b - a) / Math.abs(a)) * 100;
  const sign = pct >= 0 ? "+" : "";
  return `${sign}${pct.toFixed(0)}%`;
}

export function HeadlineKpiSection({ comparison, runs, onViewFullTable }: HeadlineKpiSectionProps) {
  const metricByKey = new Map(comparison.metrics.map((m) => [m.key, m]));
  const statsByKey = new Map(comparison.groupStatistics.map((s) => [s.metricKey, s]));
  const classificationByKey = new Map(comparison.driftClassifications.map((c) => [c.metricKey, c]));
  const labelByRunId = new Map(runs.map((run) => [run.id, run.label]));

  const totalQualifying = comparison.driftClassifications.filter(
    (c) =>
      ["moderate", "large", "categorical"].includes(c.severity) ||
      comparison.pinnedMetricKeys.includes(c.metricKey),
  ).length;

  if (comparison.headlineMetricKeys.length === 0) {
    return (
      <section className="headline-kpi-section card" aria-label="Headline drift summary">
        <p className="no-drift-message">No significant drift detected.</p>
      </section>
    );
  }

  return (
    <section className="headline-kpi-section" aria-label="Headline drift summary">
      <ul className="headline-kpi-cards">
        {comparison.headlineMetricKeys.map((key) => {
          const metric = metricByKey.get(key);
          const stats = statsByKey.get(key);
          const classification = classificationByKey.get(key);
          const outliers = stats ? identifyOutliers(stats, metric!) : [];

          const valueA = metric && runs[0] ? metric.valuesByRun.get(runs[0].id) : undefined;
          const valueB = metric && runs[1] ? metric.valuesByRun.get(runs[1].id) : undefined;
          const isTwoRunNumeric = runs.length === 2 && typeof valueA === "number" && typeof valueB === "number";
          const delta = isTwoRunNumeric ? percentDelta(valueA as number, valueB as number) : null;

          return (
            <li key={key} className="headline-kpi-card card">
              <h3 className="kpi-label">{metric?.label ?? key}</h3>
              {isTwoRunNumeric ? (
                <p className="kpi-values">
                  <span style={{ color: runColor(0) }}>{formatNumber(valueA as number)}</span>
                  <span className="kpi-vs"> vs </span>
                  <span style={{ color: runColor(1) }}>{formatNumber(valueB as number)}</span>
                </p>
              ) : (
                stats &&
                runs.length > 2 && (
                  <p className="kpi-values">
                    Range: {formatNumber(stats.min)}–{formatNumber(stats.max)}
                    {outliers.length > 0 && (
                      <>
                        {" "}
                        (outlier: {outliers.map((o) => labelByRunId.get(o.runId) ?? o.runId).join(", ")})
                      </>
                    )}
                  </p>
                )
              )}
              <p className="kpi-signal-row">
                {delta && <span className="kpi-delta">{delta}</span>}
                {classification && <SignalBadge severity={classification.severity} />}
              </p>
            </li>
          );
        })}
      </ul>
      {totalQualifying > comparison.headlineMetricKeys.length && (
        <button type="button" className="btn view-full-table-btn" onClick={onViewFullTable}>
          +{totalQualifying - comparison.headlineMetricKeys.length} more drifted metrics — view full table
        </button>
      )}
    </section>
  );
}
