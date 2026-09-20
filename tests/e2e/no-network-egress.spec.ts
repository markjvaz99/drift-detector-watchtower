import { test, expect } from "@playwright/test";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(__dirname, "../fixtures");

/**
 * FR-30/SC-007: nothing in ingestion, analysis, export, or recent-comparisons
 * access may transmit file/prompt/path content or generated explanation text
 * off-device. This asserts no outgoing request is made at all beyond the
 * page's own initial static assets (loaded before navigation starts).
 */
test("makes zero outgoing network requests during upload, comparison, export, and reopen", async ({ page }) => {
  const externalRequests: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
      externalRequests.push(request.url());
    }
  });

  await page.goto("/");
  await page.locator("#log-upload").setInputFiles([
    join(FIXTURES, "two-runs-related/run-a.jsonl"),
    join(FIXTURES, "two-runs-related/run-b.jsonl"),
  ]);
  await page.getByRole("button", { name: /continue to comparison/i }).click();
  await expect(page.getByRole("table")).toBeVisible();

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: /export report/i }).click();
  await downloadPromise;

  await page.reload();
  await expect(page.getByRole("region", { name: /recent comparisons/i })).toBeVisible();

  expect(externalRequests).toEqual([]);
});
