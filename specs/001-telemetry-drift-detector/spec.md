# Feature Specification: Telemetry Drift Detector

**Feature Branch**: `001-telemetry-drift-detector`

**Created**: 2026-09-20

**Status**: Draft

**Input**: User description: "Telemetry Drift Detector — a product that ingests one or more Claude Code OTLP telemetry log exports and produces a report that separates real behavioral/token drift from noise and confounds, and flags when two logs shouldn't be compared at all because they weren't actually running the same kind of task."

## Clarifications

### Session 2026-09-20

- Q: Given that these telemetry logs can contain actual prompt text, file paths, and code-edit content, does this product need to guarantee that log data never leaves the user's own machine (fully local processing), or is server-side processing/storage acceptable? → A: Local-only — all parsing and analysis happens on the user's own machine; log contents are never transmitted to or stored on a server.
- Q: What's an acceptable maximum time for the system to generate a full comparison report after the user finishes uploading their logs, for a realistic worst case (10 runs, several MB each)? → A: Under 30 seconds.
- Q: FR-26 says the headline section ranks drifted metrics when "more than a small number" show significant drift — what's the concrete cutoff before metrics are ranked/truncated out of the headline section? → A: 5.
- Q: Should a generated comparison report be saveable/reloadable (e.g., re-opened later or shared with a teammate), or is it strictly a one-time, in-session view? → A: Session-only — the report exists only while the logs are loaded in the current session; re-analysis requires re-uploading the same logs.

### UI Design Reconciliation — 2026-09-20

A UI design document (`docs/UI-design`) was reviewed against this spec. Per explicit direction, the UI design's requirements were incorporated and take precedence over the specific prior decisions below where they conflicted; everything else in this spec is unchanged.

**Superseded decisions** (see revised FR text for the current, authoritative requirement):

- Relatedness gating (previously FR-8/FR-9: tiered, with a hard block on "unrelated") is now **always advisory** — a Relatedness Check step is shown for every 2+ run upload (even fully related ones), "Continue to comparison" is always available regardless of result, and a "view runs individually instead" path is offered whenever any pair/cluster is below full confidence.
- Report persistence (previously FR-31: strictly session-only, no export/reload) now **allows exporting a report to a local file and keeping a local recent-comparisons history**, provided nothing ever leaves the user's device.
- The FR-26 headline-KPI cap changes from 5 to **6**, matching the UI's "top 6 + link to the rest" pattern.
- FR-19's categorical-difference rule is generalized from "present in exactly one run" (a two-run framing) to **"present in some but not all loaded runs"**, so it behaves sensibly for N > 2.

**New capabilities added from the UI design**, with no prior spec coverage: pairwise/cluster relatedness display for N > 2 (FR-7, FR-8), a dominant-driver explanation panel (FR-33–FR-36, User Story 7), export and a local recent-comparisons history (FR-31, FR-32, User Story 6), comparison auto-titling (FR-37), and stable run labeling (FR-38).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - View a Single Run's Metrics (Priority: P1)

A user uploads exactly one telemetry log and sees that run's own metrics — tokens, cost, tool usage, timing breakdown — with no comparison or drift language, since there is nothing to compare against yet.

**Why this priority**: This is the foundation every other story builds on: parsing a log and computing per-run metrics correctly must work before any comparison is meaningful. It is also independently useful — a user auditing a single run's cost or behavior gets value without uploading a second log.

**Independent Test**: Upload one `.jsonl` log file and verify the report shows that run's efficiency, timing, tool-usage, and cost metrics, with no "drift," "vs.," or comparison UI present.

**Acceptance Scenarios**:

1. **Given** a single valid telemetry log is uploaded, **When** the report is generated, **Then** the user sees per-run metrics (turns, tokens, cost, tool usage, timing breakdown) with no drift/comparison language anywhere in the view.
2. **Given** a single log whose session contains zero completed task turns (e.g., an aborted session), **When** the report is generated, **Then** the system states plainly that no completed task activity was found, rather than showing zeroed-out or misleading metrics.

---

