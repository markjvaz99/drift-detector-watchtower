import { Fragment, useState } from "react";
import type { Comparison, LogFile, Run } from "../types";
import type { EvidenceIndex } from "../parsing/evidenceIndex";
import { findEvidenceForMetric } from "../drift/findEvidenceForMetric";
import { identifyOutliers } from "../drift/identifyOutliers";
import { EvidenceDrilldownPanel } from "./EvidenceDrilldownPanel";
import { PinMetricToggle } from "./PinMetricToggle";
import { SignalBadge } from "./SignalBadge";
import { Icon } from "./Icon";
import { runColor } from "../ui/runColors";

export interface ComparisonTableProps {
  comparison: Comparison;
  runs: Run[];
  logFilesById: Map<string, LogFile>;
  evidenceIndex: EvidenceIndex;
  pinnedMetricKeys?: string[];
  onPinMetric?: (metricKey: string) => void;
  onUnpinMetric?: (metricKey: string) => void;
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

export function ComparisonTable({
  comparison,
  runs,
  logFilesById,
  evidenceIndex,
  pinnedMetricKeys = [],
  onPinMetric,
  onUnpinMetric,
}: ComparisonTableProps) {
  const [expandedMetricKey, setExpandedMetricKey] = useState<string | null>(null);
  const classificationByKey = new Map(comparison.driftClassifications.map((c) => [c.metricKey, c]));
  const statsByKey = new Map(comparison.groupStatistics.map((s) => [s.metricKey, s]));
  const labelByRunId = new Map(runs.map((run) => [run.id, run.label]));
  const showPinColumn = Boolean(onPinMetric && onUnpinMetric);
  const colCount = runs.length + 7 + (showPinColumn ? 1 : 0);

  return (
    <div className="table-scroll">
    <table className="comparison-table">
      <thead>
        <tr>
          <th>Metric</th>
          {runs.map((run, index) => (
            <th key={run.id} style={{ color: runColor(index) }}>
              {run.label}
            </th>
          ))}
          <th className="num">Min</th>
          <th className="num">Median</th>
          <th className="num">Max</th>
          <th className="num">Spread</th>
          <th>Outlier</th>
          <th>Signal</th>
          {showPinColumn && <th className="col-pin">Pin</th>}
        </tr>
      </thead>
      <tbody>
        {comparison.metrics.map((metric) => {
          const classification = classificationByKey.get(metric.key);
          const stats = statsByKey.get(metric.key);
          const outliers = stats ? identifyOutliers(stats, metric) : [];
          return (
            <Fragment key={metric.key}>
              <tr>
                <td>
                  <button
                    type="button"
                    className="metric-name-btn"
                    onClick={() => setExpandedMetricKey(
                      expandedMetricKey === metric.key ? null : metric.key,
                    )}
                  >
                    {metric.label}
                  </button>
                </td>
                {runs.map((run, index) => {
                  const value = metric.valuesByRun.get(run.id);
                  const unavailable = value === "not-available" || value === undefined;
                  return (
                    <td
                      key={run.id}
                      className={unavailable ? "cell-unavailable num" : "num"}
                      style={unavailable ? undefined : { color: runColor(index) }}
                    >
                      {unavailable
                        ? "not available for this run"
                        : typeof value === "number"
                          ? formatNumber(value)
                          : value}
                    </td>
                  );
                })}
                <td className="num">{stats ? formatNumber(stats.min) : "—"}</td>
                <td className="num">{stats ? formatNumber(stats.median) : "—"}</td>
                <td className="num">{stats ? formatNumber(stats.max) : "—"}</td>
                <td className="num">{stats ? formatNumber(stats.spread) : "—"}</td>
                <td>
                  {outliers.length > 0
                    ? outliers
                        .map((o) => `${labelByRunId.get(o.runId) ?? o.runId} (${formatNumber(o.value)})`)
                        .join(", ")
                    : "—"}
                </td>
                <td>
                  {classification && <SignalBadge severity={classification.severity} />}
                  {classification?.overriddenByConfound && (
                    <span
                      className="confound-flag"
                      role="note"
                      title={classification.overriddenByConfound.description}
                    >
                      <Icon name="warning" size={11} />
                      {classification.overriddenByConfound.type}
                    </span>
                  )}
                </td>
                {showPinColumn && (
                  <td className="col-pin">
                    <PinMetricToggle
                      metricKey={metric.key}
                      metricLabel={metric.label}
                      pinned={pinnedMetricKeys.includes(metric.key)}
                      onPin={onPinMetric!}
                      onUnpin={onUnpinMetric!}
                    />
                  </td>
                )}
              </tr>
              {expandedMetricKey === metric.key && (
                <tr>
                  <td colSpan={colCount}>
                    <EvidenceDrilldownPanel
                      evidenceRefs={runs.flatMap((run) => {
                        const logFile = logFilesById.get(run.sourceLogFileId);
                        return logFile ? findEvidenceForMetric(logFile, metric.key) : [];
                      })}
                      evidenceIndex={evidenceIndex}
                      sourceUnavailable={logFilesById.size === 0}
                    />
                  </td>
                </tr>
              )}
            </Fragment>
          );
        })}
      </tbody>
    </table>
    </div>
  );
}
