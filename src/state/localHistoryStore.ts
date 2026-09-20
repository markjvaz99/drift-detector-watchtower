import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { Comparison, RecentComparisonEntry, Run } from "../types";
import { serializeComparison, deserializeComparison, type ReportExportFile } from "../reporting/reportSerializer";

const DB_NAME = "drift-detection-history";
const DB_VERSION = 1;
const STORE_NAME = "recentComparisons";

interface StoredRecentComparisonEntry {
  id: string;
  title: string;
  runLabels: string[];
  createdAt: string;
  reportPayload: ReportExportFile;
}

interface HistoryDbSchema extends DBSchema {
  [STORE_NAME]: {
    key: string;
    value: StoredRecentComparisonEntry;
    indexes: { createdAt: string };
  };
}

let dbPromise: Promise<IDBPDatabase<HistoryDbSchema>> | null = null;

function getDb(): Promise<IDBPDatabase<HistoryDbSchema>> {
  if (!dbPromise) {
    dbPromise = openDB<HistoryDbSchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("createdAt", "createdAt");
      },
    });
  }
  return dbPromise;
}

function nextId(): string {
  return `comparison-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function writeRecentComparison(comparison: Comparison, runs: Run[]): Promise<string> {
  const db = await getDb();
  const id = nextId();
  const entry: StoredRecentComparisonEntry = {
    id,
    title: comparison.title,
    runLabels: runs.map((run) => run.label),
    createdAt: new Date().toISOString(),
    reportPayload: serializeComparison(comparison, runs),
  };
  await db.put(STORE_NAME, entry);
  return id;
}

export async function listRecentComparisons(): Promise<RecentComparisonEntry[]> {
  const db = await getDb();
  const entries = await db.getAllFromIndex(STORE_NAME, "createdAt");
  return entries
    .slice()
    .reverse()
    .map((entry) => ({
      id: entry.id,
      title: entry.title,
      runLabels: entry.runLabels,
      createdAt: entry.createdAt,
      reportPayload: deserializeComparison(entry.reportPayload).comparison,
    }));
}

export async function getRecentComparison(
  id: string,
): Promise<{ comparison: Comparison; runs: Run[] } | null> {
  const db = await getDb();
  const entry = await db.get(STORE_NAME, id);
  if (!entry) return null;
  return deserializeComparison(entry.reportPayload);
}
