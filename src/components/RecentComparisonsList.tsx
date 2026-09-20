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
    <section className="recent-comparisons-list" aria-label="Recent comparisons">
      <h2>
        <Icon name="history" size={12} /> Recent comparisons
      </h2>
      <ul>
        {entries.map((entry) => (
          <li key={entry.id}>
            <button type="button" onClick={() => onOpen(entry.id)}>
              {entry.title}
            </button>
            <span> — {entry.runLabels.join(", ")} — {new Date(entry.createdAt).toLocaleString()}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
