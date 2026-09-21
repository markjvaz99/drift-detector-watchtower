import { computeRunMetrics } from "../metrics/computeRunMetrics";
import { EmptyRunState } from "../components/EmptyRunState";
import { SessionSummaryPanel } from "../components/SessionSummaryPanel";
import { UnrecognizedEventsNotice } from "../components/UnrecognizedEventsNotice";
import { composeSessionSummary } from "../dominant-driver/composeSessionSummary";
import type { LogFile, Run } from "../types";

export interface SingleRunViewProps {
  logFile: LogFile;
  run: Run;
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

export function SingleRunView({ logFile, run }: SingleRunViewProps) {
  if (!run.hasCompletedTaskActivity) {
    return <EmptyRunState />;
  }

  const metrics = computeRunMetrics(logFile);
  const sessionSummary = composeSessionSummary(run, logFile);

  return (
    <div className="single-run-view app-shell">
      <header className="app-header">
        <div className="app-header-title">
          <h1 className="page-heading" style={{ margin: 0 }}>{run.label}</h1>
        </div>
      </header>
      <UnrecognizedEventsNotice runLabel={run.label} unrecognizedEventCount={logFile.unrecognizedEventCount} />
      <SessionSummaryPanel summary={sessionSummary} />
      <div className="card single-run-metrics-card">
        <p className="card-title">Metrics</p>
        <div className="table-scroll">
          <table className="comparison-table">
            <tbody>
              {metrics.map((metric) => (
                <tr key={metric.key}>
                  <td>{metric.label}</td>
                  <td className={metric.value === "not-available" ? "cell-unavailable" : undefined}>
                    {metric.value === "not-available" ? "not available for this run" : formatNumber(metric.value)}
                    {metric.denominatorLabel ? ` (${metric.denominatorLabel})` : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
