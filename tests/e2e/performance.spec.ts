import { test, expect } from "@playwright/test";

/**
 * SC-008: a 10-run, several-MB-each fixture set must complete report
 * generation in under 30 seconds. Fixtures are generated in-memory here
 * (not checked into the repo) to avoid bloating it with tens of MB of data.
 */
function buildLargeRunJsonl(sessionId: string, repeatCount: number): string {
  const lines: string[] = [];
  let seq = 1;
  let nano = 1_700_000_000_000_000_000;

  function record(name: string, attributes: Record<string, unknown>) {
    nano += 1_000_000;
    lines.push(
      JSON.stringify({
        resourceLogs: [
          {
            resource: {
              attributes: [
                { key: "session.id", value: { stringValue: sessionId } },
                { key: "claude_code.version", value: { stringValue: "2.1.0" } },
                { key: "session.working_directory", value: { stringValue: "/repo/perf" } },
                { key: "vcs.branch", value: { stringValue: "main" } },
                { key: "vcs.commit", value: { stringValue: "abc123" } },
              ],
            },
            scopeLogs: [
              {
                logRecords: [
                  {
                    timeUnixNano: String(nano),
                    attributes: [
                      { key: "event.name", value: { stringValue: name } },
                      { key: "event.sequence", value: { intValue: seq } },
                      ...Object.entries(attributes).map(([key, value]) => ({
                        key,
                        value:
                          typeof value === "number"
                            ? { intValue: value }
                            : { stringValue: String(value) },
                      })),
                    ],
                  },
                ],
              },
            ],
          },
        ],
      }),
    );
    seq += 1;
  }

  record("user_prompt", { prompt_text: "Implement a large feature across many files." });
  const bigContent = "x".repeat(2000);
  for (let i = 0; i < repeatCount; i += 1) {
    record("api_call", { input_tokens: 500, output_tokens: 300, cache_read_tokens: 100, cache_creation_tokens: 2000, cost_usd: 0.05 });
    record("tool_decision", { tool_use_id: `tu_${i}`, tool_name: "Edit", decision: "approved", decision_source: "auto", new_content: bigContent, old_content: "" });
    record("tool_result", { tool_use_id: `tu_${i}`, tool_name: "Edit", outcome: "success" });
  }
  return lines.join("\n") + "\n";
}

test("renders a 10-run, several-MB-each comparison in under 30 seconds and stays responsive", async ({ page }) => {
  // ~3MB per run: ~1400 repeats * ~2.1KB per record triple.
  const files = Array.from({ length: 10 }, (_, i) => ({
    name: `run-${i + 1}.jsonl`,
    mimeType: "application/jsonl",
    buffer: Buffer.from(buildLargeRunJsonl(`session-perf-${i + 1}`, 1400), "utf8"),
  }));

  await page.goto("/");
  const start = Date.now();
  await page.locator("#log-upload").setInputFiles(files);
  await page.getByRole("button", { name: /continue to comparison/i }).click();
  await expect(page.getByRole("table")).toBeVisible();
  const elapsedMs = Date.now() - start;

  expect(elapsedMs).toBeLessThan(30_000);

  // The tab must stay responsive: a simple interaction should still work.
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});
