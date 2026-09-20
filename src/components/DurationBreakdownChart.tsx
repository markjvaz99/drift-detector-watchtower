import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from "recharts";
import type { LogFile, Run } from "../types";
import { computeDurationBreakdown } from "../metrics/duration";
import { DistributionChart } from "./DistributionChart";

export interface DurationBreakdownChartProps {
  runs: Run[];
  logFilesById: Map<string, LogFile>;
}

export function DurationBreakdownChart({ runs, logFilesById }: DurationBreakdownChartProps) {
  const breakdowns = runs.map((run) => ({
    run,
    breakdown: logFilesById.get(run.sourceLogFileId)
      ? computeDurationBreakdown(logFilesById.get(run.sourceLogFileId)!)
      : { totalMs: 0, approvalWaitMs: 0, otherIdleMs: 0, activeMs: 0 },
  }));

  if (runs.length > 8) {
    return (
      <div className="duration-breakdown-chart" data-layout="aggregate">
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

  // Bars stack vertically as N grows rather than assuming exactly two groups.
  const data = breakdowns.map(({ run, breakdown }) => ({
    run: run.label,
    "Active time": breakdown.activeMs,
    "Approval-wait time": breakdown.approvalWaitMs,
    "Other idle time": breakdown.otherIdleMs,
  }));

  return (
    <div className="duration-breakdown-chart" data-layout="stacked-bars">
      <BarChart width={480} height={Math.max(200, runs.length * 36)} data={data} layout="vertical">
        <XAxis type="number" />
        <YAxis type="category" dataKey="run" width={80} />
        <Tooltip />
        <Legend />
        <Bar dataKey="Active time" stackId="duration" />
        <Bar dataKey="Approval-wait time" stackId="duration" />
        <Bar dataKey="Other idle time" stackId="duration" />
      </BarChart>
    </div>
  );
}
