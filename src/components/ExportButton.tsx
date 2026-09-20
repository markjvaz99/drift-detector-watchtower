import type { Comparison, Run } from "../types";
import { exportReport } from "../reporting/exportReport";
import { Icon } from "./Icon";

export interface ExportButtonProps {
  comparison: Comparison;
  runs: Run[];
}

export function ExportButton({ comparison, runs }: ExportButtonProps) {
  return (
    <button type="button" className="export-button btn btn-primary" onClick={() => exportReport(comparison, runs)}>
      <Icon name="download" size={14} />
      Export report
    </button>
  );
}
