import type { RelatednessAssessment, Run } from "../types";

export interface RelatednessReminderBadgeProps {
  assessment: RelatednessAssessment | null;
  runsById: Map<string, Run>;
}

export function RelatednessReminderBadge({ assessment, runsById }: RelatednessReminderBadgeProps) {
  if (!assessment || !assessment.hasAnyBelowFullConfidence) return null;

  const affectedPairs = assessment.pairs.filter((pair) => pair.confidence !== "related");

  return (
    <div className="relatedness-reminder-badge card" role="note">
      {affectedPairs.map((pair) => (
        <p key={`${pair.runIdA}-${pair.runIdB}`} className="relatedness-reminder-line">
          {runsById.get(pair.runIdA)?.label ?? pair.runIdA} and{" "}
          {runsById.get(pair.runIdB)?.label ?? pair.runIdB}: {pair.reasoning}
        </p>
      ))}
    </div>
  );
}
