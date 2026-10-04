# Telemetry Drift Detector — Product Overview

A client-only web app that ingests Claude Code session telemetry (`.jsonl` OTLP exports) and tells you what
actually changed between two or more coding-agent runs — cost, tokens, tool usage, wall-clock time, code
volume — and whether that difference is real, statistically meaningful "drift" or just noise, confound, or one
run simply doing more work. Everything runs in the browser. Nothing is uploaded anywhere by default.

## The problem this solves

If you run the same coding task twice — once with a quick, generic prompt and once with a detailed,
fully-specified one — you'll usually see very different numbers: different token counts, different costs,
different turn counts, different tool-call patterns. The question this tool exists to answer is: **which of
those differences are real, and which are noise?**

A raw diff of two sessions' totals is misleading on its own. A run that did more turns and used more tokens
might genuinely have done more work (larger scope, more files touched) — or it might have needed more
back-and-forth because the initiating prompt was under-specified, requiring the agent to ask, guess, or get
redirected. A run that took twice as long in wall-clock time might not have taken twice as long to actually
*work* — most of that time might be a human sitting on an approval prompt. A session with a resent, corrected
prompt has its early turns and cost slightly inflated by a data-quality artifact, not real behavioral drift.

The app's job is to separate those cases out automatically: compute per-run metrics from the raw telemetry,
compare them across runs using group statistics (not a naive percentage diff), classify each metric's drift
severity against a spread-relative threshold, detect known confounds that make a comparison unreliable, and
present the result as a dashboard — with an optional AI layer that turns the numbers into a business-readable
narrative, grounded entirely in the same computed values, never invented ones.

The core, recurring thesis the tool is built to test and demonstrate: **prompt detail matters.** A generic
prompt run needing several follow-up prompts, more turns, and more tool calls to reach the same outcome that a
detailed prompt reached directly is the single most useful finding this tool can surface, and the AI-insights
layer treats it as its primary interpretive lens (see "The AI layer" below).

## How it works — the pipeline

1. **Upload** one or more `.jsonl` OTLP telemetry exports from a Claude Code session (`src/components/UploadPanel.tsx`).
2. **Parse and flatten**, off the main thread in a Web Worker (`src/workers/parseLogWorker.ts`): each raw line's
   `resourceLogs[].scopeLogs[].logRecords[]` structure is unwrapped from its typed-value envelope
   (`src/parsing/unwrapAttributes.ts`) into a flat, ordered stream of events — `api_call` (aliased from real
   telemetry's `api_request`), `tool_decision`, `tool_result`, and `user_prompt` — sequenced by their own
   `event.sequence` attribute, not file order (`src/parsing/flattenLogRecords.ts`, `sequenceEvents.ts`).
   Anything not in that known set (housekeeping markers like `retention_sweep`, etc.) is counted and kept only
   as a duration-boundary hint, never silently dropped and never treated as a task event.
3. **Build a Run** (`src/parsing/buildRun.ts`): resolves the session's effective task prompt (the *last*
   `user_prompt`, since an earlier one may have been an incomplete draft that was corrected), detects a
   resent-prompt data-quality issue if one exists, pairs every `tool_decision` with its matching `tool_result`,
   and flags whether the run has any completed task activity at all.
4. **Compute per-run metrics** (`src/metrics/`): efficiency (tokens, cost, turns), duration breakdown
   (active / human-approval-wait / other-idle time), cache-creation intensity, an overhead-ratio trend across
   the session's quartiles, tool-usage composition by tool name, error/recovery counts, exploratory/validating/
   implementing activity-mix ratios, and net code volume written.
5. **Merge and compare across runs** (`src/drift/buildComparison.ts`): computes group statistics (median, min,
   max, spread, per-run deviation, outliers) generalized to any number of runs, classifies each metric's drift
   severity, detects confounds that should override that classification, ranks a dynamic "headline" subset, and
   identifies (if one exists) the single dominant driver of the comparison.
6. **Assess relatedness** (`src/relatedness/`): before trusting a comparison, the app rates whether the
   uploaded runs actually describe the same task — purely advisory, computed entirely locally, never blocking.
7. **Render the dashboard** (`src/pages/ComparisonView.tsx` and friends — see `Dashboard_Readme.md` for a full
   component-by-component tour).
8. **Optionally, generate AI insights** (`src/recommendations/`): with a user-supplied Anthropic API key, turn
   the computed comparison into a business-readable narrative and/or a suggested title/run labels.
9. **Export or persist**: a computed comparison can be downloaded as a `.driftreport.json` file
   (`src/reporting/exportReport.ts`) or is automatically written to a local IndexedDB history
   (`src/state/localHistoryStore.ts`) for later reopening — both exclude raw log content and full prompt text.

