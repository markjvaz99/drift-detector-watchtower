# Phase 1 Data Model: Telemetry Drift Detector

Uploaded logs and in-progress parsing state are in-memory only. Once a comparison is complete, its computed report (never the raw uploaded file contents) may be written to the browser's local IndexedDB store so it can be exported and reopened later (FR-31, FR-32) — see `RecentComparisonEntry` below. Nothing in this model is ever transmitted to a server (FR-30).

## LogFile

One uploaded `.jsonl` OTLP export.

| Field | Type | Notes |
|---|---|---|
| `id` | string | Derived locally (e.g., filename + upload order); never sent anywhere |
| `fileName` | string | As provided by the browser file picker |
| `sessionIdentifier` | string | From the log's session metadata |
| `buildVersion` | string | Claude Code build version that produced the log |
| `workingDirectory` | string | Project path recorded at session start |
| `startingRepositoryState` | `RepositoryState` | Extracted from the embedded git-status system reminder (FR-7b) |
| `events` | `OrderedEvent[]` | Flattened, sequence-ordered (FR-2, FR-3) |
| `unrecognizedEventCount` | number | Count of event types not recognized by the current schema mapping (Edge Cases; degrade gracefully) |

## RepositoryState

| Field | Type | Notes |
|---|---|---|
| `branch` | string \| null | |
| `headCommit` | string \| null | |
| `workingDirectory` | string | |

## OrderedEvent

A flattened log record with its typed-attribute envelope already unwrapped (FR-2).

| Field | Type | Notes |
|---|---|---|
| `sequence` | number | Meaningful only within its own `LogFile` (FR-3) — never compared across files |
| `timestamp` | string (ISO) | |
| `type` | string | e.g., `tool_decision`, `tool_result`, `user_prompt`, `api_call` |
| `queryType` | string \| null | e.g., `generate_session_title`, `prompt_suggestion`, `away_summary` (FR-4 exclusions) |
| `attributes` | `Record<string, string \| number \| boolean \| unknown[]>` | Unwrapped from `stringValue`/`intValue`/`doubleValue`/`boolValue`/`arrayValue` |

## Run

The unit of comparison. Normally one `LogFile` = one `Run`, but a file containing more than one real task prompt (FR-5) is still scoped as a single `Run` carrying an attached `DataQualityNote`, per the resolved behavior in User Story 3.

| Field | Type | Notes |
|---|---|---|
| `id` | string | |
| `sourceLogFileId` | string | FK to `LogFile` |
| `label` | string | Stable, human-readable label (e.g., "Run 1"), assigned in upload order and used consistently across every view (FR-38) |
| `taskPromptText` | string | The captured `user_prompt` content used by the relatedness check (FR-7a) |
| `dataQualityNotes` | `DataQualityNote[]` | e.g., resent-prompt detection (FR-5) |
| `rejectedToolCalls` | `ToolCallOutcome[]` | Decided-but-never-executed calls (FR-6) |

## DataQualityNote

| Field | Type | Notes |
|---|---|---|
| `type` | `"resent-prompt"` \| `"aborted-session"` \| `"schema-mismatch"` | Extensible |
| `description` | string | Human-readable |
| `estimatedCostImpact` | number \| null | Required for `resent-prompt` (FR-5) |
| `estimatedTurnImpact` | number \| null | Required for `resent-prompt` (FR-5) |
| `evidenceRefs` | `EvidenceReference[]` | |

## ToolCallOutcome

| Field | Type | Notes |
|---|---|---|
| `toolUseId` | string | Pairing key between `tool_decision` and `tool_result` (FR-6) |
| `toolName` | string | |
| `decision` | `"approved"` \| `"rejected"` | |
| `executed` | boolean | `false` when decided but never run |
| `result` | `"success"` \| `"failure"` \| `null` | `null` when not executed |

## PairwiseRelatedness

Computed for every pair of loaded runs (FR-7; research.md §5, §7). For N runs, there are up to N·(N-1)/2 of these.

| Field | Type | Notes |
|---|---|---|
| `runIdA` / `runIdB` | string | The two runs assessed together |
| `confidence` | `"related"` \| `"partial"` \| `"unrelated"` | Displayed as "Related" / "Review recommended" / "Unrelated" (FR-8) — always advisory, never blocks the comparison |
| `promptSimilarityScore` | number (0–1) | From the client-side text-similarity heuristic (research.md §5) |
| `repositoryStateComparison` | string | e.g., "same repo, different commit" |
| `workingDirectoryComparison` | string | e.g., "same project path" |
| `reasoning` | string | Human-readable explanation shown by default alongside the rating, not gated behind a request (FR-10) |

## RelatednessCluster

Groups mutually "related" runs for display when N > 2, via transitive closure over `PairwiseRelatedness` entries rated `"related"` (research.md §7).

| Field | Type | Notes |
|---|---|---|
| `runIds` | string[] | The runs in this cluster (2 or more) |
| `pairwiseDetails` | `PairwiseRelatedness[]` | The underlying pairs that formed this cluster, kept available on request |

## RelatednessAssessment

The full relatedness picture for a candidate comparison set — the Relatedness Check screen renders directly from this.

| Field | Type | Notes |
|---|---|---|
| `runIds` | string[] | All runs assessed together |
| `pairs` | `PairwiseRelatedness[]` | Every pair's individual rating and reasoning (FR-7) |
| `clusters` | `RelatednessCluster[]` | Pairs grouped for display when N > 2; for N = 2 this is just the single pair |
| `hasAnyBelowFullConfidence` | boolean | `true` if any pair is `"partial"` or `"unrelated"` — drives the persistent dashboard reminder badge (FR-9) and the "view runs individually instead" option |