### User Story 2 - Detect Whether Uploaded Runs Are Actually Comparable (Priority: P1)

Whenever two or more logs are uploaded, the system runs a Relatedness Check before the comparison dashboard: it shows, per pair (or per cluster, for larger sets), a confidence rating and the plain-language reasoning behind it — using the actual prompt content, each run's starting repository state, and its working directory/project path. This step always appears, even when confidence is high, so the user sees *why* the runs are considered comparable rather than only the resulting numbers. It is advisory: the user can always continue to the comparison, but is also offered a way to view the runs individually instead whenever any pair looks doubtful.

**Why this priority**: This is the core trust guarantee of the product: it is the mechanism that makes sure the user never mistakes a meaningless comparison for a valid one, by making the basis for comparability visible up front rather than burying it or blocking silently.

**Independent Test**: Upload two logs describing clearly unrelated tasks (different repositories, different subject matter) and verify the Relatedness Check flags them as unrelated with stated reasoning, while comparison remains available if the user chooses to continue anyway; separately, upload two logs describing the same task on the same repository and verify the check shows a "Related" result with no further warning.

**Acceptance Scenarios**:

1. **Given** two or more uploaded logs, **When** the user finishes uploading, **Then** the Relatedness Check step always appears before the comparison dashboard, showing one row per pair (or per cluster, for larger sets) with a confidence rating (Related / Review recommended / Unrelated) and its plain-language reasoning displayed by default.
2. **Given** a pair of uploaded logs whose prompts describe unrelated tasks (or unrelated starting repositories), **When** the Relatedness Check runs, **Then** that pair is rated "Unrelated" with its reasoning shown, "Continue to comparison" remains available, and a "view runs individually instead" option is also offered.
3. **Given** two uploaded logs that describe the same task family but differ in one material respect (e.g., same repository, different starting commit; same task description, different starting file tree), **When** the Relatedness Check runs, **Then** that pair is rated "Review recommended" with its reasoning shown, and this caveat remains visible as a badge on the comparison dashboard even after the user continues past the check step.
4. **Given** two uploaded logs describing the same task on the same repository and comparable starting state, **When** the Relatedness Check runs, **Then** that pair is rated "Related" with confirming reasoning shown, and the comparison dashboard itself carries no warning indicator.
5. **Given** the Relatedness Check has rated any pair "Review recommended" or "Unrelated", **When** the user chooses "view runs individually instead", **Then** the head-to-head comparison is skipped entirely in favor of each run's own individual metrics view — this is always available as a choice, not just a fallback after being blocked.

---

### User Story 3 - Compare Two Related Runs and See What Actually Drifted (Priority: P1)

Once two logs are confirmed related, the user sees a report that separates genuine behavioral/token drift from noise and confounds (like human approval wait time or a resent prompt), with each metric classified by how much it drifted, and can drill from any headline number into the raw evidence behind it.

**Why this priority**: This is the primary value proposition of the product — a trustworthy answer to "did anything meaningfully change, and why," not just a pile of raw totals a user has to reinterpret by hand.

**Independent Test**: Upload two related logs where one metric (e.g., tool-call composition) clearly changed and others did not; verify the report classifies the changed metric with an appropriate drift severity, leaves unchanged metrics classified as no-drift, and allows drilling into the raw log evidence for at least one displayed number.

**Acceptance Scenarios**:

1. **Given** two related runs with differing tool-call composition, **When** the comparison report is generated, **Then** the report shows a per-metric drift classification for every metric where a meaningful comparison is possible, and marks metrics that cannot be computed for one run as "not available for this run" rather than zero.
2. **Given** a run whose wall-clock duration is dominated by human tool-approval wait time, **When** the report is generated, **Then** duration is broken into approval-wait time, other idle time, and active time before any raw wall-clock "speed" comparison is shown, and the affected metric's severity reflects that confound (see User Story 5).
3. **Given** any displayed metric value, **When** the user chooses to drill into it, **Then** the system shows the specific raw log evidence (event(s), file, and sequence/session identifier) that produced that value.
4. **Given** a run whose session contains more than one real user-task prompt (an incomplete prompt followed by a corrected resend), **When** the report is generated, **Then** this is shown as a labeled data-quality note attached to that run, including its estimated cost/turn impact, rather than being silently folded into the run's headline numbers.
5. **Given** a tool call that was decided but never executed (e.g., a rejected tool-permission decision), **When** tool-usage and error metrics are computed, **Then** that call is shown as a distinct rejection, not counted as a normal completed call or as a failure.

