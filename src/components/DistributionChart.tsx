export interface DistributionPoint {
  runId: string;
  label: string;
  value: number;
}

export interface DistributionChartProps {
  title: string;
  points: DistributionPoint[];
  width?: number;
}

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 1) return sorted[0];
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  return sorted[base + 1] !== undefined
    ? sorted[base] + rest * (sorted[base + 1] - sorted[base])
    : sorted[base];
}

/**
 * Shared aggregate/distribution fallback (FR-14): a box-plot/strip view with a
 * median line, interquartile range, and labeled outlier points, used once N
 * runs grows too large for per-run color-coded charts to stay legible
 * (default: more than 8 loaded runs).
 */
export function DistributionChart({ title, points, width = 480 }: DistributionChartProps) {
  if (points.length === 0) {
    return <p role="status">No data available for {title}.</p>;
  }

  const sorted = [...points].sort((a, b) => a.value - b.value);
  const values = sorted.map((p) => p.value);
  const min = values[0];
  const max = values[values.length - 1];
  const q1 = quantile(values, 0.25);
  const median = quantile(values, 0.5);
  const q3 = quantile(values, 0.75);
  const iqr = q3 - q1;
  const lowerFence = q1 - 1.5 * iqr;
  const upperFence = q3 + 1.5 * iqr;
  const outliers = sorted.filter((p) => p.value < lowerFence || p.value > upperFence);

  const height = 90;
  const margin = 24;
  const scale = (v: number) => margin + ((v - min) / (max - min || 1)) * (width - margin * 2);

  return (
    <figure className="distribution-chart" aria-label={`${title} distribution`}>
      <figcaption>{title} (aggregate view, {points.length} runs)</figcaption>
      <svg width={width} height={height} role="img" aria-label={`${title} box plot`}>
        <line x1={scale(min)} x2={scale(max)} y1={height / 2} y2={height / 2} stroke="currentColor" />
        <rect
          x={scale(q1)}
          y={height / 2 - 15}
          width={Math.max(1, scale(q3) - scale(q1))}
          height={30}
          fill="none"
          stroke="currentColor"
        />
        <line x1={scale(median)} x2={scale(median)} y1={height / 2 - 15} y2={height / 2 + 15} stroke="currentColor" strokeWidth={2} />
        {outliers.map((o) => (
          <circle key={o.runId} cx={scale(o.value)} cy={height / 2} r={4} fill="currentColor" />
        ))}
      </svg>
      <dl className="distribution-chart-stats">
        <dt>Median</dt>
        <dd>{median.toFixed(2)}</dd>
        <dt>Min</dt>
        <dd>{min.toFixed(2)}</dd>
        <dt>Max</dt>
        <dd>{max.toFixed(2)}</dd>
      </dl>
      {outliers.length > 0 && (
        <ul className="distribution-chart-outliers">
          {outliers.map((o) => (
            <li key={o.runId}>
              {o.label}: {o.value.toFixed(2)}
            </li>
          ))}
        </ul>
      )}
    </figure>
  );
}
