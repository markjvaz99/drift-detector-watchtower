import type { DriftSeverity } from "../types";

const SEVERITY_CLASS: Record<DriftSeverity, string> = {
  "no-drift": "signal-badge--neutral",
  moderate: "signal-badge--moderate",
  large: "signal-badge--large",
  categorical: "signal-badge--categorical",
  "cannot-determine": "signal-badge--cannot-determine",
  uninterpretable: "signal-badge--uninterpretable",
};

export interface SignalBadgeProps {
  severity: DriftSeverity;
}

export function SignalBadge({ severity }: SignalBadgeProps) {
  return <span className={`signal-badge ${SEVERITY_CLASS[severity]}`}>{severity}</span>;
}
