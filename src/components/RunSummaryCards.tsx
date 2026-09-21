import type { Comparison, LogFile, Run } from "../types";
import { runColor } from "../ui/runColors";
import { extractPromptRecords } from "../parsing/extractPromptTexts";

function formatPromptTime(timestamp: string): string {
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

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
        const promptRecords = logFile ? extractPromptRecords(logFile.events) : [];
        const totalPromptChars = promptRecords.reduce((sum, record) => sum + record.text.length, 0);
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
                <dd>{totalPromptChars.toLocaleString()} ch</dd>
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
            {promptRecords.length > 0 ? (
              <details className="run-summary-prompt">
                <summary>
                  View full prompt{promptRecords.length > 1 ? ` (${promptRecords.length} prompts)` : ""}
                </summary>
                {promptRecords.length === 1 ? (
                  <div className="run-summary-prompt-text">{promptRecords[0].text}</div>
                ) : (
                  promptRecords.map((record, i) => (
                    <div key={i} className="run-summary-prompt-entry">
                      <p className="run-summary-prompt-entry-label">
                        Prompt {i + 1}
                        {formatPromptTime(record.timestamp) && ` · ${formatPromptTime(record.timestamp)}`}
                      </p>
                      <div className="run-summary-prompt-text">{record.text}</div>
                    </div>
                  ))
                )}
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
