# Contract: Dominant-Driver Rules

Governs how `src/dominant-driver/` produces a `DominantDriverFinding` (comparisons, FR-33/FR-34) or a `SessionSummary` (single run, FR-35), and enforces the local-only generation constraint (FR-36). `tests/contract/` MUST verify this against fixed fixtures covering a clear-dominant-driver case, a no-dominant-driver case, and the single-run case.

## Selecting the dominant driver (FR-33, FR-34)

Given a `Comparison` with N ≥ 2 runs and its computed `DriftClassification`s:

1. Consider only metrics classified above `no-drift` (i.e., `moderate`, `large`, or `categorical`) — `uninterpretable` and `cannot-determine` metrics are excluded from dominant-driver consideration entirely, since they can't support a trustworthy causal claim.
2. For each qualifying metric, take its outlier run's `|deviationByRun|` value (categorical metrics are treated as tied for the maximum possible magnitude, since a present/absent difference has no natural continuous scale).
3. Rank qualifying metrics by that magnitude, descending.
4. **Dominant-driver condition**: if the top-ranked metric's magnitude is at least **1.5×** the second-ranked metric's magnitude (or there is only one qualifying metric), `hasDominantDriver = true` and `metricKey` = the top-ranked metric's key.
5. **No-dominant-driver condition**: if the top two qualifying metrics are within that 1.5× margin of each other (drift is "spread across several unrelated metrics" per Edge Cases), `hasDominantDriver = false` and `metricKey = null`.
6. If zero metrics qualify (comparison shows no drift at all), `hasDominantDriver = false` — this is the same state as step 5, not a separate case.

## Composing the explanation (FR-33)

When `hasDominantDriver = true`:

- `explanation` is composed from a parameterized sentence template naming the dominant metric and its behavioral category (e.g., tool-usage composition, duration, cache-creation intensity — per `contracts/metric-formulas.md`'s groupings), e.g.: *"{outlier run label}'s drift is mainly driven by {metric label}, which {directional description} compared to the group."*
- `supportingEvidence` MUST cite the specific raw tool calls/events that back the claim (e.g., the categorical tool introduced only in the outlier run, or the specific approval-wait interval), resolved via the same `EvidenceReference` mechanism used for drill-down (NFR-1/SC-003).
- `supportingNumbers` MUST include 2–3 numbers drawn directly from the dominant metric's own data (e.g., its value in the outlier run, its group median, its `|deviationByRun|`) — never numbers from unrelated metrics.

When `hasDominantDriver = false`:

- `explanation` MUST be the fixed message: *"No single dominant driver identified; see the full comparison table for the complete picture."*
- `supportingEvidence` and `supportingNumbers` MUST both be empty — no narrative is fabricated to fill them.

## Single-run session summary (FR-35)

For a `Comparison` with exactly 1 run (no comparison possible):

- `SessionSummary.summaryText` MUST be composed from that run's own headline metrics (e.g., turns, tool calls, cost, dominant tool-usage category) using a non-comparative template — no "vs.", no drift/severity language, no reference to any other run.
- `supportingNumbers` MUST include 2–3 numbers drawn from that run's own `Metric[]` values.

## Local-only generation constraint (FR-36)

- `DominantDriverFinding` and `SessionSummary` generation MUST read only from already-computed local data: `Metric`, `DriftClassification`, `GroupStatistics`, and `EvidenceReference` lookups.
- This module MUST NOT issue any network request (no `fetch`/`XMLHttpRequest`), and MUST NOT pass prompt text, code content, or file paths to any external service to produce `explanation` or `summaryText`. The same `assertNoNetworkEgress` guard used elsewhere in the codebase (per `contracts/input-log-schema.md`) applies here.
- Because generation is template-based rather than model-generated, `explanation`/`summaryText` fidelity is bounded by the template's coverage of behavioral categories — this is an accepted trade-off (see `spec.md` Assumptions and `research.md` §8), not a defect to "fix" by quietly introducing a remote call.
