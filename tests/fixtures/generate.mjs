import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

let nanoCounter = 1_700_000_000_000_000_000n;
function nextNano(stepMs = 1000) {
  nanoCounter += BigInt(stepMs) * 1_000_000n;
  return nanoCounter.toString();
}

function attr(key, value) {
  if (typeof value === "string") return { key, value: { stringValue: value } };
  if (typeof value === "number") return { key, value: { intValue: value } };
  if (typeof value === "boolean") return { key, value: { boolValue: value } };
  return { key, value: { stringValue: String(value) } };
}

function record(name, sequence, attrs, stepMs = 1000) {
  return {
    timeUnixNano: nextNano(stepMs),
    attributes: [attr("event.name", name), attr("event.sequence", sequence), ...attrs],
  };
}

function resourceLogs(session, logRecords) {
  return {
    resourceLogs: [
      {
        resource: {
          attributes: [
            attr("session.id", session.id),
            attr("claude_code.version", session.buildVersion ?? "2.1.0"),
            attr("session.working_directory", session.workingDirectory ?? "/repo"),
            attr("vcs.branch", session.branch ?? "main"),
            attr("vcs.commit", session.commit ?? "abc123"),
          ],
        },
        scopeLogs: [{ logRecords }],
      },
    ],
  };
}

function toolPair(seqBase, toolUseId, toolName, extra = {}) {
  const decision = record("tool_decision", seqBase, [
    attr("tool_use_id", toolUseId),
    attr("tool_name", toolName),
    attr("decision", extra.decision ?? "approved"),
    attr("decision_source", extra.decisionSource ?? "auto"),
    ...(extra.newContent ? [attr("new_content", extra.newContent)] : []),
    ...(extra.oldContent ? [attr("old_content", extra.oldContent)] : []),
  ]);
  const records = [decision];
  if ((extra.decision ?? "approved") === "approved") {
    records.push(
      record("tool_result", seqBase + 1, [
        attr("tool_use_id", toolUseId),
        attr("tool_name", toolName),
        attr("outcome", extra.outcome ?? "success"),
      ]),
    );
  }
  return records;
}

function buildNormalRun(sessionId, promptText, session = {}) {
  const records = [];
  records.push(record("user_prompt", 1, [attr("prompt_text", promptText)]));
  records.push(
    record("api_call", 2, [
      attr("input_tokens", 500),
      attr("output_tokens", 300),
      attr("cache_read_tokens", 100),
      attr("cache_creation_tokens", 2000),
      attr("cost_usd", 0.05),
    ]),
  );
  records.push(...toolPair(3, "tu_1", "Read"));
  records.push(
    record("api_call", 5, [
      attr("input_tokens", 400),
      attr("output_tokens", 250),
      attr("cache_read_tokens", 1800),
      attr("cache_creation_tokens", 100),
      attr("cost_usd", 0.04),
    ]),
  );
  records.push(
    ...toolPair(6, "tu_2", "Edit", {
      oldContent: "function add(a, b) { return a - b; }",
      newContent: "function add(a, b) { return a + b; }",
    }),
  );
  records.push(
    record("api_call", 8, [
      attr("input_tokens", 300),
      attr("output_tokens", 150),
      attr("cache_read_tokens", 2500),
      attr("cache_creation_tokens", 50),
      attr("cost_usd", 0.03),
    ]),
  );
  records.push(...toolPair(9, "tu_3", "Bash_test"));
  let nextSeq = 10;
  if (session.extraToolCall) {
    records.push(...toolPair(nextSeq, "tu_extra", session.extraToolCall));
    nextSeq += 2;
  }
  for (const [index, toolName] of (session.extraToolCalls ?? []).entries()) {
    records.push(...toolPair(nextSeq, `tu_extra_${index}`, toolName));
    nextSeq += 2;
    if (session.extraApiCallTokens) {
      records.push(
        record("api_call", nextSeq, [
          attr("input_tokens", session.extraApiCallTokens),
          attr("output_tokens", session.extraApiCallTokens),
          attr("cache_read_tokens", 0),
          attr("cache_creation_tokens", session.extraApiCallTokens),
          attr("cost_usd", session.extraApiCallTokens * 0.0001),
        ]),
      );
      nextSeq += 1;
    }
  }
  records.push(
    record("api_call", nextSeq, [
      attr("query_source", "generate_session_title"),
      attr("input_tokens", 50),
      attr("output_tokens", 10),
      attr("cache_read_tokens", 0),
      attr("cache_creation_tokens", 0),
      attr("cost_usd", 0.001),
    ]),
  );
  return resourceLogs(
    {
      id: sessionId,
      workingDirectory: session.workingDirectory ?? "/repo/budget-app",
      branch: session.branch ?? "main",
      commit: session.commit ?? "abc123",
    },
    records,
  );
}

