import { z } from "zod";

export const BusinessStatCategorySchema = z.enum([
  "cost",
  "time",
  "efficiency",
  "tool_usage",
  "quality",
  "workload",
  "data_quality",
  "other",
]);
export type BusinessStatCategory = z.infer<typeof BusinessStatCategorySchema>;

export const ImpactLevelSchema = z.enum(["high", "medium", "low", "informational"]);
export type ImpactLevel = z.infer<typeof ImpactLevelSchema>;

// What the model must return: narrative content plus a reference to one of
// the precomputed business-stat candidates (by metricKey). The model never
// generates the numbers themselves — only picks which candidate to feature
// and explains it — so every number that reaches the user is traceable to
// code, not LLM arithmetic.
export const SelectedBusinessStatSchema = z.object({
  id: z.string(),
  metricKey: z.string(),
  category: BusinessStatCategorySchema,
  title: z.string(),
  impact: ImpactLevelSchema,
  explanation: z.string(),
  businessImplication: z.string(),
  recommendation: z.string().nullable(),
});
export type SelectedBusinessStat = z.infer<typeof SelectedBusinessStatSchema>;

export const DataQualityCaveatSchema = z.object({
  issue: z.string(),
  impact: z.string(),
});
export type DataQualityCaveat = z.infer<typeof DataQualityCaveatSchema>;

export const SelectedBusinessInsightsSchema = z.object({
  businessStats: z.array(SelectedBusinessStatSchema),
  dataQualityCaveats: z.array(DataQualityCaveatSchema),
  recommendedAction: z.string(),
});
export type SelectedBusinessInsights = z.infer<typeof SelectedBusinessInsightsSchema>;

export interface BusinessStatValue {
  runId: string;
  runLabel: string;
  formattedValue: string;
}

// The final, frontend-facing shape — SelectedBusinessStat with its `stat`
// (values/comparison) spliced in from the matching precomputed candidate,
// never from the model's own output.
export interface BusinessStat {
  id: string;
  metricKey: string;
  category: BusinessStatCategory;
  title: string;
  stat: {
    label: string;
    values: BusinessStatValue[];
    comparison: string;
  };
  impact: ImpactLevel;
  explanation: string;
  businessImplication: string;
  recommendation: string | null;
}

export interface BusinessInsights {
  businessStats: BusinessStat[];
  dataQualityCaveats: DataQualityCaveat[];
  recommendedAction: string;
}
