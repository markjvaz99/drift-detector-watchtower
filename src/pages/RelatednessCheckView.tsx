import type { PairwiseRelatedness, RelatednessAssessment, Run } from "../types";

export interface RelatednessCheckViewProps {
  assessment: RelatednessAssessment;
  runsById: Map<string, Run>;
  onContinue: () => void;
  onViewIndividually: () => void;
}

const RATING_LABEL: Record<PairwiseRelatedness["confidence"], string> = {
  related: "Related",
  partial: "Review recommended",
  unrelated: "Unrelated",
};

function runLabel(runsById: Map<string, Run>, runId: string): string {
  return runsById.get(runId)?.label ?? runId;
}

export function RelatednessCheckView({
  assessment,
  runsById,
  onContinue,
  onViewIndividually,
}: RelatednessCheckViewProps) {
  const clusterRunIds = new Set(assessment.clusters.flatMap((cluster) => cluster.runIds));
  const standalonePairs = assessment.pairs.filter(
    (pair) => pair.confidence !== "related" || !clusterRunIds.has(pair.runIdA),
  );

  return (
    <div className="relatedness-check-view">
      <h1>Checking task relatedness across {assessment.runIds.length} runs</h1>

      {assessment.clusters.map((cluster) => (
        <div key={cluster.runIds.join(",")} className="relatedness-row" data-rating="related">
          <span>{cluster.runIds.map((id) => runLabel(runsById, id)).join(", ")}</span>
          <span>{RATING_LABEL.related}</span>
          <p>{cluster.pairwiseDetails[0]?.reasoning}</p>
        </div>
      ))}

      {standalonePairs.map((pair) => (
        <div
          key={`${pair.runIdA}-${pair.runIdB}`}
          className="relatedness-row"
          data-rating={pair.confidence}
        >
          <span>
            {runLabel(runsById, pair.runIdA)}, {runLabel(runsById, pair.runIdB)}
          </span>
          <span>{RATING_LABEL[pair.confidence]}</span>
          <p>{pair.reasoning}</p>
        </div>
      ))}

      <button type="button" onClick={onContinue}>
        Continue to comparison
      </button>
      {assessment.hasAnyBelowFullConfidence && (
        <button type="button" onClick={onViewIndividually}>
          View runs individually instead
        </button>
      )}
    </div>
  );
}