function toJsonl(objects) {
  return objects.map((obj) => JSON.stringify(obj)).join("\n") + "\n";
}

function write(relativePath, content) {
  const fullPath = join(__dirname, relativePath);
  mkdirSync(dirname(fullPath), { recursive: true });
  writeFileSync(fullPath, content, "utf8");
  console.log("wrote", relativePath);
}

// single-run-normal.jsonl
write(
  "single-run-normal.jsonl",
  toJsonl([buildNormalRun("session-normal-1", "Implement a monthly-budget feature on this repo.")]),
);

// single-run-aborted.jsonl — only a user_prompt, no task activity
nanoCounter = 1_700_000_000_000_000_000n;
write(
  "single-run-aborted.jsonl",
  toJsonl([resourceLogs({ id: "session-aborted-1" }, [record("user_prompt", 1, [attr("prompt_text", "start")])])]),
);

const BUDGET_PROMPT = "Implement a monthly-budget feature that lets users set spending limits per category.";
const AUTH_PROMPT = "Refactor the authentication module to support single sign-on via OAuth.";

// two-runs-related/ — same task, same repo, same commit; run-b has an extra
// McpTool call, introducing a categorical tool-usage difference and drift.
nanoCounter = 1_700_000_000_100_000_000n;
write("two-runs-related/run-a.jsonl", toJsonl([buildNormalRun("session-related-a", BUDGET_PROMPT)]));
nanoCounter = 1_700_000_000_200_000_000n;
write(
  "two-runs-related/run-b.jsonl",
  toJsonl([buildNormalRun("session-related-b", BUDGET_PROMPT, { extraToolCall: "McpTool" })]),
);

// two-runs-partial/ — same task, same repo, different starting commit
nanoCounter = 1_700_000_000_300_000_000n;
write("two-runs-partial/run-a.jsonl", toJsonl([buildNormalRun("session-partial-a", BUDGET_PROMPT, { commit: "abc123" })]));
nanoCounter = 1_700_000_000_400_000_000n;
write("two-runs-partial/run-b.jsonl", toJsonl([buildNormalRun("session-partial-b", BUDGET_PROMPT, { commit: "def456" })]));

// two-runs-unrelated/ — different repos/subject matter
nanoCounter = 1_700_000_000_500_000_000n;
write("two-runs-unrelated/run-a.jsonl", toJsonl([buildNormalRun("session-unrelated-a", BUDGET_PROMPT)]));
nanoCounter = 1_700_000_000_600_000_000n;
write(
  "two-runs-unrelated/run-b.jsonl",
  toJsonl([
    buildNormalRun("session-unrelated-b", AUTH_PROMPT, {
      workingDirectory: "/repo/auth-service",
      branch: "main",
      commit: "zzz999",
    }),
  ]),
);

// n-runs-mixed-relatedness/ — 3 related (budget feature) + 1 unrelated (auth refactor)
for (let i = 1; i <= 3; i += 1) {
  nanoCounter = 1_700_000_000_700_000_000n + BigInt(i) * 100_000_000n;
  write(
    `n-runs-mixed-relatedness/run-${i}.jsonl`,
    toJsonl([buildNormalRun(`session-mixed-${i}`, BUDGET_PROMPT)]),
  );
}
nanoCounter = 1_700_000_001_100_000_000n;
write(
  "n-runs-mixed-relatedness/run-4.jsonl",
  toJsonl([
    buildNormalRun("session-mixed-4", AUTH_PROMPT, {
      workingDirectory: "/repo/auth-service",
      branch: "main",
      commit: "zzz999",
    }),
  ]),
);

