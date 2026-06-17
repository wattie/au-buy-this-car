import { FormEvent, useEffect, useMemo, useState } from "react";
import { analyseCar } from "./api";
import {
  createDemoCompareCars,
  createSavedCarAnalysis,
  getBestOverallChoice,
  getScoreCategoryOrder,
  getWinningCostIds,
  getWinningScoreIds
} from "./compare";
import { CompareTray } from "./components/CompareTray";
import { CostBreakdownTable } from "./components/CostBreakdownTable";
import { RadarScoreChart } from "./components/RadarScoreChart";
import type {
  AnalyseCarRequest,
  AnalyseCarResponse,
  AnalysisCategory,
  IntendedUse,
  RiskSeverity,
  SavedCarAnalysis,
  ThreeYearCostBreakdown
} from "./types";

const intendedUseOptions: IntendedUse[] = [
  "commuting",
  "family",
  "weekend",
  "first car",
  "enthusiast"
];

const loadingSteps = [
  "Reading listing",
  "Comparing market value",
  "Checking ownership risks",
  "Preparing recommendation"
] as const;

const demoListing: AnalyseCarRequest = {
  listingInput:
    "https://example.com/listing/2018-toyota-corolla\n\n2018 Toyota Corolla SX hatch, $18,900, 86,000km, one owner, full service history, two keys, reverse camera, rego until November. Seller says always serviced on time and mainly used for commuting. Small scrape on rear bumper, no accident history, tyres replaced last year.",
  budget: 20000,
  intendedUse: "commuting",
  location: "Richmond 3121"
};

const minimumLoadingMs = 2600;
const compareLimit = 3;

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0
  }).format(value);
}

function delay(milliseconds: number) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, milliseconds);
  });
}

function getVerdictTone(verdict: AnalyseCarResponse["verdict"]) {
  switch (verdict) {
    case "Buy":
      return "positive";
    case "Maybe":
      return "warning";
    default:
      return "negative";
  }
}

function getRiskTone(severity: RiskSeverity) {
  switch (severity) {
    case "low":
      return "low";
    case "medium":
      return "medium";
    default:
      return "high";
  }
}

