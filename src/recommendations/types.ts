import { z } from "zod";

export const ExecutiveSummaryInsightSchema = z.object({
  headline: z.string(),
  detail: z.string(),
  supportingMetricKeys: z.array(z.string()),
});

export const ExecutiveSummarySchema = z.object({
  insights: z.array(ExecutiveSummaryInsightSchema),
});

export type ExecutiveSummaryInsight = z.infer<typeof ExecutiveSummaryInsightSchema>;