// resent-prompt.jsonl — an incomplete prompt followed by a corrected resend
nanoCounter = 1_700_000_002_000_000_000n;
write(
  "resent-prompt.jsonl",
  toJsonl([
    resourceLogs({ id: "session-resent" }, [
      record("user_prompt", 1, [attr("prompt_text", "add a budget featur")]),
      record("api_call", 2, [
        attr("input_tokens", 200),
        attr("output_tokens", 100),
        attr("cache_read_tokens", 0),
        attr("cache_creation_tokens", 500),
        attr("cost_usd", 0.02),
      ]),
      record("user_prompt", 3, [attr("prompt_text", BUDGET_PROMPT)]),
      record("api_call", 4, [
        attr("input_tokens", 500),
        attr("output_tokens", 300),
        attr("cache_read_tokens", 100),
        attr("cache_creation_tokens", 2000),
        attr("cost_usd", 0.05),
      ]),
    ]),
  ]),
);

// rejected-tool-call.jsonl — a rejected tool-permission decision, never executed
nanoCounter = 1_700_000_003_000_000_000n;
write(
  "rejected-tool-call.jsonl",
  toJsonl([
    resourceLogs({ id: "session-rejected" }, [
      record("user_prompt", 1, [attr("prompt_text", BUDGET_PROMPT)]),
      record("api_call", 2, [
        attr("input_tokens", 200),
        attr("output_tokens", 100),
        attr("cache_read_tokens", 0),
        attr("cache_creation_tokens", 500),
        attr("cost_usd", 0.02),
      ]),
      record("tool_decision", 3, [
        attr("tool_use_id", "tu_rejected"),
        attr("tool_name", "Bash_test"),
        attr("decision", "rejected"),
        attr("decision_source", "user_reject"),
      ]),
    ]),
  ]),
);

// duration-confound.jsonl — approval-wait time dominates wall-clock duration
nanoCounter = 1_700_000_004_000_000_000n;
write(
  "duration-confound.jsonl",
  toJsonl([
    resourceLogs({ id: "session-duration-confound" }, [
      record("user_prompt", 1, [attr("prompt_text", BUDGET_PROMPT)], 1000),
      record("api_call", 2, [
        attr("input_tokens", 200),
        attr("output_tokens", 100),
        attr("cache_read_tokens", 0),
        attr("cache_creation_tokens", 500),
        attr("cost_usd", 0.02),
      ], 1000),
      // Large gap simulating the human taking a long time to approve — this
      // is the gap ENDING at the tool_decision (its timestamp is logged when
      // the decision is actually made), not the gap after it.
      record("tool_decision", 3, [
        attr("tool_use_id", "tu_wait"),
        attr("tool_name", "Bash_test"),
        attr("decision", "approved"),
        attr("decision_source", "user_temporary"),
      ], 600_000),
      record("tool_result", 4, [
        attr("tool_use_id", "tu_wait"),
        attr("tool_name", "Bash_test"),
        attr("outcome", "success"),
      ], 1000),
    ]),
  ]),
);

// n-runs-outlier/ — 5 related runs; run-3 is a clear outlier with a burst of
// extra tool calls and cache-creation tokens far beyond the other 4.
for (let i = 1; i <= 5; i += 1) {
  nanoCounter = 1_700_000_005_000_000_000n + BigInt(i) * 100_000_000n;
  const isOutlier = i === 3;
  write(
    `n-runs-outlier/run-${i}.jsonl`,
    toJsonl([
      buildNormalRun(`session-outlier-${i}`, BUDGET_PROMPT, {
        extraToolCalls: isOutlier ? ["Read", "Edit", "Read", "Edit", "Bash_test", "Read"] : [],
        extraApiCallTokens: isOutlier ? 4000 : undefined,
      }),
    ]),
  );
}

