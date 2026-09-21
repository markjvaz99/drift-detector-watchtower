import { useState } from "react";
import { useSessionStore } from "../state/sessionStore";
import { parseLogInWorker } from "../workers/parseLogInWorker";
import type { BuiltRun } from "../parsing/buildRun";
import { RecentComparisonsList } from "./RecentComparisonsList";
import { importReport } from "../reporting/importReport";
import { Icon } from "./Icon";
import { Spinner } from "./Spinner";
import type { Comparison, Run } from "../types";

export interface UploadPanelProps {
  onOpenRecent?: (id: string) => void;
  onImportReport?: (result: { comparison: Comparison; runs: Run[] }) => void;
}

const TRUST_BADGES = [
  { icon: "shield", text: "Entirely on-device — logs never leave your browser" },
  { icon: "file-text", text: "Reads standard OTLP session telemetry (.jsonl)" },
  { icon: "activity", text: "Statistical drift classification, not eyeballed diffs" },
] as const;

const HOW_IT_WORKS = [
  { title: "Upload two or more session logs", detail: "One file works as a single-run report; two or more unlocks drift comparison." },
  { title: "Automatic relatedness check", detail: "Confirms the runs describe the same task before comparing them head-to-head." },
  { title: "Drift-classified comparison", detail: "Every metric is scored no-drift/moderate/large/categorical with statistical basis and root cause." },
] as const;

export function UploadPanel({ onOpenRecent, onImportReport }: UploadPanelProps = {}) {
  const addBuiltRuns = useSessionStore((state) => state.addBuiltRuns);
  const [isParsing, setIsParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);

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

      <div className="upload-hero">
        <p className="upload-hero-title">Compare Claude Code sessions</p>
        <p className="upload-hero-subtitle">
          Upload OTLP telemetry logs to see what actually changed between runs — entirely on-device.
        </p>
        <ul className="upload-hero-badges">
          {TRUST_BADGES.map((badge) => (
            <li key={badge.text}>
              <Icon name={badge.icon} size={14} />
              {badge.text}
            </li>
          ))}
        </ul>
      </div>

      <div className="upload-page-grid">
        <div className="card upload-card">
          <p className="card-title">Upload telemetry logs</p>
          <p className="card-subtitle">One or more .jsonl files — 2+ enables drift comparison.</p>
          <label
            htmlFor="log-upload"
            className={`dropzone${isDragActive ? " dropzone--active" : ""}`}
            onDragOver={(event) => {
              event.preventDefault();
              setIsDragActive(true);
            }}
            onDragLeave={() => setIsDragActive(false)}
            onDrop={(event) => {
              event.preventDefault();
              setIsDragActive(false);
              void handleFiles(event.dataTransfer.files);
            }}
          >
            <span className="dropzone-icon-badge">
              <Icon name="upload" size={22} className="dropzone-icon" />
            </span>
            <span className="dropzone-title">Drag and drop .jsonl files here</span>
            <span className="dropzone-subtitle">or click to browse</span>
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
              <Spinner size={13} />
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
                <Icon name="external" size={13} />
                Import a previously exported report
                <input id="report-import" type="file" accept=".json" onChange={(event) => void handleImport(event.target.files)} />
              </label>
            </div>
          )}
        </div>

        <aside className="upload-side">
          <div className="card how-it-works">
            <p className="card-title">How it works</p>
            <ol className="how-it-works-steps">
              {HOW_IT_WORKS.map((step, index) => (
                <li key={step.title}>
                  <span className="how-it-works-step-number">{index + 1}</span>
                  <span>
                    <span className="how-it-works-step-title">{step.title}</span>
                    <span className="how-it-works-step-detail">{step.detail}</span>
                  </span>
                </li>
              ))}
            </ol>
          </div>

          {onOpenRecent && <RecentComparisonsList onOpen={onOpenRecent} />}
        </aside>
      </div>
    </div>
  );
}
