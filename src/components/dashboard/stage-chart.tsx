"use client";

import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { StageDistributionItem } from "@/types";

const colors = ["#dcb268", "#3a6e74", "#7f771f", "#df551f", "#877f72"];

type StageChartProps = {
  data: StageDistributionItem[];
};

export function StageChart({ data }: StageChartProps): JSX.Element {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm text-muted-foreground">Stage Distribution</CardTitle>
      </CardHeader>
      <CardContent className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="amount" nameKey="stage" innerRadius={58} outerRadius={95} paddingAngle={2}>
              {data.map((entry, index) => (
                <Cell key={entry.stage} fill={colors[index % colors.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                background: "rgba(16,18,24,0.95)",
                border: "1px solid rgba(220,178,104,0.4)",
                borderRadius: 10,
                fontSize: 12
              }}
              formatter={(value: number) => `$${value.toLocaleString("en-US")}`}
            />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