// dominant-driver-clear/ — one metric (an introduced McpTool categorical
// difference) clearly dominates; every other metric stays essentially flat.
nanoCounter = 1_700_000_006_000_000_000n;
write("dominant-driver-clear/run-a.jsonl", toJsonl([buildNormalRun("session-ddclear-a", BUDGET_PROMPT)]));
nanoCounter = 1_700_000_006_100_000_000n;
write(
  "dominant-driver-clear/run-b.jsonl",
  toJsonl([buildNormalRun("session-ddclear-b", BUDGET_PROMPT, { extraToolCall: "McpTool" })]),
);

// dominant-driver-spread/ — two independent categorical tool differences tied
// at maximum magnitude, so no single metric clearly dominates the other.
nanoCounter = 1_700_000_007_000_000_000n;
write("dominant-driver-spread/run-a.jsonl", toJsonl([buildNormalRun("session-ddspread-a", BUDGET_PROMPT)]));
nanoCounter = 1_700_000_007_100_000_000n;
write(
  "dominant-driver-spread/run-b.jsonl",
  toJsonl([
    buildNormalRun("session-ddspread-b", BUDGET_PROMPT, {
      extraToolCalls: ["McpTool", "WebSearch"],
    }),
  ]),
);

// truncated-fields.jsonl — an Edit call whose new_content was truncated by
// the source telemetry; code-volume metrics must use the reconstructed length.
nanoCounter = 1_700_000_008_000_000_000n;
write(
  "truncated-fields.jsonl",
  toJsonl([
    resourceLogs({ id: "session-truncated" }, [
      record("user_prompt", 1, [attr("prompt_text", BUDGET_PROMPT)]),
      record("api_call", 2, [
        attr("input_tokens", 200),
        attr("output_tokens", 100),
        attr("cache_read_tokens", 0),
        attr("cache_creation_tokens", 500),
        attr("cost_usd", 0.02),
      ]),
      ...toolPair(3, "tu_truncated", "Edit", {
        oldContent: "",
        newContent: "x".repeat(200) + "...[truncated: original length 5000]",
      }),
    ]),
  ]),
);

// unknown-schema-fields.jsonl — a normal session plus an event type this
// schema version doesn't recognize; parsing must tolerate and count it.
nanoCounter = 1_700_000_009_000_000_000n;
write(
  "unknown-schema-fields.jsonl",
  toJsonl([
    resourceLogs({ id: "session-unknown-schema" }, [
      record("user_prompt", 1, [attr("prompt_text", BUDGET_PROMPT)]),
      record("api_call", 2, [
        attr("input_tokens", 200),
        attr("output_tokens", 100),
        attr("cache_read_tokens", 0),
        attr("cache_creation_tokens", 500),
        attr("cost_usd", 0.02),
      ]),
      record("future_telemetry_event", 3, [attr("some_new_field", "unrecognized")]),
      ...toolPair(4, "tu_known", "Read"),
    ]),
  ]),
);

// real-schema-sample.jsonl — reproduces the *actual* Claude Code OTLP export
// shape observed from real telemetry (as opposed to this generator's other
// fixtures, which follow the shape originally assumed by the spec): resource
// attributes carry no session/vcs identity at all; session.id lives on every
// individual log record instead; the API-call event is named "api_request";
// tool_decision.decision is "accept"/"reject" with the source under "source";
// tool_result carries a boolean "success" plus a JSON-encoded "tool_input"
// (old_string/new_string for Edit, content for Write) instead of top-level
// new_content/old_content. No PII — synthetic values throughout.
function realSchemaResourceLogs(logRecords) {
  return {
    resourceLogs: [
      {
        resource: {
          attributes: [
            attr("os.type", "darwin"),
            attr("os.version", "24.6.0"),
            attr("host.arch", "amd64"),
            attr("service.name", "claude-code"),
            attr("service.version", "2.1.277"),
          ],
        },
        scopeLogs: [{ logRecords }],
      },
    ],
  };
}

