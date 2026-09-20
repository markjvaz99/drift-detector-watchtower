import type { Comparison, Run } from "../types";
import { serializeComparison } from "./reportSerializer";

function sanitizeFileNamePart(text: string): string {
  return text.replace(/[^a-z0-9-]+/gi, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").toLowerCase();
}

/**
 * Triggers a local file download of the serialized report. Never issues a
 * network request — the file is built and saved entirely client-side (FR-30).
 */
export function exportReport(comparison: Comparison, runs: Run[]): void {
  const payload = serializeComparison(comparison, runs);
  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${sanitizeFileNamePart(comparison.title) || "comparison"}.driftreport.json`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
