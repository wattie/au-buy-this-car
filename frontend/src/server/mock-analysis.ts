import { AnalyseCarRequestInput, AnalyseCarResponseOutput } from "@/src/server/analysis-schema";

export async function analyseWithMockService(
  request: AnalyseCarRequestInput
): Promise<AnalyseCarResponseOutput> {
  const normalizedInput = request.listingInput.trim().toLowerCase();
  const listingPrice = parsePrice(normalizedInput) ?? createSyntheticListingPrice(request.budget, normalizedInput);
  let buyScore = 64;
  const highlights: string[] = [];
  let keyRisks: AnalyseCarResponseOutput["keyRisks"] = [];
  let negotiationTips: string[] = [];
  let sellerQuestions: string[] = [];
  let sellerRedFlags: string[] = [];

  if (listingPrice <= request.budget) {
    buyScore += 10;
    highlights.push("The listing appears to sit within your stated budget.");
  } else {
    buyScore -= 12;
    keyRisks.push({
      label: "The asking price appears above your stated budget, leaving less room for repairs or insurance.",
      severity: "high"
    });
    negotiationTips.push("Use your budget ceiling early and anchor the conversation below the asking price.");
    sellerRedFlags.push("The seller is unwilling to discuss how they priced the car against similar listings.");
  }

  if (normalizedInput.includes("service history") || normalizedInput.includes("full history")) {
    buyScore += 8;
    highlights.push("Service history is mentioned, which usually reduces ownership uncertainty.");
  } else {
    keyRisks.push({
      label: "There is no obvious service-history signal in the listing text.",
      severity: "medium"
    });
    sellerQuestions.push("Can you share service records, invoices, or the logbook history?");
    sellerRedFlags.push("Service history is vague, incomplete, or only described verbally.");
  }

  if (normalizedInput.includes("one owner")) {
    buyScore += 4;
    highlights.push("One-owner wording can indicate more consistent care.");
  }

  if (normalizedInput.includes("accident") || normalizedInput.includes("repairable write-off")) {
    buyScore -= 22;
    keyRisks.push({
      label: "Accident or write-off language is a strong caution flag for resale and insurance.",
      severity: "high"
    });
    sellerQuestions.push("Has the car had any crash repairs, structural work, or insurance claims?");
    sellerRedFlags.push("Repair history is described vaguely or the seller avoids written details about prior damage.");
  }

  if (normalizedInput.includes("needs work") || normalizedInput.includes("as is")) {
    buyScore -= 18;
    keyRisks.push({
      label: "The listing hints at immediate repair work or deferred maintenance.",
      severity: "high"
    });
    negotiationTips.push("Treat any vague mechanical wording as a priced-in repair budget, not a minor issue.");
    sellerRedFlags.push("Phrases like 'as is' or 'needs work' appear without a clear repair explanation.");
  }

  if (normalizedInput.includes("low kms") || normalizedInput.includes("low km")) {
    buyScore += 5;
    highlights.push("Lower kilometre wording usually supports value if it is backed by condition and servicing.");
  }

  if (normalizedInput.includes("urgent sale") || normalizedInput.includes("priced to sell")) {
    sellerRedFlags.push("Urgency language may be genuine, but it can also be used to rush due diligence.");
  }

  switch (request.intendedUse.trim().toLowerCase()) {
    case "commuting":
      highlights.push("For commuting, predictable servicing and fuel economy matter more than extra features.");
      break;
    case "family":
      sellerQuestions.push("Do all safety features, child-seat anchor points, and rear doors work correctly?");
      highlights.push("For family use, safety history and interior condition carry extra weight.");
      buyScore -= normalizedInput.includes("small hatch") ? 6 : 0;
      break;
    case "weekend":
      negotiationTips.push("Ask whether the car has spent long periods parked, which can hide battery or tyre issues.");
      break;
    case "first car":
      keyRisks.push({
        label: "For a first car, insurance and tyre or brake wear can swing the real first-year cost quickly.",
        severity: "medium"
      });
      sellerQuestions.push("What work has been done recently on tyres, brakes, battery, and registration?");
      break;
    case "enthusiast":
      keyRisks.push({
        label: "Enthusiast buyers should confirm whether any modifications are engineered and insurable.",
        severity: "medium"
      });
      sellerQuestions.push("Which modifications are installed, and do you have receipts or engineering paperwork?");
      sellerRedFlags.push("Modification details are incomplete or the seller cannot show receipts for major parts.");
      break;
    default:
      break;
  }

  if (request.location?.trim()) {
    highlights.push(`Location context noted for ${request.location.trim()}, which can affect local demand and inspection logistics.`);
  }

  buyScore = clamp(buyScore, 24, 92);

  const fairPrice = calculateFairPrice(listingPrice, buyScore);
  const verdict = buyScore >= 72 ? "Buy" : buyScore >= 55 ? "Maybe" : "Avoid";
  const confidenceLevel =
    normalizedInput.length > 180 ? "High" : normalizedInput.length > 80 ? "Medium" : "Low";

  if (negotiationTips.length === 0) {
    negotiationTips.push("Ask for a pre-purchase inspection and use any upcoming service items as your negotiation leverage.");
  }

  if (sellerQuestions.length === 0) {
    sellerQuestions.push("When was the last major service completed, and what receipts can you provide?");
  }

  keyRisks = uniqueBy(keyRisks, (risk) => risk.label).slice(0, 4);
  negotiationTips = unique(negotiationTips).slice(0, 4);
  sellerQuestions = unique(sellerQuestions).slice(0, 4);
  const uniqueHighlights = unique(highlights).slice(0, 4);
  sellerRedFlags = unique(sellerRedFlags).slice(0, 4);

  if (sellerRedFlags.length === 0) {
    sellerRedFlags.push("The seller resists a pre-purchase inspection or pressures you to pay a deposit immediately.");
  }

  return {
    buyScore,
    verdict,
    estimatedFairPrice: fairPrice,
    estimatedListingPrice: listingPrice,
    pricingSummary: buildPricingSummary(listingPrice, fairPrice, request.budget),
    confidenceLevel,
    confidenceSummary: buildConfidenceSummary(confidenceLevel),
    runningCostEstimate: buildRunningCostSummary(request.intendedUse, buyScore),
    summary: buildSummary(verdict, buyScore),
    keyRisks,
    negotiationTips,
    questionsToAskSeller: sellerQuestions,
    highlights: uniqueHighlights,
    scoreBreakdown: buildScoreBreakdown(request, buyScore, listingPrice, fairPrice),
    sellerRedFlags,
    negotiationScript: buildNegotiationScript(listingPrice, fairPrice, request.budget)
  };
}

