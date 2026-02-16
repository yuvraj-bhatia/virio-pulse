import { TrendingDown, TrendingUp } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type KpiCardProps = {
  label: string;
  value: string;
  hint?: string;
  trend?: "up" | "down" | "neutral";
};

export function KpiCard({ label, value, hint, trend = "neutral" }: KpiCardProps): JSX.Element {
  return (
    <Card className="gold-accent relative overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-end justify-between gap-3">
          <p className="text-2xl font-semibold tracking-tight">{value}</p>
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px]",
              trend === "up" && "border-[#7f771f80] bg-[#7f771f2f] text-[#dad39b]",
              trend === "down" && "border-[#df551f80] bg-[#df551f2f] text-[#ffc0a8]",
              trend === "neutral" && "border-border text-muted-foreground"
            )}
          >
            {trend === "up" ? <TrendingUp className="h-3 w-3" /> : null}
            {trend === "down" ? <TrendingDown className="h-3 w-3" /> : null}
            {hint ?? "stable"}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
