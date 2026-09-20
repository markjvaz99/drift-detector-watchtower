import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from "recharts";
import type { LogFile, Run } from "../types";
import { computeCacheIntensityMetrics } from "../metrics/cacheIntensity";
import { DistributionChart } from "./DistributionChart";

export interface CacheIntensityChartProps {
  runs: Run[];
  logFilesById: Map<string, LogFile>;
}

const SUB_METRICS = [
  { key: "cache_creation_per_read", label: "Per Read call" },
  { key: "cache_creation_per_edit", label: "Per Edit call" },
  { key: "cache_creation_per_tool_call", label: "Per tool call" },
] as const;

function numericValueByRun(runs: Run[], logFilesById: Map<string, LogFile>, metricKey: string) {
  return runs.map((run) => {
    const logFile = logFilesById.get(run.sourceLogFileId);
    const metrics = logFile ? computeCacheIntensityMetrics(logFile) : [];
    const found = metrics.find((m) => m.key === metricKey);
    const value = found && typeof found.value === "number" ? found.value : 0;
    return { runId: run.id, label: run.label, value };
  });
}

export function CacheIntensityChart({ runs, logFilesById }: CacheIntensityChartProps) {
  if (runs.length > 8) {
    return (
      <div className="cache-intensity-chart" data-layout="aggregate">
        {SUB_METRICS.map((sub) => (
          <DistributionChart key={sub.key} title={sub.label} points={numericValueByRun(runs, logFilesById, sub.key)} />
        ))}
      </div>
    );
  }

  if (runs.length >= 5) {
    return (
      <div className="cache-intensity-chart" data-layout="strip">
        {SUB_METRICS.map((sub) => {
          const points = numericValueByRun(runs, logFilesById, sub.key);
          const max = Math.max(1, ...points.map((p) => p.value));
          return (
            <div key={sub.key} className="strip-row" role="img" aria-label={`${sub.label} strip plot`}>
              <span className="strip-row-label">{sub.label}</span>
              <svg width={300} height={24}>
                <line x1={0} x2={300} y1={12} y2={12} stroke="currentColor" opacity={0.3} />
                {points.map((p) => (
                  <circle key={p.runId} cx={(p.value / max) * 290 + 5} cy={12} r={4} fill="currentColor">
                    <title>{`${p.label}: ${p.value.toFixed(2)}`}</title>
                  </circle>
                ))}
              </svg>
            </div>
          );
        })}
      </div>
    );
  }

  const data = SUB_METRICS.map((sub) => {
    const row: Record<string, string | number> = { metric: sub.label };
    for (const run of runs) {
      const logFile = logFilesById.get(run.sourceLogFileId);
      const metrics = logFile ? computeCacheIntensityMetrics(logFile) : [];
      const found = metrics.find((m) => m.key === sub.key);
      row[run.label] = found && typeof found.value === "number" ? found.value : 0;
    }
    return row;
  });

  return (
    <div className="cache-intensity-chart" data-layout="grouped-bars">
      <BarChart width={480} height={260} data={data}>
        <XAxis dataKey="metric" />
        <YAxis />
        <Tooltip />
        <Legend />
        {runs.map((run) => (
          <Bar key={run.id} dataKey={run.label} />
        ))}
      </BarChart>
    </div>
  );
}
