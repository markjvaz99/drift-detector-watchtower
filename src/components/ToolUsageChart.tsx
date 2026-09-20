import type { LogFile, Run } from "../types";
import { computeToolUsageByName } from "../metrics/toolUsage";
import { DistributionChart } from "./DistributionChart";
import { HorizontalBarRows } from "./HorizontalBarRows";
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
      <div className="tool-usage-chart card" data-layout="aggregate">
        <p className="chart-card-title">Tool usage by type</p>
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

  const groups = toolMetrics.map((metric) => ({
    label: metric.label,
    bars: runs.map((run, index) => {
      const value = Number(metric.valuesByRun.get(run.id) ?? 0);
      return { runIndex: index, value, displayValue: String(value) };
    }),
  }));
  const maxValue = Math.max(1, ...groups.flatMap((g) => g.bars.map((b) => b.value)));

  return (
    <div className="tool-usage-chart card" data-layout="grouped-bars">
      <p className="chart-card-title">Tool usage by type</p>
      <p className="chart-card-subtitle">Executed tool calls, by tool name</p>
      <HorizontalBarRows groups={groups} maxValue={maxValue} />
    </div>
  );
}
