import type { BusinessStat } from "../recommendations/types";
import { Icon } from "./Icon";

const CATEGORY_LABELS: Record<BusinessStat["category"], string> = {
  cost: "Cost",
  time: "Time",
  efficiency: "Efficiency",
  tool_usage: "Tool usage",
  quality: "Quality",
  workload: "Workload",
  data_quality: "Data quality",
  other: "Other",
};

const IMPACT_LABELS: Record<BusinessStat["impact"], string> = {
  high: "High impact",
  medium: "Medium impact",
  low: "Low impact",
  informational: "Informational",
};

export interface BusinessStatCardProps {
  stat: BusinessStat;
}

export function BusinessStatCard({ stat }: BusinessStatCardProps) {
  const [first, second, ...rest] = stat.stat.values;

  return (
    <article className={`business-stat-card business-stat-card--${stat.impact}`}>
      <header className="business-stat-card-header">
        <div className="business-stat-card-badges">
          <span className="business-stat-badge">{CATEGORY_LABELS[stat.category]}</span>
          <span className={`business-stat-impact business-stat-impact--${stat.impact}`}>
            {IMPACT_LABELS[stat.impact]}
          </span>
        </div>
        <h3 className="business-stat-title">{stat.title}</h3>
      </header>

      <div className="business-stat-figure">
        <p className="business-stat-figure-value">
          {first && <span>{first.formattedValue}</span>}
          {second && (
            <>
              <span className="business-stat-figure-arrow" aria-hidden="true">
                →
              </span>
              <span>{second.formattedValue}</span>
            </>
          )}
        </p>
        <p className="business-stat-figure-comparison">{stat.stat.comparison}</p>
        <p className="business-stat-figure-label">{stat.stat.label}</p>
        {rest.length > 0 && (
          <p className="business-stat-figure-extra">{rest.map((v) => `${v.runLabel}: ${v.formattedValue}`).join(" · ")}</p>
        )}
      </div>

      <p className="business-stat-explanation">{stat.explanation}</p>
      <p className="business-stat-implication">
        <strong>Why it matters</strong> {stat.businessImplication}
      </p>

      {stat.recommendation && (
        <p className="business-stat-recommendation">
          <Icon name="check-circle" size={13} />
          {stat.recommendation}
        </p>
      )}

      <footer className="business-stat-meta">
        <span className="business-stat-meta-item">
          Source: <code>{stat.metricKey}</code>
        </span>
        <span className="business-stat-meta-item">Confidence: {stat.confidence}</span>
      </footer>

      {stat.caveat && (
        <p className="business-stat-caveat">
          <Icon name="warning" size={12} />
          {stat.caveat}
        </p>
      )}
    </article>
  );
}
