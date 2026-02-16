"use client";

import { AlertTriangle, Loader2, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { InsightOutput } from "@/types";

type InsightsPanelProps = {
  clientId: string;
  range: "7" | "30" | "90";
};

export function InsightsPanel({ clientId, range }: InsightsPanelProps): JSX.Element {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<InsightOutput | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadInsights = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/insights/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ clientId, range })
      });

      if (!response.ok) {
        throw new Error("Unable to generate insights");
      }

      const payload = (await response.json()) as { data: InsightOutput };
      setData(payload.data);
    } catch (err) {
      console.error(err);
      setError("Failed to generate insights.");
    } finally {
      setLoading(false);
    }
  }, [clientId, range]);

  useEffect(() => {
    void loadInsights();
  }, [loadInsights]);

  return (
    <Card className="section-glow">
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle className="text-sm text-muted-foreground">Recommendations</CardTitle>
        <div className="flex items-center gap-2">
          {data?.usingHeuristics ? <Badge variant="outline">Using heuristics</Badge> : null}
          <Button variant="outline" size="sm" onClick={() => void loadInsights()} disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Regenerate
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Generating insights...
          </div>
        ) : error ? (
          <div className="flex items-center gap-2 text-sm text-[#ffc0a8]">
            <AlertTriangle className="h-4 w-4" />
            {error}
          </div>
        ) : (
          <ul className="space-y-2 text-sm">
            {data?.items.map((item) => (
              <li key={item} className="rounded-lg border border-border/60 bg-[#101319cc] p-3 leading-relaxed">
                {item}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
