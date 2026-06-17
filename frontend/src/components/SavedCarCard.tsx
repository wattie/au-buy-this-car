import type { AnalysisCategory, SavedCarAnalysis, ThreeYearCostBreakdown } from "../types";

interface SavedCarCardProps {
  car: SavedCarAnalysis;
  onRemove: (id: string) => void;
  winningScoreIdsByCategory: Record<AnalysisCategory, Set<string>>;
  winningCostIdsByKey: Record<keyof ThreeYearCostBreakdown, Set<string>>;
}

const categoryOrder: AnalysisCategory[] = [
  "Price",
  "Reliability",
  "Running costs",
  "Resale",
  "Suitability"
];

export function SavedCarCard({
  car,
  onRemove,
  winningScoreIdsByCategory,
  winningCostIdsByKey
}: SavedCarCardProps) {
  return (
    <article className="saved-car-card">
      <div className="saved-car-topline">
        <div>
          <h3>{car.title}</h3>
          <div className="saved-car-meta">
            <span className={`verdict-pill ${car.analysis.verdict.toLowerCase() === "buy" ? "positive" : car.analysis.verdict.toLowerCase() === "maybe" ? "warning" : "negative"}`}>
              {car.analysis.verdict}
            </span>
            <span className="saved-car-score">{car.analysis.buyScore}/100</span>
          </div>
        </div>
        <button
          className="remove-button"
          type="button"
          onClick={() => onRemove(car.id)}
        >
          Remove
        </button>
      </div>

      <div className="saved-car-score-grid">
        {categoryOrder.map((category) => {
          const score =
            car.analysis.scoreBreakdown.find((item) => item.category === category)?.score ?? 0;
          const isWinner = winningScoreIdsByCategory[category].has(car.id);

          return (
            <div
              key={category}
              className={`saved-car-score-chip ${isWinner ? "winner" : ""}`}
            >
              <span>{category}</span>
              <strong>{score}</strong>
            </div>
          );
        })}
      </div>

      <div className="saved-car-cost-inline">
        <span>Total 3-year cost</span>
        <strong
          className={
            winningCostIdsByKey.totalThreeYearCost.has(car.id)
              ? "winner-text"
              : undefined
          }
        >
          {formatCurrency(car.costBreakdown.totalThreeYearCost)}
        </strong>
      </div>
    </article>
  );
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0
  }).format(value);
}
