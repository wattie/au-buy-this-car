import { costBreakdownLabels } from "../compare";
import type { SavedCarAnalysis, ThreeYearCostBreakdown } from "../types";

interface CostBreakdownTableProps {
  cars: SavedCarAnalysis[];
  winningCostIdsByKey: Record<keyof ThreeYearCostBreakdown, Set<string>>;
}

const rowOrder: Array<keyof ThreeYearCostBreakdown> = [
  "purchasePrice",
  "insuranceEstimate",
  "servicingEstimate",
  "fuelOrChargingEstimate",
  "registrationAndOtherCosts",
  "totalThreeYearCost"
];

export function CostBreakdownTable({
  cars,
  winningCostIdsByKey
}: CostBreakdownTableProps) {
  return (
    <div className="cost-table-wrap">
      <table className="cost-table">
        <thead>
          <tr>
            <th>Cost dimension</th>
            {cars.map((car) => (
              <th key={car.id}>{car.title}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rowOrder.map((rowKey) => (
            <tr key={rowKey}>
              <th>{costBreakdownLabels[rowKey]}</th>
              {cars.map((car) => {
                const isWinner = winningCostIdsByKey[rowKey].has(car.id);
                return (
                  <td key={`${car.id}-${rowKey}`} className={isWinner ? "winner-cell" : ""}>
                    {formatCurrency(car.costBreakdown[rowKey])}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0
  }).format(value);
}
