export type IntendedUse =
  | "commuting"
  | "family"
  | "weekend"
  | "first car"
  | "enthusiast";

export type RiskSeverity = "low" | "medium" | "high";

export interface AnalyseCarRequest {
  listingInput: string;
  budget: number;
  intendedUse: IntendedUse;
  location?: string;
}

export interface RiskItem {
  label: string;
  severity: RiskSeverity;
}

export interface ScoreBreakdownItem {
  category: string;
  score: number;
  summary: string;
}

export interface AnalyseCarResponse {
  buyScore: number;
  verdict: "Buy" | "Maybe" | "Avoid";
  estimatedFairPrice: number;
  estimatedListingPrice: number;
  pricingSummary: string;
  confidenceLevel: "High" | "Medium" | "Low";
  confidenceSummary: string;
  runningCostEstimate: string;
  summary: string;
  keyRisks: RiskItem[];
  negotiationTips: string[];
  questionsToAskSeller: string[];
  highlights: string[];
  scoreBreakdown: ScoreBreakdownItem[];
  sellerRedFlags: string[];
  negotiationScript: string;
}
