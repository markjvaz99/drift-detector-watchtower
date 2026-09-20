import type { DataQualityNote } from "../types";

export interface DataQualityNoteBadgeProps {
  note: DataQualityNote;
}

export function DataQualityNoteBadge({ note }: DataQualityNoteBadgeProps) {
  return (
    <div className="data-quality-note-badge" role="note">
      <p>{note.description}</p>
      {note.estimatedCostImpact !== null && (
        <span>Estimated cost impact: ${note.estimatedCostImpact.toFixed(4)}</span>
      )}
      {note.estimatedTurnImpact !== null && (
        <span>Estimated turn impact: {note.estimatedTurnImpact}</span>
      )}
    </div>
  );
}
