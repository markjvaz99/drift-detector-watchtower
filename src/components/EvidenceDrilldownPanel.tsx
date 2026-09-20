import type { EvidenceIndex } from "../parsing/evidenceIndex";
import type { EvidenceReference } from "../types";

export interface EvidenceDrilldownPanelProps {
  evidenceRefs: EvidenceReference[];
  evidenceIndex: EvidenceIndex;
  sourceUnavailable?: boolean;
}

export function EvidenceDrilldownPanel({
  evidenceRefs,
  evidenceIndex,
  sourceUnavailable = false,
}: EvidenceDrilldownPanelProps) {
  if (evidenceRefs.length === 0) {
    return (
      <p role="status">
        {sourceUnavailable
          ? "Original log file not available — showing already-computed values only."
          : "No raw evidence available for this value."}
      </p>
    );
  }

  return (
    <div className="evidence-drilldown-panel" role="region" aria-label="Evidence">
      {evidenceRefs.map((ref) => {
        const event = evidenceIndex.resolve(ref);
        return (
          <div key={`${ref.logFileId}-${ref.sequence}`} className="evidence-row">
            <span>
              {ref.logFileId} · seq {ref.sequence} · session {ref.sessionIdentifier}
            </span>
            {event && <span>{event.type}</span>}
          </div>
        );
      })}
    </div>
  );
}
