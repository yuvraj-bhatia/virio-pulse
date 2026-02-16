"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { FunnelMetrics } from "@/types";

type FunnelChartProps = {
  data: FunnelMetrics;
};

const labels = [
  { key: "inboundSignals", label: "Inbound signals", color: "bg-[#3a6e7480]" },
  { key: "meetingsHeld", label: "Meetings held", color: "bg-[#7f771f8a]" },
  { key: "opportunitiesCreated", label: "Opportunities", color: "bg-[#dcb26899]" },
  { key: "closedWon", label: "Closed won", color: "bg-[#df551f8c]" }
] as const;

export function FunnelChart({ data }: FunnelChartProps): JSX.Element {
  const max = Math.max(data.inboundSignals, 1);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm text-muted-foreground">Pipeline Funnel</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {labels.map((item) => {
          const value = data[item.key];
          const width = Math.max(8, Math.round((value / max) * 100));
          return (
            <div key={item.key} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{item.label}</span>
                <span className="font-mono text-foreground">{value.toLocaleString("en-US")}</span>
              </div>
              <div className="h-9 rounded-md border border-border/60 bg-[#0f1318] p-1">
                <div
                  className={cn(
                    "h-full rounded-sm transition-all duration-700 ease-float",
                    item.color
                  )}
                  style={{ width: `${width}%` }}
                />
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
