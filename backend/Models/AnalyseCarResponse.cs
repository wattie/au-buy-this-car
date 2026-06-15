namespace ShouldIBuyThisCar.Api.Models;

public sealed record RiskItem(
    string Label,
    string Severity
);

public sealed record ScoreBreakdownItem(
    string Category,
    int Score,
    string Summary
);

public sealed record AnalyseCarResponse(
    int BuyScore,
    string Verdict,
    decimal EstimatedFairPrice,
    decimal EstimatedListingPrice,
    string PricingSummary,
    string ConfidenceLevel,
    string ConfidenceSummary,
    string RunningCostEstimate,
    string Summary,
    IReadOnlyList<RiskItem> KeyRisks,
    IReadOnlyList<string> NegotiationTips,
    IReadOnlyList<string> QuestionsToAskSeller,
    IReadOnlyList<string> Highlights,
    IReadOnlyList<ScoreBreakdownItem> ScoreBreakdown,
    IReadOnlyList<string> SellerRedFlags,
    string NegotiationScript
);
