# Quickstart: Validating the Telemetry Drift Detector

This guide runs the feature end-to-end against the acceptance scenarios in `spec.md`. It assumes the implementation tasks (`/speckit-tasks`, `/speckit-implement`) have produced a working app per `plan.md`'s project structure.

## Prerequisites

- Node.js (LTS) and a package manager installed.
- The app's dependencies installed: `npm install` from the repository root.
- A set of fixture `.jsonl` OTLP log files under `tests/fixtures/` (created during implementation), covering at minimum:
  - `single-run-normal.jsonl` — one complete, well-formed session
  - `single-run-aborted.jsonl` — zero completed task turns
  - `two-runs-related/run-a.jsonl` + `run-b.jsonl` — same task, same repo, comparable state
  - `two-runs-partial/run-a.jsonl` + `run-b.jsonl` — same repo, different starting commit
  - `two-runs-unrelated/run-a.jsonl` + `run-b.jsonl` — different repos/subject matter
  - `n-runs-outlier/run-{1..5}.jsonl` — 5 variants of one task, one a clear outlier on a metric
  - `n-runs-mixed-relatedness/run-{1..4}.jsonl` — 4 runs where 3 form one related cluster and the 4th is unrelated to all of them
  - `dominant-driver-clear.jsonl` set — a related pair/group where one metric's drift clearly dominates all others
  - `dominant-driver-spread.jsonl` set — a related pair/group where drift is spread evenly across several unrelated metrics, with no clear dominant cause
  - `resent-prompt.jsonl` — a session with an incomplete prompt followed by a resend
  - `rejected-tool-call.jsonl` — a session containing a rejected tool-permission decision
  - `truncated-fields.jsonl` — a session with truncated large field values
  - `unknown-schema-fields.jsonl` — a session containing event/tool types not in the current schema mapping

## Run the app

```bash
npm run dev
```

Open the printed local URL in a browser. No network configuration or server deployment is required — everything runs client-side (FR-30).

## Validation scenarios

### 1. Single-run view (User Story 1)

1. Upload `single-run-normal.jsonl` only.
2. **Expect**: per-run metrics (turns, tokens, cost, tool usage, timing breakdown) with no drift/comparison language anywhere (spec Acceptance Scenario US1.1).
3. Repeat with `single-run-aborted.jsonl`.
4. **Expect**: a plain statement that no completed task activity was found — no zeroed/misleading metrics (US1.2).

### 2. Relatedness check — always advisory (User Story 2)

1. Upload the `two-runs-related/` pair.
2. **Expect**: the Relatedness Check screen appears (it always does for 2+ uploads) rating the pair "Related" with confirming reasoning shown by default; "Continue to comparison" is available and, once selected, the comparison dashboard carries no warning indicator (US2.1, US2.4).
3. Upload the `two-runs-partial/` pair.
4. **Expect**: the Relatedness Check rates the pair "Review recommended" with its reasoning shown; both "Continue to comparison" and "view runs individually instead" are offered; after continuing, the comparison dashboard carries a persistent reminder badge referencing this pair (US2.3).
5. Upload the `two-runs-unrelated/` pair.
6. **Expect**: the Relatedness Check rates the pair "Unrelated" with its reasoning shown; "Continue to comparison" remains available (not blocked) alongside "view runs individually instead" (US2.2). Selecting "view runs individually instead" opens each log's own single-run view instead of a head-to-head comparison (US2.5).
7. Upload all 4 files in `n-runs-mixed-relatedness/`.
8. **Expect**: the Relatedness Check shows one row for the 3-run related cluster and a separate row/pair for the unrelated 4th run — not one collapsed verdict for all 4 (Edge Cases: "three or more logs where some pairs are related and others are not").

### 3. Two-run drift comparison (User Story 3)

1. Using the `two-runs-related/` pair, confirm a per-metric drift classification appears for every computable metric, and any inapplicable metric shows "not available for this run" (US3.1).
2. Confirm duration is shown as approval-wait / other-idle / active time before any raw "speed" framing (US3.2).
3. Click into any displayed metric value; confirm the raw evidence (event, file, sequence/session identifier) is shown (US3.3).
4. Upload `resent-prompt.jsonl` alongside a normal run; confirm a labeled data-quality note with estimated cost/turn impact appears on the affected run (US3.4).
5. Upload `rejected-tool-call.jsonl`; confirm the rejected call appears as a distinct rejection, not a failure or a normal completed call (US3.5).

