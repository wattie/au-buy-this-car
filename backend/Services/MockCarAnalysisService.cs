using System.Text.RegularExpressions;
using ShouldIBuyThisCar.Api.Models;

namespace ShouldIBuyThisCar.Api.Services;

public sealed class MockCarAnalysisService : ICarAnalysisService
{
    public Task<AnalyseCarResponse> AnalyseAsync(AnalyseCarRequest request, CancellationToken cancellationToken = default)
    {
        var normalizedInput = request.ListingInput.Trim().ToLowerInvariant();
        var listingPrice = ParsePrice(normalizedInput) ?? CreateSyntheticListingPrice(request.Budget, normalizedInput);
        var buyScore = 64;
        var highlights = new List<string>();
        var keyRisks = new List<RiskItem>();
        var negotiationTips = new List<string>();
        var sellerQuestions = new List<string>();
        var sellerRedFlags = new List<string>();

        if (listingPrice <= request.Budget)
        {
            buyScore += 10;
            highlights.Add("The listing appears to sit within your stated budget.");
        }
        else
        {
            buyScore -= 12;
            keyRisks.Add(new RiskItem("The asking price appears above your stated budget, leaving less room for repairs or insurance.", "high"));
            negotiationTips.Add("Use your budget ceiling early and anchor the conversation below the asking price.");
            sellerRedFlags.Add("The seller is unwilling to discuss how they priced the car against similar listings.");
        }

        if (normalizedInput.Contains("service history") || normalizedInput.Contains("full history"))
        {
            buyScore += 8;
            highlights.Add("Service history is mentioned, which usually reduces ownership uncertainty.");
        }
        else
        {
            keyRisks.Add(new RiskItem("There is no obvious service-history signal in the listing text.", "medium"));
            sellerQuestions.Add("Can you share service records, invoices, or the logbook history?");
            sellerRedFlags.Add("Service history is vague, incomplete, or only described verbally.");
        }

        if (normalizedInput.Contains("one owner"))
        {
            buyScore += 4;
            highlights.Add("One-owner wording can indicate more consistent care.");
        }

        if (normalizedInput.Contains("accident") || normalizedInput.Contains("repairable write-off"))
        {
            buyScore -= 22;
            keyRisks.Add(new RiskItem("Accident or write-off language is a strong caution flag for resale and insurance.", "high"));
            sellerQuestions.Add("Has the car had any crash repairs, structural work, or insurance claims?");
            sellerRedFlags.Add("Repair history is described vaguely or the seller avoids written details about prior damage.");
        }

        if (normalizedInput.Contains("needs work") || normalizedInput.Contains("as is"))
        {
            buyScore -= 18;
            keyRisks.Add(new RiskItem("The listing hints at immediate repair work or deferred maintenance.", "high"));
            negotiationTips.Add("Treat any vague mechanical wording as a priced-in repair budget, not a minor issue.");
            sellerRedFlags.Add("Phrases like 'as is' or 'needs work' appear without a clear repair explanation.");
        }

        if (normalizedInput.Contains("low kms") || normalizedInput.Contains("low km"))
        {
            buyScore += 5;
            highlights.Add("Lower kilometre wording usually supports value if it is backed by condition and servicing.");
        }

        if (normalizedInput.Contains("urgent sale") || normalizedInput.Contains("priced to sell"))
        {
            sellerRedFlags.Add("Urgency language may be genuine, but it can also be used to rush due diligence.");
        }

        switch (request.IntendedUse.Trim().ToLowerInvariant())
        {
            case "commuting":
                highlights.Add("For commuting, predictable servicing and fuel economy matter more than extra features.");
                break;
            case "family":
                sellerQuestions.Add("Do all safety features, child-seat anchor points, and rear doors work correctly?");
                highlights.Add("For family use, safety history and interior condition carry extra weight.");
                buyScore -= normalizedInput.Contains("small hatch") ? 6 : 0;
                break;
            case "weekend":
                negotiationTips.Add("Ask whether the car has spent long periods parked, which can hide battery or tyre issues.");
                break;
            case "first car":
                keyRisks.Add(new RiskItem("For a first car, insurance and tyre or brake wear can swing the real first-year cost quickly.", "medium"));
                sellerQuestions.Add("What work has been done recently on tyres, brakes, battery, and registration?");
                break;
            case "enthusiast":
                keyRisks.Add(new RiskItem("Enthusiast buyers should confirm whether any modifications are engineered and insurable.", "medium"));
                sellerQuestions.Add("Which modifications are installed, and do you have receipts or engineering paperwork?");
                sellerRedFlags.Add("Modification details are incomplete or the seller cannot show receipts for major parts.");
                break;
        }

        if (!string.IsNullOrWhiteSpace(request.Location))
        {
            highlights.Add($"Location context noted for {request.Location.Trim()}, which can affect local demand and inspection logistics.");
        }

        buyScore = Math.Clamp(buyScore, 24, 92);

        var fairPrice = CalculateFairPrice(listingPrice, buyScore);
        var verdict = buyScore >= 72 ? "Buy" : buyScore >= 55 ? "Maybe" : "Avoid";
        var confidenceLevel = normalizedInput.Length > 180 ? "High" : normalizedInput.Length > 80 ? "Medium" : "Low";

        if (!negotiationTips.Any())
        {
            negotiationTips.Add("Ask for a pre-purchase inspection and use any upcoming service items as your negotiation leverage.");
        }

        if (!sellerQuestions.Any())
        {
            sellerQuestions.Add("When was the last major service completed, and what receipts can you provide?");
        }

        keyRisks = keyRisks
            .DistinctBy(risk => risk.Label)
            .Take(4)
            .ToList();

        negotiationTips = negotiationTips
            .Distinct()
            .Take(4)
            .ToList();

        sellerQuestions = sellerQuestions
            .Distinct()
            .Take(4)
            .ToList();

        highlights = highlights
            .Distinct()
            .Take(4)
            .ToList();

        sellerRedFlags = sellerRedFlags
            .Distinct()
            .Take(4)
            .ToList();

        if (!sellerRedFlags.Any())
        {
            sellerRedFlags.Add("The seller resists a pre-purchase inspection or pressures you to pay a deposit immediately.");
        }

        var scoreBreakdown = BuildScoreBreakdown(request, buyScore, listingPrice, fairPrice);

        return Task.FromResult(new AnalyseCarResponse(
            BuyScore: buyScore,
            Verdict: verdict,
            EstimatedFairPrice: fairPrice,
            EstimatedListingPrice: listingPrice,
            PricingSummary: BuildPricingSummary(listingPrice, fairPrice, request.Budget),
            ConfidenceLevel: confidenceLevel,
            ConfidenceSummary: BuildConfidenceSummary(confidenceLevel),
            RunningCostEstimate: BuildRunningCostSummary(request.IntendedUse, buyScore),
            Summary: BuildSummary(verdict, buyScore),
            KeyRisks: keyRisks,
            NegotiationTips: negotiationTips,
            QuestionsToAskSeller: sellerQuestions,
            Highlights: highlights,
            ScoreBreakdown: scoreBreakdown,
            SellerRedFlags: sellerRedFlags,
            NegotiationScript: BuildNegotiationScript(listingPrice, fairPrice, request.Budget)
        ));
    }