function realRecord(sessionId, name, sequence, attrs, stepMs = 1000) {
  return {
    timeUnixNano: nextNano(stepMs),
    attributes: [
      attr("session.id", sessionId),
      attr("event.name", name),
      attr("event.sequence", sequence),
      ...attrs,
    ],
  };
}

function realToolPair(sessionId, seqBase, toolUseId, toolName, extra = {}) {
  const decision = realRecord(sessionId, "tool_decision", seqBase, [
    attr("tool_use_id", toolUseId),
    attr("tool_name", toolName),
    attr("decision", extra.decision ?? "accept"),
    attr("source", extra.source ?? "config"),
  ]);
  const records = [decision];
  if ((extra.decision ?? "accept") === "accept") {
    const toolInput = extra.toolInput ? JSON.stringify(extra.toolInput) : "{}";
    records.push(
      realRecord(sessionId, "tool_result", seqBase + 1, [
        attr("tool_use_id", toolUseId),
        attr("tool_name", toolName),
        attr("success", extra.success ?? true),
        attr("tool_input", toolInput),
      ]),
    );
  }
  return records;
}

nanoCounter = 1_700_000_010_000_000_000n;
const REAL_SESSION_ID = "real-schema-session-1";
write(
  "real-schema-sample.jsonl",
  toJsonl([
    realSchemaResourceLogs([
      realRecord(REAL_SESSION_ID, "hook_registered", 0, [attr("hook_event", "Stop")]),
      realRecord(REAL_SESSION_ID, "user_prompt", 1, [
        attr("prompt", "Implement a monthly-budget feature that lets users set spending limits."),
        attr("prompt_length", 70),
      ]),
      realRecord(REAL_SESSION_ID, "api_request", 2, [
        attr("input_tokens", 500),
        attr("output_tokens", 300),
        attr("cache_read_tokens", 100),
        attr("cache_creation_tokens", 2000),
        attr("cost_usd", 0.05),
      ]),
      ...realToolPair(REAL_SESSION_ID, 3, "tu_real_1", "Read"),
      realRecord(REAL_SESSION_ID, "api_request", 5, [
        attr("input_tokens", 400),
        attr("output_tokens", 250),
        attr("cache_read_tokens", 1800),
        attr("cache_creation_tokens", 100),
        attr("cost_usd", 0.04),
      ]),
      ...realToolPair(REAL_SESSION_ID, 6, "tu_real_2", "Edit", {
        toolInput: {
          file_path: "/repo/app.py",
          old_string: "return a - b",
          new_string: "return a + b # fixed",
        },
      }),
      realRecord(REAL_SESSION_ID, "api_request", 8, [
        attr("input_tokens", 300),
        attr("output_tokens", 150),
        attr("cache_read_tokens", 2500),
        attr("cache_creation_tokens", 50),
        attr("cost_usd", 0.03),
      ]),
      ...realToolPair(REAL_SESSION_ID, 9, "tu_real_3", "Bash", {
        source: "user_temporary",
      }),
      ...realToolPair(REAL_SESSION_ID, 11, "tu_real_rejected", "Bash", {
        decision: "reject",
        source: "user_reject",
      }),
      // Real telemetry sometimes encodes tool_result.success as the STRING
      // "false" rather than a boolean — this call must still count as a failure.
      ...realToolPair(REAL_SESSION_ID, 13, "tu_real_failed", "Bash", {
        success: "false",
      }),
      // Real telemetry truncates large tool_input fields with a "…[N chars]"
      // suffix (Unicode ellipsis) stating how many more characters were cut —
      // true length is the visible prefix plus N, not the visible length alone.
      ...realToolPair(REAL_SESSION_ID, 15, "tu_real_truncated", "Edit", {
        toolInput: {
          file_path: "/repo/big.py",
          old_string: "pass",
          // 120 visible chars + a marker stating 4880 more were cut -> true length 5000.
          new_string: "x".repeat(120) + "…[4880 chars]",
        },
      }),
    ]),
  ]),
);

console.log("Fixture generation complete.");
