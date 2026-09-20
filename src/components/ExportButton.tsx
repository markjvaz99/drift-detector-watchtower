import type { Comparison, Run } from "../types";
import { exportReport } from "../reporting/exportReport";

export interface ExportButtonProps {
  comparison: Comparison;
  runs: Run[];
}

export function ExportButton({ comparison, runs }: ExportButtonProps) {
  return (
    <button type="button" className="export-button" onClick={() => exportReport(comparison, runs)}>
      Export report
    </button>
  );
}
