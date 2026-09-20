import type { Comparison, Run } from "../types";
import { identifyOutliers } from "../drift/identifyOutliers";

export interface HeadlineKpiSectionProps {
  comparison: Comparison;
  runs: Run[];
  onViewFullTable?: () => void;
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
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
      <section className="headline-kpi-section" aria-label="Headline drift summary">
        <p>No significant drift detected.</p>
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
          return (
            <li key={key} className="headline-kpi-card">
              <h3>{metric?.label ?? key}</h3>
              <p>{classification?.severity}</p>
              {stats && runs.length > 2 && (
                <p>
                  Range: {formatNumber(stats.min)}–{formatNumber(stats.max)}
                  {outliers.length > 0 && (
                    <>
                      {" "}
                      (outlier: {outliers.map((o) => labelByRunId.get(o.runId) ?? o.runId).join(", ")})
                    </>
                  )}
                </p>
              )}
            </li>
          );
        })}
      </ul>
      {totalQualifying > comparison.headlineMetricKeys.length && (
        <button type="button" onClick={onViewFullTable}>
          +{totalQualifying - comparison.headlineMetricKeys.length} more drifted metrics — view full table
        </button>
      )}
    </section>
  );
}
