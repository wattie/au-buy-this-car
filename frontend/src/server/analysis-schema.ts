import { z } from "zod";

const intendedUseSchema = z.enum([
  "commuting",
  "family",
  "weekend",
  "first car",
  "enthusiast"
]);

const riskSeveritySchema = z.enum(["low", "medium", "high"]);
const confidenceLevelSchema = z.enum(["High", "Medium", "Low"]);
const verdictSchema = z.enum(["Buy", "Maybe", "Avoid"]);

export const analyseCarRequestSchema = z.object({
  listingInput: z.string(),
  budget: z.number(),
  intendedUse: intendedUseSchema,
  location: z.string().optional()
});

export const analyseCarResponseSchema = z.object({
  buyScore: z.number().min(0).max(100),
  verdict: verdictSchema,
  estimatedFairPrice: z.number(),
  estimatedListingPrice: z.number(),
  pricingSummary: z.string().min(1),
  confidenceLevel: confidenceLevelSchema,
  confidenceSummary: z.string().min(1),
  runningCostEstimate: z.string().min(1),
  summary: z.string().min(1),
  keyRisks: z.array(
    z.object({
      label: z.string().min(1),
      severity: riskSeveritySchema
    })
  ).min(1),
  negotiationTips: z.array(z.string().min(1)).min(1),
  questionsToAskSeller: z.array(z.string().min(1)).min(1),
  highlights: z.array(z.string().min(1)).min(1),
  scoreBreakdown: z.array(
    z.object({
      category: z.enum([
        "Price",
        "Reliability",
        "Running costs",
        "Resale",
        "Suitability"
      ]),
      score: z.number().min(0).max(100),
      summary: z.string().min(1)
    })
  ).length(5).superRefine((items, context) => {
    const expectedOrder = [
      "Price",
      "Reliability",
      "Running costs",
      "Resale",
      "Suitability"
    ] as const;

    items.forEach((item, index) => {
      if (item.category !== expectedOrder[index]) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "scoreBreakdown categories must follow the expected order",
          path: [index, "category"]
        });
      }
    });
  }),
  sellerRedFlags: z.array(z.string().min(1)).min(1),
  negotiationScript: z.string().min(1)
});

export type AnalyseCarRequestInput = z.infer<typeof analyseCarRequestSchema>;
export type AnalyseCarResponseOutput = z.infer<typeof analyseCarResponseSchema>;
