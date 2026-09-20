import type { ToolCallOutcome } from "../types";

export interface RejectedCallBadgeProps {
  outcome: ToolCallOutcome;
}

export function RejectedCallBadge({ outcome }: RejectedCallBadgeProps) {
  if (outcome.decision !== "rejected") return null;
  return (
    <span className="rejected-call-badge" role="status">
      Rejected: {outcome.toolName} (not a failure, not a completed call)
    </span>
  );
}
