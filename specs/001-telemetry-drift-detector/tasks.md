---
description: "Task list for Telemetry Drift Detector implementation"
---

# Tasks: Telemetry Drift Detector

**Input**: Design documents from `/specs/001-telemetry-drift-detector/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md (all present; this list supersedes the previous tasks.md, regenerated after the UI Design Reconciliation pass and the follow-up `/speckit-plan` update)

**Tests**: Included. `plan.md` commits to a Vitest (contract/unit) + React Testing Library (integration) + Playwright (e2e) strategy, and `contracts/` was written specifically to be verified by contract tests, so test tasks are generated alongside implementation tasks throughout.

**Organization**: Tasks are grouped by user story (from `spec.md`, now 7 stories) to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (US1–US7)
- All file paths are relative to the repository root and match `plan.md`'s Project Structure

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization per `plan.md`'s Technical Context (TypeScript + React + Vite, client-only, no backend, local IndexedDB persistence)

- [X] T001 Create the project structure from `plan.md` (`src/parsing/`, `src/relatedness/`, `src/metrics/`, `src/drift/`, `src/dominant-driver/`, `src/reporting/`, `src/workers/`, `src/components/`, `src/pages/`, `src/state/`, `tests/contract/`, `tests/unit/`, `tests/integration/`, `tests/e2e/`, `tests/fixtures/`)
- [X] T002 Initialize the TypeScript 5.x + React 18 + Vite project (`package.json`, `tsconfig.json` in ES2022/strict mode, `vite.config.ts`) with dependencies: `react`, `react-dom`, `recharts`, `zustand`, `idb`, and dev dependencies `vitest`, `@testing-library/react`, `@playwright/test`, `typescript`
- [X] T003 [P] Configure ESLint + Prettier for the TypeScript/React codebase (`.eslintrc`, `.prettierrc`)
- [X] T004 [P] Configure `vitest.config.ts` (unit/contract/integration) and `playwright.config.ts` (e2e) with corresponding `npm run test:unit`, `test:contract`, `test:integration`, `test:e2e` scripts in `package.json`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The shared ingestion pipeline, worker infrastructure, and session state that every user story depends on — no story can show anything without a parsed, labeled `Run`.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T005 [P] Implement the typed-value envelope unwrapper in `src/parsing/unwrapAttributes.ts`, mapping `stringValue`→string, `intValue`/`doubleValue`→number, `boolValue`→boolean, `arrayValue`→recursively-unwrapped array, per `contracts/input-log-schema.md`
- [X] T006 [P] Implement the newline-delimited `.jsonl` reader in `src/parsing/readJsonl.ts` that parses one JSON object per line without assuming the whole file is a single JSON document (`contracts/input-log-schema.md`), remaining usable from a few hundred lines up to files several MB in size (FR-1)
- [X] T007 Implement log-record flattening in `src/parsing/flattenLogRecords.ts` for the `resourceLogs[].scopeLogs[].logRecords[]` structure, unwrapping each record's attributes via T005 (depends on T005) (FR-2)
- [X] T008 Implement per-file event sequencing in `src/parsing/sequenceEvents.ts` that sorts events by `event.sequence` and never compares/merges `sequence` values across files (depends on T007) (FR-3)
- [X] T009 [P] Implement non-task API call exclusion in `src/parsing/excludeNonTaskCalls.ts`, excluding `query_source` values `generate_session_title`, `prompt_suggestion`, `away_summary` from main-task metrics while retaining their cost/token totals separately for full-session accounting (FR-4)
- [X] T010 [P] Implement resent-prompt detection in `src/parsing/detectResentPrompt.ts`, producing a `DataQualityNote` with `type: "resent-prompt"` and non-null `estimatedCostImpact`/`estimatedTurnImpact` per `data-model.md` when a session contains more than one real `user_prompt` event (FR-5)
- [X] T011 [P] Implement `tool_decision`↔`tool_result` pairing by `tool_use_id` in `src/parsing/pairToolCalls.ts`, producing a `ToolCallOutcome` per `data-model.md` with `decision: "approved" | "rejected"` and `executed: boolean`, where a `rejected` decision with no matching `tool_result` MUST have `executed: false` and `result: null` (never counted as a completed call or a failure) (FR-6)
- [X] T012 [P] Implement truncation-marker detection and true-length reconstruction in `src/parsing/reconstructTruncatedLength.ts` per `contracts/input-log-schema.md` (feeds FR-22 code-volume metrics)
- [X] T013 Extend `src/parsing/flattenLogRecords.ts` (depends on T007) to tolerate unrecognized event types: increment `LogFile.unrecognizedEventCount` for each and continue parsing the rest of the file without corruption or silent miscounting (Edge Cases — graceful schema-version degradation)
- [X] T014 Compose the full ingestion pipeline into `buildRun(logFile): { logFile: LogFile, run: Run }` in `src/parsing/buildRun.ts`, wiring T006, T008–T013 together per the `LogFile`/`Run` shapes in `data-model.md` (depends on T006, T008, T009, T010, T011, T012, T013)
- [X] T015 [P] Implement the evidence lookup index in `src/parsing/evidenceIndex.ts` resolving an `EvidenceReference { logFileId, sequence, sessionIdentifier }` to its raw source event, supporting drill-down (NFR-1, SC-003)
- [X] T016 Wrap `buildRun()` in a Web Worker at `src/workers/parseLogWorker.ts` so ingestion/analysis run off the main thread per file (depends on T014) (research.md §3, SC-008)
- [X] T017 [P] Implement the in-memory session store in `src/state/sessionStore.ts` (Zustand) holding uploaded `LogFile`/`Run` state for the current browser tab
- [X] T018 Build the shared `UploadPanel` component in `src/components/UploadPanel.tsx` accepting an arbitrary number of `.jsonl` files (FR-1, no fixed maximum) and dispatching each to the worker from T016 (depends on T016)
- [X] T019 Add a runtime assertion module `src/parsing/assertNoNetworkEgress.ts` that fails loudly (thrown error in dev/test builds) if any ingestion/analysis code path attempts a `fetch`/`XMLHttpRequest` call, enforcing that log content is never transmitted off-device (FR-30) (depends on T006, T014)
- [X] T020 Assign each `Run` a stable, human-readable `label` (e.g., "Run 1," "Run 2," … in upload order, per `data-model.md`) in `src/state/sessionStore.ts` when runs are added to session state, used consistently across every later view (FR-38) (depends on T017, T014)

**Checkpoint**: Foundation ready — user story implementation can now begin.

---

## Phase 3: User Story 1 - View a Single Run's Metrics (Priority: P1) 🎯 MVP

**Goal**: Upload exactly one log and see that run's own metrics (tokens, cost, tool usage, timing breakdown) with no comparison/drift language.

**Independent Test**: Upload one `.jsonl` file and verify the report shows per-run efficiency, timing, tool-usage, and cost metrics with no "drift"/"vs."/comparison UI present; upload an aborted-session log and verify a plain "no completed task activity" message instead of zeroed metrics.

### Tests for User Story 1

- [X] T021 [P] [US1] Contract test verifying `buildRun()` output matches `contracts/input-log-schema.md` (flattening, sequencing, tool-call pairing) against `tests/fixtures/single-run-normal.jsonl` in `tests/contract/parsing.contract.test.ts`
- [X] T022 [P] [US1] Contract test for every Efficiency formula in `contracts/metric-formulas.md` (FR-15) against a fixed fixture in `tests/contract/metrics-efficiency.contract.test.ts`
- [X] T023 [P] [US1] Contract test for the Duration breakdown formula (total/approval-wait/other-idle/active, FR-16) against a fixed fixture in `tests/contract/metrics-duration.contract.test.ts`
- [X] T024 [P] [US1] Integration test: uploading `tests/fixtures/single-run-normal.jsonl` renders per-run metrics with zero occurrences of drift/comparison language in `tests/integration/single-run-view.test.ts`
- [X] T025 [P] [US1] Integration test: uploading `tests/fixtures/single-run-aborted.jsonl` (zero completed task turns) renders the "no completed task activity found" state, not zeroed/misleading metrics, in `tests/integration/single-run-aborted.test.ts`

### Implementation for User Story 1

- [X] T026 [P] [US1] Implement the efficiency metrics calculator in `src/metrics/efficiency.ts` per `contracts/metric-formulas.md` (turns, input/output/cache-read/cache-creation tokens, tokens per turn, total tokens incl. cache, cost, tool calls, tool calls per turn), attaching each ratio's denominator per FR-23
- [X] T027 [P] [US1] Implement the duration breakdown calculator in `src/metrics/duration.ts` (total wall-clock, approval-wait time from `tool_decision.source` values indicating human approval e.g. `user_temporary`/`user_reject`, other idle gaps above threshold, active time) per FR-16
- [X] T028 [P] [US1] Implement the cache-creation intensity calculator in `src/metrics/cacheIntensity.ts` (total new context tokens, normalized per Read call / per Edit call / per tool call) per FR-17
- [X] T029 [P] [US1] Implement the overhead-ratio trend calculator in `src/metrics/overheadTrend.ts` (cache-read ÷ output tokens across 4 equal-sized quartiles, more buckets for very long runs) per FR-18
- [X] T030 [P] [US1] Implement the tool-usage composition calculator in `src/metrics/toolUsage.ts` (counts by tool name including connector/skill-type tools) per FR-19
- [X] T031 [P] [US1] Implement the error/recovery calculator in `src/metrics/errorRecovery.ts` (failed-call count/rate, rejection count kept distinct from failures per T011's `ToolCallOutcome`, immediate-recovery detection) per FR-20
- [X] T032 [P] [US1] Implement the exploration/validation/implementation ratio calculator in `src/metrics/activityRatios.ts`, exposing its categorization ruleset (which tool names/command patterns map to which category) for on-request display per FR-21
- [X] T033 [P] [US1] Implement the code-volume calculator in `src/metrics/codeVolume.ts` (net characters added/removed by edits and file creation), using T012's truncation-corrected lengths, per FR-22
- [X] T034 [US1] Compose per-run `Metric[]` objects in `src/metrics/computeRunMetrics.ts`, wiring T026–T033 together, always attaching `denominatorLabel` and refusing to compute a "per successful completion" metric without an independently verified success signal (report the raw numerator instead) per FR-23 (depends on T026, T027, T028, T029, T030, T031, T032, T033)
- [X] T035 [US1] Build `SingleRunView` page in `src/pages/SingleRunView.tsx` rendering T034's metrics with no drift/comparison UI anywhere (depends on T034)
- [X] T036 [US1] Add the zero-completed-task-turns empty state in `src/components/EmptyRunState.tsx`, wired into `SingleRunView.tsx` (depends on T035)
- [X] T037 [US1] Wire `UploadPanel` (T018) into `src/pages/AppRoot.tsx` so that exactly one uploaded file routes to `SingleRunView` (depends on T018, T036)

**Checkpoint**: User Story 1 is fully functional and independently testable.

---

## Phase 4: User Story 2 - Detect Whether Uploaded Runs Are Actually Comparable (Priority: P1)

**Goal**: Whenever 2+ logs are uploaded, always show a Relatedness Check step rating each pair/cluster (Related / Review recommended / Unrelated) with reasoning shown by default. The check is advisory only — "Continue to comparison" is always available, "view runs individually instead" is offered whenever any pair is below full confidence, and a reminder badge persists on the dashboard afterward.

**Independent Test**: Upload two logs describing unrelated tasks and verify the Relatedness Check screen rates the pair "Unrelated" with reasoning shown, while "Continue to comparison" remains available; upload two logs describing the same task on the same repo and verify a "Related" rating with no dashboard reminder afterward; upload 4 logs where 3 are related and 1 is not, and verify the screen shows a cluster row plus a separate row for the unrelated run.

### Tests for User Story 2

- [X] T038 [P] [US2] Contract test for the pairwise relatedness rating table (`"related"` → "Related", `"partial"` → "Review recommended", `"unrelated"` → "Unrelated") in `tests/contract/relatedness.contract.test.ts` per `contracts/drift-classification-rules.md`
- [X] T039 [P] [US2] Contract test for clustering "related"-rated pairs via transitive closure (A–B and B–C both "related" ⇒ one cluster {A,B,C}) in `tests/contract/relatedness-clustering.contract.test.ts` per `research.md` §7
- [X] T040 [P] [US2] Integration test: `tests/fixtures/two-runs-unrelated/` rates the pair "Unrelated" with reasoning shown by default, "Continue to comparison" enabled, and "view runs individually instead" offered, in `tests/integration/relatedness-unrelated.test.ts`
- [X] T041 [P] [US2] Integration test: `tests/fixtures/two-runs-partial/` rates the pair "Review recommended," and after continuing, the comparison dashboard shows a persistent reminder badge referencing that pair, in `tests/integration/relatedness-partial.test.ts`
- [X] T042 [P] [US2] Integration test: `tests/fixtures/two-runs-related/` rates the pair "Related" with confirming reasoning, and the dashboard carries no reminder badge, in `tests/integration/relatedness-related.test.ts`
- [X] T043 [P] [US2] Integration test: `tests/fixtures/n-runs-mixed-relatedness/` (4 runs) shows one row for the 3-run related cluster and a separate row for the unrelated 4th run, not one collapsed verdict, in `tests/integration/relatedness-mixed-cluster.test.ts`
- [X] T044 [P] [US2] Integration test: selecting "view runs individually instead" skips the head-to-head comparison entirely and opens each loaded run's own `SingleRunView`, in `tests/integration/relatedness-view-individually.test.ts`

### Implementation for User Story 2

- [X] T045 [P] [US2] Implement the prompt text-similarity heuristic (TF-IDF/cosine over normalized tokens) in `src/relatedness/promptSimilarity.ts` per research.md §5
- [X] T046 [P] [US2] Implement starting-repository-state comparison (branch/head-commit lineage) in `src/relatedness/repositoryStateComparison.ts` per FR-7b
- [X] T047 [P] [US2] Implement working-directory/project-path comparison in `src/relatedness/workingDirectoryComparison.ts` per FR-7c
- [X] T048 [US2] Compose `assessPairwiseRelatedness(runA, runB): PairwiseRelatedness` in `src/relatedness/assessPairwiseRelatedness.ts`, combining T045–T047 into `confidence: "related" | "partial" | "unrelated"` plus a `reasoning` string (depends on T045, T046, T047) per FR-7, FR-8, FR-10
- [X] T049 [US2] Compute `PairwiseRelatedness` for every pair of loaded runs and group "related"-rated pairs into `RelatednessCluster[]` via transitive closure, producing the `RelatednessAssessment` container with `hasAnyBelowFullConfidence`, in `src/relatedness/buildRelatednessAssessment.ts` (depends on T048) per `research.md` §7
- [X] T050 [US2] Build `RelatednessCheckView` page in `src/pages/RelatednessCheckView.tsx` rendering one row per cluster/pair with its rating and `reasoning` shown by default — never hidden behind an additional request (depends on T049) per FR-8, FR-10
- [X] T051 [US2] Add "Continue to comparison" (always enabled, for every rating combination including all-"Unrelated") and "view runs individually instead" (shown whenever `hasAnyBelowFullConfidence` is `true`) actions to `RelatednessCheckView.tsx` (depends on T050) per FR-8, FR-9
- [X] T052 [US2] Build the persistent `RelatednessReminderBadge` component in `src/components/RelatednessReminderBadge.tsx`, shown on the comparison dashboard whenever `hasAnyBelowFullConfidence` is `true`, explicitly naming/referencing the specific affected pair(s)/cluster(s) (not just a generic warning) so the caveat isn't lost after continuing past the check screen (depends on T049) per FR-9
- [X] T053 [US2] Wire routing in `src/pages/AppRoot.tsx`: 2+ uploaded files always route through `RelatednessCheckView` before the comparison dashboard (even when every pair is "Related"); "view runs individually instead" routes to `SingleRunView` for every loaded run instead (depends on T037, T051)

### Remediation additions for User Story 2 (from `/speckit-analyze` finding F3)

- [X] T128 [P] [US2] Unit test asserting `src/relatedness/` never issues a network request (prompt-similarity comparison must stay fully local per FR-30/research.md §5) in `tests/unit/relatedness-no-network-egress.test.ts` (depends on T019)
- [X] T129 [US2] Extend the local-only guard (reusing T019's `assertNoNetworkEgress`) to cover `src/relatedness/`, enforcing FR-30's no-transmission constraint on the prompt-similarity heuristic (depends on T019, T045, T046, T047, T048, T049)

**Checkpoint**: User Stories 1 AND 2 both work independently.

---

## Phase 5: User Story 3 - Compare Two Related Runs and See What Actually Drifted (Priority: P1)

**Goal**: Once relatedness has been assessed, classify every comparable metric's drift severity, surface confounds honestly, and support drilling into raw evidence.

**Independent Test**: Upload two related logs where one metric clearly changed; verify the report classifies the changed metric with an appropriate severity, leaves unchanged metrics at "no drift", marks unavailable metrics as "not available for this run" rather than zero, and allows drilling into raw evidence for at least one displayed number.

### Tests for User Story 3

- [X] T054 [P] [US3] Contract test for the 2-run group-statistics formulas (median/min/max/spread/deviation) in `tests/contract/drift-groupstats.contract.test.ts` per `contracts/drift-classification-rules.md`
- [X] T055 [P] [US3] Contract test for the drift-severity threshold table (`|deviation| < 1` → `"no-drift"`, `1–3` → `"moderate"`, `> 3` → `"large"`, single-run-only tool → `"categorical"`, uncomputable → `"cannot-determine"`) in `tests/contract/drift-severity.contract.test.ts`
- [X] T056 [P] [US3] Contract test for the confound-forced `"uninterpretable"` override (resent-prompt, mismatched-repo-state, approval-wait-dominated — the three types with `forcesUninterpretable: true`) in `tests/contract/drift-confound-override.contract.test.ts`
- [X] T057 [P] [US3] Integration test: `two-runs-related/` with differing tool-call composition shows a classification for every computable metric and `"not available for this run"` (never zero) for inapplicable ones, in `tests/integration/two-run-drift.test.ts`
- [X] T058 [P] [US3] Integration test: an approval-wait-dominated run shows the approval-wait/other-idle/active breakdown before any raw "speed" comparison, with the affected metric marked `"uninterpretable"`, in `tests/integration/duration-confound.test.ts`
- [X] T059 [P] [US3] Integration test: drilling into any displayed metric value surfaces its raw evidence (event, file, sequence/session identifier), in `tests/integration/evidence-drilldown.test.ts`
- [X] T060 [P] [US3] Integration test: `tests/fixtures/resent-prompt.jsonl` produces a labeled data-quality note with non-null estimated cost/turn impact attached to the affected run, in `tests/integration/resent-prompt.test.ts`
- [X] T061 [P] [US3] Integration test: `tests/fixtures/rejected-tool-call.jsonl` shows the rejected call as a distinct rejection — not a failure, not a normal completed call — in `tests/integration/rejected-tool-call.test.ts`
- [X] T130 [P] [US3] Integration test: a comparison with zero `ConfoundFinding` entries renders no confound-related UI anywhere — no badge, no panel, no empty placeholder (FR-28) — in `tests/integration/no-confounds.test.ts` *(added by `/speckit-analyze` finding E2)*
- [X] T131 [P] [US3] Unit test for `generateComparisonTitle` covering a typical case, very different prompt lengths across runs, and a run with missing/empty prompt text, in `tests/unit/generateComparisonTitle.test.ts` *(added by `/speckit-analyze` finding E1)*

### Implementation for User Story 3

- [X] T132 [US3] Implement `generateComparisonTitle(runs, relatednessAssessment): string` in `src/drift/generateComparisonTitle.ts`, deriving a short, human-readable title from the shared task description (FR-37); MUST NOT transmit prompt content off-device (FR-30) (depends on T034, T049) *(added by `/speckit-analyze` finding E1)*
- [X] T062 [US3] Implement the group-statistics engine (median, min, max, spread as median-absolute-deviation, per-run deviation) in `src/drift/groupStatistics.ts` per `contracts/drift-classification-rules.md`, excluding `"not-available"` values from the input set (depends on T034)
- [X] T063 [US3] Implement the drift-severity classifier in `src/drift/classifySeverity.ts` applying the `|deviation|` threshold table verbatim (`< 1` → `"no-drift"`, `1–3` → `"moderate"`, `> 3` → `"large"`) and recording the numeric `basis` string (depends on T062)
- [X] T064 [P] [US3] Implement categorical-difference detection in `src/drift/categoricalDifference.ts`, classifying a tool as `"categorical"` when it is "present in some but not all loaded runs — at least one run has a non-zero count and at least one has zero" per the updated FR-19
- [X] T065 [US3] Implement confound detection and the forced-`"uninterpretable"` override in `src/drift/applyConfoundOverrides.ts` for the three named `ConfoundFinding` types — `"resent-prompt"`, `"mismatched-repo-state"`, `"approval-wait-dominated"` (approval-wait time > 50% of total duration) — each setting `forcesUninterpretable: true` and overriding T063's computed severity, per FR-29 (depends on T063)
- [X] T066 [US3] Compose the `Comparison` object (`title` from T132, `relatednessAssessment`, `metrics`, `groupStatistics`, `driftClassifications`) in `src/drift/buildComparison.ts`, wiring T034, T049, T062, T063, T064, T065, T132 (depends on T034, T049, T064, T065, T132)
- [X] T067 [US3] Build `EvidenceDrilldownPanel` component in `src/components/EvidenceDrilldownPanel.tsx` resolving an `EvidenceReference` (via T015's index) to its raw event display (depends on T015)
- [X] T068 [US3] Build `ComparisonTable` component in `src/components/ComparisonTable.tsx` listing every metric from T066 with its `DriftClassification`, rendering `"not available for this run"` cells and inline confound flags (never a separate always-shown validity panel) per FR-27, FR-28 (depends on T066)
- [X] T069 [P] [US3] Build `DataQualityNoteBadge` component in `src/components/DataQualityNoteBadge.tsx` rendering a `resent-prompt` note's `estimatedCostImpact`/`estimatedTurnImpact`
- [X] T070 [P] [US3] Build `RejectedCallBadge` component in `src/components/RejectedCallBadge.tsx` visually distinguishing a `ToolCallOutcome` with `decision: "rejected"` from a failure or a normal completed call
- [X] T071 [US3] Build `ComparisonView` page in `src/pages/ComparisonView.tsx` rendering `RelatednessReminderBadge` (T052), `EvidenceDrilldownPanel`, `ComparisonTable`, `DataQualityNoteBadge`, and `RejectedCallBadge`, reached only via the routing wired in T053 (depends on T053, T067, T068, T069, T070)

**Checkpoint**: User Stories 1, 2, and 3 together form the full two-run MVP experience.

---

## Phase 6: User Story 4 - Compare More Than Two Runs at Once (Priority: P2)

**Goal**: Generalize group statistics and outlier detection to N runs, support pairwise drill-in among them, and scale each of the four chart types with its own large-N fallback.

**Independent Test**: Upload 5 related logs where one is a clear outlier on a metric; verify group statistics (min/median/max/spread) render across all 5, the outlier run is identified with its raw counts viewable, and any two of the five can still be viewed pairwise; upload more than 8 related runs and verify the charts switch to an aggregate/distribution view.

### Tests for User Story 4

- [X] T072 [P] [US4] Contract test for N-run (N ≥ 3) group-statistics and outlier-identification formulas in `tests/contract/drift-nrun.contract.test.ts`
- [X] T073 [P] [US4] Integration test: `tests/fixtures/n-runs-outlier/` (5 runs) renders group statistics across all 5 and identifies the known outlier with its raw counts viewable, in `tests/integration/n-run-outlier.test.ts`
- [X] T074 [P] [US4] Integration test: selecting any two of the five loaded runs renders a correct pairwise view, in `tests/integration/n-run-pairwise.test.ts`
- [X] T075 [P] [US4] Integration test: loading more than 8 related runs switches every chart's layout to its aggregate/distribution fallback, in `tests/integration/n-run-layout-threshold.test.ts`

### Implementation for User Story 4

- [X] T076 [US4] Generalize `src/drift/groupStatistics.ts` (T062) from the 2-run pair-difference case to arbitrary N runs (median/spread/deviation computed across the full set) (depends on T062)
- [X] T077 [US4] Implement outlier identification (the run(s) with the largest `|deviationByRun|` per metric) in `src/drift/identifyOutliers.ts` per FR-12 (depends on T076)
- [X] T078 [P] [US4] Build `PairwiseSelector` component in `src/components/PairwiseSelector.tsx` letting the user pick any two of the N loaded runs for a focused side-by-side view per FR-13
- [X] T079 [P] [US4] Build `CacheIntensityChart` in `src/components/CacheIntensityChart.tsx` (Recharts grouped bars for 2–4 runs; switches to a strip plot per row for 5+ runs) per FR-14
- [X] T080 [P] [US4] Build `OverheadTrendChart` in `src/components/OverheadTrendChart.tsx` (one line per run; fades non-outlier lines to reduced opacity beyond ~6 runs, keeping the highest/lowest growth lines at full opacity) per FR-14
- [X] T081 [P] [US4] Build `ToolUsageChart` in `src/components/ToolUsageChart.tsx` (per-tool-name bar rows scaling with N runs, reusing T064's categorical-difference flag)
- [X] T082 [P] [US4] Build `DurationBreakdownChart` in `src/components/DurationBreakdownChart.tsx` (Active/Permission-wait/Other-idle bars per run, stacking vertically as N grows rather than assuming exactly two groups)
- [X] T083 [US4] Build the shared `DistributionChart` in `src/components/DistributionChart.tsx` (box-plot/strip aggregate view: median line, interquartile range, labeled outlier points) and wire the >8-run switchover (FR-14, spec Assumptions default) into all four chart components from T079–T082 (depends on T079, T080, T081, T082)
- [X] T084 [US4] Extend `ComparisonTable.tsx` (T068) to render group-statistics columns (min/median/max/spread) for N ≥ 2 runs and the T077 outlier indicator (depends on T068, T076, T077)

**Checkpoint**: N-run scaling works on top of User Stories 1–3.

---

## Phase 7: User Story 5 - See Only What Actually Drifted, Not a Fixed KPI List (Priority: P2)

**Goal**: Generate the headline/KPI section dynamically from computed drift classifications, ranked and capped at 6, with pinning support, an N>2 range/outlier display, and an explicit "no drift" state.

**Independent Test**: With exactly one drifted metric, verify only that metric (plus pins) appears in the headline while the full table still lists everything; with more than 6 drifted metrics, verify only the top 6 appear with a link to the rest; with zero drifted metrics, verify a plain "no significant drift" statement instead of empty/forced KPI cards.

### Tests for User Story 5

- [X] T085 [P] [US5] Contract test for the headline qualification/ranking rule (severity above `"no-drift"` OR pinned; rank by `|deviationByRun|` of the outlier run; cap at top 6) in `tests/contract/headline-ranking.contract.test.ts` per `contracts/drift-classification-rules.md`
- [X] T086 [P] [US5] Integration test: exactly one drifted metric → headline shows only that metric plus any pinned metrics, in `tests/integration/headline-single-drift.test.ts`
- [X] T087 [P] [US5] Integration test: zero drifted metrics → explicit "no significant drift detected" state, no empty/forced KPI cards, in `tests/integration/headline-no-drift.test.ts`
- [X] T088 [P] [US5] Integration test: more than 6 drifted metrics → only the top 6 by relative magnitude appear in the headline, ranked, with a "+N more drifted metrics — view full table" link, in `tests/integration/headline-ranking.test.ts`
- [X] T089 [P] [US5] Integration test: the full comparison table always lists every computed metric regardless of headline status, in `tests/integration/full-table-completeness.test.ts`
- [X] T090 [P] [US5] Integration test: for a comparison with more than 2 runs, a drifted metric's headline card shows the group's value range (min–max) and names the outlier run, in `tests/integration/headline-nrun-range.test.ts`

### Implementation for User Story 5

- [X] T091 [US5] Implement `buildHeadline(comparison): { headlineMetricKeys: string[] }` in `src/drift/buildHeadline.ts`: include a metric if `severity` is `"moderate"`, `"large"`, or `"categorical"` (explicitly excluding `"cannot-determine"` and `"uninterpretable"` — an unvouched-for metric MUST NOT appear as a headline finding, per SC-006) OR its key is pinned; when more than 6 qualify, rank by the outlier run's `|deviationByRun|` and keep only the top 6 (depends on T066)
- [X] T092 [P] [US5] Add `pinnedMetricKeys` state (per FR-25) to `src/state/sessionStore.ts` (T017) with pin/unpin actions
- [X] T093 [US5] Build `HeadlineKpiSection` component in `src/components/HeadlineKpiSection.tsx` rendering T091's ranked metrics with min–max range + outlier-run naming for N>2 comparisons, a "+N more drifted metrics — view full table" link when capped, or the explicit "no significant drift detected" state when `headlineMetricKeys` is empty (depends on T091)
- [X] T094 [P] [US5] Build `PinMetricToggle` control in `src/components/PinMetricToggle.tsx`, wired into each `ComparisonTable` (T068) row (depends on T092)
- [X] T095 [US5] Wire `ComparisonView.tsx` (T071) to render `HeadlineKpiSection` above `ComparisonTable`, driven by `buildHeadline()` output (depends on T093, T094, T071)

**Checkpoint**: User Stories 1–5 form the complete N-run drift-detection experience.

---

## Phase 8: User Story 6 - Export a Comparison Report and Revisit Recent Work (Priority: P3)

**Goal**: Export a completed comparison to a local file, and maintain a local (IndexedDB-backed) recent-comparisons history so past work can be reopened later without re-uploading the original logs.

**Independent Test**: Generate a comparison, export it, refresh the browser, confirm it appears in the recent-comparisons list, and confirm reopening it restores the full report without re-uploading the original logs; confirm clearing the browser's site data empties the list.

### Tests for User Story 6

- [X] T096 [P] [US6] Contract test for the export/report format round-trip (serialize a `Comparison` → export → reimport → deep-equal, per `contracts/export-format.md`, including the `formatVersion` check rejecting an unrecognized future version) in `tests/contract/export-format.contract.test.ts`
- [X] T097 [P] [US6] Integration test: selecting "Export report" downloads a local file with zero outgoing network requests, in `tests/integration/export-report.test.ts`
- [X] T098 [P] [US6] Integration test: after generating a comparison and refreshing the browser, the upload screen's recent-comparisons list shows its title, run labels, and timestamp, in `tests/integration/recent-comparisons-list.test.ts`
- [X] T099 [P] [US6] Integration test: selecting a recent-comparisons entry reopens the full report without re-uploading the original log files, in `tests/integration/recent-comparisons-reopen.test.ts`
- [X] T100 [P] [US6] Integration test: clearing the browser's local storage for the app empties the recent-comparisons list, in `tests/integration/recent-comparisons-cleared.test.ts`

### Implementation for User Story 6

- [X] T101 [P] [US6] Set up the IndexedDB wrapper and object store in `src/state/localHistoryStore.ts` using `idb` (open DB, define the `recentComparisons` object store keyed by `RecentComparisonEntry.id`)
- [X] T102 [P] [US6] Implement `serializeComparison`/`deserializeComparison` per `contracts/export-format.md` in `src/reporting/reportSerializer.ts`, including the `formatVersion` field and the explicit exclusion of raw `LogFile.events`, full `taskPromptText`, and file/code content beyond computed metric values
- [X] T103 [US6] Implement `exportReport(comparison)` triggering a local file download (no network request) in `src/reporting/exportReport.ts` (depends on T102)
- [X] T104 [US6] Implement `writeRecentComparison`/`listRecentComparisons`/`getRecentComparison` in `src/state/localHistoryStore.ts` using T102's serialized format (depends on T101, T102)
- [X] T105 [US6] Implement `importReport(file): Comparison` in `src/reporting/importReport.ts`, checking `formatVersion` and failing with a clear "exported by a newer version" message on an unrecognized value rather than a best-effort partial read (depends on T102)
- [X] T106 [P] [US6] Build the `ExportButton` component in `src/components/ExportButton.tsx`, calling T103
- [X] T107 [P] [US6] Build the `RecentComparisonsList` component in `src/components/RecentComparisonsList.tsx` for the upload screen, reading via T104
- [X] T108 [US6] Wire `UploadPanel`/`AppRoot` (T018, T053) to write to the recent-comparisons history whenever a comparison completes, and to support reopening a selected entry or an imported file directly into `ComparisonView` without re-upload (depends on T104, T105, T018, T053)

**Checkpoint**: Export and recent-comparisons history work on top of User Stories 1–5.

---

## Phase 9: User Story 7 - See the Likely Dominant Driver of Drift (Priority: P3)

**Goal**: Identify and explain the single metric most responsible for a comparison's largest drift (or state explicitly that none dominates), and show a plain session summary for a single uploaded run.

**Independent Test**: Given a comparison where one metric's drift clearly dominates, verify the panel names that cause with supporting evidence and numbers; given drift spread across unrelated metrics, verify the panel states no single dominant driver was identified; given a single uploaded run, verify a plain session summary appears instead.

### Tests for User Story 7

- [X] T109 [P] [US7] Contract test for the dominant-driver selection rule (top-ranked qualifying metric's `|deviationByRun|` at least 1.5× the second-ranked's ⇒ `hasDominantDriver: true`) in `tests/contract/dominant-driver-selection.contract.test.ts` per `contracts/dominant-driver-rules.md`
- [X] T110 [P] [US7] Contract test for the "no dominant driver" fallback (top two qualifying metrics within the 1.5× margin ⇒ `hasDominantDriver: false`, empty `supportingEvidence`/`supportingNumbers`) in `tests/contract/dominant-driver-fallback.contract.test.ts`
- [X] T111 [P] [US7] Integration test: `tests/fixtures/dominant-driver-clear.jsonl` set → panel names the dominant metric, cites specific supporting metrics/tool calls as evidence, and shows 2–3 supporting numbers, in `tests/integration/dominant-driver-clear.test.ts`
- [X] T112 [P] [US7] Integration test: `tests/fixtures/dominant-driver-spread.jsonl` set → panel explicitly states no single dominant driver was identified, in `tests/integration/dominant-driver-spread.test.ts`
- [X] T113 [P] [US7] Integration test: uploading `tests/fixtures/single-run-normal.jsonl` alone shows a plain session-summary panel with no causal or comparison language, in `tests/integration/session-summary.test.ts`

### Implementation for User Story 7

- [X] T114 [US7] Implement dominant-driver selection in `src/dominant-driver/selectDominantDriver.ts`: exclude metrics classified `"uninterpretable"`/`"cannot-determine"`, rank remaining qualifying metrics by `|deviationByRun|`, and apply the 1.5× margin rule from `contracts/dominant-driver-rules.md` (depends on T066)
- [X] T115 [US7] Implement explanation composition in `src/dominant-driver/composeExplanation.ts`: fill the parameterized sentence template naming the dominant metric, cite its supporting `EvidenceReference`s (via T015), and include 2–3 supporting numbers drawn from that metric's own data; emit the fixed "no single dominant driver identified" message with empty evidence/numbers when `hasDominantDriver` is `false` (depends on T114, T015)
- [X] T116 [US7] Implement single-run session-summary composition in `src/dominant-driver/composeSessionSummary.ts`, generating a non-comparative summary from that run's own `Metric[]` values with 2–3 supporting numbers, per FR-35 (depends on T034)
- [X] T117 [US7] Extend the local-only guard (reusing T019's `assertNoNetworkEgress`) to cover `src/dominant-driver/`, enforcing FR-36's no-transmission constraint on explanation/summary generation (depends on T019, T115, T116)
- [X] T118 [US7] Build the `DominantDriverPanel` component in `src/components/DominantDriverPanel.tsx` rendering T115's explanation, evidence, and supporting numbers, or the "no single dominant driver" message (depends on T115)
- [X] T119 [US7] Build the `SessionSummaryPanel` component in `src/components/SessionSummaryPanel.tsx` rendering T116's summary for the single-run case (depends on T116)
- [X] T120 [US7] Wire `DominantDriverPanel` into `ComparisonView.tsx` (T095) and `SessionSummaryPanel` into `SingleRunView.tsx` (T035) (depends on T035, T095, T118, T119)

**Checkpoint**: All seven user stories are independently functional and integrated.

---

## Phase 10: Polish & Cross-Cutting Concerns

**Purpose**: End-to-end validation and non-functional guarantees that span every user story.

- [X] T121 [P] Create every fixture file listed in `quickstart.md` under `tests/fixtures/` (`single-run-normal.jsonl`, `single-run-aborted.jsonl`, `two-runs-related/`, `two-runs-partial/`, `two-runs-unrelated/`, `n-runs-outlier/run-{1..5}.jsonl`, `n-runs-mixed-relatedness/run-{1..4}.jsonl`, `dominant-driver-clear.jsonl` set, `dominant-driver-spread.jsonl` set, `resent-prompt.jsonl`, `rejected-tool-call.jsonl`, `truncated-fields.jsonl`, `unknown-schema-fields.jsonl`)
- [X] T122 [P] Write the Playwright e2e suite covering `quickstart.md` scenarios 1–8 in `tests/e2e/quickstart.spec.ts` (depends on T121)
- [X] T123 [P] Write the performance e2e test: a 10-run, several-MB-each fixture set completes report generation in under 30 seconds (SC-008) in `tests/e2e/performance.spec.ts` (depends on T121)
- [X] T124 [P] Write the network-egress e2e test asserting zero outgoing requests carry file/prompt/path content or generated explanation text during ingestion, analysis, export, or recent-comparisons access (FR-30, FR-36, SC-007) in `tests/e2e/no-network-egress.spec.ts`
- [X] T125 [P] Write the export/reopen round-trip e2e test: export a comparison, clear in-memory state, reimport the file directly, and confirm it renders identically without re-uploading source logs (SC-009) in `tests/e2e/export-roundtrip.spec.ts` (depends on T121)
- [X] T126 Write `README.md` covering setup, `npm` scripts, and an architecture overview referencing `plan.md`
- [X] T127 Run the full `quickstart.md` validation pass end-to-end and record results

  **Results (manual browser walkthrough against the dev server, since Playwright's Chromium binary could not be downloaded in the sandbox — no network access to cdn.playwright.dev)**: all 8 scenarios PASS.

  - **Scenario 1** (single-run view): per-run metrics rendered with zero "drift"/"vs." occurrences; aborted session showed the plain "No completed task activity was found in this log." message.
  - **Scenario 2** (relatedness, always advisory): `two-runs-related/` rated "Related" with confirming reasoning, no reminder badge after continuing; `two-runs-unrelated/` rated "Unrelated" with Continue still enabled alongside "view individually."
  - **Scenario 3** (two-run drift): every metric classified; duration ordered Total → Approval-wait → Other-idle → Active; evidence drill-down on "Turns" showed the correct raw `api_call` events per run/sequence.
  - **Scenario 4** (N-run): `n-runs-outlier/` (5 runs) showed Min/Median/Max/Spread/Outlier columns; outlier correctly identified as Run 3 across ~11 metrics with raw counts visible.
  - **Scenario 5** (dynamic headline): top-6 ranked cards with `Range: min–max (outlier: Run 3)` and a "+11 more drifted metrics — view full table" link; full table still listed every metric.
  - **Scenario 6** (schema tolerance): `unknown-schema-fields.jsonl` parsed without corruption; `truncated-fields.jsonl` initially showed the wrong (truncated) length due to a mismatched marker in the QA's own regenerated fixture text vs. the parser's regex — fixed in `tests/fixtures/generate.mjs`/`tests/fixtures/truncated-fields.jsonl`, then correctly reconstructed to 5000 chars. The app's reconstruction logic itself was correct throughout.
  - **Scenario 7** (export/recent comparisons): reopening a recent-comparisons entry restored the full report with a "Reopened from recent comparisons" notice and no re-upload prompt.
  - **Scenario 8** (dominant driver): clear-driver set named "McpTool calls" with 3 supporting numbers; spread set showed the fixed "No single dominant driver identified..." message.
  - **Console errors**: none observed at any step.
  - **Network**: only same-origin Vite dev-server module requests; one `fonts.googleapis.com` request traced to the Claude-in-Chrome QA tooling extension itself (confirmed absent from the app's own source), not an app-level FR-30 violation.

  **Two real gaps the walkthrough surfaced were fixed as part of this pass** (not scope creep — both are contract requirements/correctness bugs the automated suite hadn't caught):
  1. `LogFile.unrecognizedEventCount` was tracked (T013) but never surfaced in the UI, despite `contracts/input-log-schema.md` and `quickstart.md` scenario 6.1 requiring it be shown as "unrecognized, not included in metrics." Added `src/components/UnrecognizedEventsNotice.tsx`, wired into `SingleRunView` and `ComparisonView`, covered by `tests/integration/unrecognized-events-notice.test.tsx`.
  2. `ComparisonView`'s recent-comparisons write effect wasn't idempotent against React StrictMode's dev-only double-invoke, causing duplicate history entries in dev. Fixed with a ref-guarded write key in `src/pages/ComparisonView.tsx`, covered by `tests/integration/recent-comparisons-no-duplicate-write.test.tsx`.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately.
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories.
- **User Stories (Phase 3–9)**: All depend on Foundational phase completion.
  - US1, US2, US3 are all Priority P1 and together form the MVP; US1 has no dependency on US2/US3 and can be built and demoed alone.
  - US2 depends on US1 only for the `SingleRunView` fallback link (T053 references T037); its own relatedness logic (T038–T049) is independent.
  - US3 depends on US1's `computeRunMetrics` (T034), US2's `RelatednessAssessment` composition (T049) and routing (T053).
  - US4 depends on US3's `groupStatistics`/`buildComparison` (T062, T066) and `ComparisonTable` (T068).
  - US5 depends on US3's `Comparison` object (T066) and `ComparisonView`/`ComparisonTable` (T071, T068).
  - US6 depends on US3's `Comparison` object (T066) for what gets serialized, and US1/US2's routing (T018, T053) for where reopened reports land.
  - US7 depends on US3's `Comparison`/`DriftClassification`s (T066) and US1's `computeRunMetrics` (T034) for the single-run session summary; wires into US1's `SingleRunView` (T035) and US5's `ComparisonView` (T095).
- **Polish (Phase 10)**: Depends on all desired user stories being complete.

### Within Each User Story

- Tests are written before their corresponding implementation tasks and should fail first.
- Calculators/detectors (independent files) before composition tasks (`computeRunMetrics`, `assessPairwiseRelatedness`/`buildRelatednessAssessment`, `buildComparison`, `buildHeadline`, `selectDominantDriver`).
- Composition before UI wiring.
- Story complete and independently testable before moving to the next priority.

### Parallel Opportunities

- All Setup tasks marked [P] can run together.
- Within Foundational, T005/T006/T009/T010/T011/T012/T015/T017 (all independent files) can run in parallel; T007→T008→T013→T014→T016→T018→T019→T020 form the sequential backbone.
- Once Foundational completes, US1 and US2's independent tracks (T021–T033 and T038–T047) can proceed in parallel; US3 needs both US1's T034 and US2's T049/T053 before its composition tasks.
- US4, US5, US6, and US7 can all proceed in parallel once US3's T066 lands, since they extend different parts of it (charts/group-stats, headline ranking, export/persistence, dominant-driver respectively).
- All [P]-marked tests within a story can run in parallel with each other.

---

## Parallel Example: User Story 1

```bash
# Launch all tests for User Story 1 together:
Task: "Contract test verifying buildRun() output in tests/contract/parsing.contract.test.ts"
Task: "Contract test for Efficiency formulas in tests/contract/metrics-efficiency.contract.test.ts"
Task: "Contract test for Duration breakdown formula in tests/contract/metrics-duration.contract.test.ts"
Task: "Integration test for single-run view in tests/integration/single-run-view.test.ts"
Task: "Integration test for aborted-session state in tests/integration/single-run-aborted.test.ts"

