import { unwrapAttributes } from "./unwrapAttributes";
import type { AttributeValue, RepositoryState } from "../types";

export const KNOWN_EVENT_NAMES = new Set(["api_call", "api_request", "tool_decision", "tool_result", "user_prompt"]);

// Real Claude Code telemetry emits "api_request" for what this app treats as
// the canonical "api_call" event internally; normalizing here keeps every
// downstream consumer (isMainTaskApiCall, efficiency metrics, etc.) agnostic
// to which name the source telemetry used.
const EVENT_NAME_ALIASES: Record<string, string> = { api_request: "api_call" };

export interface FlatRecord {
  sequence: number;
  timestamp: string;
  name: string;
  attributes: Record<string, AttributeValue>;
}

export interface FlattenResult {
  sessionIdentifier: string;
  buildVersion: string;
  workingDirectory: string;
  startingRepositoryState: RepositoryState;
  records: FlatRecord[];
  unrecognizedEventCount: number;
  /**
   * Timestamps of unrecognized events (e.g. housekeeping markers like
   * "retention_sweep"), kept only as gap-split boundaries for duration
   * analysis (FR-16) — never surfaced as task events or counted in any
   * metric. A large gap between two known events that actually spans one of
   * these often represents idle/away time that concluded when the telemetry
   * layer did routine housekeeping, not active approval consideration.
   */
  unrecognizedEventTimestamps: string[];
}

interface RawAttribute {
  key: string;
  value: Record<string, unknown>;
}

interface RawLogRecord {
  timeUnixNano?: string;
  attributes?: RawAttribute[];
}

interface RawResourceLogs {
  resource?: { attributes?: RawAttribute[] };
  scopeLogs?: Array<{ logRecords?: RawLogRecord[] }>;
}

interface RawTopLevel {
  resourceLogs?: RawResourceLogs[];
}

function asString(value: AttributeValue | undefined, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function timestampFromNano(nano: string | undefined): string {
  if (!nano) return new Date(0).toISOString();
  const millis = Number(BigInt(nano) / 1_000_000n);
  return new Date(millis).toISOString();
}

const GIT_STATUS_MARKER = "gitStatus";
const GIT_STATUS_WINDOW_CHARS = 2000;

/**
 * Real Claude Code telemetry carries no `vcs.branch`/`vcs.commit` attributes
 * at all — the starting repository state instead appears as plain text (a
 * "# gitStatus" system-reminder block) inside the first `api_request_body`
 * event's `body` field (FR-7b). That field is itself a JSON-encoded request
 * payload, so its embedded newlines appear as the literal two-character
 * sequence "\n" rather than real newline bytes; this normalizes just enough
 * of that to make the block's lines matchable, without needing a full
 * (and truncation-fragile) JSON.parse of the whole body.
 */
function extractGitStatusRepositoryState(body: string): { branch: string; headCommit: string } | null {
  const markerIndex = body.indexOf(GIT_STATUS_MARKER);
  if (markerIndex === -1) return null;

  const window = body
    .slice(markerIndex, markerIndex + GIT_STATUS_WINDOW_CHARS)
    .replace(/\\n/g, "\n");

  const branchMatch = /Current branch:\s*(\S+)/.exec(window);
  const commitMatch = /Recent commits:\s*\n\s*(\S+)/.exec(window);
  if (!branchMatch || !commitMatch) return null;

  return { branch: branchMatch[1], headCommit: commitMatch[1] };
}

export function flattenLogRecords(rawLines: unknown[]): FlattenResult {
  let sessionIdentifier = "";
  let buildVersion = "";
  let workingDirectory = "";
  const repositoryState: RepositoryState = { branch: null, headCommit: null, workingDirectory: "" };
  const records: FlatRecord[] = [];
  let unrecognizedEventCount = 0;
  const unrecognizedEventTimestamps: string[] = [];
  // First (starting) gitStatus snapshot only — a later one mid-session may
  // reflect commits the agent itself made, not the starting state.
  let gitStatusRepositoryState: { branch: string; headCommit: string } | null = null;

  for (const rawLine of rawLines) {
    const topLevel = rawLine as RawTopLevel;
    for (const resourceLogs of topLevel.resourceLogs ?? []) {
      const resourceAttrs = unwrapAttributes(
        (resourceLogs.resource?.attributes ?? []) as never,
      );
      if (typeof resourceAttrs["session.id"] === "string") {
        sessionIdentifier = resourceAttrs["session.id"];
      }
      if (typeof resourceAttrs["claude_code.version"] === "string") {
        buildVersion = resourceAttrs["claude_code.version"];
      } else if (typeof resourceAttrs["service.version"] === "string") {
        buildVersion = resourceAttrs["service.version"];
      }
      if (typeof resourceAttrs["session.working_directory"] === "string") {
        workingDirectory = resourceAttrs["session.working_directory"];
        repositoryState.workingDirectory = workingDirectory;
      }
      if (typeof resourceAttrs["vcs.branch"] === "string") {
        repositoryState.branch = resourceAttrs["vcs.branch"];
      }
      if (typeof resourceAttrs["vcs.commit"] === "string") {
        repositoryState.headCommit = resourceAttrs["vcs.commit"];
      }

      for (const scopeLogs of resourceLogs.scopeLogs ?? []) {
        for (const logRecord of scopeLogs.logRecords ?? []) {
          const attributes = unwrapAttributes(logRecord.attributes as never);

          // Some telemetry exports carry session/build identity as per-record
          // attributes rather than resource-level ones — capture it from
          // whichever record has it first (Edge Cases: graceful degradation).
          if (!sessionIdentifier && typeof attributes["session.id"] === "string") {
            sessionIdentifier = attributes["session.id"];
          }
          if (!buildVersion && typeof attributes["claude_code.version"] === "string") {
            buildVersion = attributes["claude_code.version"];
          }

          const rawName = asString(attributes["event.name"]);
          const name = EVENT_NAME_ALIASES[rawName] ?? rawName;

          if (!gitStatusRepositoryState && rawName === "api_request_body") {
            const bodyText = attributes["body"];
            if (typeof bodyText === "string") {
              gitStatusRepositoryState = extractGitStatusRepositoryState(bodyText);
            }
          }

          if (!KNOWN_EVENT_NAMES.has(rawName)) {
            unrecognizedEventCount += 1;
            unrecognizedEventTimestamps.push(timestampFromNano(logRecord.timeUnixNano));
            continue;
          }
          const sequenceRaw = attributes["event.sequence"];
          const sequence = typeof sequenceRaw === "number" ? sequenceRaw : Number(sequenceRaw ?? 0);
          records.push({
            sequence,
            timestamp: timestampFromNano(logRecord.timeUnixNano),
            name,
            attributes,
          });
        }
      }
    }
  }

  // Fall back to the text-parsed gitStatus block only when no vcs.branch/
  // vcs.commit attribute was ever present (real telemetry never carries
  // those attributes at all; synthetic fixtures that do carry them keep
  // taking priority).
  if (repositoryState.branch === null && gitStatusRepositoryState) {
    repositoryState.branch = gitStatusRepositoryState.branch;
    repositoryState.headCommit = gitStatusRepositoryState.headCommit;
  }

  return {
    sessionIdentifier,
    buildVersion,
    workingDirectory,
    startingRepositoryState: repositoryState,
    records,
    unrecognizedEventCount,
    unrecognizedEventTimestamps,
  };
}
