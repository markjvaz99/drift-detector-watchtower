import type { DominantDriverFinding } from "../types";

export interface DominantDriverPanelProps {
  finding: DominantDriverFinding;
}

function formatSupportingNumber(value: number): string {
  return Number.isInteger(value) ? value.toLocaleString() : value.toFixed(2);
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
              <span className="dominant-driver-number">{formatSupportingNumber(n)}</span>
              {finding.supportingNumberLabels[i] && (
                <span className="dominant-driver-number-label">{finding.supportingNumberLabels[i]}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
