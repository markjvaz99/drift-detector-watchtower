import { describe, expect, it } from "vitest";
import { join } from "node:path";
import { openDB } from "idb";
import { loadFixtureRun } from "../helpers/loadFixtureRun";
import { buildComparison } from "../../src/drift/buildComparison";
import { writeRecentComparison, listRecentComparisons } from "../../src/state/localHistoryStore";

const FIXTURES = join(__dirname, "../fixtures/two-runs-related");
const DB_NAME = "drift-detection-history";
const STORE_NAME = "recentComparisons";

describe("recent comparisons — cleared site data", () => {
  it("empties the recent-comparisons list once the browser's local storage for the app is cleared", async () => {
    const a = loadFixtureRun(join(FIXTURES, "run-a.jsonl"), "Run 1");
    const b = loadFixtureRun(join(FIXTURES, "run-b.jsonl"), "Run 2");
    const logFilesById = new Map([
      [a.logFile.id, a.logFile],
      [b.logFile.id, b.logFile],
    ]);
    const runs = [a.run, b.run];
    const comparison = buildComparison(runs, logFilesById, null);
    await writeRecentComparison(comparison, runs);

    expect((await listRecentComparisons()).length).toBeGreaterThan(0);

    // Simulate the browser clearing this origin's site data: the underlying
    // IndexedDB object store is emptied out from under the app.
    const db = await openDB(DB_NAME, 1);
    await db.clear(STORE_NAME);
    db.close();

    expect(await listRecentComparisons()).toEqual([]);
  });
});
