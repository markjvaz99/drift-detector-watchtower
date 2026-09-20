import type { SessionSummary } from "../types";

export interface SessionSummaryPanelProps {
  summary: SessionSummary;
}

export function SessionSummaryPanel({ summary }: SessionSummaryPanelProps) {
  return (
    <section className="session-summary-panel card" aria-label="Session summary">
      <p className="eyebrow eyebrow--accent">Session summary</p>
      <p className="root-cause-explanation">{summary.summaryText}</p>
    </section>
  );
}
