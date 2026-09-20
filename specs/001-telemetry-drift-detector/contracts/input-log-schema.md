# Contract: Input Log Schema

This is the external interface boundary of the product: the shape of the `.jsonl` OTLP telemetry export it consumes. The parsing layer (`src/parsing/`) MUST conform to this contract, and `tests/contract/` MUST verify it against fixture files.

## File format

- One `.jsonl` file per upload; each line is a standalone JSON object (an OTLP `ResourceLogs` record, or one `logRecords[]` entry depending on export shape).
- The parser MUST NOT assume the whole file fits validly as a single JSON document — it is newline-delimited JSON, read and parsed line by line (research.md §3).

## Structural flattening (FR-2)

Each record's nested structure MUST be flattened before analysis:

```text
resourceLogs[].scopeLogs[].logRecords[]
```

Each `logRecords[]` entry has attributes wrapped in a typed-value envelope, which MUST be unwrapped to a plain value before use:

| Envelope key | Unwrapped type |
|---|---|
| `stringValue` | string |
| `intValue` | number |
| `doubleValue` | number |
| `boolValue` | boolean |
| `arrayValue` | unwrapped array (recursively unwrap each element) |

## Sequencing (FR-3)

- Every event carries an `event.sequence` integer attribute.
- The parser MUST sort each file's events by `event.sequence` before any time-ordered analysis.
- `event.sequence` is meaningful only within the file/session that produced it. The parser MUST NEVER compare or merge sequence numbers across files.

## Recognized event / query classifications

| Attribute | Recognized values consumed by this contract | Used by |
|---|---|---|
| `query_source` | `generate_session_title`, `prompt_suggestion`, `away_summary` | FR-4 (excluded from main-task metrics, retained for full-session accounting) |
| event type | `tool_decision` | FR-6 — carries `tool_use_id`, `decision` (`approved`/`rejected`), `source` (e.g., `user_temporary`, `user_reject` — used by FR-16's approval-wait detection) |
| event type | `tool_result` | FR-6 — carries `tool_use_id`, outcome (`success`/`failure`) |
| event type | `user_prompt` | FR-7a — the actual task prompt text used by the relatedness check |
| embedded content | git-status system reminder | FR-7b — source of `RepositoryState` (branch, head commit, working directory) |

### Git-status text parsing (FR-7b)

- Real Claude Code telemetry carries no `vcs.branch`/`vcs.commit` resource attributes at all. The starting repository state instead appears as plain text — a `# gitStatus` system-reminder block — inside the first `api_request_body` event's `body` field (`Current branch: X`, and the first hash under `Recent commits:`).
- That `body` field is itself a JSON-encoded request payload, so its embedded newlines appear as the literal two-character sequence `\n` rather than real newline bytes; the parser normalizes that before matching the block's lines.
- Only the FIRST `api_request_body` event's gitStatus block is used as the starting state — a later one mid-session may reflect commits the agent itself made, not the state the runs should be compared against.
- Synthetic fixtures that DO set `vcs.branch`/`vcs.commit` resource attributes keep priority over this text-parsed fallback.
- If no `vcs.branch`/`vcs.commit` attribute and no parseable gitStatus block are present, `RepositoryState.branch`/`headCommit` MUST remain `null` — this is a distinct "unknown/unverifiable" state, never conflated with "different repository" by downstream relatedness comparison (`contracts/metric-formulas.md` and `src/relatedness/repositoryStateComparison.ts`).
- Working-directory differences between two runs are surfaced as separate informational metadata and MUST NOT by themselves downgrade relatedness confidence when branch/commit match — comparing the same repo/commit checked out into two different working directories is the expected A/B setup, not a mismatch.

## Tool-call pairing (FR-6)

- Every `tool_decision` MUST be paired to its `tool_result` by `tool_use_id`.
- A `tool_decision` with no matching `tool_result` (e.g., a `rejected` decision that was never executed) MUST be surfaced as a distinct rejection — never silently treated as a completed call, and never counted as a `failure`.

## Truncation markers (FR-22)

- Large field values (e.g., edit/file-creation content) may appear truncated by the source telemetry with a truncation marker pattern.
- The parser MUST detect this marker pattern and reconstruct the true original length for code-volume metrics rather than counting the truncated (shorter) string length.
- Two marker formats are recognized:
  - `...[truncated: original length (N)]` — states the total original length directly (N is the true length).
  - `…[N chars]` (a Unicode ellipsis) — confirmed against real Claude Code telemetry; states how many *additional* characters were cut beyond what's visible, so the true length is `(visible text before the marker).length + N`.

## Multiple task prompts per session (FR-5)

- A single file MAY contain more than one real `user_prompt` event representing genuine user-facing task attempts (e.g., an incomplete prompt followed by a corrected resend).
- The parser MUST detect this condition and attach a `DataQualityNote` (type `resent-prompt`) to the resulting `Run` (see data-model.md) rather than treating the file as two separate runs or silently merging the prompts' costs into one undifferentiated total.

## Forward/backward schema compatibility (Edge Cases — graceful degradation)

- Event types, `query_source` values, or attributes not recognized by this contract's current version MUST NOT abort or corrupt parsing of the rest of the file.
- Each unrecognized event MUST be counted in `LogFile.unrecognizedEventCount` and surfaced in the UI as "unrecognized, not included in metrics" — never silently dropped and never miscounted into an existing category.
- Unrecognized events' timestamps MAY still be used as gap-split boundaries for duration analysis (`contracts/metric-formulas.md`'s FR-16 breakdown) — this doesn't "recognize" the event as a task action or include it in any metric, it only refines which portion of an otherwise-single large gap is idle vs. approval-wait.

## Non-transmission constraint (FR-30)

- Nothing in the parsing layer may issue a network request containing file content, attribute values, or any derived text (prompt content, file paths, code snippets). All processing described in this contract executes in-browser (main thread or Web Worker) only.
