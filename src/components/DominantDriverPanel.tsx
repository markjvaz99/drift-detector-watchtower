import type { DominantDriverFinding } from "../types";

export interface DominantDriverPanelProps {
  finding: DominantDriverFinding;
}

export function DominantDriverPanel({ finding }: DominantDriverPanelProps) {
  return (
    <section className="dominant-driver-panel card" aria-label="Dominant driver">
      <p className="eyebrow eyebrow--accent">Root cause</p>
      <p className="root-cause-explanation">{finding.explanation}</p>
      {finding.hasDominantDriver && finding.supportingNumbers.length > 0 && (
        <ul className="dominant-driver-numbers">
          {finding.supportingNumbers.map((n, i) => (
            <li key={i}>
              <span className="dominant-driver-number">{n}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