### 4. N-run comparison (User Story 4)

1. Upload all 5 files in `n-runs-outlier/`.
2. **Expect**: group statistics (min/median/max/spread) per metric across all 5 runs, not a fixed two-column layout (US4.1).
3. **Expect**: the known outlier run is identified for the metric it drifts on, with its raw counts viewable (US4.2).
4. Select any two of the five runs for a pairwise view; confirm it renders correctly (US4.3).
5. Upload more than 8 related runs; confirm the layout switches to an aggregate/distribution view (US4.4, FR-14 default threshold).

### 5. Dynamic headline surfacing (User Story 5)

1. Using a comparison with exactly one drifted metric, confirm the headline section shows only that metric (plus any pinned metrics) (US5.1).
2. Using a comparison with no drifted metrics, confirm a plain "no significant drift detected" statement — no empty/forced KPI cards (US5.2).
3. Using a fixture set engineered to drift more than 6 metrics, confirm only the top 6 (by relative magnitude) appear in the headline, ranked, with a "+N more drifted metrics — view full table" link for the rest (US5.3).
4. Confirm the full comparison table always lists every computed metric regardless of headline status (US5.4).
5. Using `two-runs-partial/` (mismatched starting commit) or a run with approval-wait-dominated duration, confirm the affected metric is shown as `uninterpretable` with the confound named as the reason (US5.5).
6. Using `n-runs-outlier/` (N > 2), confirm a drifted metric's headline card shows the group's value range (min–max) and names the outlier run, rather than a two-value comparison (US5.6).

### 6. Schema tolerance and correctness edge cases

1. Upload `unknown-schema-fields.jsonl` alongside a normal run; confirm parsing of the rest of the file is unaffected and unrecognized events are visibly reported as "unrecognized, not included in metrics."
2. Upload `truncated-fields.jsonl`; confirm code-volume metrics reflect the reconstructed true length, not the truncated string length (contracts/input-log-schema.md).

### 7. Export and recent comparisons (User Story 6)

1. Generate a comparison from the `two-runs-related/` pair and select "Export report."
2. **Expect**: a local file downloads containing the computed report; the browser's Network panel shows no request carrying its content (US6.1).
3. Refresh the browser tab, then view the upload screen.
4. **Expect**: a recent-comparisons entry for the comparison just generated appears, showing its title, run labels, and timestamp (US6.2).
5. Select that entry.
6. **Expect**: the full report reopens exactly as before, without prompting for the original log files (US6.3).
7. Clear the browser's site data for the app, then view the upload screen again.
8. **Expect**: the recent-comparisons list is empty (US6.4).

### 8. Dominant-driver panel (User Story 7)

1. Generate a comparison from the `dominant-driver-clear.jsonl` set.
2. **Expect**: the driver panel names the dominant metric, cites its specific supporting metrics/tool calls as evidence, and shows 2–3 supporting numbers (US7.1).
3. Generate a comparison from the `dominant-driver-spread.jsonl` set.
4. **Expect**: the panel explicitly states no single dominant driver was identified, rather than forcing a narrative (US7.2).
5. Upload `single-run-normal.jsonl` alone.
6. **Expect**: the panel instead shows a plain session-summary of that run's own characteristics, with no causal or comparison language (US7.3).

## Non-functional checks

- **Performance (SC-008)**: with the `n-runs-outlier/` set scaled up to 10 files at several MB each, confirm the full report renders in under 30 seconds and the tab remains responsive (no dropped input) during processing.
- **No network egress (FR-30, SC-007)**: with browser dev tools' Network panel open, run through scenarios 1–8 above — including export and recent-comparisons — and confirm zero outgoing requests carry file content, prompt text, file paths, code snippets, or generated explanation text. (The app may make no network requests at all after its initial static assets load.)
- **Export/reopen round-trip (SC-009, FR-32)**: export a comparison, clear in-memory app state (e.g., close and reopen the tab without using "recent comparisons"), then import the exported file directly; confirm it renders identically to the original without re-uploading the source logs.
