# Contract: Metric Formulas

Every metric implemented in `src/metrics/` MUST match one of the definitions below exactly, including its stated denominator. `tests/contract/` MUST verify each formula against fixed fixtures. Per FR-23, every ratio/intensity metric's denominator MUST be displayed alongside its value, and a "per successful completion" metric MUST NOT be computed unless an independently verified success signal exists in the data (fall back to reporting the raw numerator).

## Efficiency (FR-15)

| Metric | Formula | Denominator |
|---|---|---|
| Turns | Count of main-task API calls (post FR-4 exclusion) | — |
| Input / output / cache-read / cache-creation tokens | Direct sums from main-task API calls | — |
| Tokens per turn | `total tokens (incl. cache) / turns` | Turns |
| Total tokens including cache | `input + output + cache-read + cache-creation` | — |
| Cost | Direct sum from main-task API calls | — |
| Tool calls | Count of executed tool calls (excludes rejections per FR-6) | — |
| Tool calls per turn | `tool calls / turns` | Turns |

## Duration breakdown (FR-16)

| Component | Formula |
|---|---|
| Total wall-clock duration | `last event timestamp − first event timestamp` (within the run) |
| Approval-wait time | Sum of intervals where a `tool_decision` has `source` indicating human approval (e.g., `user_temporary`, `user_reject`) between decision request and resolution |
| Other idle time | Sum of gaps between consecutive events exceeding a defined idle threshold, excluding approval-wait intervals |
| Active time | `total duration − approval-wait time − other idle time` |

Raw wall-clock duration MUST NOT be shown as a standalone "speed" comparison without this breakdown alongside it.

## Cache-creation intensity (FR-17)

| Metric | Formula | Denominator |
|---|---|---|
| Total new (non-cached) context tokens | Sum of cache-creation tokens across the run | — |
| Cache-creation per Read call | `total new context tokens / count(Read calls)` | Read call count |
| Cache-creation per Edit call | `total new context tokens / count(Edit calls)` | Edit call count |
| Cache-creation per tool call | `total new context tokens / count(all tool calls)` | Tool call count |

## Overhead-ratio trend (FR-18)

- Split the run into 4 equal-sized quartiles by event sequence (more buckets for very long runs, at implementer's discretion but MUST remain equal-sized within a run).
- Per bucket: `overhead ratio = cache-read tokens / output tokens` (within that bucket's events).
- Report the sequence of per-bucket ratios and the slope/steepness of growth across buckets.

## Tool-usage composition (FR-19, updated by UI Design Reconciliation)

- Count of tool calls grouped by tool name, including any connector/skill/MCP-style tool identifiers present in the data (not limited to Bash/Read/Edit/Write).
- A tool name present in **some but not all** loaded runs of a comparison set (i.e., at least one run has a non-zero count for that tool AND at least one run has a zero count) MUST be flagged as a **categorical** difference, distinct from a **difference of degree** (the same tool present with a non-zero count in every run, differing only by how many times it was called). This generalizes the original two-run "present in exactly one run" rule to arbitrary N.

## Error/recovery (FR-20)

| Metric | Formula |
|---|---|
| Failed-call count | Count of `tool_result` with outcome `failure` |
| Failed-call rate | `failed-call count / tool calls` (tool calls = denominator, shown per FR-23) |
| Rejection count | Count of `tool_decision` with `decision = rejected` (FR-6) — kept distinct from failures |
| Immediate recovery | For each failure, `true` if the next tool call by the agent addresses the same target (file/command) as the failed call |

## Exploration / validation / implementation ratios (FR-21)

- Categorize each executed tool call into exactly one of:
  - **Exploratory**: file reads, search-type shell calls (e.g., `Read`, `Grep`, `find`/`grep`-style Bash calls)
  - **Validating**: test execution, manual verification commands (e.g., test runners, lint/typecheck invocations)
  - **Implementing**: edits/writes (e.g., `Edit`, `Write`, file-creation calls)
- Ratio per category = `count(category) / total categorized tool calls`.
- The categorization ruleset (which tool names/command patterns map to which category) MUST be exposed in the UI on request (auditability, FR-21) — not a hidden internal lookup table.

## Code volume (FR-22)

| Metric | Formula |
|---|---|
| Net characters added (edits) | Sum of `(new content length − old content length)` across edit operations, using truncation-corrected lengths (see contracts/input-log-schema.md) |
| Net characters added (new files) | Sum of created-file content lengths, truncation-corrected |
| Net characters removed | Sum of negative deltas from edit operations, truncation-corrected |

## Denominator and fabrication-refusal rule (FR-23)

- Every ratio/intensity metric's display MUST include its denominator's raw count (e.g., "per Edit call (16)").
- A "per successful completion" metric (e.g., cost per successfully completed task) MUST only be computed when an independently verified success signal exists in the data (e.g., an explicit test-pass event, not an inferred one). If no such signal exists, the system MUST report the raw numerator alone and MUST NOT invent or approximate a completion-count denominator.
