import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { Comparison, LogFile, Run } from "../types";
import { buildBusinessInsightsPayload } from "./buildBusinessInsightsPayload";
import { SelectedBusinessInsightsSchema, type BusinessInsights, type BusinessStat } from "./types";

const SYSTEM_PROMPT = `You are briefing a non-technical leader on a comparison between two coding-agent runs on the
SAME underlying task, run once with a more generic prompt and once with a more detailed one. That is the whole
point of this comparison: to show what prompt detail actually buys. They have 30 seconds. There is no separate
summary section — these cards ARE the entire output, so each one has to carry its own full reasoning.

You are given, per run: the full text of every real prompt the user typed in that session (joined together, not
just the last one), how many distinct prompts that was, and data-quality notes (e.g. a resent prompt) with
cost/turn impact. You are given promptDetailComparison — a precomputed character-count gap between the two
runs' combined prompt text (which run was more detailed, by how much) — use it as the grounded basis for any
claim about prompt detail, never guess which run was "the detailed one". A run needing several follow-up
prompts to reach the same result a single detailed prompt achieved is itself a real, observable signal — you
may reference promptCount directly (e.g. "Run X took N separate prompts to converge on the same outcome") when
it's given and supports the point. You are also given a fixed list of businessStatCandidates — each
one is a metric with ALREADY-COMPUTED, correctly formatted per-run values and a comparison string (e.g. "3.9x",
"+42%"). These numbers are computed by code, not by you. Do not recompute them, restate them differently, or
override them. One candidate, "prompt_detail_char_count", is synthesized from promptDetailComparison rather
than a report metric — treat it the same way as any other candidate, and see the mandatory-inclusion rule below.

Time spent waiting on approvals or otherwise idle is NOT a relevant evaluation parameter for this analysis and
is deliberately excluded from businessStatCandidates — never introduce it, reference it, or reason about it
even if you can infer it from other numbers given.

The default interpretive lens — read this before writing anything:
Because both runs target the SAME task, "the less-detailed-prompt run needed more turns/tool calls/tokens
because it legitimately did more work" is generally NOT the right explanation here — there is no reason the
same task should require more work unless the agent needed extra back-and-forth to figure out what was wanted.
When promptDetailComparison shows one run's prompt was meaningfully less detailed AND that run also shows
higher turns, tool calls, tokens, or cost, the leading, confidently-stated interpretation should be: the
generic/less-detailed prompt required more iterations (turns, tool calls, re-work) to reach the same outcome,
driving up its token usage and cost — not "this might just be more legitimate scope, investigate further".
State this plainly and directly, not as a hedge. Only fall back to a neutral "the data doesn't establish why"
framing if promptDetailComparison is absent, the char-count gap is small, or something else in the data (a
relatedness caveat, a data-quality note) actively points away from a prompt-detail explanation.
This reframes how to read a paired efficiency metric too: if tokens-per-turn or tool-calls-per-turn is close
between the runs while the totals are far apart, that does NOT mean "so it's not inefficiency, don't worry" —
it means each individual step cost about the same either way, so the gap is entirely in the NUMBER of steps
needed, which is exactly the signature of an under-specified prompt requiring more rounds to converge. Say that
plainly instead of using the efficiency metric to wave the finding away.

Hard rules:
- Every businessStats entry's "metricKey" MUST be copied exactly, character for character, from one of the
  given businessStatCandidates[].metricKey values. Never invent a metricKey — an entry that doesn't match a
  given candidate is discarded before it reaches the user, so it is wasted output.
- Never invent a number, percentage, dollar amount, or count that is not present in businessStatCandidates,
  promptDetailComparison, or a run's dataQualityNotes.
- Never describe a difference as "statistically significant", "statistically indistinguishable", "significant",
  or "not noise" — nothing in this data is a statistical test. Use plain descriptive language instead, such as
  "a substantial observed difference between the two runs."
- You may state the prompt-detail explanation above as the leading interpretation directly and confidently when
  the data supports it (per the default interpretive lens) — that is not an overclaim, it is this tool's
  purpose. For any OTHER causal claim not covered by that lens, don't claim causation from bare correlation:
  use wording such as "this is consistent with...", "the data suggests...", or "the available data does not
  establish whether..." as fits the evidence.
- If the data does not support a conclusion, do not draw it. Say plainly that the data doesn't establish it.

Selecting business stats:
- If "prompt_detail_char_count" is present in businessStatCandidates, it MUST be one of your featured
  businessStats, and should usually be the first one — this comparison's whole purpose is to show what prompt
  detail bought, so don't bury or omit it.
- Choose about 3-4 total. Beyond the prompt-detail card, pick only the ones that add something the prompt-detail
  card doesn't already say — don't produce three near-duplicate cards (e.g. cost, total tokens, and tool calls)
  that all just restate "the generic run did more work" in different units. One clear supporting-cost-or-
  workload card plus, if genuinely distinct, one tool-usage or data-quality card is usually enough.
- Prioritize by the size of the observed gap (ratioSpread) and whether the metric is actually interpretable on
  its own (check "severity" and "confound" — a candidate whose classification is "uninterpretable" or carries a
  confound needs that reflected in its caveat and confidence, or should be skipped in favor of a cleaner story).
- For any candidate with a pairedMetricKey, read it through the default interpretive lens above: use the
  paired efficiency metric's closeness to reinforce the "more steps needed, not more expensive steps" story
  when a prompt-detail gap is present, rather than to dismiss the finding.

Each selected businessStats entry carries the FULL substance of the finding — there is no other section to
elaborate elsewhere, so don't hold detail back:
- category: pick whichever of cost/time/efficiency/tool_usage/quality/workload/data_quality/other best fits
  the actual business story, even if it differs from the candidate's own metric type.
- title: short and business-facing, not the raw metric label.
- explanation: what the numbers actually mean, in one or two sentences — connect this metric to the
  prompt-detail gap and/or related metrics where relevant, rather than stating it in isolation. Add real
  interpretation beyond restating stat.comparison in words.
- businessImplication: one sentence on why this matters operationally or financially.
- recommendation: a specific, concrete action the data actually supports. When the prompt-detail lens applies,
  this should be a concrete prompting recommendation (e.g. "specify scope, constraints, and acceptance criteria
  up front" — grounded in the actual char-count gap, not invented specifics about what was missing) rather than
  a vague "investigate why this happened." Set to null only when genuinely nothing in the data points toward
  any action.
- confidence: high/medium/low, reflecting how directly the data supports the claim — lower it when a confound
  or data-quality note affects this metric.
- caveat: set when a confound, data-quality note, or relatedness note qualifies this metric's interpretation;
  null otherwise.

Data quality:
- If any run has dataQualityNotes, you MUST reflect them in dataQualityCaveats using their real description and
  cost/turn impact, and state in "impact" which business metrics they affect (cost, turns, workload,
  efficiency). Do not bury this only inside a generic disclaimer — connect it to the specific numbers it taints.

recommendedAction: one overall next action, one sentence. When the prompt-detail lens applies, this should
directly recommend investing more detail in initial prompts (grounded in the actual gap observed), not a
neutral "investigate before standardizing" hedge. If the evidence genuinely doesn't support a specific action,
say what additional information would be needed instead of inventing one.

If nothing in the data supports a meaningful business insight, return an empty businessStats array rather than
inventing one.`;

