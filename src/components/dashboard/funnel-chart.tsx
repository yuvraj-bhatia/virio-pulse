"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { FunnelMetrics } from "@/types";

type FunnelChartProps = {
  data: FunnelMetrics;
};

const labels = [
  { key: "inboundSignals", label: "Inbound signals", gradient: "linear-gradient(90deg,#3a6e74,#4d8f97)" },
  { key: "meetingsHeld", label: "Meetings held", gradient: "linear-gradient(90deg,#7f771f,#b3a945)" },
  { key: "opportunitiesCreated", label: "Opportunities", gradient: "linear-gradient(90deg,#dcb268,#f1cd88)" },
  { key: "closedWon", label: "Closed won", gradient: "linear-gradient(90deg,#df551f,#f2875e)" }
] as const;

export function FunnelChart({ data }: FunnelChartProps): JSX.Element {
  const max = Math.max(data.inboundSignals, 1);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm text-[#d2bb8d]">Pipeline Funnel</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {labels.map((item) => {
          const value = data[item.key];
          const width = Math.max(8, Math.round((value / max) * 100));
          return (
            <div key={item.key} className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{item.label}</span>
                <span className="font-mono text-foreground">{value.toLocaleString("en-US")}</span>
              </div>
              <div className="h-9 rounded-lg border border-[#dcb2683a] bg-[linear-gradient(180deg,rgba(13,17,23,0.85),rgba(10,14,20,0.92))] p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                <div
                  className={cn("h-full rounded-md transition-all duration-700 ease-float")}
                  style={{
                    width: `${width}%`,
                    background: item.gradient,
                    boxShadow: "0 0 14px rgba(220,178,104,0.2)"
                  }}
                />
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
