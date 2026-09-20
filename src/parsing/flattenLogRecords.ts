import { unwrapAttributes } from "./unwrapAttributes";
import type { AttributeValue, RepositoryState } from "../types";

export const KNOWN_EVENT_NAMES = new Set(["api_call", "tool_decision", "tool_result", "user_prompt"]);

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

export function flattenLogRecords(rawLines: unknown[]): FlattenResult {
  let sessionIdentifier = "";
  let buildVersion = "";
  let workingDirectory = "";
  const repositoryState: RepositoryState = { branch: null, headCommit: null, workingDirectory: "" };
  const records: FlatRecord[] = [];
  let unrecognizedEventCount = 0;

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
          const name = asString(attributes["event.name"]);
          if (!KNOWN_EVENT_NAMES.has(name)) {
            unrecognizedEventCount += 1;
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

  return {
    sessionIdentifier,
    buildVersion,
    workingDirectory,
    startingRepositoryState: repositoryState,
    records,
    unrecognizedEventCount,
  };
}
