import type {
  AnalyseCarRequest,
  AnalyseCarResponse,
  AnalysisCategory,
  SavedCarAnalysis,
  ThreeYearCostBreakdown
} from "./types";

const scoreCategoryOrder: AnalysisCategory[] = [
  "Price",
  "Reliability",
  "Running costs",
  "Resale",
  "Suitability"
];

const verdictConfidenceMap: Record<AnalyseCarResponse["confidenceLevel"], number> = {
  High: 1,
  Medium: 0.72,
  Low: 0.45
};

export const costBreakdownLabels: Record<keyof ThreeYearCostBreakdown, string> = {
  purchasePrice: "Purchase price",
  insuranceEstimate: "Insurance estimate",
  servicingEstimate: "Servicing estimate",
  fuelOrChargingEstimate: "Fuel/charging estimate",
  registrationAndOtherCosts: "Registration/other costs",
  totalThreeYearCost: "Total 3-year cost"
};

export function getScoreCategoryOrder() {
  return scoreCategoryOrder;
}

export function createSavedCarAnalysis(
  request: AnalyseCarRequest,
  analysis: AnalyseCarResponse,
  id = createCarId()
): SavedCarAnalysis {
  const title = extractCarTitle(request.listingInput);
  const costBreakdown = estimateThreeYearCosts(request, analysis);
  const averageSubScore = calculateAverageSubScore(analysis);

  return {
    id,
    title,
    analysis,
    request,
    costBreakdown,
    averageSubScore,
    verdictConfidenceScore: verdictConfidenceMap[analysis.confidenceLevel]
  };
}

