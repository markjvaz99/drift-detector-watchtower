# Implementation Plan: Telemetry Drift Detector

**Branch**: `001-telemetry-drift-detector` | **Date**: 2026-09-20 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-telemetry-drift-detector/spec.md`

## Summary

Ingest 1–N Claude Code OTLP telemetry log exports and produce a report that separates genuine behavioral/token drift from noise and confounds, preceded by an always-shown, advisory Relatedness Check that rates each pair/cluster of runs (Related / Review recommended / Unrelated) so the user always sees the basis for comparability before trusting any numbers. Per the spec's Clarifications and the subsequent UI Design Reconciliation, this is a single-page, client-only web application: all parsing and analysis run in the user's browser (no backend, no data transmission — FR-30). Unlike the original session-only design, a comparison can now be exported to a local file and reopened later from a local recent-comparisons history (FR-31/FR-32) — still without any server involvement. A locally generated dominant-driver explanation panel (FR-33–FR-36) rounds out the report as a later increment (User Story 7).

## Technical Context

**Language/Version**: TypeScript 5.x, running in the browser (ES2022 target)

**Primary Dependencies**: React 18 (UI), Vite (build/dev server), a composable charting library (Recharts) for the scaling N-run charts/box-plots required by FR-14, `idb` (a small Promise wrapper over IndexedDB) for the local recent-comparisons history required by FR-31

**Storage**: No server-side storage (still precluded by FR-30). Client-side only: IndexedDB holds the local recent-comparisons history (title, run labels, timestamp, and the full computed report payload per FR-32) so entries survive a page refresh; nothing is written until a comparison completes, and clearing the browser's site data removes it entirely (FR-31, Assumptions)

**Testing**: Vitest (unit + contract tests for parsing/metric/relatedness/drift/dominant-driver logic), React Testing Library (component-level UI states), Playwright (end-to-end quickstart flows)

**Target Platform**: Modern evergreen desktop browsers (latest two versions of Chrome, Edge, Firefox, Safari) with IndexedDB support; no server-side runtime

**Project Type**: Single-project client-only web application (no backend/API layer — precluded by FR-30)

**Performance Goals**: Full comparison report generated in under 30 seconds for a worst-case set of 10 runs at several MB each (SC-008); UI thread must remain responsive during ingestion/analysis (no dropped input/frozen tab)

**Constraints**: Fully client-side and network-independent during analysis (FR-30 — no log content, generated explanation text, exported file, or recent-comparisons entry is ever transmitted off-device); relatedness gating is advisory only, never a hard block (FR-8); must degrade gracefully across telemetry schema versions without breaking parsing of the rest of a file (per Edge Cases)

**Scale/Scope**: 1 to at least 10 uploaded logs per comparison (SC-001), each up to several MB / tens of thousands of log lines; no fixed maximum run count (FR-1), with layout switching to an aggregate/distribution view beyond 8 runs (FR-14); relatedness is assessed pairwise across up to N·(N-1)/2 pairs and grouped into clusters for display (FR-7)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

`.specify/memory/constitution.md` is still the unpopulated template (all principle placeholders unfilled) — no project-specific principles have been ratified for this repository yet. There are therefore no project-specific gates to check this plan against beyond the spec-kit defaults implicit in the workflow itself: keep the design as simple as the requirements allow, avoid speculative abstraction, and make every functional requirement independently testable.

This plan satisfies those defaults: a single client-only project (no speculative backend, no premature multi-service split) with a structure organized around the spec's own functional groupings (parsing, relatedness, metrics, drift, dominant-driver, persistence). The one new piece of complexity versus the original plan — a local IndexedDB persistence layer — is directly required by FR-31/FR-32 (export + recent-comparisons), not speculative; it stores data only, with no new service boundary. **No violations to justify; Complexity Tracking is not needed.**

*Post-Phase-1 re-check*: Unchanged — the data model and contracts in Phase 1 introduce no server-side services and no dependency beyond the local IndexedDB wrapper already listed above. Gate still passes.

## Project Structure

### Documentation (this feature)

```text
specs/001-telemetry-drift-detector/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
│   ├── input-log-schema.md
│   ├── metric-formulas.md
│   ├── drift-classification-rules.md
│   ├── export-format.md
│   └── dominant-driver-rules.md
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
src/
├── parsing/            # OTLP JSONL ingestion: flatten, unwrap typed values, sequence-order,
│                       # exclude non-task calls, detect resent prompts, pair tool_decision/tool_result
│                       # (FR-1..FR-6) — see contracts/input-log-schema.md
├── relatedness/        # Task-relatedness heuristic engine: prompt-content comparison, starting
│                       # repo-state comparison, working-directory comparison, PAIRWISE confidence
│                       # rating for every run pair, clustering of mutually "related" runs for
│                       # display, and human-readable reasoning per pair/cluster (FR-7..FR-10)
├── metrics/            # Per-run metric calculators: efficiency, duration breakdown, cache-creation
│                       # intensity, overhead-ratio trend, tool-usage composition, error/recovery,
│                       # exploration/validation/implementation ratios, code volume (FR-15..FR-23)
│                       # — see contracts/metric-formulas.md
├── drift/              # Cross-run comparison: N-run generalization, group statistics, outlier
│                       # detection, drift-severity classification, confound-forced overrides,
│                       # headline ranking (FR-11..FR-14, FR-24..FR-29)
│                       # — see contracts/drift-classification-rules.md
├── dominant-driver/    # Identifies the single metric most responsible for a comparison's largest
│                       # drift and composes a template-based explanation from its supporting
│                       # evidence, or an explicit "no single driver" result; single-run session
│                       # summaries (FR-33..FR-36) — see contracts/dominant-driver-rules.md
├── reporting/          # Serializes a completed Comparison to the exportable report file format
│                       # and restores one from a file or the local history (FR-31, FR-32)
│                       # — see contracts/export-format.md
├── workers/            # Web Worker entry points wrapping parsing/metrics/drift computation so the
│                       # UI thread stays responsive on worst-case input sizes (SC-008)
├── components/         # Dashboard UI: upload, single-run view, Relatedness Check screen (per
│                       # pair/cluster rows), relatedness reminder badges, headline KPIs, dominant-
│                       # driver/session-summary panel, full comparison table, evidence drill-down
│                       # panel, per-chart-type N-run charts (grouped-bar, line, per-tool-name,
│                       # stacked-bar) each with its own large-N fallback, export control, recent-
│                       # comparisons list
├── pages/              # Top-level views: single-run page, Relatedness Check page (new — only
│                       # shown for 2+ uploads), comparison page
└── state/              # In-memory session state (uploaded logs/runs) plus a thin wrapper around
│                       # the IndexedDB-backed recent-comparisons history (FR-31)

tests/
├── contract/           # Verifies parsing output matches contracts/input-log-schema.md, each
│                       # metric's computed value matches contracts/metric-formulas.md, dominant-
│                       # driver selection matches contracts/dominant-driver-rules.md, and exported/
│                       # reimported reports match contracts/export-format.md, all on fixtures
├── unit/                # Pure-function edge cases: truncation reconstruction, resent-prompt
│                       # detection, tool_decision/tool_result pairing, denominator refusal rule,
│                       # pairwise-to-cluster grouping
├── integration/         # Multi-module flows: ingest → metrics → relatedness → drift → headline →
│                       # dominant-driver, using synthetic multi-run fixture sets (2-run and N-run
│                       # scenarios), plus export → clear state → reimport round-trips
└── e2e/                  # Playwright: upload-to-report quickstart scenarios (see quickstart.md)
```

**Structure Decision**: Single-project, client-only web application. There is no backend/API tier to structure separately — FR-30 (local-only processing) rules out a server component entirely, so all ingestion, analysis, local persistence, and rendering live in one browser-side codebase organized by the spec's own functional groupings (parsing → relatedness → metrics → drift → dominant-driver → reporting → presentation).

## Complexity Tracking

*Not applicable — no Constitution Check violations were identified.*
