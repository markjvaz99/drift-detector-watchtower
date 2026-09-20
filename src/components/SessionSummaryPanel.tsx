import type { SessionSummary } from "../types";

export interface SessionSummaryPanelProps {
  summary: SessionSummary;
}

export function SessionSummaryPanel({ summary }: SessionSummaryPanelProps) {
  return (
    <section className="session-summary-panel" aria-label="Session summary">
      <h2>Session summary</h2>
      <p>{summary.summaryText}</p>
    </section>
  );
}
