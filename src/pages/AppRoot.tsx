import { useMemo, useState } from "react";
import { useSessionStore } from "../state/sessionStore";
import { UploadPanel } from "../components/UploadPanel";
import { SingleRunView } from "./SingleRunView";
import { RelatednessCheckView } from "./RelatednessCheckView";
import { ComparisonView } from "./ComparisonView";
import { buildRelatednessAssessment } from "../relatedness/buildRelatednessAssessment";
import { getRecentComparison } from "../state/localHistoryStore";
import { EvidenceIndex } from "../parsing/evidenceIndex";
import type { Comparison, RelatednessAssessment, Run } from "../types";

type ViewMode = "check" | "comparison" | "individual";

export function AppRoot() {
  const logFiles = useSessionStore((state) => state.logFiles);
  const runs = useSessionStore((state) => state.runs);
  const evidenceIndex = useSessionStore((state) => state.evidenceIndex);
  const [viewMode, setViewMode] = useState<ViewMode>("check");
  const [reopened, setReopened] = useState<{ comparison: Comparison; runs: Run[] } | null>(null);

  const logFilesById = useMemo(() => new Map(logFiles.map((lf) => [lf.id, lf])), [logFiles]);
  const runsById = useMemo(() => new Map(runs.map((run) => [run.id, run])), [runs]);

  const relatednessAssessment: RelatednessAssessment | null = useMemo(
    () => (runs.length >= 2 ? buildRelatednessAssessment(runs, logFilesById) : null),
    [runs, logFilesById],
  );

  if (reopened) {
    return (
      <ComparisonView
        runs={reopened.runs}
        logFilesById={new Map()}
        relatednessAssessment={reopened.comparison.relatednessAssessment}
        evidenceIndex={new EvidenceIndex()}
        precomputedComparison={reopened.comparison}
      />
    );
  }

  if (runs.length === 0) {
    return (
      <UploadPanel
        onOpenRecent={(id) => {
          void getRecentComparison(id).then((result) => {
            if (result) setReopened(result);
          });
        }}
        onImportReport={(result) => setReopened(result)}
      />
    );
  }

  if (runs.length === 1) {
    return <SingleRunView logFile={logFiles[0]} run={runs[0]} />;
  }

  if (viewMode === "individual") {
    return (
      <div>
        {runs.map((run, index) => (
          <SingleRunView key={run.id} logFile={logFiles[index]} run={run} />
        ))}
      </div>
    );
  }

  if (viewMode === "check" && relatednessAssessment) {
    return (
      <RelatednessCheckView
        assessment={relatednessAssessment}
        runsById={runsById}
        onContinue={() => setViewMode("comparison")}
        onViewIndividually={() => setViewMode("individual")}
      />
    );
  }

  return (
    <ComparisonView
      runs={runs}
      logFilesById={logFilesById}
      relatednessAssessment={relatednessAssessment}
      evidenceIndex={evidenceIndex}
    />
  );
}
