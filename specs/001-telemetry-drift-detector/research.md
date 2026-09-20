# Phase 0 Research: Telemetry Drift Detector

## 1. Application shape: client-only web app vs. alternatives

**Decision**: A single-page TypeScript + React application built with Vite, with no backend/API tier.

**Rationale**: FR-30 requires that log contents never be transmitted to or stored on a remote server. A browser-based app that reads uploaded files via the File API and does all parsing/computation in-tab satisfies this by construction — there is no server in the request path to accidentally leak data to. A componentized UI framework is warranted because the dashboard has real conditional structure (relatedness banners, dynamic headline KPIs, drill-down panels, N-run charts that change shape past a threshold — FR-14) rather than a static report.

**Alternatives considered**:
- *Local Python CLI/notebook tool*: satisfies local-only processing but is a poor fit for "upload logs, browse a dashboard, drill into evidence" interactions described throughout the user stories; would need a bespoke UI layer anyway.
- *Local Python web server (e.g., Streamlit/Flask) serving to localhost*: still requires a running server process and installation step, and blurs the "never transmitted" guarantee (a local server is easy to reason about, but it's an unnecessary moving part compared to a static, installable-free browser tab). Rejected in favor of the simpler pure-client model.
- *Native desktop app (Electron/Tauri)*: would satisfy local-only processing but adds packaging/distribution/update-channel overhead with no corresponding benefit for this MVP's needs; a browser tab is zero-install and just as capable here.

## 2. Charting approach for scalable N-run views

**Decision**: Recharts (composable React chart components).

**Rationale**: FR-14 requires charts/tables to scale their layout with the number of loaded runs, including a defined fallback to an aggregate/distribution view beyond a per-run color-coding threshold (8 runs, per spec Assumptions). Recharts provides composable primitives (bar, line, and box/violin-style distribution charts via community extensions) that map cleanly onto React state without hand-rolled SVG/D3 work, keeping the MVP's charting layer thin.

**Alternatives considered**:
- *Raw D3*: maximum flexibility but significantly higher implementation cost for an MVP; better suited if/when bespoke visualizations are needed later.
- *Chart.js*: solid but less idiomatic to compose declaratively inside React state-driven views; weaker fit for the "swap chart type based on run count" requirement.

## 3. JSONL ingestion strategy and performance

**Decision**: Stream-read each uploaded file, split on newlines, `JSON.parse` each line, and run the full flatten → sequence → classify → compute pipeline inside a Web Worker per file (fan-out), with results merged on the main thread.

**Rationale**: SC-008 requires a full report in under 30 seconds for a worst case of 10 runs at several MB each, and the UI must stay responsive while that happens. Offloading parsing and metric computation to Web Workers keeps the main thread free to render progress/interaction, and per-file workers parallelize naturally since files are independent until the cross-run comparison step.

**Alternatives considered**:
- *Synchronous main-thread parsing*: simplest to implement, but risks a frozen tab on worst-case input, which the spec explicitly treats as a failure mode (UI must remain responsive).
- *WASM-based parser*: unnecessary complexity for `.jsonl` files of this size; plain `JSON.parse` per line is fast enough at the stated scale.

## 4. Session state and persistence (revised — UI Design Reconciliation)

**Decision**: In-memory application state (React context / a lightweight store such as Zustand) for uploaded logs/runs during active parsing, plus an IndexedDB-backed store (via the `idb` wrapper) for the local recent-comparisons history and exported report re-import, per the spec's revised FR-31/FR-32.

**Rationale**: The original session-only decision was superseded during UI Design Reconciliation: the UI explicitly requires an "Export report" action and a "recent comparisons" list on the upload screen, both of which require some form of local persistence. IndexedDB is chosen over `localStorage` because a comparison's full computed payload (metrics for up to ~10 runs, drift classifications, relatedness reasoning) can be large and is naturally structured data — `localStorage`'s ~5–10MB synchronous string-only quota is a poor fit, while IndexedDB is async, has a much larger practical quota, and stores structured objects directly.

**What is and isn't persisted**: Only the *computed report* (per `contracts/export-format.md`) is written to IndexedDB — never the raw uploaded `.jsonl` file contents themselves, once parsing/analysis for that session is done. This keeps the retained footprint to derived, already-summarized data rather than re-storing full raw logs, while still satisfying "reopen without re-uploading" (FR-32).

**Alternatives considered**:
- *`localStorage`*: simpler API, but quota and synchronous-string-only constraints make it a poor fit for a report payload covering up to 10 runs; reserved only for trivial UI prefs, none of which currently exist in this feature.
- *No persistence at all (original decision)*: cleanest from a data-retention standpoint, but explicitly superseded — the UI's export/recent-comparisons requirements are a deliberate product decision to reopen this trade-off, not an oversight.
- *Persisting raw uploaded log content alongside the computed report*: would make "reopen" trivially re-runnable from scratch, but retains more sensitive raw content locally than necessary; rejected in favor of persisting only the derived report.

## 5. Task-relatedness comparison method (FR-7–FR-10)

**Decision**: A client-side heuristic combining (a) lexical/semantic-ish text-similarity over normalized prompt tokens (e.g., TF-IDF cosine similarity plus keyword/entity overlap) with (b) structural signals extracted from the log — starting repository branch/commit lineage and working directory/project path — combined into a three-tier confidence result (related / partial / unrelated) with a human-readable explanation template (FR-10). This is computed **per pair** of runs (see §7 for how pairs are grouped for N > 2 display), and the check is advisory only (FR-8): it never blocks the comparison, it only informs it.

**Rationale**: FR-30 rules out sending prompt content to a remote LLM for a true semantic comparison, since that would transmit log content off-device. A local, deterministic text-similarity heuristic combined with the structural repo/path signals the spec already calls for (FR-7b, FR-7c) keeps everything on-device and is sufficient to distinguish "same feature on the same repo" from "unrelated task on an unrelated repo" — the two ends of the spectrum the user stories actually test. The partial-confidence tier ("Review recommended", FR-8) absorbs the cases where the heuristic is less certain (e.g., same repo, different commit) rather than forcing a binary call.

**Important caveat carried into design**: This heuristic is lower-fidelity than an LLM-based semantic judgment would be. Prompts that are topically similar but use very different vocabulary may be under-classified as unrelated, or vice versa. This is an accepted MVP trade-off directly driven by the local-only constraint (FR-30) and should be revisited if a future iteration allows an on-device model (e.g., a WASM/WebGPU local LLM) — noted here rather than silently designed around.

**Alternatives considered**:
- *Server-side or third-party LLM call for semantic comparison*: rejected outright — violates FR-30.
- *On-device LLM (WebLLM/WASM)*: technically local-only, but adds significant download size and inference latency risk against the 30-second SC-008 budget for what is, in the MVP, a two-tier classification problem; deferred as a future enhancement rather than MVP scope.

## 6. Testing strategy

**Decision**: Vitest for pure-function contract/unit tests of parsing, metric formulas, relatedness scoring, and drift classification; React Testing Library for component-level UI-state tests (empty state, blocked comparison, headline suppression); Playwright for end-to-end quickstart flows.

**Rationale**: The highest-risk, highest-value logic in this feature is the domain computation (parsing correctness, metric formulas, relatedness heuristic, drift thresholds) — all pure, easily unit-testable functions — so the testing investment is weighted there first, matching the spec's own emphasis on traceability and auditability (NFR-1/FR-23). UI-state and end-to-end tests then confirm that computed results are surfaced correctly (dynamic KPI surfacing, drill-down, relatedness gating).

**Alternatives considered**:
- *Jest*: comparable capability to Vitest, but Vitest integrates natively with the chosen Vite build tool (shared config, faster watch mode).
- *Cypress*: comparable to Playwright for e2e; Playwright chosen for built-in multi-browser support matching the "evergreen browsers" target platform.

## 7. Relatedness assessment for N > 2 runs (pairwise + clustering)

**Decision**: Compute the relatedness heuristic from §5 for every pair of loaded runs — O(N·(N-1)/2) pairs — then group pairs rated "related" into clusters via transitive closure (if A–B and B–C are both "related", A/B/C form one cluster), so the Relatedness Check screen shows one row per cluster (or per pair, when clustering doesn't apply) rather than an unwieldy full pairwise matrix once N grows.

**Rationale**: `spec.md` FR-7 now explicitly requires per-pair/per-cluster display for 3+ runs (the UI design's Relatedness Check screen shows exactly this). Clustering related pairs keeps the screen readable at N=5+ while still letting the underlying per-pair detail surface (e.g., in a tooltip or expandable row) since nothing is discarded — only the default presentation is grouped.

**Alternatives considered**:
- *Raw N×N pairwise matrix, always shown in full*: simplest to compute and reason about, but doesn't match the UI's "per cluster, for larger N" design and becomes visually unwieldy past a handful of runs (10 runs = 45 pairs).
- *A single holistic relatedness verdict for the whole set* (the pre-reconciliation design): rejected — can't express "3 of 5 runs are clearly the same task, but run 4 is something else," which is exactly the scenario FR-7's per-pair/cluster requirement exists to handle.

## 8. Dominant-driver and session-summary text generation

**Decision**: A local, template-based composition: identify the metric with the largest `|deviation|` among all metrics classified above "no drift" (per `contracts/drift-classification-rules.md`); if that metric's `|deviation|` is at least 1.5× the next-largest qualifying metric's, treat it as the dominant driver and fill a parameterized sentence template naming it, citing its top contributing raw evidence (e.g., specific tool calls) and 2–3 supporting numbers pulled directly from that metric's data. If no metric clears that 1.5× margin over the runner-up, emit the fixed "no single dominant driver identified" message instead (FR-34). For a single uploaded run, the same module instead composes a plain, non-comparative session-summary sentence from that run's own headline metrics (FR-35).

**Rationale**: FR-36 requires this text be generated without transmitting prompt/code content to a remote service, for the same reason the relatedness heuristic stays local (§5): FR-30's local-only guarantee applies to derived-text generation just as much as to numeric analysis. A deterministic, threshold-based template keeps the feature auditable and testable (a fixed contract in `contracts/dominant-driver-rules.md`) rather than depending on a model call.

**Important caveat carried into design** (same shape as §5's caveat): template-generated prose is necessarily less fluent and specific than a hypothetical LLM-authored explanation would be. This is an accepted, explicit trade-off for staying local-only, not an oversight — flagged here and in `spec.md`'s Assumptions so it isn't rediscovered as a "bug" later.

**Alternatives considered**:
- *On-device LLM (WebLLM/WASM)*: same rejection as the relatedness check — download size and inference latency risk against SC-008's 30-second budget, deferred as a future enhancement.
- *Server-side/third-party LLM call*: rejected outright — violates FR-30/FR-36.

## 9. Export/report file format

**Decision**: Export produces a single versioned JSON file containing the full computed `Comparison` payload (per-run metrics, drift classifications, relatedness assessment, dominant-driver finding, run labels/titles) as defined in `contracts/export-format.md`. The same format is what's stored in IndexedDB for the recent-comparisons history and what re-import reads back.

**Rationale**: Keeping export, local history, and re-import on one shared schema means "export to a file" and "keep locally" are the same serialization path exercised two ways, minimizing duplicated logic and duplicated contract surface. JSON keeps the format both human-inspectable (a user can technically open and read what they exported) and trivially versioned (a top-level `formatVersion` field) for forward compatibility as the report shape evolves.

**Alternatives considered**:
- *PDF/HTML export*: better for reading/sharing/printing, but not machine-re-importable — would need a second format for the "reopen without re-uploading" requirement (FR-32), doubling the export surface for the MVP. Deferred as a possible additional export option later, not a replacement for the JSON format.
- *Bundling the original raw `.jsonl` files into the export*: would make re-analysis trivial and let a teammate re-derive everything from scratch, but significantly increases the exported file's size and re-includes raw prompt/code content in a file meant to be shared — in tension with the same privacy-conscious reasoning behind FR-30. Rejected in favor of exporting only the already-computed, summarized report.

## Outstanding items

None — all Technical Context unknowns are resolved above. No open `NEEDS CLARIFICATION` markers remain.
