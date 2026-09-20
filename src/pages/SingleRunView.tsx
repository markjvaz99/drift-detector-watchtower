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

export function SingleRunView({ logFile, run }: SingleRunViewProps) {
  if (!run.hasCompletedTaskActivity) {
    return <EmptyRunState />;
  }

  const metrics = computeRunMetrics(logFile);
  const sessionSummary = composeSessionSummary(run, logFile);

  return (
    <div className="single-run-view">
      <h1>{run.label}</h1>
      <UnrecognizedEventsNotice runLabel={run.label} unrecognizedEventCount={logFile.unrecognizedEventCount} />
      <SessionSummaryPanel summary={sessionSummary} />
      <table>
        <tbody>
          {metrics.map((metric) => (
            <tr key={metric.key}>
              <td>{metric.label}</td>
              <td>
                {metric.value === "not-available" ? "not available for this run" : metric.value}
                {metric.denominatorLabel ? ` (${metric.denominatorLabel})` : ""}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
