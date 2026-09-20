import type { MetricValue } from "../types";

export interface RunMetricValue {
  key: string;
  label: string;
  value: MetricValue;
  denominatorLabel: string;
}
