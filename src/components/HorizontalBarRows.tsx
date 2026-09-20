import { runColor } from "../ui/runColors";

export interface HorizontalBarRowsGroup {
  label: string;
  bars: { runIndex: number; value: number; displayValue: string }[];
}

export interface HorizontalBarRowsProps {
  groups: HorizontalBarRowsGroup[];
  maxValue: number;
}

export function HorizontalBarRows({ groups, maxValue }: HorizontalBarRowsProps) {
  const safeMax = maxValue > 0 ? maxValue : 1;
  return (
    <div className="hbar-rows">
      {groups.map((group) => (
        <div key={group.label} className="hbar-group">
          <p className="hbar-group-label">{group.label}</p>
          {group.bars.map((bar) => (
            <div className="hbar-row" key={bar.runIndex}>
              <div className="hbar-track">
                <div
                  className="hbar-fill"
                  style={{ width: `${Math.min(100, (bar.value / safeMax) * 100)}%`, background: runColor(bar.runIndex) }}
                />
              </div>
              <span className="hbar-value">{bar.displayValue}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