# Launch all independent metric calculators for User Story 1 together:
Task: "Implement efficiency calculator in src/metrics/efficiency.ts"
Task: "Implement duration calculator in src/metrics/duration.ts"
Task: "Implement cache-creation intensity calculator in src/metrics/cacheIntensity.ts"
Task: "Implement overhead-ratio trend calculator in src/metrics/overheadTrend.ts"
Task: "Implement tool-usage composition calculator in src/metrics/toolUsage.ts"
Task: "Implement error/recovery calculator in src/metrics/errorRecovery.ts"
Task: "Implement activity-ratio calculator in src/metrics/activityRatios.ts"
Task: "Implement code-volume calculator in src/metrics/codeVolume.ts"
```

---

## Implementation Strategy

### MVP First (User Stories 1–3, all P1)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories).
3. Complete Phase 3: User Story 1 — **STOP and VALIDATE** independently (single-run view works).
4. Complete Phase 4: User Story 2 — **STOP and VALIDATE** (advisory relatedness gating and pairwise/cluster display work).
5. Complete Phase 5: User Story 3 — **STOP and VALIDATE** (full two-run drift report works). This is the true MVP: the product's core value proposition end to end.

### Incremental Delivery

1. Setup + Foundational → foundation ready.
2. US1 → demo single-run metrics.
3. US2 → demo advisory relatedness gating on top of US1.
4. US3 → demo full two-run drift comparison (MVP complete).
5. US4 → demo N-run scaling across all four chart types.
6. US5 → demo dynamic, drift-only, N-run-aware headlines.
7. US6 → demo export and recent-comparisons history.
8. US7 → demo the dominant-driver panel and single-run session summary.
9. Polish → fixtures, e2e coverage, non-functional validation, docs.

### Format Validation

Every task above follows `- [ ] T### [P?] [Story?] Description with exact file path`: Setup/Foundational/Polish tasks carry no `[Story]` label; every Phase 3–9 task carries its `[US#]` label; `[P]` appears only on tasks touching independent files with no incomplete-task dependency.
