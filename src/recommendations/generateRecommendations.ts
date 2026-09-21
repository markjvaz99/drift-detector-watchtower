import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { Comparison, Run } from "../types";
import { buildRecommendationPayload } from "./buildRecommendationPayload";
import { ExecutiveSummarySchema, type ExecutiveSummaryInsight } from "./types";

const SYSTEM_PROMPT = `You are analyzing a comparison between Claude Code runs on the same underlying task,
where the runs differ mainly in how detailed or specific the task prompt was. Write a short, rigorous
executive summary that shows what prompt detail actually bought (or cost) in time, cost, and correctness —
the way a careful engineer would write it up for a teammate, not a marketing pitch.

You will be given, per run: the prompt text and its character count, any data-quality notes (e.g. a resent
prompt) with their cost/turn impact, and a wall-clock duration breakdown (active / approval-wait / other-idle,
as percentages of total). You will also be given drift-classified metrics across the runs — including
per-tool-name call counts (metric key prefix "tool_usage_"), code volume written (net_chars_added /
net_chars_removed), and other session metrics — each with severity, statistical basis, group statistics, and
any confound that overrides the classification.

Write 4-6 insights, ordered by how much they actually explain the difference between the runs (most
explanatory first). Rules:
- Start by checking the metric most people would look at first (e.g. tokens per turn, or whichever metric is
  headline) — say plainly whether it actually shows drift. If it doesn't, say so before moving on; don't let
  a flat top-line metric imply nothing happened when other metrics tell a different story.
- Identify which metric(s) actually carry the real signal, with the precise numbers and how large the gap is
  (percentage or multiple) — never vague language like "significantly higher."
- Explain root causes using the tool-usage breakdown: if one run used a tool the other didn't (a categorical
  difference) or used one far more than the other, name the tools and counts and explain what that implies
  about how the two runs solved the task differently.
- If wall-clock duration is dominated by approval-wait or other-idle time, say so explicitly with the
  percentages, and caution against reading raw duration as agent speed.
- Compare code volume written (net_chars_added / net_chars_removed) and note whether the cost/token/call gap
  is actually explained by writing more code, or by something else (tool choice, retries, session shape).
- If any data-quality note (e.g. a resent prompt) is present, report its cost/turn impact and flag which
  metrics it makes unreliable.
- Where the data supports it, tie the finding back to prompt detail: does the more detailed prompt's run show
  fewer wasted/exploratory tool calls, less rework, or a more direct path to the result? Don't force this
  connection where the data doesn't support it — say so plainly if the drift isn't actually explained by
  prompt detail.
- Ground every claim in the specific numbers given. Never invent a number, timestamp, or fact not present in
  the payload.
- List each metric key an insight is actually grounded in in supportingMetricKeys (empty array if none apply).
- If nothing in the data is worth reporting, return an empty list rather than inventing an insight.`;

export async function generateRecommendations(
  comparison: Comparison,
  runs: Run[],
  apiKey: string,
): Promise<ExecutiveSummaryInsight[]> {
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
  const payload = buildRecommendationPayload(comparison, runs);

  const response = await client.messages.parse({
    model: "claude-sonnet-5",
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Here is the drift comparison data:\n\n${JSON.stringify(payload, null, 2)}`,
      },
    ],
    output_config: {
      effort: "medium",
      format: zodOutputFormat(ExecutiveSummarySchema),
    },
  });

  if (!response.parsed_output) {
    throw new Error("Claude returned a response that didn't match the expected format. Try again.");
  }
  return response.parsed_output.insights;
}