---

### User Story 4 - Compare More Than Two Runs at Once (Priority: P2)

A user uploads several variants of the same prompt (e.g., 5 versions in an A/B/C/D/E test) and sees group statistics per metric across all runs, with outlier run(s) identified, while still being able to view any two specific runs side-by-side on request.

**Why this priority**: Generalizing beyond a fixed two-run layout is what makes the product useful for real experimentation workflows, not just one-off A/B checks. It builds directly on User Stories 2 and 3 rather than replacing them.

**Independent Test**: Upload 5 related logs where one is a clear outlier on a given metric; verify the report shows group statistics (min/median/max/spread) for that metric, identifies the outlier run, and that the user can still select any two of the five runs for a pairwise view.

**Acceptance Scenarios**:

1. **Given** N related runs (N ≥ 3) are loaded, **When** the comparison report is generated, **Then** every applicable metric shows group statistics (min, median, max, spread) computed across all N runs, not a fixed "Run A vs Run B" layout.
2. **Given** N related runs are loaded and one run is the furthest from the group's central tendency on a metric, **When** the report is generated, **Then** that run is identified as the outlier for that metric, and the raw counts that drove the outlier status are viewable.
3. **Given** N related runs (N ≥ 3) are loaded, **When** the user selects any two specific runs, **Then** the system shows a pairwise comparison of just those two runs on request.
4. **Given** a large number of runs is loaded, **When** the report is displayed, **Then** charts and tables scale their layout to the number of runs rather than assuming exactly two columns/colors, switching to an aggregate/distribution view once per-run color-coding would stop being legible.

---

### User Story 5 - See Only What Actually Drifted, Not a Fixed KPI List (Priority: P2)

The report's headline section is generated from each metric's computed drift classification — only metrics that show at least moderate drift (or that the user has pinned) appear as headline callouts — rather than forcing every metric into a permanent, fixed-size KPI panel regardless of whether anything changed.

**Why this priority**: This directly addresses the stated problem of raw totals being "easy to pull but easy to misread." It depends on the drift classification produced in User Stories 3 and 4 and shapes how that output is presented.

**Independent Test**: Generate a comparison where only one metric shows significant drift; verify the headline section shows only that metric (plus any user-pinned metrics), while the full comparison table still lists every computed metric regardless of drift status. Separately, generate a comparison where nothing drifted and verify the system states this plainly.

**Acceptance Scenarios**:

1. **Given** a comparison where exactly one metric shows drift above "no drift," **When** the report is generated, **Then** only that metric (plus any user-pinned metrics) appears in the headline section.
2. **Given** a comparison where no metric shows drift above "no drift," **When** the report is generated, **Then** the system plainly states that no significant drift was detected, rather than displaying empty or forced KPI cards.
3. **Given** a comparison where more than 6 metrics show significant drift, **When** the headline section is generated, **Then** the drifted metrics are ranked by relative magnitude of change, only the top 6 appear in the headline section, and a link to the full table names how many more drifted metrics are not shown (e.g., "+3 more drifted metrics — view full table").
4. **Given** any comparison, **When** the user views the full comparison table, **Then** every computed metric is listed there regardless of whether it appears in the headline section.
5. **Given** a metric whose drift is affected by a named confound (a resent prompt, a mismatched starting repository state, or permission-wait time dominating duration), **When** that metric's classification is computed, **Then** it is forced to "uninterpretable" regardless of its computed statistical severity, and the reason is shown as a flag attached to that specific metric row — not in a separate, always-present validity panel.
6. **Given** a comparison with more than two runs, **When** a headline KPI card is generated for a drifted metric, **Then** the card shows the group's value range (min–max) together with an indication of which run is the outlier, rather than assuming exactly two values to compare.

