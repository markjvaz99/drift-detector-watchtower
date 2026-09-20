import { test, expect } from "@playwright/test";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(__dirname, "../fixtures");

test.describe("Quickstart scenario 1 — single-run view", () => {
  test("shows per-run metrics with no drift language, and a plain empty state for an aborted session", async ({ page }) => {
    await page.goto("/");
    await page.locator("#log-upload").setInputFiles(join(FIXTURES, "single-run-normal.jsonl"));

    await expect(page.getByRole("heading", { name: "Run 1" })).toBeVisible();
    await expect(page.getByText(/drift/i)).toHaveCount(0);
    await expect(page.getByText(/vs\./i)).toHaveCount(0);

    await page.reload();
    await page.locator("#log-upload").setInputFiles(join(FIXTURES, "single-run-aborted.jsonl"));
    await expect(page.getByText(/no completed task activity/i)).toBeVisible();
  });
});

test.describe("Quickstart scenario 2 — relatedness check is always advisory", () => {
  test("rates a related pair and shows no reminder badge after continuing", async ({ page }) => {
    await page.goto("/");
    await page.locator("#log-upload").setInputFiles([
      join(FIXTURES, "two-runs-related/run-a.jsonl"),
      join(FIXTURES, "two-runs-related/run-b.jsonl"),
    ]);

    await expect(page.getByText("Related")).toBeVisible();
    const continueButton = page.getByRole("button", { name: /continue to comparison/i });
    await expect(continueButton).toBeEnabled();
    await continueButton.click();
    await expect(page.getByText(/review recommended|unrelated/i)).toHaveCount(0);
  });

  test("rates an unrelated pair as Unrelated without blocking continuation", async ({ page }) => {
    await page.goto("/");
    await page.locator("#log-upload").setInputFiles([
      join(FIXTURES, "two-runs-unrelated/run-a.jsonl"),
      join(FIXTURES, "two-runs-unrelated/run-b.jsonl"),
    ]);

    await expect(page.getByText("Unrelated")).toBeVisible();
    await expect(page.getByRole("button", { name: /continue to comparison/i })).toBeEnabled();
    await expect(page.getByRole("button", { name: /view.*individually/i })).toBeVisible();
  });

  test("shows one row for a 3-run cluster and a separate row for the unrelated 4th run", async ({ page }) => {
    await page.goto("/");
    await page.locator("#log-upload").setInputFiles([
      join(FIXTURES, "n-runs-mixed-relatedness/run-1.jsonl"),
      join(FIXTURES, "n-runs-mixed-relatedness/run-2.jsonl"),
      join(FIXTURES, "n-runs-mixed-relatedness/run-3.jsonl"),
      join(FIXTURES, "n-runs-mixed-relatedness/run-4.jsonl"),
    ]);

    await expect(page.getByText("Related")).toBeVisible();
    await expect(page.getByText("Unrelated")).toBeVisible();
  });
});

test.describe("Quickstart scenario 3 — two-run drift comparison", () => {
  test("classifies every metric and supports evidence drill-down", async ({ page }) => {
    await page.goto("/");
    await page.locator("#log-upload").setInputFiles([
      join(FIXTURES, "two-runs-related/run-a.jsonl"),
      join(FIXTURES, "two-runs-related/run-b.jsonl"),
    ]);
    await page.getByRole("button", { name: /continue to comparison/i }).click();

    await page.getByRole("button", { name: "Turns" }).click();
    await expect(page.getByRole("region", { name: /evidence/i })).toBeVisible();
  });

  test("shows a resent-prompt data-quality note with estimated impact", async ({ page }) => {
    await page.goto("/");
    await page.locator("#log-upload").setInputFiles([
      join(FIXTURES, "resent-prompt.jsonl"),
      join(FIXTURES, "single-run-normal.jsonl"),
    ]);
    await page.getByRole("button", { name: /continue to comparison/i }).click();
    await expect(page.getByText(/estimated cost impact/i)).toBeVisible();
  });
});

