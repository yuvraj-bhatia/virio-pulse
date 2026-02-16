"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipProps
} from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function TooltipBox({ active, payload, label }: TooltipProps<number, string>): JSX.Element | null {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="rounded-xl border border-[#dcb26866] bg-[linear-gradient(180deg,rgba(14,18,24,0.98),rgba(12,16,22,0.98))] p-3 text-xs shadow-[0_12px_28px_rgba(0,0,0,0.45)] backdrop-blur-xl">
      <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Week {label}</p>
      {payload.map((entry) => (
        <p key={entry.name} className="mt-1 text-foreground">
          <span className="text-muted-foreground">{entry.name}: </span>
          {entry.value?.toLocaleString("en-US")}
        </p>
      ))}
    </div>
  );
}

type SeriesProps = {
  title: string;
  data: Array<Record<string, number | string>>;
  dataKey: string;
  color: string;
  yAxisFormat?: "number" | "currencyK";
};

export function TimeSeriesChart({ title, data, dataKey, color, yAxisFormat = "number" }: SeriesProps): JSX.Element {
  const yTickFormatter = (value: number): string => {
    if (yAxisFormat === "currencyK") {
      return `$${Math.round(value / 1000)}k`;
    }
    return value.toLocaleString("en-US");
  };

  return (
    <Card className="section-glow">
      <CardHeader>
        <CardTitle className="text-sm text-[#d2bb8d]">{title}</CardTitle>
      </CardHeader>
      <CardContent className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ left: 4, right: 4, top: 8, bottom: 0 }}>
            <defs>
              <linearGradient id={`${dataKey}-gradient`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.7} />
                <stop offset="100%" stopColor={color} stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 4" stroke="rgba(220,178,104,0.12)" />
            <XAxis
              dataKey="weekStart"
              tick={{ fill: "#a5a9b4", fontSize: 11 }}
              tickFormatter={(value) => value.slice(5)}
              stroke="rgba(220,178,104,0.26)"
            />
            <YAxis
              tick={{ fill: "#a5a9b4", fontSize: 11 }}
              tickFormatter={yTickFormatter}
              stroke="rgba(220,178,104,0.26)"
              width={64}
            />
            <Tooltip content={<TooltipBox />} />
            <Area
              type="monotone"
              dataKey={dataKey}
              stroke={color}
              fill={`url(#${dataKey}-gradient)`}
              strokeWidth={2.1}
              dot={false}
              activeDot={{ r: 4, fill: color, strokeWidth: 0 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