## Architecture

A single-page React 18 + TypeScript application built with Vite, with **no backend of any kind**. There is no
server component in this repository, no API route, no database beyond the browser's own IndexedDB. Parsing,
metric computation, drift classification, and confound detection are all pure, synchronous (or Worker-hosted)
TypeScript functions operating on data that never leaves the tab except for the two opt-in Anthropic API calls
described below.

- **State**: Zustand (`src/state/sessionStore.ts`) holds the current tab's in-memory session — uploaded log
  files, built runs, an evidence index for drill-down, and pinned metric keys.
- **Persistence**: `idb` (a small Promise wrapper over IndexedDB) backs a local "recent comparisons" history
  (`src/state/localHistoryStore.ts`), storing the same privacy-safe serialized `Comparison` shape used for file
  export — never raw log events or full prompt text.
- **Parsing performance**: large `.jsonl` files are parsed inside a dedicated Web Worker
  (`src/workers/parseLogWorker.ts` / `parseLogInWorker.ts`) so a big upload doesn't freeze the UI thread.
- **Charts**: `recharts` for the one true line chart (overhead-ratio trend); everything else (grouped bars,
  strip plots, stacked duration bars, box-plot distributions) is small hand-rolled SVG/CSS, since the app's
  charts need to gracefully re-lay-out from 2 runs up to dozens (see `Dashboard_Readme.md`'s chart section).
- **Schema validation for AI output**: `zod`, via Anthropic's `zodOutputFormat` structured-output helper.

## Key concepts

**Drift severity** (`DriftSeverity` in `src/types.ts`): every numeric metric is classified by how far its most
extreme run deviates from the group, in units of the group's own spread (`src/drift/classifySeverity.ts`):

- `no-drift` — max deviation < 1× spread
- `moderate` — 1×–3× spread
- `large` — > 3× spread
- `categorical` — a tool (or other by-name behavior) was used in some runs and not others at all; a
  present/absent difference has no continuous scale, so it's classified independently of the numeric thresholds
  (`src/drift/categoricalDifference.ts`)
- `cannot-determine` — insufficient data to classify (e.g. the metric has no numeric value in any run)
- `uninterpretable` — a detected confound (below) forces this metric's classification to be discarded

For exactly two runs, "spread" is the smaller of the two values (so deviation scales with the pair's relative
magnitude, not a degenerate ±1 that a raw min/max spread would always produce for a pair); for three or more
runs it's the median absolute deviation, falling back to the same relative-magnitude baseline when MAD collapses
to zero despite a real single-run outlier (`src/drift/groupStatistics.ts`).

**Confounds** (`ConfoundType` in `src/types.ts`) are conditions that make a metric's raw comparison unreliable
enough to override its severity to `uninterpretable`, detected in `src/drift/applyConfoundOverrides.ts`:

- `resent-prompt` — a run's early turns/cost/tokens are inflated by an incomplete prompt that was immediately
  corrected; only applied to the specific metrics (turns, total tokens, cost) the resend could plausibly
  explain a meaningful share of the observed gap for, not blanket-suppressed
- `mismatched-repo-state` — the compared runs started from different commits on the same repo, tainting code-
  volume and cache-intensity metrics specifically
- `approval-wait-dominated` — a run's wall-clock duration is more than half human approval-wait time, so its
  total-duration metric is not a fair measure of agent speed
- `schema-version-mismatch` — reserved in the type system for a future telemetry-schema-compatibility check; not
  currently produced by any detector

**Group statistics** generalize a two-run "A vs. B" comparison to N runs: median, min, max, spread, each run's
deviation from the group, and which run(s) are the outlier(s) (`src/drift/groupStatistics.ts`,
`identifyOutliers.ts`).

**Relatedness confidence** (`related` / `partial` / `unrelated`, `src/relatedness/`) rates each pair of uploaded
runs before the app lets you trust a head-to-head comparison: a local, in-browser cosine-similarity score over
each run's prompt text (`promptSimilarity.ts`, no network call, no LLM), combined with a starting-repository-
state comparison (same branch and commit vs. drifted vs. unknown) and a working-directory comparison. Related
runs on the same task cluster together via union-find for clean N-run display; a mismatch never blocks the
comparison, only flags it.

**Dominant driver**: when a comparison has a drift-qualifying metric whose magnitude beats the runner-up by at
least 1.5×, the app identifies it as the single dominant driver and composes a template-based (non-AI)
explanation with supporting numbers and evidence references (`src/dominant-driver/`). This is computed as part
of every `Comparison` but is not currently rendered as its own dashboard panel (an earlier "Root cause" card was
removed in favor of the AI insights panel); it remains part of the exported/history report shape.

## The AI layer

Two optional features call the Anthropic API directly from the browser, using a key the user supplies —
**bring your own key (BYOK)**. Neither ever fires without the user having either saved a key or explicitly
clicked a button that prompts for one.

- **AI business insights** (`src/recommendations/`): reads the run prompts (every real prompt the user typed in
  the session, not just the last one) and the computed comparison, and returns a small set of business-facing
  "stat cards" plus a recommended action and any data-quality caveats. See `Dashboard_Readme.md` for the card
  anatomy.
- **AI-suggested naming** (`generateComparisonNames.ts` / `SuggestNamesButton.tsx`): suggests a context-aware
  comparison title and per-run labels from the actual prompt content, replacing the deterministic default (the
  longest real prompt across all runs, title-cased and stripped of stopwords —
  `src/drift/generateComparisonTitle.ts`). Auto-fires once per comparison if a key is already saved; otherwise
  stays a manual button, and never auto-prompts for a key.

**Safety architecture — the numbers are never LLM-generated.** For business insights, a payload builder
(`buildBusinessInsightsPayload.ts`) precomputes every candidate statistic's formatted per-run values and
comparison string (e.g. `"3.9x"`, `"21.4 min vs 1.7 min"`) in plain TypeScript before the model ever sees the
data. The model's structured-output schema only lets it *select* a `metricKey` from that fixed candidate list
and *narrate* it (title, explanation, business implication, recommendation, confidence, caveat) — any response
referencing a metric key that isn't in the candidate list is discarded before it reaches the UI. This means
every number a user sees on an insight card is traceable to a deterministic calculation, not something the
model computed or could hallucinate. The system prompt additionally forbids "statistically significant" /
"not noise" language (nothing here is a formal significance test) and requires correlation-not-causation
phrasing, except for one explicit, intentional exception: when a less-detailed-prompt run also shows a higher
workload (turns/tool calls/tokens/cost) on the *same task*, the model is instructed to state the prompt-detail
explanation as the leading interpretation directly — that connection is this tool's whole reason for existing,
not an overclaim to hedge away.

**Key handling**: the API key is stored in `localStorage` only (`src/recommendations/apiKeyStore.ts`) and used
solely in direct client-side calls to `api.anthropic.com` — never sent anywhere else, never logged. In local
development, an optional `VITE_ANTHROPIC_API_KEY` in `.env.local` is used as a fallback when no key has been
saved yet, purely for developer convenience; it is inert in any production build (`import.meta.env.DEV`-gated)
and additionally inert under Vitest (`import.meta.env.VITEST`-gated), so automated test runs can never
accidentally trigger a real, billed API call even if a developer's local `.env.local` has a live key in it.

## Tech stack

| Package | Version | Why |
|---|---|---|
| `react` / `react-dom` | ^18.3 | UI |
| `vite` | ^5.4 | Dev server, build, Worker bundling |
| `typescript` | ^5.5 | Strict-mode typed domain model across parsing/metrics/drift |
| `zustand` | ^4.5 | Minimal in-memory session state, no boilerplate |
| `idb` | ^8.0 | Promise-friendly IndexedDB wrapper for local comparison history |
| `recharts` | ^2.12 | The one real line chart (overhead-ratio trend) |
| `zod` | ^4.6 | Runtime schema for the AI structured-output response |
| `@anthropic-ai/sdk` | ^0.127 | Direct browser calls to the Anthropic Messages API (BYOK) |
| `vitest` | ^2.0 | Unit/contract/integration test runner |
| `@playwright/test` | ^1.47 | Real-browser e2e tests |
| `@testing-library/react` | ^16.0 | Integration tests against real rendered pages |

## Running it locally

```bash
npm install
npm run dev
```

Open the printed local URL and upload one or more `.jsonl` log files (or try the bundled sample data — see
below). No server or network configuration is required; the only network calls the app ever makes are the
user's own opted-in Anthropic API requests.

| Script | Purpose |
|---|---|
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Type-check (`tsc -b`) and build for production |
| `npm run preview` | Preview a production build |
| `npm test` | Run unit + contract + integration tests (Vitest) |
| `npm run test:unit` | Unit tests only |
| `npm run test:contract` | Contract tests only |
| `npm run test:integration` | Integration tests only (React Testing Library, full-page renders) |
| `npm run test:e2e` | End-to-end tests (Playwright; run `npx playwright install chromium` once first) |
| `npm run lint` | ESLint |

## Repo layout

```
src/
  components/     UI building blocks used by the pages — see Dashboard_Readme.md for the full tour
  pages/          The four top-level screens: AppRoot, UploadPanel's destination views,
                  RelatednessCheckView, ComparisonView, SingleRunView
  parsing/        Raw OTLP JSONL -> ordered events -> a Run (ingestion, flattening, sequencing,
                  resent-prompt detection, tool-call pairing, prompt extraction, evidence lookup)
  metrics/        Per-run metric calculators (efficiency, duration, cache intensity, overhead trend,
                  tool usage, error recovery, activity ratios, code volume)
  drift/          Cross-run comparison: group statistics, severity classification, categorical-
                  difference detection, confound detection/override, headline ranking, comparison
                  title generation
  dominant-driver/  Single-driver selection and template-based (non-AI) explanation/session-summary text
  relatedness/    Local, non-AI comparability check between runs (prompt similarity, repo state,
                  working directory)
  recommendations/  The AI layer: BYOK key storage, payload building, the Anthropic call, and the
                  structured-output schema for both AI features
  reporting/      Serialize/deserialize a Comparison to the .driftreport.json export format
  state/          Zustand session store (in-memory) + IndexedDB recent-comparisons history
  ui/             Small shared UI helpers (per-run color assignment)
  workers/        Web Worker entry point for off-main-thread log parsing
  styles/         The app's single theme.css (dark by default, print/light overrides for PDF export)
  types.ts        The shared domain model: Run, Metric, Comparison, DriftClassification, etc.
```

## Sample data

`sample-logs/` ships two real Claude Code `.jsonl` telemetry exports (a generic-prompt and a detailed-prompt run
of the same feature) plus two pre-built `.driftreport.json` exports you can import directly via the upload
screen's "Import a previously exported report" link — a fast way to see the dashboard without waiting on a real
Claude Code session. `case-study/` contains a full worked analysis
(`README-drift-findings-monthly-budget.md`) of one such detailed-vs-generic pair, written the way this tool's
own AI-insights layer is designed to reason: it found that the metric most people check first (tokens per turn)
showed essentially no drift, that the real driver was a tool-strategy divergence (one run loaded a browser-
automation skill the other didn't), and that raw wall-clock duration was unusable for either run because 86–89%
of it was human approval-wait time — exactly the class of confound this app is built to catch automatically.

## Testing philosophy

- **Contract tests** (`tests/contract/`, e.g. `drift-severity.contract.test.ts`,
  `dominant-driver-selection.contract.test.ts`) verify pure algorithmic invariants — the classification
  thresholds, group-statistics formulas, confound rules — independent of any UI.
- **Unit tests** (`tests/unit/`) cover isolated functions in isolation, e.g. the no-network-egress guard and the
  AI payload/formatting builders.
- **Integration tests** (`tests/integration/`, e.g. `evidence-drilldown.test.tsx`, `headline-no-drift.test.tsx`)
  render real pages/components against fixture telemetry with React Testing Library, verifying end-to-end
  behavior without a browser.
- **E2E tests** (`tests/e2e/`, Playwright) drive an actual browser through upload → comparison → export/reopen
  round-trips, including an explicit no-network-egress assertion (`no-network-egress.spec.ts`) and a performance
  check.

This project was originally built following a spec-driven-development workflow (see `specs/001-telemetry-
drift-detector/` for the frozen spec, data model, and per-subsystem contracts an early implementation phase was
built against); the AI-insights layer and dashboard redesign described here were added afterward and are
documented primarily in this file and `Dashboard_Readme.md` rather than in that original spec.

## Privacy and security

- **No backend.** There is no server in this repository. The entire pipeline — parsing, metric computation,
  drift classification, confound detection, relatedness assessment — runs synchronously (or in a Web Worker) in
  the user's own browser tab.
- **No telemetry upload, ever, except the user's own explicit AI calls.** Uploaded log files and everything
  derived from them stay in memory and, for history, in the browser's local IndexedDB. A network-egress guard
  (`src/parsing/assertNoNetworkEgress.ts`) replaces `fetch` and `XMLHttpRequest` with functions that throw; it
  is installed only in tests (the relatedness and dominant-driver unit tests), not in the running app, and
  `tests/e2e/no-network-egress.spec.ts` separately asserts zero external requests in a real browser with no
  API key configured.
- **AI calls are opt-in and direct.** The only network requests this app ever makes are calls to
  `api.anthropic.com`, made only after the user has supplied their own API key, and only when they click a
  "Generate" / "Suggest" action (or, for naming, once automatically per comparison — only if a key is already
  saved).
- **API key handling**: stored in `localStorage` only, never transmitted anywhere except directly to Anthropic,
  never logged, and clearable from the UI at any time ("Forget key").
- **Export privacy boundary**: `.driftreport.json` exports and the local history both exclude raw log events and
  full prompt text — only already-computed metric values, classifications, and short excerpts survive
  serialization (`src/reporting/reportSerializer.ts`).
