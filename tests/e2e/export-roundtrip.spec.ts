import { test, expect } from "@playwright/test";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(__dirname, "../fixtures");

/**
 * SC-009/FR-32: export a comparison, clear in-memory app state (a fresh page
 * load, not "recent comparisons"), then import the exported file directly.
 * It must render identically without re-uploading the source logs.
 */
test("importing a freshly exported report renders identically without re-uploading source logs", async ({ page }) => {
  await page.goto("/");
  await page.locator("#log-upload").setInputFiles([
    join(FIXTURES, "two-runs-related/run-a.jsonl"),
    join(FIXTURES, "two-runs-related/run-b.jsonl"),
  ]);
  await page.getByRole("button", { name: /continue to comparison/i }).click();
  await expect(page.getByRole("table")).toBeVisible();

  const title = await page.getByRole("heading", { level: 1 }).textContent();

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: /export report/i }).click();
  const download = await downloadPromise;
  const exportedPath = await download.path();
  expect(exportedPath).toBeTruthy();

  // Clear in-memory app state with a fresh page load (not "recent comparisons").
  await page.goto("/");
  await expect(page.locator("#log-upload")).toBeVisible();

  await page.locator("#report-import").setInputFiles(exportedPath!);

  await expect(page.getByRole("heading", { level: 1 })).toHaveText(title ?? "");
  await expect(page.getByRole("table")).toBeVisible();
  await expect(page.getByText(/reopened from recent comparisons/i)).toBeVisible();
});
