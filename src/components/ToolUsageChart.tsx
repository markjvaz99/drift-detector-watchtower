import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from "recharts";
import type { LogFile, Run } from "../types";
import { computeToolUsageByName } from "../metrics/toolUsage";
import { isCategoricalToolUsageDifference } from "../drift/categoricalDifference";
import { DistributionChart } from "./DistributionChart";
import type { Metric } from "../types";

export interface ToolUsageChartProps {
  runs: Run[];
  logFilesById: Map<string, LogFile>;
}

function buildToolMetrics(runs: Run[], logFilesById: Map<string, LogFile>): Metric[] {
  const toolNames = new Set<string>();
  const countsByRun = new Map<string, Map<string, number>>();
  for (const run of runs) {
    const logFile = logFilesById.get(run.sourceLogFileId);
    const counts = logFile ? computeToolUsageByName(logFile) : new Map<string, number>();
    countsByRun.set(run.id, counts);
    for (const toolName of counts.keys()) toolNames.add(toolName);
  }
  return Array.from(toolNames).map((toolName) => ({
    key: `tool_usage_${toolName}`,
    label: `${toolName} calls`,
    valuesByRun: new Map(runs.map((run) => [run.id, countsByRun.get(run.id)?.get(toolName) ?? 0])),
    denominatorLabel: "",
  }));
}

export function ToolUsageChart({ runs, logFilesById }: ToolUsageChartProps) {
  const toolMetrics = buildToolMetrics(runs, logFilesById);

  if (runs.length > 8) {
    return (
      <div className="tool-usage-chart" data-layout="aggregate">
        {toolMetrics.map((metric) => (
          <DistributionChart
            key={metric.key}
            title={metric.label}
            points={runs.map((run) => ({
              runId: run.id,
              label: run.label,
              value: Number(metric.valuesByRun.get(run.id) ?? 0),
            }))}
          />
        ))}
      </div>
    );
  }

  const data = toolMetrics.map((metric) => {
    const row: Record<string, string | number | boolean> = {
      tool: metric.label,
      categorical: isCategoricalToolUsageDifference(metric),
    };
    for (const run of runs) {
      row[run.label] = Number(metric.valuesByRun.get(run.id) ?? 0);
    }
    return row;
  });

  return (
    <div className="tool-usage-chart" data-layout="grouped-bars">
      <BarChart width={480} height={Math.max(200, toolMetrics.length * 40)} data={data} layout="vertical">
        <XAxis type="number" />
        <YAxis type="category" dataKey="tool" width={140} />
        <Tooltip />
        <Legend />
        {runs.map((run) => (
          <Bar key={run.id} dataKey={run.label} />
        ))}
      </BarChart>
    </div>
  );
}
