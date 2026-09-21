import { Fragment, useState } from "react";
import type { Comparison, LogFile, Run } from "../types";
import type { EvidenceIndex } from "../parsing/evidenceIndex";
import { findEvidenceForMetric } from "../drift/findEvidenceForMetric";
import { EvidenceDrilldownPanel } from "./EvidenceDrilldownPanel";
import { PinMetricToggle } from "./PinMetricToggle";
import { SignalBadge } from "./SignalBadge";
import { Icon } from "./Icon";
import { runColor } from "../ui/runColors";
import { AnimatedNumber } from "./AnimatedNumber";

// Each row waits for the previous ones to have (mostly) finished appearing
// before it renders in — a deliberate one-row-at-a-time reveal rather than a
// quick ripple, capped so a long table doesn't leave the last rows waiting
// several seconds. The row's own fade-in and its numbers' scramble share the
// same delay, so a row visibly arrives and settles as one beat. A lead-in
// matches the rest of the dashboard's entrance pacing, so the table doesn't
// start before the sections above it have had their own beat.
const ROW_DELAY_LEAD_IN_MS = 800;
const ROW_DELAY_STEP_MS = 220;
const ROW_DELAY_CAP_MS = 5000;
const TABLE_SCRAMBLE_DURATION_MS = 1300;

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
  const showPinColumn = Boolean(onPinMetric && onUnpinMetric);
  const colCount = runs.length + 2 + (showPinColumn ? 1 : 0);

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
          <th>Signal</th>
          {showPinColumn && <th className="col-pin">Pin</th>}
        </tr>
      </thead>
      <tbody>
        {comparison.metrics.map((metric, rowIndex) => {
          const classification = classificationByKey.get(metric.key);
          const rowDelay = ROW_DELAY_LEAD_IN_MS + Math.min(rowIndex * ROW_DELAY_STEP_MS, ROW_DELAY_CAP_MS);
          return (
            <Fragment key={metric.key}>
              <tr
                className={`row-enter${classification ? ` signal-row signal-row--${classification.severity}` : ""}`}
                style={{ animationDelay: `${rowDelay}ms` }}
              >
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
                      {unavailable ? (
                        "not available for this run"
                      ) : (
                        <AnimatedNumber
                          text={typeof value === "number" ? formatNumber(value) : value}
                          delay={rowDelay}
                          duration={TABLE_SCRAMBLE_DURATION_MS}
                        />
                      )}
                    </td>
                  );
                })}
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
