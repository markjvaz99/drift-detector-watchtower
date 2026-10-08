# Telemetry Drift Detector

A client-only web app that ingests one or more Claude Code OTLP telemetry log exports (`.jsonl`) and produces a report separating real behavioral/token drift from noise and confounds — flagging when two logs shouldn't even be compared because they weren't running the same kind of task.

Everything runs in the browser. Nothing is uploaded unless you opt in to the AI insights feature with your own API key. Parsing, relatedness checks, metrics, drift classification, and the dominant-driver explanation all run locally; the dominant-driver explanation is template-based and makes no model call. Local history and export stay on the device. See [Network access](#network-access) for exactly what the opt-in features send.

## Documentation

- [`Product_README.md`](Product_README.md) — product overview, metrics, the AI layer, and privacy details.
- [`Dashboard_Readme.md`](Dashboard_Readme.md) — component-by-component tour of the dashboard UI.
- [`specs/001-telemetry-drift-detector/`](specs/001-telemetry-drift-detector/) — the original frozen spec, plan, data model, and contracts.

## Network access

- **No key, no requests.** With no API key saved in the browser (and no dev-only `VITE_ANTHROPIC_API_KEY`, see below), the app makes no requests beyond loading its own static assets. `tests/e2e/no-network-egress.spec.ts` (SC-007, FR-30) asserts zero non-localhost requests across upload, comparison, export, and reload; `tests/unit/relatedness-no-network-egress.test.ts` and `tests/unit/dominant-driver-no-network-egress.test.ts` run those modules with `fetch`/`XMLHttpRequest` disabled.
- **Opt-in AI features.** The only outbound calls are two features in `src/recommendations/` that call `api.anthropic.com` directly from the browser with your own key — there is no backend in between:
  - _Business insights_ — runs only when you click "Generate business insights". Sends the comparison title, each run's label and user-typed prompt text (all prompts joined, truncated to 4,000 characters), data-quality notes, relatedness reasoning, the session summary, and preformatted values for the notable metrics.
  - _Suggested names_ — sends each run's label and user-typed prompts (each truncated to 2,000 characters). Runs when you click "Suggest names", and also automatically once per new comparison whenever a key is already saved.
- **API key.** Stored in `localStorage` only (`src/recommendations/apiKeyStore.ts`) and removable via "Forget key". Under `npm run dev` only, `VITE_ANTHROPIC_API_KEY` from `.env.local` is used when no key is saved, which also enables the automatic naming call; this fallback is disabled in production builds and under Vitest.
- **Local data.** The recent-comparisons history (IndexedDB) and exported `.driftreport.json` files stay on the device.

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

## Run-count gate

Drift is only labelled when a comparison contains at least 3 runs. With fewer, every metric's severity is shown as "cannot determine" (including metrics that would otherwise read "no drift" or "categorical"), and the dominant-driver panel states that it was not assessed. Metrics already marked uninterpretable by a confound keep that label. The threshold is `MIN_RUNS_FOR_DRIFT` in `src/drift/runCountGate.ts`. The tool compares one group of runs, so the count applies to the whole comparison.

## Architecture overview

The app is a single-page React + Vite application with no backend. Full technical context and rationale live in `specs/001-telemetry-drift-detector/plan.md`; the summary:

- **`src/parsing/`** — OTLP JSONL ingestion: flattens `resourceLogs[].scopeLogs[].logRecords[]`, unwraps typed attribute values, sequences events per file, excludes non-task API calls from main-task metrics, detects resent prompts, and pairs `tool_decision`/`tool_result` events. Tolerates unrecognized event types without corrupting the rest of the file. Runs off the main thread via a Web Worker (`src/workers/parseLogWorker.ts`).
- **`src/relatedness/`** — Rates whether 2+ uploaded runs are actually comparable: prompt-text similarity, starting-repository-state comparison, and working-directory comparison combine into a per-pair `related`/`partial`/`unrelated` confidence with human-readable reasoning. Related pairs cluster via transitive closure for N-run display. Purely advisory — never blocks comparison.
- **`src/metrics/`** — Per-run calculators: efficiency (tokens, cost, turns), duration breakdown (approval-wait / other-idle / active time), cache-creation intensity, overhead-ratio trend, tool-usage composition, error/recovery, exploration/validation/implementation activity ratios, and code volume (using truncation-corrected lengths).
- **`src/drift/`** — Cross-run comparison: generalizes group statistics (median/min/max/spread/deviation) to N runs, identifies outliers, classifies each metric's drift severity against a spread-relative threshold table, detects confounds (resent prompt, mismatched repo state, approval-wait-dominated duration) that force a metric to `uninterpretable`, and ranks/caps the dynamic headline section.
- **`src/dominant-driver/`** — Identifies the single metric most responsible for a comparison's drift (or explicitly states none dominates) and composes a template-based explanation with supporting evidence and numbers — never a remote model call. Composes a plain, non-comparative summary for single-run uploads.
- **`src/recommendations/`** — The opt-in AI layer (business insights and suggested names): API-key storage, payload building, and direct browser calls to the Anthropic API. The only code that makes network requests.
- **`src/reporting/`** — Serializes a computed `Comparison` to the shared export/recent-comparisons format (`contracts/export-format.md`), excluding raw log content and full prompt text; drives file export and re-import.
- **`src/state/`** — In-memory session state (Zustand) for the current tab's uploaded runs, plus an IndexedDB-backed local history of recent comparisons.
- **`src/components/` / `src/pages/`** — UI: per-run view, relatedness check, comparison dashboard (headline KPIs, full metric table, charts, pairwise selector, dominant-driver panel), upload/recent-comparisons screen.

## Tests

Tests are organized to match the project's TDD approach:

- `tests/contract/` — verifies formulas and classification rules against the frozen contracts in `specs/001-telemetry-drift-detector/contracts/`.
- `tests/unit/` — focused unit tests (e.g. the relatedness and dominant-driver no-network-egress checks).
- `tests/integration/` — component-level tests rendering real pages/components against fixture data.
- `tests/e2e/` — Playwright browser tests covering the `quickstart.md` validation scenarios, performance (SC-008), no-network-egress (SC-007), and export/reopen round-trip (SC-009).
- `tests/fixtures/` — `.jsonl` OTLP fixture files (regenerate with `node tests/fixtures/generate.mjs`).

See `specs/001-telemetry-drift-detector/` for the full spec, plan, data model, and contracts this implementation follows.

## Authorship

Specified, designed and verified by Mark Vaz; code written with Claude Code.
