import type { AnalysisCategory, SavedCarAnalysis, ThreeYearCostBreakdown } from "../types";
import { SavedCarCard } from "./SavedCarCard";

interface CompareTrayProps {
  cars: SavedCarAnalysis[];
  onRemove: (id: string) => void;
  onLoadDemoSet: () => void;
  compareMessage: string | null;
  winningScoreIdsByCategory: Record<AnalysisCategory, Set<string>>;
  winningCostIdsByKey: Record<keyof ThreeYearCostBreakdown, Set<string>>;
}

export function CompareTray({
  cars,
  onRemove,
  onLoadDemoSet,
  compareMessage,
  winningScoreIdsByCategory,
  winningCostIdsByKey
}: CompareTrayProps) {
  return (
    <section className="card compare-tray">
      <div className="compare-tray-header">
        <div>
          <span className="eyebrow">Compare tray</span>
          <h2>Saved cars</h2>
          <p>
            Save up to three analysed cars, then compare scores and ownership
            costs side by side.
          </p>
        </div>
        <button className="secondary-button" type="button" onClick={onLoadDemoSet}>
          Load demo compare set
        </button>
      </div>

      {compareMessage ? <div className="message warning-message">{compareMessage}</div> : null}

      {cars.length > 0 ? (
        <div className="saved-car-grid">
          {cars.map((car) => (
            <SavedCarCard
              key={car.id}
              car={car}
              onRemove={onRemove}
              winningScoreIdsByCategory={winningScoreIdsByCategory}
              winningCostIdsByKey={winningCostIdsByKey}
            />
          ))}
        </div>
      ) : (
        <div className="compare-empty">
          <strong>No cars saved yet</strong>
          <span>Analyse a car and use “Save to Compare” to start building a shortlist.</span>
        </div>
      )}
    </section>
  );
}
