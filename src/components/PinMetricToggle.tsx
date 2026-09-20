export interface PinMetricToggleProps {
  metricKey: string;
  metricLabel: string;
  pinned: boolean;
  onPin: (metricKey: string) => void;
  onUnpin: (metricKey: string) => void;
}

export function PinMetricToggle({ metricKey, metricLabel, pinned, onPin, onUnpin }: PinMetricToggleProps) {
  return (
    <button
      type="button"
      className="pin-metric-toggle"
      aria-pressed={pinned}
      aria-label={pinned ? `Unpin ${metricLabel}` : `Pin ${metricLabel}`}
      onClick={() => (pinned ? onUnpin(metricKey) : onPin(metricKey))}
    >
      {pinned ? "★" : "☆"}
    </button>
  );
}