export function createDemoCompareCars(): SavedCarAnalysis[] {
  return [
    createSavedCarAnalysis(
      {
        listingInput:
          "2018 Toyota Corolla SX hatch, $18,900, 86,000km, one owner, full service history, reverse camera, two keys, commuting use.",
        budget: 20000,
        intendedUse: "commuting",
        location: "Richmond 3121"
      },
      {
        buyScore: 82,
        verdict: "Buy",
        estimatedFairPrice: 19500,
        estimatedListingPrice: 18900,
        pricingSummary:
          "The asking price sits slightly below the modelled fair value, which makes this a strong commuter candidate if inspection checks out.",
        confidenceLevel: "High",
        confidenceSummary:
          "The listing provides enough detail to make this a confident demo recommendation, though inspection still matters.",
        runningCostEstimate:
          "Expect moderate annual costs, with no obvious red flag for insurance or catch-up servicing in the current signals.",
        summary:
          "This looks like a dependable, well-priced used-car option with solid commuter appeal.",
        keyRisks: [
          { label: "Rear bumper cosmetic damage should be inspected in person.", severity: "low" },
          { label: "Confirm tyre brand and age rather than relying on seller wording.", severity: "medium" }
        ],
        negotiationTips: [
          "Use the bumper scrape and any upcoming service interval as gentle negotiation leverage.",
          "Ask for the last two service invoices before making an offer."
        ],
        questionsToAskSeller: [
          "Can you send the most recent service invoice and logbook entries?",
          "Have any suspension or brake components been replaced recently?"
        ],
        highlights: [
          "One-owner wording supports cleaner ownership history.",
          "Full service history reduces maintenance uncertainty.",
          "Practical features fit everyday commuting well."
        ],
        scoreBreakdown: [
          { category: "Price", score: 84, summary: "Strong value relative to the current fair-price estimate." },
          { category: "Reliability", score: 86, summary: "Service-history language and sensible ownership signals help here." },
          { category: "Running costs", score: 80, summary: "Expected to be affordable to insure, service, and fuel." },
          { category: "Resale", score: 79, summary: "A broad-market hatch with decent resale strength." },
          { category: "Suitability", score: 83, summary: "Very aligned with commuter use." }
        ],
        sellerRedFlags: [
          "If the seller cannot show the logbook, downgrade the confidence quickly."
        ],
        negotiationScript:
          "I like this one and it suits what I need, but I still need to allow for inspection and minor cosmetic work, so I’d feel better around the mid-$18k range if the history all checks out."
      },
      "demo-corolla"
    ),
    createSavedCarAnalysis(
      {
        listingInput:
          "2017 Mazda 3 SP25 GT, $21,500, 101,000km, partial service history, leather trim, sunroof, tyres due soon.",
        budget: 22000,
        intendedUse: "first car",
        location: "South Yarra 3141"
      },
      {
        buyScore: 69,
        verdict: "Maybe",
        estimatedFairPrice: 20500,
        estimatedListingPrice: 21500,
        pricingSummary:
          "The asking price looks a little ambitious, so this is more about condition and negotiation discipline than instant value.",
        confidenceLevel: "Medium",
        confidenceSummary:
          "There is enough information for a directional call, but the incomplete history keeps this out of high-confidence territory.",
        runningCostEstimate:
          "Expect moderate ownership costs, but add a buffer for tyres, insurance, and any catch-up servicing in the first year.",
        summary:
          "This is an appealing but slightly overpriced option that needs a firmer inspection and a smarter offer.",
        keyRisks: [
          { label: "Partial service history raises questions about long-term maintenance consistency.", severity: "medium" },
          { label: "Tyres due soon will add to early ownership cost.", severity: "medium" }
        ],
        negotiationTips: [
          "Use the tyre replacement cost and partial service records to reset the negotiation anchor.",
          "Treat any missing ownership paperwork as a real price lever, not a minor detail."
        ],
        questionsToAskSeller: [
          "Which services are documented and which are missing?",
          "How much tread is left on all four tyres?"
        ],
        highlights: [
          "Strong feature set for the price bracket.",
          "Popular model that should stay easy to resell if bought well."
        ],
        scoreBreakdown: [
          { category: "Price", score: 65, summary: "Price is workable, but only with negotiation." },
          { category: "Reliability", score: 71, summary: "Reasonable platform, but history gaps hold it back." },
          { category: "Running costs", score: 66, summary: "Tyres and first-car insurance make this less forgiving." },
          { category: "Resale", score: 74, summary: "Market demand remains good for tidy examples." },
          { category: "Suitability", score: 70, summary: "Still a practical first-car candidate if costs are managed." }
        ],
        sellerRedFlags: [
          "Missing service records are brushed off as unimportant.",
          "The seller avoids discussing tyre condition in detail."
        ],
        negotiationScript:
          "It’s a nice spec, but with the partial history and tyres I’d need to replace soon, I’d be much more comfortable if we could get closer to the low-$20k mark."
      },
      "demo-mazda3"
    ),
    createSavedCarAnalysis(
      {
        listingInput:
          "2016 Subaru Outback 2.5i Premium, $23,900, 128,000km, full service history, one owner, AWD, family use, roof racks included.",
        budget: 25000,
        intendedUse: "family",
        location: "Camberwell 3124"
      },
      {
        buyScore: 76,
        verdict: "Buy",
        estimatedFairPrice: 23800,
        estimatedListingPrice: 23900,
        pricingSummary:
          "This sits close to fair value and makes sense if you genuinely need the space, safety, and AWD practicality.",
        confidenceLevel: "High",
        confidenceSummary:
          "The ownership pattern and service detail make this one of the clearer demo recommendations in the set.",
        runningCostEstimate:
          "Expect moderate-to-high annual costs because size, tyres, and fuel use are naturally higher than a small hatch.",
        summary:
          "A strong family-oriented choice with sensible pricing and practical strengths, as long as the running-cost tradeoff suits you.",
        keyRisks: [
          { label: "Higher fuel and tyre costs than a smaller hatchback.", severity: "medium" },
          { label: "At this mileage, confirm the next major service items clearly.", severity: "medium" }
        ],
        negotiationTips: [
          "Use upcoming major-service items to keep the offer disciplined.",
          "Ask for a pre-purchase inspection focused on suspension and AWD-system condition."
        ],
        questionsToAskSeller: [
          "What major work has been done in the last 30,000km?",
          "Have the brakes, battery, or suspension components been replaced recently?"
        ],
        highlights: [
          "One-owner history supports cleaner long-term care.",
          "Family-friendly packaging and safety context lift the suitability score.",
          "Pricing is close to fair value rather than obviously inflated."
        ],
        scoreBreakdown: [
          { category: "Price", score: 76, summary: "Fair-market fit is solid rather than exceptional." },
          { category: "Reliability", score: 78, summary: "Service history and ownership consistency help." },
          { category: "Running costs", score: 64, summary: "Bigger vehicle costs more to run over time." },
          { category: "Resale", score: 73, summary: "Still marketable, especially for family buyers." },
          { category: "Suitability", score: 88, summary: "Very strong fit for family use." }
        ],
        sellerRedFlags: [
          "If the seller cannot explain recent major maintenance, treat that as a caution sign."
        ],
        negotiationScript:
          "This one fits the brief well, but because larger cars can bring higher running costs and I still want an inspection, I’d be more comfortable if we can keep the deal just under the asking price."
      },
      "demo-outback"
    )
  ];
}

