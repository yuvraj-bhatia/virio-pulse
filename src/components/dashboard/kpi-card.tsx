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
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(220,178,104,0.7),transparent)]" />
      <CardHeader className="pb-2">
        <CardTitle className="text-[11px] uppercase tracking-[0.18em] text-[#c9b07e]">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-end justify-between gap-3">
          <p className="text-3xl font-semibold tracking-[-0.02em] text-[#f8e9cc]">{value}</p>
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] uppercase tracking-[0.12em]",
              trend === "up" && "border-[#7f771f80] bg-[#7f771f2f] text-[#dad39b]",
              trend === "down" && "border-[#df551f80] bg-[#df551f2f] text-[#ffc0a8]",
              trend === "neutral" && "border-[#dcb26844] text-muted-foreground"
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
