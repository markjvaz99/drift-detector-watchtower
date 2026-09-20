import { NON_TASK_QUERY_SOURCES } from "../parsing/excludeNonTaskCalls";
import type { LogFile, OrderedEvent } from "../types";
import type { RunMetricValue } from "./types";

const HUMAN_APPROVAL_SOURCES = new Set(["user_temporary", "user_reject"]);

export interface DurationBreakdown {
  totalMs: number;
  approvalWaitMs: number;
  otherIdleMs: number;
  activeMs: number;
}

interface Boundary {
  timeMs: number;
  event: OrderedEvent | null; // null for an unrecognized-event split point
}

function isExcludedNonTaskCall(event: OrderedEvent): boolean {
  return event.type === "api_call" && Boolean(event.queryType) && NON_TASK_QUERY_SOURCES.has(event.queryType!);
}

// Active time is attributed directly from the source telemetry's own
// per-event timing rather than inferred from gaps: every tool_result and
// api_call (aliased from real telemetry's "api_request") event carries a
// duration_ms attribute recording how long that individual call actually
// took. These durations are non-overlapping by construction (tool calls and
// API calls are sequential within a session), so summing them directly
// yields real active processing time — unlike a gap-inference approach,
// which conflates "time between two events" with "time spent working" and
// undercounts whenever multiple short operations occur within what looks
// like one small gap. This sum intentionally includes non-task calls (e.g.
// away-summary generation) too: they still represent real processing time,
// even though they're excluded from the total-duration *span* and from
// token/cost metrics.
function eventDurationMs(event: OrderedEvent): number {
  if (event.type !== "tool_result" && event.type !== "api_call") return 0;
  const raw = event.attributes["duration_ms"];
  const value = typeof raw === "number" ? raw : Number(raw);
  return Number.isFinite(value) ? value : 0;
}

export function computeDurationBreakdown(logFile: LogFile): DurationBreakdown {
  // Trailing/leading non-task calls (session-title generation, prompt
  // suggestions, away-summaries) aren't part of the actual task and would
  // otherwise inflate the measured session boundary (FR-4/FR-16).
  const relevantEvents = logFile.events.filter((event) => !isExcludedNonTaskCall(event));
  if (relevantEvents.length === 0) {
    return { totalMs: 0, approvalWaitMs: 0, otherIdleMs: 0, activeMs: 0 };
  }

  const first = new Date(relevantEvents[0].timestamp).getTime();
  const last = new Date(relevantEvents[relevantEvents.length - 1].timestamp).getTime();
  const totalMs = Math.max(0, last - first);

  // Unrecognized events (e.g. a "retention_sweep" housekeeping marker) aren't
  // task events, but a large gap between two known events that actually spans
  // one often represents idle/away time that concluded when the telemetry
  // layer did routine housekeeping — not active approval consideration. Used
  // only as split points within the known-event span, never to extend it.
  const boundaries: Boundary[] = [
    ...relevantEvents.map((event) => ({ timeMs: new Date(event.timestamp).getTime(), event })),
    ...(logFile.unrecognizedEventTimestamps ?? [])
      .map((ts) => new Date(ts).getTime())
      .filter((timeMs) => timeMs > first && timeMs < last)
      .map((timeMs) => ({ timeMs, event: null })),
  ].sort((a, b) => a.timeMs - b.timeMs);

  let approvalWaitMs = 0;

  for (let i = 1; i < boundaries.length; i += 1) {
    const previous = boundaries[i - 1];
    const current = boundaries[i];
    const gap = current.timeMs - previous.timeMs;
    if (gap <= 0) continue;

    // A tool_decision's own timestamp is logged when the decision is actually
    // made, not when the tool call was proposed — so the human-approval wait
    // is the gap ENDING at a tool_decision with a human source, not the gap
    // starting from it (that following gap is just execution time before the
    // tool_result). Real telemetry carries the source as "source"; synthetic
    // fixtures use "decision_source".
    const decisionSource = current.event?.attributes["source"] ?? current.event?.attributes["decision_source"];
    if (current.event?.type === "tool_decision" && HUMAN_APPROVAL_SOURCES.has(String(decisionSource))) {
      approvalWaitMs += gap;
    }
  }

  const activeMs = logFile.events.reduce((sum, event) => sum + eventDurationMs(event), 0);
  // Other idle is the residual, not an independent gap-scan: with active time
  // now attributed directly from event durations, "everything else" (time
  // outside both approval-wait and directly-attributed active work) is idle
  // by definition, so these three always sum to exactly the total.
  const otherIdleMs = totalMs - approvalWaitMs - activeMs;
  return { totalMs, approvalWaitMs, otherIdleMs, activeMs };
}

export function computeDurationMetrics(logFile: LogFile): RunMetricValue[] {
  const breakdown = computeDurationBreakdown(logFile);
  return [
    { key: "duration_total_ms", label: "Total wall-clock duration", value: breakdown.totalMs, denominatorLabel: "" },
    {
      key: "duration_approval_wait_ms",
      label: "Approval-wait time",
      value: breakdown.approvalWaitMs,
      denominatorLabel: "",
    },
    {
      key: "duration_other_idle_ms",
      label: "Other idle time",
      value: breakdown.otherIdleMs,
      denominatorLabel: "",
    },
    { key: "duration_active_ms", label: "Active time", value: breakdown.activeMs, denominatorLabel: "" },
  ];
}
