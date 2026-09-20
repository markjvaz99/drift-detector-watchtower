import type { LogFile } from "../types";
import type { RunMetricValue } from "./types";

const HUMAN_APPROVAL_SOURCES = new Set(["user_temporary", "user_reject"]);
const IDLE_THRESHOLD_MS = 60_000;

export interface DurationBreakdown {
  totalMs: number;
  approvalWaitMs: number;
  otherIdleMs: number;
  activeMs: number;
}

export function computeDurationBreakdown(logFile: LogFile): DurationBreakdown {
  const events = logFile.events;
  if (events.length === 0) {
    return { totalMs: 0, approvalWaitMs: 0, otherIdleMs: 0, activeMs: 0 };
  }

  const first = new Date(events[0].timestamp).getTime();
  const last = new Date(events[events.length - 1].timestamp).getTime();
  const totalMs = Math.max(0, last - first);

  let approvalWaitMs = 0;
  let otherIdleMs = 0;

  for (let i = 0; i < events.length - 1; i += 1) {
    const current = events[i];
    const next = events[i + 1];
    const gap = new Date(next.timestamp).getTime() - new Date(current.timestamp).getTime();
    if (gap <= 0) continue;

    // Real telemetry's tool_decision carries this as "source"; synthetic
    // fixtures use "decision_source".
    const decisionSource = current.attributes["source"] ?? current.attributes["decision_source"];
    if (current.type === "tool_decision" && HUMAN_APPROVAL_SOURCES.has(String(decisionSource))) {
      approvalWaitMs += gap;
    } else if (gap >= IDLE_THRESHOLD_MS) {
      otherIdleMs += gap;
    }
  }

  const activeMs = Math.max(0, totalMs - approvalWaitMs - otherIdleMs);
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
