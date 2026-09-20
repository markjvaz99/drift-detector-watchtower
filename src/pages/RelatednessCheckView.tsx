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

const RATING_CLASS: Record<PairwiseRelatedness["confidence"], string> = {
  related: "signal-badge--neutral",
  partial: "signal-badge--moderate",
  unrelated: "signal-badge--large",
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
    <div className="relatedness-check-view app-shell">
      <header className="app-header">
        <div className="app-header-title">
          <span className="app-header-logo">
            <span className="app-header-logo-mark" />
            DRIFT
          </span>
        </div>
      </header>

      <h1 className="page-heading">Checking task relatedness across {assessment.runIds.length} runs</h1>

      <div className="relatedness-rows">
        {assessment.clusters.map((cluster) => (
          <div key={cluster.runIds.join(",")} className="relatedness-row card" data-rating="related">
            <div className="relatedness-row-header">
              <span className="relatedness-row-runs">{cluster.runIds.map((id) => runLabel(runsById, id)).join(", ")}</span>
              <span className={`signal-badge ${RATING_CLASS.related}`}>{RATING_LABEL.related}</span>
            </div>
            <p className="relatedness-row-reasoning">{cluster.pairwiseDetails[0]?.reasoning}</p>
          </div>
        ))}

        {standalonePairs.map((pair) => (
          <div
            key={`${pair.runIdA}-${pair.runIdB}`}
            className="relatedness-row card"
            data-rating={pair.confidence}
          >
            <div className="relatedness-row-header">
              <span className="relatedness-row-runs">
                {runLabel(runsById, pair.runIdA)}, {runLabel(runsById, pair.runIdB)}
              </span>
              <span className={`signal-badge ${RATING_CLASS[pair.confidence]}`}>{RATING_LABEL[pair.confidence]}</span>
            </div>
            <p className="relatedness-row-reasoning">{pair.reasoning}</p>
          </div>
        ))}
      </div>

      <div className="relatedness-actions">
        <button type="button" className="btn btn-primary" onClick={onContinue}>
          Continue to comparison
        </button>
        {assessment.hasAnyBelowFullConfidence && (
          <button type="button" className="btn" onClick={onViewIndividually}>
            View runs individually instead
          </button>
        )}
      </div>
    </div>
  );
}
