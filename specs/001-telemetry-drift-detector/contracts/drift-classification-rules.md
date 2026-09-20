# Contract: Drift Classification Rules

Governs how `src/drift/` turns per-run metric values into the severity labels and headline surfacing behavior specified in FR-11–FR-14 and FR-24–FR-29, and how `src/relatedness/` + the Relatedness Check screen apply the FR-7–FR-10 gating rule. `tests/contract/` MUST verify this against fixed fixtures covering each severity tier, each confound-override case, and each relatedness-rating combination.

## Group statistics (FR-11, FR-12)

For each metric, across all N loaded runs:

- `median`, `min`, `max` of the metric's values across runs (excluding runs where the metric is `"not-available"`).
- `spread` = a robust dispersion measure across the run set (e.g., median absolute deviation, MAD).
- `deviationByRun[run]` = `(value[run] − median) / spread` (0 when `spread` is 0, i.e., no variation).
- `outlierRunIds` = the run(s) with the largest absolute `deviationByRun` value for that metric.

A metric unavailable for a given run (missing field, unsupported tool type) MUST be excluded from that run's group-statistics input and displayed as "not available for this run" — never defaulted to zero (Edge Cases).

## Drift severity thresholds (FR-24, resolved via Clarifications: statistical, relative to group spread)

Given a run's `deviationByRun` value (in multiples of `spread`) for a metric:

| `|deviation|` range | Severity |
|---|---|
| < 1 | `no-drift` |
| 1 – 3 | `moderate` |
| > 3 | `large` |
| N/A — tool/category present in some but not all loaded runs | `categorical` (see metric-formulas.md, FR-19) |
| Metric formula cannot be evaluated for a required run | `cannot-determine` |
| A named confound applies (see below) | `uninterpretable` (overrides any of the above) |

`DriftClassification.basis` MUST record the numeric basis used (e.g., "2.4× group spread") so the classification is auditable, not ad hoc.

With exactly 2 runs, `spread` reduces to a single-pair difference measure; the same threshold table applies using the two runs' own delta in place of a group-derived spread.

## Confound-forced "uninterpretable" (FR-29, resolved via Clarifications: yes, for named types)

The following `ConfoundFinding` types, when present, MUST force the affected metric's `severity` to `uninterpretable` regardless of its computed statistical severity:

1. **Resent prompt** — a `DataQualityNote` of type `resent-prompt` exists on a run contributing to the metric.
2. **Mismatched starting repository state** — any `PairwiseRelatedness` entry among the compared runs (within the comparison's `RelatednessAssessment.pairs`) reports a repository-state mismatch (e.g., different starting commit).
3. **Approval-wait-dominated duration** — approval-wait time (contracts/metric-formulas.md, FR-16) accounts for more than half of a run's total wall-clock duration, for any duration-derived metric.

Other confound types (e.g., a general schema-version mismatch between files) are surfaced as informational flags per FR-28 but do NOT force `uninterpretable` unless they fall into one of the three types above.

## Headline surfacing (FR-25, FR-26 — updated by UI Design Reconciliation)

- A metric appears in the headline/KPI section if and only if: its `severity` is `moderate`, `large`, or `categorical` (i.e., above `no-drift`, explicitly excluding `cannot-determine` and `uninterpretable` — matching the same exclusion used in `contracts/dominant-driver-rules.md`'s selection rule), OR its key is in `pinnedMetricKeys`.
- If more than 6 metrics qualify, rank by relative magnitude of change (`|deviationByRun|` for the metric's outlier run) and keep only the top 6 in the headline section; the rest remain in the full comparison table (FR-27), reachable via a "+N more drifted metrics — view full table" link.
- If zero metrics qualify, the headline section MUST render an explicit "no significant drift detected" state — never an empty or forced KPI card.
- For a `Comparison` with more than 2 runs, a headline card MUST display the metric's group value range (`min`–`max`) and name the `outlierRunIds` run, rather than assuming exactly two values (FR-25).

## Relatedness gating (FR-7–FR-10, updated by UI Design Reconciliation: always advisory, pairwise/cluster)

This section supersedes the original "tiered by confidence, hard block on unrelated" rule from the initial Clarifications session. The current rule:

- Every `PairwiseRelatedness.confidence` value maps to a displayed rating: `related` → "Related", `partial` → "Review recommended", `unrelated` → "Unrelated".
- The Relatedness Check screen (`src/pages/RelatednessCheckView.tsx`) MUST always render before the comparison dashboard when 2+ runs are loaded — regardless of every pair's rating — showing one row per `RelatednessCluster` (or per `PairwiseRelatedness` when it doesn't belong to a multi-run cluster), each with its rating and `reasoning` displayed by default.
- "Continue to comparison" MUST always be enabled, for every combination of ratings, including all-`unrelated`. There is no rating value that blocks this action.
- Whenever `RelatednessAssessment.hasAnyBelowFullConfidence` is `true`, a "view runs individually instead" action MUST also be offered, routing to per-run `SingleRunView`s for every loaded run instead of the comparison dashboard.
- Whenever `RelatednessAssessment.hasAnyBelowFullConfidence` is `true`, the comparison dashboard (once reached) MUST carry a persistent reminder badge referencing the affected pair(s)/cluster(s) — the caveat must not disappear just because the user clicked past the check screen.
- When every pair is rated `related`, the Relatedness Check screen still renders (per FR-8) but shows confirming reasoning with no warning styling, and the comparison dashboard itself carries no reminder badge.

## Confound visibility (FR-28)

- `ConfoundFinding`s are rendered as inline flags attached to the specific run/metric/comparison they affect.
- If a `Comparison` has zero `ConfoundFinding`s, no confound-related UI element renders anywhere in that comparison — this must be verified as an explicit "no confounds" test case, not just an absence of assertions.
