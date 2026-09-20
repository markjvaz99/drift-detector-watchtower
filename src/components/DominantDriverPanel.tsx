import type { DominantDriverFinding } from "../types";

export interface DominantDriverPanelProps {
  finding: DominantDriverFinding;
}

export function DominantDriverPanel({ finding }: DominantDriverPanelProps) {
  return (
    <section className="dominant-driver-panel" aria-label="Dominant driver">
      <h2>Dominant driver</h2>
      <p>{finding.explanation}</p>
      {finding.hasDominantDriver && finding.supportingNumbers.length > 0 && (
        <ul className="dominant-driver-numbers">
          {finding.supportingNumbers.map((n, i) => (
            <li key={i}>{n}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
