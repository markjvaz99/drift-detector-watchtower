export type AttributeValue = string | number | boolean | AttributeValue[];

export interface RepositoryState {
  branch: string | null;
  headCommit: string | null;
  workingDirectory: string;
}

export interface OrderedEvent {
  sequence: number;
  timestamp: string;
  type: string;
  queryType: string | null;
  attributes: Record<string, AttributeValue>;
}

export interface LogFile {
  id: string;
  fileName: string;
  sessionIdentifier: string;
  buildVersion: string;
  workingDirectory: string;
  startingRepositoryState: RepositoryState;
  events: OrderedEvent[];
  unrecognizedEventCount: number;
}

export type DataQualityNoteType = "resent-prompt" | "aborted-session" | "schema-mismatch";

export interface EvidenceReference {
  logFileId: string;
  sequence: number;
  sessionIdentifier: string;
}

export interface DataQualityNote {
  type: DataQualityNoteType;
  description: string;
  estimatedCostImpact: number | null;
  estimatedTurnImpact: number | null;
  evidenceRefs: EvidenceReference[];
}

export type ToolDecision = "approved" | "rejected";
export type ToolResultOutcome = "success" | "failure" | null;

export interface ToolCallOutcome {
  toolUseId: string;
  toolName: string;
  decision: ToolDecision;
  executed: boolean;
  result: ToolResultOutcome;
  decisionSequence: number;
  resultSequence: number | null;
}

export interface Run {
  id: string;
  sourceLogFileId: string;
  label: string;
  taskPromptText: string;
  dataQualityNotes: DataQualityNote[];
  rejectedToolCalls: ToolCallOutcome[];
  hasCompletedTaskActivity: boolean;
}

export type MetricValue = number | "not-available";

export interface Metric {
  key: string;
  label: string;
  valuesByRun: Map<string, MetricValue>;
  denominatorLabel: string;
}

export type RelatednessConfidence = "related" | "partial" | "unrelated";

export interface PairwiseRelatedness {
  runIdA: string;
  runIdB: string;
  confidence: RelatednessConfidence;
  promptSimilarityScore: number;
  repositoryStateComparison: string;
  workingDirectoryComparison: string;
  reasoning: string;
}

export interface RelatednessCluster {
  runIds: string[];
  pairwiseDetails: PairwiseRelatedness[];
}

export interface RelatednessAssessment {
  runIds: string[];
  pairs: PairwiseRelatedness[];
  clusters: RelatednessCluster[];
  hasAnyBelowFullConfidence: boolean;
}

export interface GroupStatistics {
  metricKey: string;
  median: number;
  min: number;
  max: number;
  spread: number;
  deviationByRun: Map<string, number>;
  outlierRunIds: string[];
}

export type ConfoundType =
  | "resent-prompt"
  | "mismatched-repo-state"
  | "approval-wait-dominated"
  | "schema-version-mismatch";

export interface ConfoundFinding {
  type: ConfoundType;
  affectedRunIds: string[];
  affectedMetricKeys: string[];
  description: string;
  evidenceRefs: EvidenceReference[];
  forcesUninterpretable: boolean;
}

export type DriftSeverity =
  | "no-drift"
  | "moderate"
  | "large"
  | "categorical"
  | "cannot-determine"
  | "uninterpretable";

export interface DriftClassification {
  metricKey: string;
  severity: DriftSeverity;
  basis: string;
  overriddenByConfound: ConfoundFinding | null;
}

export interface DominantDriverFinding {
  hasDominantDriver: boolean;
  metricKey: string | null;
  explanation: string;
  supportingEvidence: EvidenceReference[];
  supportingNumbers: number[];
}

export interface SessionSummary {
  runId: string;
  summaryText: string;
  supportingNumbers: number[];
}

export interface Comparison {
  runIds: string[];
  title: string;
  relatednessAssessment: RelatednessAssessment | null;
  metrics: Metric[];
  groupStatistics: GroupStatistics[];
  driftClassifications: DriftClassification[];
  headlineMetricKeys: string[];
  pinnedMetricKeys: string[];
  dominantDriverFinding: DominantDriverFinding | null;
  sessionSummary: SessionSummary | null;
}

export interface RecentComparisonEntry {
  id: string;
  title: string;
  runLabels: string[];
  createdAt: string;
  reportPayload: Comparison;
}
