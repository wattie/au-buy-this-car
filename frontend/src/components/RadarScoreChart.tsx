import {
  Legend,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip
} from "recharts";
import { getScoreCategoryOrder } from "../compare";
import type { SavedCarAnalysis } from "../types";

interface RadarScoreChartProps {
  cars: SavedCarAnalysis[];
}

const radarColors = ["#1c6f55", "#c78321", "#7f4fd1"];

export function RadarScoreChart({ cars }: RadarScoreChartProps) {
  const data = getScoreCategoryOrder().map((category) => {
    const row: Record<string, number | string> = { category };

    cars.forEach((car) => {
      const score =
        car.analysis.scoreBreakdown.find((item) => item.category === category)?.score ?? 0;
      row[car.id] = score;
    });

    return row;
  });

  return (
    <div className="radar-chart-shell">
      <ResponsiveContainer width="100%" height={360}>
        <RadarChart data={data} outerRadius="72%">
          <PolarGrid stroke="rgba(23, 36, 30, 0.14)" />
          <PolarAngleAxis dataKey="category" tick={{ fill: "#5d6d65", fontSize: 12 }} />
          <PolarRadiusAxis
            angle={90}
            domain={[0, 100]}
            tick={{ fill: "#5d6d65", fontSize: 11 }}
          />
          <Tooltip
            formatter={(value: number) => [`${value}/100`, "Score"]}
            contentStyle={{
              borderRadius: 16,
              border: "1px solid rgba(23, 36, 30, 0.08)",
              backgroundColor: "rgba(255, 253, 248, 0.96)"
            }}
          />
          <Legend />
          {cars.map((car, index) => (
            <Radar
              key={car.id}
              name={car.title}
              dataKey={car.id}
              stroke={radarColors[index % radarColors.length]}
              fill={radarColors[index % radarColors.length]}
              fillOpacity={0.18}
              strokeWidth={2.5}
            />
          ))}
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