export function getScoreForCategory(car: SavedCarAnalysis, category: AnalysisCategory) {
  return (
    car.analysis.scoreBreakdown.find((item) => item.category === category)?.score ?? 0
  );
}

export function getWinningScoreIds(
  cars: SavedCarAnalysis[],
  category: AnalysisCategory
) {
  const bestScore = Math.max(...cars.map((car) => getScoreForCategory(car, category)));
  return new Set(
    cars.filter((car) => getScoreForCategory(car, category) === bestScore).map((car) => car.id)
  );
}

export function getWinningCostIds(
  cars: SavedCarAnalysis[],
  key: keyof ThreeYearCostBreakdown
) {
  const bestCost = Math.min(...cars.map((car) => car.costBreakdown[key]));
  return new Set(
    cars.filter((car) => car.costBreakdown[key] === bestCost).map((car) => car.id)
  );
}

export function getBestOverallChoice(cars: SavedCarAnalysis[]) {
  const maxAverage = Math.max(...cars.map((car) => car.averageSubScore));
  const minCost = Math.min(...cars.map((car) => car.costBreakdown.totalThreeYearCost));

  const rankedCars = cars
    .map((car) => {
      const averageComponent = maxAverage === 0 ? 0 : car.averageSubScore / maxAverage;
      const costComponent =
        minCost === 0 ? 0 : minCost / car.costBreakdown.totalThreeYearCost;
      const finalScore =
        averageComponent * 0.5 +
        costComponent * 0.3 +
        car.verdictConfidenceScore * 0.2;

      return {
        car,
        finalScore
      };
    })
    .sort((left, right) => right.finalScore - left.finalScore);

  return rankedCars[0]?.car ?? null;
}

function createCarId() {
  return `saved-car-${Math.random().toString(36).slice(2, 9)}`;
}

function extractCarTitle(listingInput: string) {
  const lines = listingInput
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const firstDescriptiveLine =
    lines.find((line) => !line.startsWith("http")) ?? lines[0] ?? "Used car listing";

  return firstDescriptiveLine.slice(0, 72);
}

function calculateAverageSubScore(analysis: AnalyseCarResponse) {
  const total = analysis.scoreBreakdown.reduce((sum, item) => sum + item.score, 0);
  return total / analysis.scoreBreakdown.length;
}

function estimateThreeYearCosts(
  request: AnalyseCarRequest,
  analysis: AnalyseCarResponse
): ThreeYearCostBreakdown {
  const intendedUseFactor: Record<AnalyseCarRequest["intendedUse"], number> = {
    commuting: 1,
    family: 1.18,
    weekend: 0.82,
    "first car": 1.12,
    enthusiast: 1.28
  };

  const baseMultiplier = intendedUseFactor[request.intendedUse];
  const reliabilityScore =
    analysis.scoreBreakdown.find((item) => item.category === "Reliability")?.score ?? 70;
  const runningCostScore =
    analysis.scoreBreakdown.find((item) => item.category === "Running costs")?.score ?? 70;

  const purchasePrice = analysis.estimatedListingPrice;
  const insuranceEstimate = Math.round((950 + (100 - reliabilityScore) * 8) * baseMultiplier * 3);
  const servicingEstimate = Math.round((780 + (100 - reliabilityScore) * 12) * baseMultiplier * 3);
  const fuelOrChargingEstimate = Math.round((1450 + (100 - runningCostScore) * 10) * baseMultiplier * 3);
  const registrationAndOtherCosts = Math.round((920 + (100 - analysis.buyScore) * 4) * 3);
  const totalThreeYearCost =
    purchasePrice +
    insuranceEstimate +
    servicingEstimate +
    fuelOrChargingEstimate +
    registrationAndOtherCosts;

  return {
    purchasePrice,
    insuranceEstimate,
    servicingEstimate,
    fuelOrChargingEstimate,
    registrationAndOtherCosts,
    totalThreeYearCost
  };
}
