import type { Comparison, LogFile, Run } from "../types";
import { runColor } from "../ui/runColors";

export interface RunSummaryCardsProps {
  runs: Run[];
  logFilesById: Map<string, LogFile>;
  comparison: Comparison;
}

function metricValue(comparison: Comparison, runId: string, key: string): string {
  const metric = comparison.metrics.find((m) => m.key === key);
  const value = metric?.valuesByRun.get(runId);
  return typeof value === "number" ? String(value) : "—";
}

export function RunSummaryCards({ runs, logFilesById, comparison }: RunSummaryCardsProps) {
  return (
    <div className="run-summary-cards">
      {runs.map((run, index) => {
        const logFile = logFilesById.get(run.sourceLogFileId);
        const color = runColor(index);
        return (
          <div key={run.id} className="run-summary-card card" style={{ borderTopColor: color }}>
            <p className="run-summary-title" style={{ color }}>
              <span className="run-summary-dot" style={{ background: color }} />
              {run.label}
              {logFile && <span className="run-summary-session"> {logFile.sessionIdentifier.slice(0, 8) || "—"}…</span>}
            </p>
            <dl className="run-summary-stats">
              <div>
                <dt>Prompt</dt>
                <dd>{run.taskPromptText.length.toLocaleString()} ch</dd>
              </div>
              <div>
                <dt>Working dir</dt>
                <dd>{logFile?.workingDirectory || "—"}</dd>
              </div>
              <div>
                <dt>Turns</dt>
                <dd>{metricValue(comparison, run.id, "turns")}</dd>
              </div>
              <div>
                <dt>Tool calls</dt>
                <dd>{metricValue(comparison, run.id, "tool_calls")}</dd>
              </div>
            </dl>
            {run.taskPromptText.trim().length > 0 ? (
              <details className="run-summary-prompt">
                <summary>View full prompt</summary>
                <div className="run-summary-prompt-text">{run.taskPromptText}</div>
              </details>
            ) : (
              <p className="run-summary-prompt-empty">No prompt captured for this run.</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