---

### User Story 6 - Export a Comparison Report and Revisit Recent Work (Priority: P3)

A user exports a completed comparison to a local file for sharing or later reference, and sees a "recent comparisons" list on the upload screen to quickly recognize and reopen past work without hunting for the original log files each time.

**Why this priority**: This is a convenience layer on top of the core drift-detection value — the tool is fully usable without it — added specifically to match the UI design's upload-screen and dashboard-toolbar behavior.

**Independent Test**: Generate a comparison, export it, refresh the browser, confirm it appears in the recent-comparisons list, and confirm reopening it restores the full report without re-uploading the original logs.

**Acceptance Scenarios**:

1. **Given** a completed comparison, **When** the user selects "Export report," **Then** a local file containing the comparison's computed report (metrics, drift classifications, relatedness reasoning) is downloaded to the user's device, with no content transmitted to any server.
2. **Given** the user has previously generated one or more comparisons in this browser, **When** they view the upload screen, **Then** a recent-comparisons list shows each one's title, run labels, and timestamp.
3. **Given** an entry in the recent-comparisons list, **When** the user selects it, **Then** the previously computed report reopens without requiring the original log files to be re-uploaded.
4. **Given** the browser's local storage for this app is cleared, **When** the user views the upload screen, **Then** the recent-comparisons list is empty — no data survives outside the browser's own local storage.

---

### User Story 7 - See the Likely Dominant Driver of Drift (Priority: P3)

Alongside the headline KPIs, the user sees a short, auto-generated explanation naming the single factor most responsible for the largest observed drift, backed by the specific metrics/tool calls that support it — or, when no single factor stands out, an explicit statement that no dominant driver was found rather than a forced narrative. For a single uploaded run (no comparison), the same panel instead summarizes that run's own session characteristics.

**Why this priority**: This is an interpretive convenience layered on top of the already-classified drift data (User Stories 3 and 5) — valuable, but the tool delivers its core value without it, and its generation method carries architectural risk against the local-only processing constraint (see Assumptions), so it is scoped as a later increment rather than core MVP.

**Independent Test**: Given a comparison where one metric's drift clearly traces to one specific, identifiable behavioral change, verify the panel names that cause and cites the specific supporting metrics/tool calls as evidence; given a comparison where drift is spread evenly across unrelated metrics, verify the panel explicitly states that no single dominant driver was identified.

**Acceptance Scenarios**:

1. **Given** a comparison where one metric's drift clearly dominates and traces to a specific, identifiable behavioral cause, **When** the report is generated, **Then** a driver panel names that cause in a short summary, cites the specific supporting metrics/tool calls as evidence, and includes 2–3 supporting numbers drawn from that evidence.
2. **Given** a comparison where drift is spread across several unrelated metrics with no single dominant cause, **When** the report is generated, **Then** the panel explicitly states that no single dominant driver was identified, rather than forcing a narrative.
3. **Given** exactly one uploaded run (no comparison), **When** the report is generated, **Then** the panel instead shows a plain session-summary of that run's own characteristics, with no causal or comparison language.

---

### Edge Cases

- Exactly one log uploaded — no comparison or drift language is shown (User Story 1).
- Two or more logs that are related but not identical in starting state (e.g., same repository, different commit) are rated "Review recommended" by the Relatedness Check, not a hard pass/fail, and the comparison remains available regardless (User Story 2).
- Three or more logs where some pairs are related and others are not — the Relatedness Check reports each pair/cluster's own rating rather than collapsing the whole set into a single verdict (User Story 2).
- A log containing zero completed task turns (e.g., an aborted session) is reported as such rather than producing misleading zeroed metrics.
- A log using a newer or older telemetry schema than others in the set (new event/tool types present in only one file) does not silently break comparison of the metrics that ARE shared across all files; unrecognized event types are visibly reported as "unrecognized, not included in metrics."
- A metric that cannot be computed for one run in the set at all (missing field, unsupported tool type) is shown as "not available for this run" rather than defaulting to zero.
- All N runs show no drift on every metric — the headline section states this plainly as a valid outcome.
- A run with an explicit tool-call rejection or a resent prompt is shown as such, not misread as a normal error or as a duplicated task.
- A metric intensity (e.g., cache-creation per tool call) drifts even when the corresponding total does not — both are computed and shown independently.
- A comparison where drift is spread across many unrelated metrics with no single dominant cause — the dominant-driver panel states this explicitly rather than forcing a narrative (User Story 7).
- A user reopens a recent comparison after the underlying log files have been moved, renamed, or deleted from their machine — the previously exported/retained report still opens correctly since it does not depend on the original files still being present (User Story 6).

