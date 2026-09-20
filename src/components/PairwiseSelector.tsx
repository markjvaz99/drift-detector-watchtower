import type { Run } from "../types";

export interface PairwiseSelectorProps {
  runs: Run[];
  selectedRunIdA: string;
  selectedRunIdB: string;
  onChange: (runIdA: string, runIdB: string) => void;
}

export function PairwiseSelector({ runs, selectedRunIdA, selectedRunIdB, onChange }: PairwiseSelectorProps) {
  return (
    <div className="pairwise-selector">
      <label>
        Run A
        <select
          aria-label="Pairwise run A"
          value={selectedRunIdA}
          onChange={(event) => onChange(event.target.value, selectedRunIdB)}
        >
          {runs.map((run) => (
            <option key={run.id} value={run.id}>
              {run.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        Run B
        <select
          aria-label="Pairwise run B"
          value={selectedRunIdB}
          onChange={(event) => onChange(selectedRunIdA, event.target.value)}
        >
          {runs.map((run) => (
            <option key={run.id} value={run.id}>
              {run.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
