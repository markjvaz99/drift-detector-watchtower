import { computeEfficiencyMetrics } from "./efficiency";
import { computeDurationMetrics } from "./duration";
import { computeCacheIntensityMetrics } from "./cacheIntensity";
import { computeOverheadTrendMetrics } from "./overheadTrend";
import { computeToolUsageMetrics } from "./toolUsage";
import { computeErrorRecoveryMetrics } from "./errorRecovery";
import { computeActivityRatioMetrics } from "./activityRatios";
import { computeCodeVolumeMetrics } from "./codeVolume";
import type { LogFile } from "../types";
import type { RunMetricValue } from "./types";

export function computeRunMetrics(logFile: LogFile): RunMetricValue[] {
  return [
    ...computeEfficiencyMetrics(logFile),
    ...computeDurationMetrics(logFile),
    ...computeCacheIntensityMetrics(logFile),
    ...computeOverheadTrendMetrics(logFile),
    ...computeToolUsageMetrics(logFile),
    ...computeErrorRecoveryMetrics(logFile),
    ...computeActivityRatioMetrics(logFile),
    ...computeCodeVolumeMetrics(logFile),
  ];
}
