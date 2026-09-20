import { LineChart, Line, XAxis, YAxis, Tooltip } from "recharts";
import type { LogFile, Run } from "../types";
import { computeOverheadTrend, computeOverheadTrendMetrics } from "../metrics/overheadTrend";
import { DistributionChart } from "./DistributionChart";

export interface OverheadTrendChartProps {
  runs: Run[];
  logFilesById: Map<string, LogFile>;
}

function growthMultiple(run: Run, logFilesById: Map<string, LogFile>): number {
  const logFile = logFilesById.get(run.sourceLogFileId);
  if (!logFile) return 0;
  const metrics = computeOverheadTrendMetrics(logFile);
  const found = metrics.find((m) => m.key === "overhead_growth_multiple");
  return found && typeof found.value === "number" ? found.value : 0;
}

export function OverheadTrendChart({ runs, logFilesById }: OverheadTrendChartProps) {
  if (runs.length > 8) {
    const points = runs.map((run) => ({ runId: run.id, label: run.label, value: growthMultiple(run, logFilesById) }));
    return (
      <div className="overhead-trend-chart" data-layout="aggregate">
        <DistributionChart title="Overhead-ratio growth multiple" points={points} />
      </div>
    );
  }

  const bucketCounts = runs.map((run) => {
    const logFile = logFilesById.get(run.sourceLogFileId);
    return logFile ? computeOverheadTrend(logFile).length : 0;
  });
  const maxBuckets = Math.max(0, ...bucketCounts);
  const data = Array.from({ length: maxBuckets }, (_, bucketIndex) => {
    const row: Record<string, number> = { bucketIndex };
    runs.forEach((run, i) => {
      const logFile = logFilesById.get(run.sourceLogFileId);
      const points = logFile ? computeOverheadTrend(logFile) : [];
      row[run.label] = points[bucketIndex]?.ratio ?? points[points.length - 1]?.ratio ?? 0;
      void i;
    });
    return row;
  });

  // Beyond ~6 runs, fade every line except the highest/lowest growth-multiple
  // runs to keep the chart legible (FR-14).
  const fadeThreshold = 6;
  const shouldFade = runs.length > fadeThreshold;
  const growthByRunId = new Map(runs.map((run) => [run.id, growthMultiple(run, logFilesById)]));
  const sortedByGrowth = [...runs].sort(
    (a, b) => (growthByRunId.get(a.id) ?? 0) - (growthByRunId.get(b.id) ?? 0),
  );
  const highlightedRunIds = new Set(
    [sortedByGrowth[0]?.id, sortedByGrowth[sortedByGrowth.length - 1]?.id].filter(Boolean) as string[],
  );

  return (
    <div className="overhead-trend-chart" data-layout="lines">
      <LineChart width={480} height={260} data={data}>
        <XAxis dataKey="bucketIndex" />
        <YAxis />
        <Tooltip />
        {runs.map((run) => (
          <Line
            key={run.id}
            dataKey={run.label}
            dot={false}
            strokeOpacity={shouldFade && !highlightedRunIds.has(run.id) ? 0.25 : 1}
          />
        ))}
      </LineChart>
    </div>
  );
}
