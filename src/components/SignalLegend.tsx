import type { Run } from "../types";
import { runColor } from "../ui/runColors";

export interface SignalLegendProps {
  runs: Run[];
}

export function SignalLegend({ runs }: SignalLegendProps) {
  return (
    <div className="signal-legend" aria-label="Legend">
      {runs.map((run, index) => (
        <span key={run.id} className="legend-item">
          <span className="legend-dot" style={{ background: runColor(index) }} />
          {run.label}
        </span>
      ))}
      <span className="legend-item">
        <span className="legend-dot" style={{ background: "var(--signal-large)" }} />
        Large / categorical drift
      </span>
      <span className="legend-item">
        <span className="legend-dot" style={{ background: "var(--signal-moderate)" }} />
        Moderate drift
      </span>
      <span className="legend-item">
        <span className="legend-dot" style={{ background: "var(--signal-neutral)" }} />
        No drift / uninterpretable
      </span>
    </div>
  );
}
