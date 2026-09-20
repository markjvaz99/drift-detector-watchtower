# Contract: Export / Recent-Comparisons Report Format

Governs the single shared serialization format used by `src/reporting/` for (a) the file produced by "Export report," (b) the payload written to the local IndexedDB recent-comparisons history, and (c) what re-import/reopen reads back (FR-31, FR-32). `tests/contract/` MUST verify a round-trip: serialize a `Comparison` → write/export → read back → deep-equal to the original (modulo the fields explicitly excluded below).

## File shape

A single JSON document:

```json
{
  "formatVersion": 1,
  "exportedAt": "2026-09-20T00:00:00.000Z",
  "comparison": { "...": "serialized Comparison, see data-model.md" }
}
```

- `formatVersion` MUST be present and MUST be checked on import; an unrecognized (future) version MUST fail import with a clear "this file was exported by a newer version of the app" message rather than attempting a best-effort partial read.
- `exportedAt` is independent of any run's own timestamps — it records when the export/save happened.

## What is included

- The full serialized `Comparison`: `runIds`, `title`, `relatednessAssessment` (including all `PairwiseRelatedness`/`RelatednessCluster` detail), `metrics`, `groupStatistics`, `driftClassifications`, `headlineMetricKeys`, `pinnedMetricKeys`, `dominantDriverFinding` or `sessionSummary`.
- Enough per-run identity to re-render the report: each run's `label`, `sourceLogFileId` (opaque, for internal cross-referencing only — see exclusion below), and the `EvidenceReference`s needed for drill-down (`logFileId`, `sequence`, `sessionIdentifier` — identifiers only, not content).

## What is explicitly excluded (privacy boundary, ties to FR-30)

- Raw `LogFile.events` (the full flattened event stream) — re-opening a report is a read of already-computed results, not a re-parse.
- `Run.taskPromptText` in full — only what `RelatednessAssessment.pairs[].reasoning` and `DominantDriverFinding.explanation` already quote/paraphrase as generated text is included; the raw original prompt string is not separately duplicated into the export.
- Any file path or code-edit content beyond what a `Metric`'s already-computed numeric value represents.

This keeps an exported/retained report meaningfully smaller and less sensitive than the original logs, consistent with `research.md` §4's "persist only the derived report, not the raw content" decision.

## Import / reopen behavior (FR-32)

- Reading a valid export MUST fully reconstruct the `Comparison` for display — every view (headline KPIs, full table, charts, relatedness screen, dominant-driver panel) MUST render identically whether the `Comparison` came from a fresh analysis or from import, with one exception: evidence drill-down for an imported report resolves against the identifiers in the export, not against any files re-selected by the user, and MUST state plainly when the original log file isn't currently available to re-verify against (it does not block viewing the already-computed evidence reference).
- Import MUST NOT require the user to re-select or re-upload the original `.jsonl` files.

## Recent-comparisons history vs. exported file

Both use this exact format. Writing to the local IndexedDB history (`RecentComparisonEntry.reportPayload`, per `data-model.md`) happens automatically whenever a comparison completes; producing a downloadable file happens only when the user explicitly selects "Export report." The two are otherwise the same operation against the same schema, per `research.md` §9.