## Requirements *(mandatory)*

### Functional Requirements

**Ingestion & parsing**

- **FR-1**: The system MUST accept an arbitrary number of `.jsonl` OTLP log files in a single session (minimum 1, no fixed maximum), remaining usable at sizes from a few hundred log lines up to files several MB in size.
- **FR-2**: The system MUST flatten each file's nested log structure and unwrap each attribute's typed value envelope before any analysis runs.
- **FR-3**: The system MUST order each file's events by its own event-sequence field before doing anything time-ordered, and MUST treat sequence numbers as meaningful only within a single session (never compared across files).
- **FR-4**: The system MUST identify and exclude non-task API calls (at minimum: session-title generation, prompt suggestions, and away-summary calls) from all "main task" metrics, while still making their cost/token totals visible separately for full-session accounting.
- **FR-5**: The system MUST detect when a single session contains more than one real user-task prompt (e.g., an incomplete prompt followed by a corrected resend) and MUST report this as a data-quality note attached to that specific run, including its estimated cost/turn impact, rather than silently folding it into the run's headline numbers.
- **FR-6**: The system MUST verify tool-decision-to-tool-result pairing for every run and MUST separately surface any tool call that was decided but never executed (e.g., a rejected decision), rather than treating it as a normal completed tool call.

**Task-relatedness check**

- **FR-7**: Whenever 2 or more logs are uploaded, before presenting the comparison dashboard, the system MUST run a Relatedness Check assessing whether the uploaded logs represent runs of a related task, using at minimum: (a) a content comparison of the actual prompt text captured in each log, (b) each run's starting repository state where available (branch, commit history, working directory), and (c) each run's working directory/project path. For 3 or more uploaded runs, this assessment MUST be produced per pair (or per cluster of mutually related runs), not collapsed into one verdict for the whole set.
- **FR-8**: The Relatedness Check MUST rate each pair/cluster as "Related," "Review recommended," or "Unrelated" and MUST always display this step before the comparison dashboard — even when every pair is rated "Related" — so the basis for comparability is visible up front. Proceeding to the comparison dashboard ("Continue to comparison") MUST always be available regardless of any pair/cluster's rating; the check is advisory, not a hard gate. Individual per-run metrics remain viewable for each log regardless of relatedness outcome.
- **FR-9**: Whenever any pair/cluster is rated "Review recommended" or "Unrelated," the system MUST also offer a "view runs individually instead" path that skips the head-to-head comparison entirely in favor of each run's own single-run view. A pair/cluster rated below "Related" MUST keep a visible reminder badge on the comparison dashboard even after the user continues past the Relatedness Check, so the caveat isn't lost once they proceed.
- **FR-10**: The Relatedness Check's plain-language reasoning for each pair/cluster MUST be shown by default alongside its rating (not hidden behind an additional request) — e.g., "these two prompts both describe implementing a monthly-budget feature on the same repository" or "prompt A describes a budgeting feature; prompt B describes an authentication refactor; these do not appear to be the same task."

**Scalable N-run comparison**