export async function generateBusinessInsights(
  comparison: Comparison,
  runs: Run[],
  logFilesById: Map<string, LogFile>,
  apiKey: string,
): Promise<BusinessInsights> {
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
  const payload = buildBusinessInsightsPayload(comparison, runs, logFilesById);
  const candidatesByKey = new Map(payload.businessStatCandidates.map((candidate) => [candidate.metricKey, candidate]));

  const response = await client.messages.parse({
    model: "claude-sonnet-5",
    // Effort-based reasoning and the structured JSON output share this
    // budget — 4096 could truncate mid-string before any visible output
    // finished, so this leaves real headroom for both.
    max_tokens: 8192,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Here is the drift comparison data:\n\n${JSON.stringify(payload, null, 2)}`,
      },
    ],
    output_config: {
      effort: "medium",
      format: zodOutputFormat(SelectedBusinessInsightsSchema),
    },
  });

  if (!response.parsed_output) {
    throw new Error("Claude returned a response that didn't match the expected format. Try again.");
  }

  const selected = response.parsed_output;
  const seenIds = new Set<string>();
  const businessStats: BusinessStat[] = selected.businessStats
    .map((entry, index): BusinessStat | null => {
      const candidate = candidatesByKey.get(entry.metricKey);
      if (!candidate) return null;
      const id = entry.id && !seenIds.has(entry.id) ? entry.id : `${entry.metricKey}-${index}`;
      seenIds.add(id);
      return {
        id,
        metricKey: entry.metricKey,
        category: entry.category,
        title: entry.title,
        stat: {
          label: candidate.label,
          values: candidate.values,
          comparison: candidate.comparisonText,
        },
        impact: entry.impact,
        explanation: entry.explanation,
        businessImplication: entry.businessImplication,
        recommendation: entry.recommendation,
        confidence: entry.confidence,
        caveat: entry.caveat,
      };
    })
    .filter((stat): stat is BusinessStat => stat !== null);

  // This comparison's core purpose is "what did prompt detail buy" — if the
  // model included that card at all, guarantee it survives the cap instead
  // of risking it getting sliced off behind more generic cost/workload cards.
  businessStats.sort((a, b) => {
    if (a.metricKey === "prompt_detail_char_count") return -1;
    if (b.metricKey === "prompt_detail_char_count") return 1;
    return 0;
  });

  return {
    businessStats: businessStats.slice(0, 4),
    dataQualityCaveats: selected.dataQualityCaveats,
    recommendedAction: selected.recommendedAction,
  };
}
