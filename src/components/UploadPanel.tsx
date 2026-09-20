import { useState } from "react";
import { useSessionStore } from "../state/sessionStore";
import { parseLogInWorker } from "../workers/parseLogInWorker";
import type { BuiltRun } from "../parsing/buildRun";
import { RecentComparisonsList } from "./RecentComparisonsList";
import { importReport } from "../reporting/importReport";
import type { Comparison, Run } from "../types";

export interface UploadPanelProps {
  onOpenRecent?: (id: string) => void;
  onImportReport?: (result: { comparison: Comparison; runs: Run[] }) => void;
}

export function UploadPanel({ onOpenRecent, onImportReport }: UploadPanelProps = {}) {
  const addBuiltRuns = useSessionStore((state) => state.addBuiltRuns);
  const [isParsing, setIsParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleImport(fileList: FileList | null) {
    const file = fileList?.[0];
    if (!file || !onImportReport) return;
    try {
      onImportReport(await importReport(file));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to import report.");
    }
  }

  async function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    setIsParsing(true);
    setError(null);
    try {
      const files = Array.from(fileList);
      const builtRuns: BuiltRun[] = await Promise.all(files.map(parseLogInWorker));
      addBuiltRuns(builtRuns);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to parse one or more log files.");
    } finally {
      setIsParsing(false);
    }
  }

  return (
    <div className="upload-panel app-shell">
      <header className="app-header">
        <div className="app-header-title">
          <span className="app-header-logo">
            <span className="app-header-logo-mark" />
            DRIFT
          </span>
        </div>
      </header>

      <div className="card upload-card">
        <p className="card-title">Upload telemetry logs</p>
        <p className="card-subtitle">One or more .jsonl files — 2+ enables drift comparison.</p>
        <label htmlFor="log-upload" className="file-input-label">
          <input
            id="log-upload"
            type="file"
            accept=".jsonl"
            multiple
            disabled={isParsing}
            onChange={(event) => void handleFiles(event.target.files)}
          />
        </label>
        {isParsing && (
          <p role="status" className="upload-status">
            Parsing…
          </p>
        )}
        {error && (
          <p role="alert" className="upload-error">
            {error}
          </p>
        )}

        {onImportReport && (
          <div className="import-report">
            <label htmlFor="report-import" className="file-input-label file-input-label--secondary">
              Import a previously exported report
              <input id="report-import" type="file" accept=".json" onChange={(event) => void handleImport(event.target.files)} />
            </label>
          </div>
        )}
      </div>

      {onOpenRecent && <RecentComparisonsList onOpen={onOpenRecent} />}
    </div>
  );
}
