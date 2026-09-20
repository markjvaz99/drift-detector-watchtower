import type { LogFile, Run } from "../types";
import { computeDurationBreakdown } from "../metrics/duration";
import { DistributionChart } from "./DistributionChart";
import { runColor } from "../ui/runColors";

export interface DurationBreakdownChartProps {
  runs: Run[];
  logFilesById: Map<string, LogFile>;
}

const CATEGORIES = [
  { key: "activeMs", label: "Active" },
  { key: "approvalWaitMs", label: "Approval-wait time" },
  { key: "otherIdleMs", label: "Other idle" },
] as const;

export function DurationBreakdownChart({ runs, logFilesById }: DurationBreakdownChartProps) {
  const breakdowns = runs.map((run) => ({
    run,
    breakdown: logFilesById.get(run.sourceLogFileId)
      ? computeDurationBreakdown(logFilesById.get(run.sourceLogFileId)!)
      : { totalMs: 0, approvalWaitMs: 0, otherIdleMs: 0, activeMs: 0 },
  }));

  if (runs.length > 8) {
    return (
      <div className="duration-breakdown-chart card" data-layout="aggregate">
        <p className="chart-card-title">Where the wall-clock time went</p>
        <DistributionChart
          title="Active time"
          points={breakdowns.map(({ run, breakdown }) => ({ runId: run.id, label: run.label, value: breakdown.activeMs }))}
        />
        <DistributionChart
          title="Approval-wait time"
          points={breakdowns.map(({ run, breakdown }) => ({ runId: run.id, label: run.label, value: breakdown.approvalWaitMs }))}
        />
        <DistributionChart
          title="Other idle time"
          points={breakdowns.map(({ run, breakdown }) => ({ runId: run.id, label: run.label, value: breakdown.otherIdleMs }))}
        />
      </div>
    );
  }

  return (
    <div className="duration-breakdown-chart card" data-layout="stacked-bars">
      <p className="chart-card-title">Where the wall-clock time went</p>
      <p className="chart-card-subtitle">Share of total session duration</p>
      <div className="duration-breakdown-rows">
        {breakdowns.map(({ run, breakdown }, index) => {
          const total = breakdown.totalMs || 1;
          const color = runColor(index);
          return (
            <div key={run.id} className="duration-run-block">
              <p className="run-summary-title" style={{ color }}>
                <span className="run-summary-dot" style={{ background: color }} />
                {run.label}
              </p>
              {CATEGORIES.map((cat) => {
                const ms = breakdown[cat.key];
                const pct = (ms / total) * 100;
                return (
                  <div key={cat.key} className="hbar-row">
                    <span className="duration-cat-label">{cat.label}</span>
                    <div className="hbar-track">
                      <div className="hbar-fill" style={{ width: `${Math.min(100, pct)}%`, background: color }} />
                    </div>
                    <span className="hbar-value">{pct.toFixed(1)}%</span>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
