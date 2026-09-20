import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from "recharts";
import type { LogFile, Run } from "../types";
import { computeOverheadTrend, computeOverheadTrendMetrics } from "../metrics/overheadTrend";
import { DistributionChart } from "./DistributionChart";
import { runColor } from "../ui/runColors";

function quartileTick(bucketIndex: number): string {
  return `Q${bucketIndex + 1}`;
}

interface EndpointDotProps {
  cx?: number;
  cy?: number;
  index?: number;
  value?: number;
  pointCount: number;
  color: string;
}

// Only the last (most recent) point on each line gets a visible dot + its
// value printed beside it — earlier points stay bare so the chart doesn't
// get noisy, but the reader can read off the ending value at a glance.
function EndpointDot({ cx, cy, index, value, pointCount, color }: EndpointDotProps) {
  if (cx === undefined || cy === undefined || index !== pointCount - 1) {
    return <circle cx={cx} cy={cy} r={0} fill="none" />;
  }
  return (
    <g>
      <circle cx={cx} cy={cy} r={3.5} fill={color} stroke="var(--surface-1)" strokeWidth={1.5} />
      <text x={cx + 8} y={cy + 4} fontSize={11} fill={color} fontFamily="var(--font-mono)">
        {typeof value === "number" ? value.toFixed(0) : ""}
      </text>
    </g>
  );
}

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
      <div className="overhead-trend-chart card" data-layout="aggregate">
        <p className="chart-card-title">Overhead ratio across the session</p>
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
    <div className="overhead-trend-chart card" data-layout="lines">
      <p className="chart-card-title">Overhead ratio across the session</p>
      <p className="chart-card-subtitle">cache_read ÷ output_tokens, by session quartile</p>
      <div className="overhead-trend-plot">
        <ResponsiveContainer width="100%" height="100%" minWidth={200} minHeight={180}>
          <LineChart data={data} margin={{ top: 6, right: 34, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="var(--border)" vertical={false} />
            <XAxis
              dataKey="bucketIndex"
              tickFormatter={quartileTick}
              stroke="var(--border-strong)"
              tick={{ fill: "var(--text-muted)", fontSize: 11 }}
            />
            <YAxis stroke="var(--border-strong)" tick={{ fill: "var(--text-muted)", fontSize: 11 }} width={36} />
            <Tooltip
              labelFormatter={(v) => quartileTick(Number(v))}
              contentStyle={{
                background: "var(--surface-2)",
                border: "1px solid var(--border-strong)",
                borderRadius: "var(--radius-sm)",
                fontSize: 12,
              }}
            />
            {runs.map((run, index) => (
              <Line
                key={run.id}
                dataKey={run.label}
                dot={(dotProps: EndpointDotProps) => (
                  <EndpointDot key={dotProps.index} {...dotProps} pointCount={data.length} color={runColor(index)} />
                )}
                activeDot={{ r: 4 }}
                stroke={runColor(index)}
                strokeWidth={2}
                strokeOpacity={shouldFade && !highlightedRunIds.has(run.id) ? 0.25 : 1}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="chart-card-footnote">
        {runs.map((run, index) => (
          <span key={run.id} style={{ color: runColor(index) }}>
            {run.label} — {growthMultiple(run, logFilesById).toFixed(1)}x growth
            {index < runs.length - 1 ? "  " : ""}
          </span>
        ))}
      </p>
    </div>
  );
}
