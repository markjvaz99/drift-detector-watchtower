import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

const ComparisonNamesSchema = z.object({
  title: z.string(),
  runLabels: z.array(z.object({ runId: z.string(), label: z.string() })),
});

export type ComparisonNames = z.infer<typeof ComparisonNamesSchema>;

export interface RunPromptSummary {
  runId: string;
  currentLabel: string;
  prompts: string[];
}

const SYSTEM_PROMPT = `You are naming a comparison between coding-agent sessions, based on the real prompts
each session's user actually typed (system-generated notifications and trivial commands are already
excluded from what you're given).

Produce:
- A short title (3-6 words, title case, no trailing punctuation) describing the shared task across all
  runs — not any one run's specifics.
- A short label (2-4 words) per run that captures what's actually DISTINCTIVE about that run relative to
  the others — e.g. how detailed its prompt was, a specific instruction it included that the others didn't.
  If the runs aren't meaningfully distinguishable from their prompts alone, use a plain, factual label (e.g.
  "Baseline run") rather than inventing a difference that isn't there.
- Never use marketing language ("Amazing", "Optimized!"). Be plain and factual, like a filename or a
  changelog entry, not a headline.
- Return exactly one runLabels entry per run given, using its runId unchanged.`;

const MAX_PROMPT_CHARS = 2000;

function truncate(text: string): string {
  return text.length > MAX_PROMPT_CHARS ? `${text.slice(0, MAX_PROMPT_CHARS)}…` : text;
}

export async function generateComparisonNames(
  runs: RunPromptSummary[],
  apiKey: string,
): Promise<ComparisonNames> {
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
  const payload = runs.map((run) => ({
    runId: run.runId,
    currentLabel: run.currentLabel,
    prompts: run.prompts.map(truncate),
  }));

  const response = await client.messages.parse({
    model: "claude-sonnet-5",
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Here are the runs and their real prompts:\n\n${JSON.stringify(payload, null, 2)}`,
      },
    ],
    output_config: {
      effort: "low",
      format: zodOutputFormat(ComparisonNamesSchema),
    },
  });

  if (!response.parsed_output) {
    throw new Error("Claude returned a response that didn't match the expected format. Try again.");
  }
  return response.parsed_output;
}