    private static decimal? ParsePrice(string input)
    {
        var match = Regex.Match(input, @"(?:\$|aud\s?)(\d{1,3}(?:,\d{3})+|\d{4,6})", RegexOptions.IgnoreCase);
        if (!match.Success)
        {
            return null;
        }

        return decimal.TryParse(match.Groups[1].Value.Replace(",", ""), out var parsed)
            ? parsed
            : null;
    }

    private static decimal CreateSyntheticListingPrice(decimal budget, string input)
    {
        var modifier = input.Length switch
        {
            > 250 => 0.94m,
            > 120 => 0.98m,
            _ => 1.03m
        };

        return Math.Round(budget * modifier, 0);
    }

    private static decimal CalculateFairPrice(decimal listingPrice, int buyScore)
    {
        var scoreModifier = buyScore switch
        {
            >= 78 => 1.04m,
            >= 65 => 0.98m,
            >= 52 => 0.92m,
            _ => 0.84m
        };

        return Math.Round(listingPrice * scoreModifier, 0);
    }

    private static string BuildPricingSummary(decimal listingPrice, decimal fairPrice, decimal budget)
    {
        if (listingPrice < fairPrice)
        {
            return $"The asking price looks slightly under the modelled fair value, which suggests room for a positive buy if inspection checks out. Your budget is {budget:C0}.";
        }

        if (listingPrice <= budget)
        {
            return $"The asking price looks close to fair market value, so the deal depends on condition, history, and any immediate maintenance. Your budget is {budget:C0}.";
        }

        return $"The asking price looks stretched relative to both the fair-value estimate and your budget, so negotiation discipline matters here. Your budget is {budget:C0}.";
    }

