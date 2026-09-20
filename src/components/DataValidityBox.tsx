import type { LogFile, Run } from "../types";
import { DataQualityNoteBadge } from "./DataQualityNoteBadge";
import { RejectedCallBadge } from "./RejectedCallBadge";
import { UnrecognizedEventsNotice } from "./UnrecognizedEventsNotice";

export interface DataValidityBoxProps {
  runs: Run[];
  logFilesById: Map<string, LogFile>;
}

export function DataValidityBox({ runs, logFilesById }: DataValidityBoxProps) {
  const noteCount = runs.reduce(
    (total, run) =>
      total +
      run.dataQualityNotes.length +
      run.rejectedToolCalls.filter((o) => o.decision === "rejected").length,
    0,
  );

  if (noteCount === 0) {
    return (
      <>
        {runs.map((run) => {
          const logFile = logFilesById.get(run.sourceLogFileId);
          return logFile ? (
            <UnrecognizedEventsNotice
              key={run.id}
              runLabel={run.label}
              unrecognizedEventCount={logFile.unrecognizedEventCount}
            />
          ) : null;
        })}
      </>
    );
  }

  return (
    <div className="card data-validity-box">
      <p className="data-validity-heading">
        <span aria-hidden="true">⚠</span> {noteCount} data-validity note{noteCount === 1 ? "" : "s"}
      </p>
      <ul className="data-validity-list">
        {runs.map((run) => (
          <li key={run.id}>
            {run.dataQualityNotes.map((note) => (
              <DataQualityNoteBadge key={note.type} note={note} />
            ))}
            {run.rejectedToolCalls.map((outcome) => (
              <RejectedCallBadge key={outcome.toolUseId} outcome={outcome} />
            ))}
          </li>
        ))}
      </ul>
      {runs.map((run) => {
        const logFile = logFilesById.get(run.sourceLogFileId);
        return logFile ? (
          <UnrecognizedEventsNotice
            key={run.id}
            runLabel={run.label}
            unrecognizedEventCount={logFile.unrecognizedEventCount}
          />
        ) : null;
      })}
    </div>
  );
}
