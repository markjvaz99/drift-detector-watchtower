import type { Comparison, Run } from "../types";
import { deserializeComparison, type ReportExportFile } from "./reportSerializer";

export async function importReport(file: File): Promise<{ comparison: Comparison; runs: Run[] }> {
  const text = await file.text();
  const parsed = JSON.parse(text) as ReportExportFile;
  return deserializeComparison(parsed);
}