export default function App() {
  const [formState, setFormState] = useState<AnalyseCarRequest>({
    listingInput: "",
    budget: 20000,
    intendedUse: "commuting",
    location: ""
  });
  const [result, setResult] = useState<AnalyseCarResponse | null>(null);
  const [lastAnalysedRequest, setLastAnalysedRequest] =
    useState<AnalyseCarRequest | null>(null);
  const [savedCars, setSavedCars] = useState<SavedCarAnalysis[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStepIndex, setLoadingStepIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [compareMessage, setCompareMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading) {
      setLoadingStepIndex(0);
      return;
    }

    const intervalId = window.setInterval(() => {
      setLoadingStepIndex((current) =>
        current < loadingSteps.length - 1 ? current + 1 : current
      );
    }, 650);

    return () => window.clearInterval(intervalId);
  }, [isLoading]);

  const scoreRingStyle = useMemo(() => {
    const score = result?.buyScore ?? 0;
    return {
      background: `conic-gradient(var(--score-accent) ${score * 3.6}deg, rgba(255,255,255,0.14) 0deg)`
    };
  }, [result?.buyScore]);

  const winningScoreIdsByCategory = useMemo(() => {
    return getScoreCategoryOrder().reduce(
      (accumulator, category) => {
        accumulator[category] = getWinningScoreIds(savedCars, category);
        return accumulator;
      },
      {} as Record<AnalysisCategory, Set<string>>
    );
  }, [savedCars]);

  const winningCostIdsByKey = useMemo(() => {
    const costKeys: Array<keyof ThreeYearCostBreakdown> = [
      "purchasePrice",
      "insuranceEstimate",
      "servicingEstimate",
      "fuelOrChargingEstimate",
      "registrationAndOtherCosts",
      "totalThreeYearCost"
    ];

    return costKeys.reduce(
      (accumulator, key) => {
        accumulator[key] = getWinningCostIds(savedCars, key);
        return accumulator;
      },
      {} as Record<keyof ThreeYearCostBreakdown, Set<string>>
    );
  }, [savedCars]);

  const bestOverallChoice = useMemo(() => getBestOverallChoice(savedCars), [savedCars]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const payload = {
        ...formState,
        listingInput: formState.listingInput.trim(),
        location: formState.location?.trim() || undefined
      };

      const [response] = await Promise.all([
        analyseCar(payload),
        delay(minimumLoadingMs)
      ]);

      setResult(response);
      setLastAnalysedRequest(payload);
      setCompareMessage(null);
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Something went wrong while analysing the car."
      );
    } finally {
      setIsLoading(false);
    }
  }

  function handleSaveToCompare() {
    if (!result || !lastAnalysedRequest) {
      return;
    }

    const candidate = createSavedCarAnalysis(lastAnalysedRequest, result);
    const alreadySaved = savedCars.some(
      (car) =>
        car.title === candidate.title &&
        car.analysis.estimatedListingPrice ===
          candidate.analysis.estimatedListingPrice
    );

    if (alreadySaved) {
      setCompareMessage("This car is already in your compare tray.");
      return;
    }

    if (savedCars.length >= compareLimit) {
      setCompareMessage("You can only compare up to 3 cars at once. Remove one to add another.");
      return;
    }

    setSavedCars((current) => [...current, candidate]);
    setCompareMessage(`Saved "${candidate.title}" to compare.`);
  }

  function handleRemoveSavedCar(id: string) {
    setSavedCars((current) => current.filter((car) => car.id !== id));
    setCompareMessage(null);
  }

  function handleLoadDemoCompareSet() {
    setSavedCars(createDemoCompareCars());
    setCompareMessage("Loaded a three-car demo compare set.");
  }

  return (
    <div className="page-shell">
      <main className="app-frame">
        <section className="hero">
          <div className="hero-copy">
            <span className="eyebrow">AI-assisted used-car decisioning</span>
            <h1>Should I Buy This Car?</h1>
            <p>
              Turn a raw used-car listing into a polished buying recommendation
              with a score breakdown, red-flag scan, pricing context, and a
              ready-to-use negotiation angle.
            </p>
            <div className="hero-actions">
              <button
                className="secondary-button"
                type="button"
                onClick={() => {
                  setFormState(demoListing);
                  setError(null);
                }}
              >
                Try sample listing
              </button>
              <button
                className="ghost-button"
                type="button"
                onClick={handleLoadDemoCompareSet}
              >
                Load compare demo
              </button>
              <span className="hero-note">
                Demo-ready mock analysis, structured for real AI later.
              </span>
            </div>
          </div>

          <div className="hero-panel">
            <div className="hero-stat">
              <strong>Recommendation quality</strong>
              <span>Verdict, score, and category-by-category breakdown</span>
            </div>
            <div className="hero-stat">
              <strong>Seller coaching</strong>
              <span>Red flags, questions, and a natural negotiation script</span>
            </div>
          </div>
        </section>

        <CompareTray
          cars={savedCars}
          onRemove={handleRemoveSavedCar}
          onLoadDemoSet={handleLoadDemoCompareSet}
          compareMessage={compareMessage}
          winningScoreIdsByCategory={winningScoreIdsByCategory}
          winningCostIdsByKey={winningCostIdsByKey}
        />

        <section className="content-grid">
          <form className="card form-card" onSubmit={handleSubmit}>
            <div className="section-heading">
              <h2>Analyse a listing</h2>
              <p>Paste a listing URL, listing text, or a mix of both.</p>
            </div>

            <label className="field">
              <span>Listing URL or text</span>
              <textarea
                required
                rows={8}
                value={formState.listingInput}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    listingInput: event.target.value
                  }))
                }
                placeholder="Example: 2017 Mazda 3 SP25, 98,000km, one owner, full service history..."
              />
            </label>

            <div className="field-row">
              <label className="field">
                <span>Budget</span>
                <input
                  required
                  type="number"
                  min={1000}
                  step={500}
                  value={formState.budget}
                  onChange={(event) =>
                    setFormState((current) => ({
                      ...current,
                      budget: Number(event.target.value)
                    }))
                  }
                />
              </label>

              <label className="field">
                <span>Intended use</span>
                <select
                  value={formState.intendedUse}
                  onChange={(event) =>
                    setFormState((current) => ({
                      ...current,
                      intendedUse: event.target.value as IntendedUse
                    }))
                  }
                >
                  {intendedUseOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="field">
              <span>Postcode or suburb (optional)</span>
              <input
                type="text"
                value={formState.location}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    location: event.target.value
                  }))
                }
                placeholder="Richmond 3121"
              />
            </label>

            <div className="form-actions">
              <button className="analyse-button" type="submit" disabled={isLoading}>
                {isLoading ? "Analysing..." : "Analyse"}
              </button>
              <button
                className="ghost-button"
                type="button"
                onClick={() => {
                  setFormState(demoListing);
                  setError(null);
                }}
                disabled={isLoading}
              >
                Fill demo data
              </button>
            </div>

            {error ? <div className="message error">{error}</div> : null}

            {!error && isLoading ? (
              <div className="message loading-panel">
                <div className="loading-header">
                  <strong>AI is analysing the listing</strong>
                  <span>
                    Mocking the kind of multi-step reasoning a full AI workflow
                    would show in a live demo.
                  </span>
                </div>
                <ol className="loading-steps">
                  {loadingSteps.map((step, index) => {
                    const state =
                      index < loadingStepIndex
                        ? "done"
                        : index === loadingStepIndex
                          ? "active"
                          : "pending";

                    return (
                      <li key={step} className={`loading-step ${state}`}>
                        <span className="loading-dot" />
                        <span>{step}</span>
                      </li>
                    );
                  })}
                </ol>
              </div>
            ) : null}
          </form>

          <section className="results-column">
            {result ? (
              <>
                <article className="card score-card">
                  <div className="score-visual">
                    <p className="muted-label">Buy score</p>
                    <div className="score-ring" style={scoreRingStyle}>
                      <div className="score-ring-inner">
                        <strong>{result.buyScore}</strong>
                        <span>/100</span>
                      </div>
                    </div>
                  </div>

                  <div className="score-summary">
                    <div className="summary-topline">
                      <span
                        className={`verdict-pill ${getVerdictTone(result.verdict)}`}
                      >
                        {result.verdict}
                      </span>
                      <span className="confidence-pill">
                        Confidence: {result.confidenceLevel}
                      </span>
                    </div>
                    <h2>{result.summary}</h2>
                    <p>{result.pricingSummary}</p>
                    <div className="score-metadata">
                      <div>
                        <span className="muted-label">Fair price</span>
                        <strong>{formatCurrency(result.estimatedFairPrice)}</strong>
                      </div>
                      <div>
                        <span className="muted-label">Listing price</span>
                        <strong>
                          {formatCurrency(result.estimatedListingPrice)}
                        </strong>
                      </div>
                      <div>
                        <span className="muted-label">Running costs</span>
                        <strong>Modelled locally</strong>
                      </div>
                    </div>
                    <div className="result-actions">
                      <button
                        className="secondary-button"
                        type="button"
                        onClick={handleSaveToCompare}
                      >
                        Save to Compare
                      </button>
                      <span className="compare-hint">
                        {savedCars.length}/{compareLimit} cars saved
                      </span>
                    </div>
                  </div>
                </article>

                <div className="results-grid">
                  <article className="card">
                    <div className="card-heading">
                      <h3>Score breakdown</h3>
                      <span className="card-kicker">Why the score landed here</span>
                    </div>
                    <div className="breakdown-list">
                      {result.scoreBreakdown.map((item) => (
                        <div className="breakdown-item" key={item.category}>
                          <div className="breakdown-header">
                            <strong>{item.category}</strong>
                            <span>{item.score}/100</span>
                          </div>
                          <div className="breakdown-track">
                            <span
                              className="breakdown-fill"
                              style={{ width: `${item.score}%` }}
                            />
                          </div>
                          <p>{item.summary}</p>
                        </div>
                      ))}
                    </div>
                  </article>

                  <article className="card">
                    <div className="card-heading">
                      <h3>Key risks</h3>
                      <span className="card-kicker">Colour-coded by severity</span>
                    </div>
                    <div className="risk-list">
                      {result.keyRisks.map((risk) => (
                        <div className="risk-item" key={risk.label}>
                          <span
                            className={`risk-chip ${getRiskTone(risk.severity)}`}
                          >
                            {risk.severity}
                          </span>
                          <p>{risk.label}</p>
                        </div>
                      ))}
                    </div>
                  </article>

                  <article className="card">
                    <div className="card-heading">
                      <h3>Seller red flags</h3>
                      <span className="card-kicker">Signals to slow the deal down</span>
                    </div>
                    <ul className="detail-list">
                      {result.sellerRedFlags.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </article>

                  <article className="card">
                    <div className="card-heading">
                      <h3>Highlights</h3>
                      <span className="card-kicker">What is working in the listing</span>
                    </div>
                    <ul className="detail-list">
                      {result.highlights.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </article>

                  <article className="card script-card">
                    <div className="card-heading">
                      <h3>Negotiation script</h3>
                      <span className="card-kicker">Natural-language demo output</span>
                    </div>
                    <p className="script-text">{result.negotiationScript}</p>
                    <ul className="detail-list compact">
                      {result.negotiationTips.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </article>

                  <article className="card">
                    <div className="card-heading">
                      <h3>Questions to ask seller</h3>
                      <span className="card-kicker">Useful before inspection or deposit</span>
                    </div>
                    <ul className="detail-list">
                      {result.questionsToAskSeller.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </article>

                  <article className="card">
                    <div className="card-heading">
                      <h3>Running costs</h3>
                      <span className="card-kicker">Practical ownership view</span>
                    </div>
                    <p>{result.runningCostEstimate}</p>
                  </article>

                  <article className="card">
                    <div className="card-heading">
                      <h3>Confidence level</h3>
                      <span className="card-kicker">How much detail the model had</span>
                    </div>
                    <p>{result.confidenceSummary}</p>
                  </article>
                </div>
              </>
            ) : (
              <article className="card empty-state">
                <span className="eyebrow">Demo mode</span>
                <h2>Your analysis will appear here</h2>
                <p>
                  Use the sample listing button for a quick presentation flow, or
                  paste your own listing to generate a mock verdict with pricing,
                  risks, seller red flags, and negotiation guidance.
                </p>
              </article>
            )}
          </section>
        </section>

        {savedCars.length >= 2 ? (
          <section className="compare-section">
            <div className="card compare-summary-card">
              <div className="compare-summary-copy">
                <span className="eyebrow">Compare cars</span>
                <h2>Side-by-side shortlist view</h2>
                <p>
                  The radar chart stacks all five score dimensions in one place,
                  while the cost table below highlights the cheapest ownership
                  path across your saved options.
                </p>
              </div>

              {bestOverallChoice ? (
                <div className="best-choice-panel">
                  <span className="card-kicker">Best overall choice</span>
                  <strong>{bestOverallChoice.title}</strong>
                  <p>
                    Highest blended recommendation based on sub-score average,
                    lowest three-year ownership cost, and verdict confidence.
                  </p>
                </div>
              ) : null}
            </div>

            <div className="compare-grid">
              <article className="card compare-chart-card">
                <div className="card-heading">
                  <h3>Five-category radar view</h3>
                  <span className="card-kicker">Higher scores win in each dimension</span>
                </div>
                <RadarScoreChart cars={savedCars} />
              </article>

              <article className="card compare-table-card">
                <div className="card-heading">
                  <h3>3-year cost breakdown</h3>
                  <span className="card-kicker">Lower cost wins in green</span>
                </div>
                <CostBreakdownTable
                  cars={savedCars}
                  winningCostIdsByKey={winningCostIdsByKey}
                />
              </article>
            </div>
          </section>
        ) : null}
      </main>
    </div>
  );
}
