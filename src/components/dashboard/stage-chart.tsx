"use client";

import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { StageDistributionItem } from "@/types";

const colors = ["#dcb268", "#4d9aa2", "#7f771f", "#df551f", "#887e71"];

type StageChartProps = {
  data: StageDistributionItem[];
};

export function StageChart({ data }: StageChartProps): JSX.Element {
  return (
    <Card className="section-glow">
      <CardHeader>
        <CardTitle className="text-sm text-[#d2bb8d]">Stage Distribution</CardTitle>
      </CardHeader>
      <CardContent className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="amount"
              nameKey="stage"
              innerRadius={58}
              outerRadius={95}
              paddingAngle={2}
              stroke="rgba(255,255,255,0.68)"
              strokeWidth={1}
            >
              {data.map((entry, index) => (
                <Cell key={entry.stage} fill={colors[index % colors.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                background: "linear-gradient(180deg, rgba(14,18,24,0.98), rgba(12,16,22,0.98))",
                border: "1px solid rgba(220,178,104,0.46)",
                borderRadius: 12,
                fontSize: 12,
                boxShadow: "0 12px 30px rgba(0,0,0,0.45)"
              }}
              formatter={(value: number) => `$${value.toLocaleString("en-US")}`}
            />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