test.describe("Quickstart scenario 4 — N-run comparison", () => {
  test("shows group statistics and identifies the outlier across 5 runs", async ({ page }) => {
    await page.goto("/");
    await page.locator("#log-upload").setInputFiles([1, 2, 3, 4, 5].map((i) => join(FIXTURES, `n-runs-outlier/run-${i}.jsonl`)));
    await page.getByRole("button", { name: /continue to comparison/i }).click();

    await expect(page.getByRole("columnheader", { name: "Median" })).toBeVisible();
    await expect(page.getByText(/Run 3/).first()).toBeVisible();
  });
});

test.describe("Quickstart scenario 5 — dynamic headline surfacing", () => {
  test("shows an explicit no-drift state for two identical runs", async ({ page }) => {
    await page.goto("/");
    await page.locator("#log-upload").setInputFiles([
      join(FIXTURES, "single-run-normal.jsonl"),
      join(FIXTURES, "single-run-normal.jsonl"),
    ]);
    await page.getByRole("button", { name: /continue to comparison/i }).click();
    await expect(page.getByText(/no significant drift detected/i)).toBeVisible();
  });
});

test.describe("Quickstart scenario 6 — schema tolerance", () => {
  test("tolerates unrecognized event types and reconstructs truncated field lengths", async ({ page }) => {
    await page.goto("/");
    await page.locator("#log-upload").setInputFiles([
      join(FIXTURES, "unknown-schema-fields.jsonl"),
      join(FIXTURES, "single-run-normal.jsonl"),
    ]);
    await page.getByRole("button", { name: /continue to comparison/i }).click();
    await expect(page.getByRole("table")).toBeVisible();

    await page.goto("/");
    await page.locator("#log-upload").setInputFiles(join(FIXTURES, "truncated-fields.jsonl"));
    await expect(page.getByText("Net characters added")).toBeVisible();
  });
});

test.describe("Quickstart scenario 7 — export and recent comparisons", () => {
  test("exports a report and lists it as a recent comparison after reload", async ({ page }) => {
    await page.goto("/");
    await page.locator("#log-upload").setInputFiles([
      join(FIXTURES, "two-runs-related/run-a.jsonl"),
      join(FIXTURES, "two-runs-related/run-b.jsonl"),
    ]);
    await page.getByRole("button", { name: /continue to comparison/i }).click();

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: /export report/i }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.json$/);

    await page.reload();
    await expect(page.getByRole("region", { name: /recent comparisons/i })).toBeVisible();
  });
});

test.describe("Quickstart scenario 8 — dominant-driver panel", () => {
  test("names the dominant metric for a clear-driver comparison", async ({ page }) => {
    await page.goto("/");
    await page.locator("#log-upload").setInputFiles([
      join(FIXTURES, "dominant-driver-clear/run-a.jsonl"),
      join(FIXTURES, "dominant-driver-clear/run-b.jsonl"),
    ]);
    await page.getByRole("button", { name: /continue to comparison/i }).click();
    await expect(page.getByRole("region", { name: /dominant driver/i })).toContainText("McpTool calls");
  });

  test("states no single dominant driver for a spread comparison", async ({ page }) => {
    await page.goto("/");
    await page.locator("#log-upload").setInputFiles([
      join(FIXTURES, "dominant-driver-spread/run-a.jsonl"),
      join(FIXTURES, "dominant-driver-spread/run-b.jsonl"),
    ]);
    await page.getByRole("button", { name: /continue to comparison/i }).click();
    await expect(page.getByRole("region", { name: /dominant driver/i })).toContainText(
      /no single dominant driver identified/i,
    );
  });

  test("shows a plain session summary for a single uploaded run", async ({ page }) => {
    await page.goto("/");
    await page.locator("#log-upload").setInputFiles(join(FIXTURES, "single-run-normal.jsonl"));
    await expect(page.getByRole("region", { name: /session summary/i })).toBeVisible();
  });
});
