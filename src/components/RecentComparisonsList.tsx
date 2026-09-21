import { useEffect, useState } from "react";
import type { RecentComparisonEntry } from "../types";
import { listRecentComparisons } from "../state/localHistoryStore";
import { Icon } from "./Icon";

export interface RecentComparisonsListProps {
  onOpen: (id: string) => void;
}

export function RecentComparisonsList({ onOpen }: RecentComparisonsListProps) {
  const [entries, setEntries] = useState<RecentComparisonEntry[]>([]);

  useEffect(() => {
    let cancelled = false;
    listRecentComparisons().then((loaded) => {
      if (!cancelled) setEntries(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (entries.length === 0) return null;

  return (
    <section className="card recent-comparisons-list" aria-label="Recent comparisons">
      <p className="card-title">
        <Icon name="history" size={13} /> Recent comparisons
      </p>
      <ul>
        {entries.map((entry) => (
          <li key={entry.id}>
            <button type="button" onClick={() => onOpen(entry.id)}>
              <span className="recent-comparison-title">{entry.title}</span>
              <span className="recent-comparison-meta">
                {entry.runLabels.join(" vs. ")} · {new Date(entry.createdAt).toLocaleString()}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