## Metric

A named, computed quantity with a defined formula and denominator (FR-23). See `contracts/metric-formulas.md` for the authoritative formula list (FR-15–FR-22).

| Field | Type | Notes |
|---|---|---|
| `key` | string | e.g., `cache_creation_per_edit_call` |
| `label` | string | Display name |
| `valuesByRun` | `Map<runId, number \| "not-available">` | "not-available" per Edge Cases when a metric can't be computed for a run |
| `denominatorLabel` | string | Always shown alongside the value (FR-23) |

## GroupStatistics

Computed per metric when N ≥ 2 (FR-11).

| Field | Type | Notes |
|---|---|---|
| `metricKey` | string | |
| `median` | number | |
| `min` | number | |
| `max` | number | |
| `spread` | number | Spread measure used as the basis for drift thresholds (FR-24) |
| `deviationByRun` | `Map<runId, number>` | Each run's deviation from the median |
| `outlierRunIds` | string[] | Run(s) furthest from central tendency (FR-12) |

## ConfoundFinding

A specific, evidenced reason a metric or run should be interpreted carefully (FR-28, FR-29).

| Field | Type | Notes |
|---|---|---|
| `type` | `"resent-prompt"` \| `"mismatched-repo-state"` \| `"approval-wait-dominated"` \| `"schema-version-mismatch"` | The named types that force "uninterpretable" per FR-29 are the first three |
| `affectedRunIds` | string[] | |
| `affectedMetricKeys` | string[] | |
| `description` | string | |
| `evidenceRefs` | `EvidenceReference[]` | |
| `forcesUninterpretable` | boolean | `true` for the FR-29 named types |

## DriftClassification

The severity label attached to a metric within a `Comparison` (FR-24).

| Field | Type | Notes |
|---|---|---|
| `metricKey` | string | |
| `severity` | `"no-drift"` \| `"moderate"` \| `"large"` \| `"categorical"` \| `"cannot-determine"` \| `"uninterpretable"` | |
| `basis` | string | e.g., "2.4× group median deviation" — the stated threshold basis (FR-24) |
| `overriddenByConfound` | `ConfoundFinding` \| null | Set when FR-29 forces "uninterpretable" |

## Comparison

A set of 1–N runs plus, for N ≥ 2, the computed classifications and statistics. Can be exported to a local file and reopened later from a local recent-comparisons history (FR-31, FR-32) — see `RecentComparisonEntry`.

| Field | Type | Notes |
|---|---|---|
| `runIds` | string[] | 1 to N |
| `title` | string | Auto-generated, human-readable title (e.g., derived from the shared task description) shown in navigation elements (FR-37) |
| `relatednessAssessment` | `RelatednessAssessment` \| null | `null` when only one run is loaded (User Story 1) |
| `metrics` | `Metric[]` | Every computed metric, regardless of drift status (FR-27) |
| `groupStatistics` | `GroupStatistics[]` | Present when N ≥ 2 |
| `driftClassifications` | `DriftClassification[]` | |
| `headlineMetricKeys` | string[] | Top 6 by relative magnitude of change, ranked (FR-26); empty + "no drift detected" message when none qualify (FR-25) |
| `pinnedMetricKeys` | string[] | User-pinned metrics always included in the headline section (FR-25) |
| `dominantDriverFinding` | `DominantDriverFinding` \| null | Present when N ≥ 2 (User Story 7); `null` for a single-run `Comparison` |
| `sessionSummary` | `SessionSummary` \| null | Present only for a single-run `Comparison` (N = 1), in place of `dominantDriverFinding` |

## DominantDriverFinding

The single metric identified as contributing most to a comparison's largest drift, or an explicit "none found" result (FR-33, FR-34; `contracts/dominant-driver-rules.md`).

| Field | Type | Notes |
|---|---|---|
| `hasDominantDriver` | boolean | `false` when no metric's deviation clearly dominates the others |
| `metricKey` | string \| null | The dominant metric's key, or `null` when `hasDominantDriver` is `false` |
| `explanation` | string | The generated, template-composed explanation sentence(s) (FR-33), or the fixed "no single dominant driver identified" message (FR-34) |
| `supportingEvidence` | `EvidenceReference[]` | The specific tool calls/events cited as evidence |
| `supportingNumbers` | number[] | 2–3 numbers drawn from the dominant metric's data, cited in the explanation |

## SessionSummary

A plain, non-comparative summary of a single run's own characteristics, shown in place of `DominantDriverFinding` when N = 1 (FR-35).

| Field | Type | Notes |
|---|---|---|
| `runId` | string | |
| `summaryText` | string | Generated locally from the run's own headline metrics; no causal or comparison language (FR-36) |
| `supportingNumbers` | number[] | 2–3 numbers drawn from the run's own metrics, cited in the summary |

## RecentComparisonEntry

One entry in the local, in-browser recent-comparisons history (FR-31), stored in IndexedDB and readable from the upload screen.

| Field | Type | Notes |
|---|---|---|
| `id` | string | |
| `title` | string | Copied from `Comparison.title` |
| `runLabels` | string[] | Copied from each run's `Run.label` |
| `createdAt` | string (ISO timestamp) | When the comparison was generated/exported |
| `reportPayload` | `Comparison` (serialized) | The full computed report needed to reopen without re-uploading (FR-32) — see `contracts/export-format.md` for the exact serialized shape and version field. Never includes raw `LogFile`/event content. |

## EvidenceReference

Supports drill-down/audit traceability (NFR-1, SC-003).

| Field | Type | Notes |
|---|---|---|
| `logFileId` | string | |
| `sequence` | number | Meaningful within `logFileId` only |
| `sessionIdentifier` | string | |