- **FR-11**: All comparison metrics MUST generalize to N runs: every metric is computed once per run, then summarized across the full set (median, min, max, spread, and each run's deviation from the group median) rather than only supporting exactly two runs. Wherever this spread/deviation measure is displayed to the user (e.g., in a "Spread" column), it MUST be the same measure used for the metric's drift classification — never a different statistic shown under the same label.
- **FR-12**: The system MUST identify the outlier run(s) per metric — the run(s) furthest from the group's central tendency — and make the raw counts that drove that outlier status viewable.
- **FR-13**: The system MUST support viewing any two specific runs side-by-side on demand, even when more than two are loaded.
- **FR-14**: Charts and tables MUST scale their layout to the number of runs loaded rather than assuming exactly two colors/columns, switching to an aggregate/distribution view once per-run color-coding would stop being legible (default: at more than 8 loaded runs; see Assumptions).

**Metrics computed per run, then compared across runs**

- **FR-15**: The system MUST compute efficiency metrics per run: turns (main-task API calls only, per FR-4), input/output/cache-read/cache-creation tokens, tokens per turn, total tokens including cache, cost, tool calls, and tool calls per turn.
- **FR-16**: The system MUST compute a confound-aware duration breakdown per run: total wall-clock duration; time spent waiting on interactive tool-permission approval; other unexplained idle gaps above a defined threshold; and "active time" defined as time not explained by the previous two — and MUST show this breakdown before ever presenting raw wall-clock duration as a comparable "speed" metric.
- **FR-17**: The system MUST compute cache-creation intensity per run: total new (non-cached) context tokens entering the run, normalized per Read call, per Edit call, and per tool call overall — computed and shown even when total-token or tokens-per-turn comparisons show no drift.
- **FR-18**: The system MUST track the overhead ratio (cache-read tokens divided by output tokens) across equal-sized quartiles of each run (or more buckets for very long runs), showing how steeply the ratio grows over the course of the run.
- **FR-19**: The system MUST compute tool-usage composition per run — count of tool calls broken down by tool name, including any connector/skill-type tools present in the data, not only the core file/shell tools — with categorical differences (a tool present in some but not all loaded runs — at least one run has a non-zero count and at least one has zero) flagged distinctly from differences of degree (the same tool present in every run, differing only in count).
- **FR-20**: The system MUST compute error/recovery metrics per run: count and rate of tool calls with a failed outcome; count of explicit tool-call rejections (distinct from failures); and identification of an immediate recovery action following a failure where one exists.
- **FR-21**: The system MUST compute exploration/validation/implementation ratios per run — the proportion of tool calls that are exploratory (file reads, search-type calls), validating (test execution, manual verification), or implementing (edits/writes) — with the categorization method used made visible/auditable.
- **FR-22**: The system MUST compute code-volume metrics per run — net characters added/removed by edit and file-creation operations — correcting for any truncation the source telemetry applies to large field values by detecting the truncation marker pattern and reconstructing the true original length rather than silently under-counting.
- **FR-23**: Every derived ratio or intensity metric MUST show its denominator alongside it (e.g., "per Edit call (16)"), and the system MUST refuse to compute any "per successful completion" metric unless an independently verified success signal is present in the data — reporting the raw numerator instead of fabricating a denominator when one isn't available.

**Dynamic, drift-driven KPI surfacing**

- **FR-24**: The system MUST classify every computed metric into a drift-severity level (no drift / moderate / large / categorical / cannot-determine / uninterpretable), using thresholds computed statistically relative to each metric's own spread across the loaded N runs (e.g., deviation from the group median in multiples of a spread measure), applied consistently rather than judged ad hoc per metric.
- **FR-25**: The top-of-report headline/KPI section MUST be generated from this classification, not from a fixed predetermined list of metrics — only metrics classified `moderate`, `large`, or `categorical` (i.e., above "no drift," explicitly excluding `cannot-determine` and `uninterpretable` — a metric the system cannot vouch for MUST NOT be presented as a headline finding, per SC-006) — and metrics the user has pinned, if pinning is supported, appear as headline KPIs. If nothing qualifies, the system MUST say so plainly rather than displaying empty or forced KPI cards. For a comparison with more than two runs, a headline KPI card MUST show the group's value range (min–max) together with an indication of which run is the outlier, rather than assuming exactly two values to display.
- **FR-26**: When more than 6 metrics show significant drift, the system MUST rank them by relative magnitude of change, show only the top 6 in the headline section, and provide a link to the full comparison table stating how many additional drifted metrics are not shown, so the headline stays scannable rather than growing unbounded.
- **FR-27**: Every metric — whether surfaced as a headline KPI or not — MUST remain visible in a full, unfiltered comparison table.

**Data-validity / confounds**

- **FR-28**: The product MUST NOT include a permanently-present, fixed-size "data validity notes" panel. Validity/confound findings (e.g., a resent prompt, a mismatched starting repository state, a schema/version difference between runs) MUST instead be surfaced as contextual flags attached to the specific run, metric, or comparison they affect, rather than collected into a separate always-shown block. If there are zero validity findings for a given comparison, no confound-related UI appears for it at all.
- **FR-29**: When a named confound applies to a metric — a resent prompt within the affected run, a mismatched starting repository state between compared runs, or permission-wait time dominating wall-clock duration — the system MUST force that metric's drift classification to "uninterpretable" regardless of its computed statistical severity, and MUST show the confound as the reason on that metric's flag.

**Data handling & privacy**

- **FR-30**: The system MUST process and analyze uploaded telemetry logs entirely on the user's own machine. Log contents — including prompt text, file paths, and code-edit content — MUST NOT be transmitted to or stored on a remote server at any point during ingestion, analysis, or report display.
- **FR-31**: The system MUST allow a user to export a completed comparison report to a local file, and MUST maintain a local, in-browser history of recent comparisons (title, run labels, timestamp) so past work can be recognized and reopened later. All exported/retained data MUST remain on the user's device — never transmitted to or synced through a remote server (FR-30). Clearing the browser's local storage for this app removes this history entirely.
- **FR-32**: Reopening a recent or previously exported comparison MUST restore its full computed report (metrics, drift classifications, relatedness reasoning) without requiring the original `.jsonl` files to be re-uploaded or re-parsed.

**Dominant-driver summary**

- **FR-33**: When a comparison has one or more metrics classified above "no drift," the system MUST attempt to identify the single metric contributing most to the largest drift and generate a short explanation naming the likely cause, citing the specific metrics/tool-call evidence behind it alongside 2–3 supporting numbers drawn from that evidence.
- **FR-34**: If no single metric's drift clearly dominates (drift is spread across multiple unrelated metrics with no clear single cause), the system MUST state this explicitly rather than fabricating a narrative.
- **FR-35**: For a single uploaded run (no comparison), the system MUST show a plain, non-comparative session-summary of that run's own characteristics in place of the dominant-driver explanation.
- **FR-36**: Any generated explanation text (dominant-driver summary or session summary) MUST be produced using only information already computed locally from the run's own data (per FR-30); the system MUST NOT transmit prompt text, code content, or file paths to a remote service in order to produce this text.

**Run and comparison identity**

- **FR-37**: The system MUST generate a short, human-readable title for each comparison (e.g., derived from the shared task description) for display in navigation elements such as a breadcrumb. This title MUST be generated locally without transmitting prompt content off-device (per FR-30).
- **FR-38**: The system MUST assign each run a stable, human-readable label (e.g., "Run 1," "Run 2," … in upload order) used consistently across every view — identity cards, charts, tables, and headline callouts.

### Key Entities

- **Log file**: One uploaded `.jsonl` OTLP export; has a session identifier, a build version, a working directory, a starting repository state, and an ordered event stream.
- **Run**: The unit of comparison; normally one log file equals one run, but a log file may contain more than one real task prompt (FR-5), which affects how a run is scoped. Each run carries a stable, human-readable label (FR-38).
- **Task**: The underlying thing being attempted; used by the relatedness check to decide whether two runs' tasks are the same, related, or unrelated.
- **Metric**: A named, computed quantity for a run (e.g., "cache-creation per edit call"), always with a defined formula and denominator.
- **Comparison**: A set of 1–N runs plus, for N ≥ 2, the per-metric drift classifications and group statistics computed across them. Has a generated title (FR-37) and, once completed, can be exported and reopened later from a local recent-comparisons history (FR-31, FR-32).
- **Drift classification**: The severity label attached to a metric within a comparison (no drift / moderate / large / categorical / cannot-determine / uninterpretable).
- **Confound / validity finding**: A specific, evidenced reason a particular metric or run should be interpreted carefully (e.g., permission-wait time dominating duration; a resent prompt; a mismatched starting repository state).
- **Dominant driver finding**: The single metric identified as contributing most to a comparison's largest drift, together with its supporting evidence and generated explanation — or an explicit "no single driver" result when none stands out (FR-33–FR-35).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can go from uploading logs to a drift-or-no-drift answer in which every classification is traceable to evidence (per SC-003) and every confound is disclosed (per SC-006) — without manually reading raw log files — for sets ranging from 1 to at least 10 uploaded logs, using the same workflow regardless of count.
- **SC-002**: When uploaded logs represent different or unrelated tasks, the Relatedness Check surfaces this — with the specific reasoning — before the user ever reaches the comparison dashboard, in 100% of cases where the tasks are clearly unrelated (different repositories and unrelated subject matter).
- **SC-003**: Every number shown in a report can be traced back to the specific raw log evidence that produced it on request.
- **SC-004**: When no metric shows meaningful drift across a comparison, the report states this plainly rather than presenting empty, zeroed, or forced KPI panels — measured as zero instances of misleading empty-state KPI displays across test comparisons.
- **SC-005**: For any metric flagged as drifted, a user can identify which specific run is the outlier and see the raw counts justifying that classification without additional analysis.
- **SC-006**: A metric affected by a known confound (resent prompt, mismatched starting state, approval-wait-dominated duration) is never presented as a trustworthy computed drift severity — it is always shown as "uninterpretable" with the reason stated.
- **SC-007**: No content from an uploaded log (prompt text, file paths, code-edit content) is ever transmitted off the user's device during ingestion, analysis, report viewing, export, or local history retention.
- **SC-008**: A full comparison report is generated in under 30 seconds for a worst-case set of 10 runs at several MB each.
- **SC-009**: A user can reopen a previously generated comparison from the recent-comparisons list, or from a previously exported file, without re-uploading the original log files.
- **SC-010**: When a single dominant cause exists behind a comparison's drift, the dominant-driver panel names it with supporting evidence; when none exists, the panel says so explicitly rather than presenting a fabricated explanation.

## Assumptions

- Uploaded logs conform to the Claude Code OTLP telemetry schema (or a close variant); logs from unrelated agent tooling are out of scope.
- A user has already captured telemetry exports before using this product; capturing/instrumenting telemetry itself is out of scope.
- The default threshold for switching from per-run color-coded views to an aggregate/distribution view (FR-14) is more than 8 loaded runs; this may be tuned based on user feedback but a reasonable default is needed for the initial release. The run-color palette itself provides 5 visually distinct colors before colors repeat at reduced opacity from the 6th run onward — a separate legibility consideration from the >8-run layout switch, and one the eventual color/pattern design should account for independently.
- Drift-severity thresholds (FR-24) are derived statistically from the spread of the loaded run set itself, rather than fixed universal percentages, per the resolved clarification on this point.
- The recent-comparisons history and exported reports (FR-31, FR-32) are stored only in the browser's own local storage for the device/browser profile that created them; clearing that browser's site data removes them entirely, and none of it is synced across devices or transmitted to a server (FR-30).
- The dominant-driver and session-summary explanations (FR-33–FR-36) are generated from locally computed metrics and evidence only (e.g., template-based composition from the identified metric and its supporting evidence), not from a remote language-model call, in order to preserve the local-only processing guarantee (FR-30). This may limit the fluency/specificity of generated explanations compared to a hypothetical server-side approach — an accepted trade-off, consistent with the same local-only reasoning already applied to the relatedness check's text comparison.
- The product classifies and explains the magnitude and likely cause of drift; it does not judge whether a given drift is "good" or "bad" (e.g., more expensive but more thorough verification is reported, not evaluated).
- The product does not verify the actual correctness or outcome of the task the agent performed (test results, code review); this is explicitly outside what telemetry alone can establish, and reports say so rather than inferring it.
- The product does not automatically fix or re-run the underlying agent based on findings.