function parsePrice(input: string) {
  const match = input.match(/(?:\$|aud\s?)(\d{1,3}(?:,\d{3})+|\d{4,6})/i);
  if (!match) {
    return null;
  }

  const parsed = Number(match[1].replaceAll(",", ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function createSyntheticListingPrice(budget: number, input: string) {
  const modifier = input.length > 250 ? 0.94 : input.length > 120 ? 0.98 : 1.03;
  return Math.round(budget * modifier);
}

function calculateFairPrice(listingPrice: number, buyScore: number) {
  const scoreModifier =
    buyScore >= 78 ? 1.04 : buyScore >= 65 ? 0.98 : buyScore >= 52 ? 0.92 : 0.84;

  return Math.round(listingPrice * scoreModifier);
}

function buildPricingSummary(listingPrice: number, fairPrice: number, budget: number) {
  const formattedBudget = formatCurrency(budget);

  if (listingPrice < fairPrice) {
    return `The asking price looks slightly under the modelled fair value, which suggests room for a positive buy if inspection checks out. Your budget is ${formattedBudget}.`;
  }

  if (listingPrice <= budget) {
    return `The asking price looks close to fair market value, so the deal depends on condition, history, and any immediate maintenance. Your budget is ${formattedBudget}.`;
  }

  return `The asking price looks stretched relative to both the fair-value estimate and your budget, so negotiation discipline matters here. Your budget is ${formattedBudget}.`;
}

function buildConfidenceSummary(confidenceLevel: AnalyseCarResponseOutput["confidenceLevel"]) {
  switch (confidenceLevel) {
    case "High":
      return "The listing provided enough detail for a stronger mock assessment, but a real inspection and vehicle-history check would still matter.";
    case "Medium":
      return "This recommendation is directionally useful, though more detail on service history, condition, and ownership would improve confidence.";
    default:
      return "The listing details are thin, so treat this as an early screen rather than a buying decision.";
  }
}

function buildRunningCostSummary(intendedUse: string, buyScore: number) {
  const normalizedUse = intendedUse.trim().toLowerCase();
  const baseline =
    normalizedUse === "family"
      ? "Expect moderate-to-high annual ownership costs because tyres, servicing, and insurance often scale with size and safety equipment."
      : normalizedUse === "enthusiast"
        ? "Expect above-average running costs if the car has performance parts, specialist tyres, or modification-related insurance loading."
        : normalizedUse === "first car"
          ? "Expect running costs to be very sensitive to insurance, tyre age, and any overdue maintenance items in the first 12 months."
          : "Expect moderate annual ownership costs, with the biggest variables being tyres, brakes, insurance, and fuel use.";

  const overlay =
    buyScore >= 70
      ? " The current signals suggest no obvious running-cost blowout, assuming the inspection is clean."
      : " Build in extra buffer for catch-up maintenance after purchase.";

  return baseline + overlay;
}

function buildSummary(verdict: AnalyseCarResponseOutput["verdict"], buyScore: number) {
  switch (verdict) {
    case "Buy":
      return `This looks like a promising used-car candidate with a solid overall score of ${buyScore}/100.`;
    case "Maybe":
      return `This is a borderline opportunity at ${buyScore}/100 and needs a careful inspection before committing.`;
    default:
      return `This carries enough downside signals that the model leans away from buying at ${buyScore}/100.`;
  }
}

function buildScoreBreakdown(
  request: AnalyseCarRequestInput,
  buyScore: number,
  listingPrice: number,
  fairPrice: number
): AnalyseCarResponseOutput["scoreBreakdown"] {
  const priceScore = clamp(
    100 - Math.min(40, (Math.abs(listingPrice - fairPrice) / Math.max(1, fairPrice)) * 140),
    48,
    92
  );
  const reliabilityScore = clamp(
    buyScore + (request.listingInput.toLowerCase().includes("service history") ? 8 : -6),
    40,
    90
  );
  const runningCostScore = clamp(
    buyScore +
      (request.intendedUse.toLowerCase() === "enthusiast" ? -10 : 3) +
      (request.intendedUse.toLowerCase() === "first car" ? -4 : 0),
    42,
    88
  );
  const resaleScore = clamp(
    buyScore +
      (request.listingInput.toLowerCase().includes("one owner") ? 5 : 0) -
      (request.listingInput.toLowerCase().includes("accident") ? 18 : 0),
    35,
    90
  );
  const suitabilityScore = clamp(buyScore + 4, 46, 91);

  return [
    {
      category: "Price",
      score: Math.round(priceScore),
      summary: "How competitive the asking price looks relative to the mock fair-value estimate."
    },
    {
      category: "Reliability",
      score: Math.round(reliabilityScore),
      summary: "Signals from ownership history, servicing language, and likely maintenance confidence."
    },
    {
      category: "Running costs",
      score: Math.round(runningCostScore),
      summary: "Expected cost pressure from insurance, fuel, tyres, and catch-up maintenance."
    },
    {
      category: "Resale",
      score: Math.round(resaleScore),
      summary: "How easy this car may be to resell later based on history and marketability clues."
    },
    {
      category: "Suitability",
      score: Math.round(suitabilityScore),
      summary: `How well the listing appears to match your intended use: ${request.intendedUse}.`
    }
  ];
}

function buildNegotiationScript(listingPrice: number, fairPrice: number, budget: number) {
  const openingOffer = Math.round(Math.min(fairPrice, budget) * 0.95);
  const target = Math.round(Math.min(fairPrice, budget));

  return `You could say: "I like the car and it fits what I need, but based on the price, service history, and the chance I'll need to spend on inspection or maintenance, I'd be more comfortable around ${formatCurrency(openingOffer)}. If the inspection is clean and we can get close to ${formatCurrency(target)}, I'd be happy to move quickly."`;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0
  }).format(value);
}

function unique(values: string[]) {
  return [...new Set(values)];
}

function uniqueBy<T>(values: T[], selector: (value: T) => string) {
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = selector(value);
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}
