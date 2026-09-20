# Telemetry Drift Detector

A client-only web app that ingests one or more Claude Code OTLP telemetry log exports (`.jsonl`) and produces a report separating real behavioral/token drift from noise and confounds — flagging when two logs shouldn't even be compared because they weren't running the same kind of task.

Everything runs in the browser. Nothing is uploaded anywhere: parsing, analysis, drift classification, and explanation generation all happen locally, and local history/export never leaves the device (see `specs/001-telemetry-drift-detector/spec.md` FR-30).

## Setup

```bash
npm install
npm run dev
```

Open the printed local URL and upload one or more `.jsonl` log files. No server or network configuration is required.

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Type-check (`tsc -b`) and build for production |
| `npm run preview` | Preview a production build |
| `npm test` | Run unit + contract + integration tests (Vitest) |
| `npm run test:unit` | Unit tests only |
| `npm run test:contract` | Contract tests only (verify formulas/rules against `specs/.../contracts/`) |
| `npm run test:integration` | Integration tests only (React Testing Library, component-level) |
| `npm run test:e2e` | End-to-end tests (Playwright, requires `npx playwright install chromium` once) |
| `npm run lint` | ESLint |

## Architecture overview

The app is a single-page React + Vite application with no backend. Full technical context and rationale live in `specs/001-telemetry-drift-detector/plan.md`; the summary:

- **`src/parsing/`** — OTLP JSONL ingestion: flattens `resourceLogs[].scopeLogs[].logRecords[]`, unwraps typed attribute values, sequences events per file, excludes non-task API calls from main-task metrics, detects resent prompts, and pairs `tool_decision`/`tool_result` events. Tolerates unrecognized event types without corrupting the rest of the file. Runs off the main thread via a Web Worker (`src/workers/parseLogWorker.ts`).
- **`src/relatedness/`** — Rates whether 2+ uploaded runs are actually comparable: prompt-text similarity, starting-repository-state comparison, and working-directory comparison combine into a per-pair `related`/`partial`/`unrelated` confidence with human-readable reasoning. Related pairs cluster via transitive closure for N-run display. Purely advisory — never blocks comparison.
- **`src/metrics/`** — Per-run calculators: efficiency (tokens, cost, turns), duration breakdown (approval-wait / other-idle / active time), cache-creation intensity, overhead-ratio trend, tool-usage composition, error/recovery, exploration/validation/implementation activity ratios, and code volume (using truncation-corrected lengths).
- **`src/drift/`** — Cross-run comparison: generalizes group statistics (median/min/max/spread/deviation) to N runs, identifies outliers, classifies each metric's drift severity against a spread-relative threshold table, detects confounds (resent prompt, mismatched repo state, approval-wait-dominated duration) that force a metric to `uninterpretable`, and ranks/caps the dynamic headline section.
- **`src/dominant-driver/`** — Identifies the single metric most responsible for a comparison's drift (or explicitly states none dominates) and composes a template-based explanation with supporting evidence and numbers — never a remote model call. Composes a plain, non-comparative summary for single-run uploads.
- **`src/reporting/`** — Serializes a computed `Comparison` to the shared export/recent-comparisons format (`contracts/export-format.md`), excluding raw log content and full prompt text; drives file export and re-import.
- **`src/state/`** — In-memory session state (Zustand) for the current tab's uploaded runs, plus an IndexedDB-backed local history of recent comparisons.
- **`src/components/` / `src/pages/`** — UI: per-run view, relatedness check, comparison dashboard (headline KPIs, full metric table, charts, pairwise selector, dominant-driver panel), upload/recent-comparisons screen.

## Tests

Tests are organized to match the project's TDD approach:

- `tests/contract/` — verifies formulas and classification rules against the frozen contracts in `specs/001-telemetry-drift-detector/contracts/`.
- `tests/unit/` — focused unit tests (e.g. the no-network-egress guard).
- `tests/integration/` — component-level tests rendering real pages/components against fixture data.
- `tests/e2e/` — Playwright browser tests covering the `quickstart.md` validation scenarios, performance (SC-008), no-network-egress (SC-007), and export/reopen round-trip (SC-009).
- `tests/fixtures/` — `.jsonl` OTLP fixture files (regenerate with `node tests/fixtures/generate.mjs`).

See `specs/001-telemetry-drift-detector/` for the full spec, plan, data model, and contracts this implementation follows.