    private static string BuildConfidenceSummary(string confidenceLevel)
    {
        return confidenceLevel switch
        {
            "High" => "The listing provided enough detail for a stronger mock assessment, but a real inspection and vehicle-history check would still matter.",
            "Medium" => "This recommendation is directionally useful, though more detail on service history, condition, and ownership would improve confidence.",
            _ => "The listing details are thin, so treat this as an early screen rather than a buying decision."
        };
    }

    private static string BuildRunningCostSummary(string intendedUse, int buyScore)
    {
        var baseline = intendedUse.Trim().ToLowerInvariant() switch
        {
            "family" => "Expect moderate-to-high annual ownership costs because tyres, servicing, and insurance often scale with size and safety equipment.",
            "enthusiast" => "Expect above-average running costs if the car has performance parts, specialist tyres, or modification-related insurance loading.",
            "first car" => "Expect running costs to be very sensitive to insurance, tyre age, and any overdue maintenance items in the first 12 months.",
            _ => "Expect moderate annual ownership costs, with the biggest variables being tyres, brakes, insurance, and fuel use."
        };

        var overlay = buyScore >= 70
            ? " The current signals suggest no obvious running-cost blowout, assuming the inspection is clean."
            : " Build in extra buffer for catch-up maintenance after purchase.";

        return baseline + overlay;
    }

    private static string BuildSummary(string verdict, int buyScore)
    {
        return verdict switch
        {
            "Buy" => $"This looks like a promising used-car candidate with a solid overall score of {buyScore}/100.",
            "Maybe" => $"This is a borderline opportunity at {buyScore}/100 and needs a careful inspection before committing.",
            _ => $"This carries enough downside signals that the model leans away from buying at {buyScore}/100."
        };
    }

    private static IReadOnlyList<ScoreBreakdownItem> BuildScoreBreakdown(
        AnalyseCarRequest request,
        int buyScore,
        decimal listingPrice,
        decimal fairPrice)
    {
        var priceScore = Math.Clamp(100 - (int)Math.Min(40, Math.Abs(listingPrice - fairPrice) / Math.Max(1, fairPrice) * 140), 48, 92);
        var reliabilityScore = Math.Clamp(
            buyScore
            + (request.ListingInput.Contains("service history", StringComparison.OrdinalIgnoreCase) ? 8 : -6),
            40,
            90);
        var runningCostScore = Math.Clamp(
            buyScore
            + (request.IntendedUse.Equals("enthusiast", StringComparison.OrdinalIgnoreCase) ? -10 : 3)
            + (request.IntendedUse.Equals("first car", StringComparison.OrdinalIgnoreCase) ? -4 : 0),
            42,
            88);
        var resaleScore = Math.Clamp(
            buyScore
            + (request.ListingInput.Contains("one owner", StringComparison.OrdinalIgnoreCase) ? 5 : 0)
            - (request.ListingInput.Contains("accident", StringComparison.OrdinalIgnoreCase) ? 18 : 0),
            35,
            90);
        var suitabilityScore = Math.Clamp(buyScore + 4, 46, 91);

        return new List<ScoreBreakdownItem>
        {
            new("Price", priceScore, "How competitive the asking price looks relative to the mock fair-value estimate."),
            new("Reliability", reliabilityScore, "Signals from ownership history, servicing language, and likely maintenance confidence."),
            new("Running costs", runningCostScore, "Expected cost pressure from insurance, fuel, tyres, and catch-up maintenance."),
            new("Resale", resaleScore, "How easy this car may be to resell later based on history and marketability clues."),
            new("Suitability", suitabilityScore, $"How well the listing appears to match your intended use: {request.IntendedUse}.")
        };
    }

    private static string BuildNegotiationScript(decimal listingPrice, decimal fairPrice, decimal budget)
    {
        var openingOffer = Math.Min(fairPrice, budget) * 0.95m;
        var target = Math.Min(fairPrice, budget);

        return $"You could say: \"I like the car and it fits what I need, but based on the price, service history, and the chance I'll need to spend on inspection or maintenance, I'd be more comfortable around {openingOffer:C0}. If the inspection is clean and we can get close to {target:C0}, I'd be happy to move quickly.\"";
    }
}

