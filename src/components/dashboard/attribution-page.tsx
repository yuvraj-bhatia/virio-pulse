"use client";

import Link from "next/link";
import { Loader2, RotateCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { EmptyState } from "@/components/dashboard/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toCurrency } from "@/lib/utils";
import type { PostAttributionRow } from "@/types";

type AttributionPageProps = {
  clientId: string;
  range: "7" | "30" | "90";
  initialRows: PostAttributionRow[];
  autoRecompute?: boolean;
};

function confidenceVariant(confidence: "HIGH" | "MEDIUM" | "LOW" | "UNATTRIBUTED"): "default" | "secondary" | "outline" {
  if (confidence === "HIGH") return "default";
  if (confidence === "MEDIUM") return "secondary";
  return "outline";
}

export function AttributionPage({
  clientId,
  range,
  initialRows,
  autoRecompute = false
}: AttributionPageProps): JSX.Element {
  const router = useRouter();
  const [rows, setRows] = useState<PostAttributionRow[]>(initialRows);
  const [loading, setLoading] = useState(false);
  const [lastComputedAt, setLastComputedAt] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const refreshRows = useCallback(async (): Promise<void> => {
    const response = await fetch(`/api/attribution?clientId=${clientId}&range=${range}`, { cache: "no-store" });
    if (!response.ok) throw new Error("Failed to refresh attribution rows");
    const payload = (await response.json()) as { data: PostAttributionRow[] };
    setRows(payload.data);
  }, [clientId, range]);

  const recompute = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      const response = await fetch("/api/attribution/recompute", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          clientId,
          rangeDays: Number(range)
        })
      });

      const payload = (await response.json()) as {
        data?: { ranges?: Array<{ computedAt: string }> };
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to recompute attribution");
      }

      setLastComputedAt(payload.data?.ranges?.[0]?.computedAt ?? null);
      await refreshRows();
      router.refresh();
      setToast("Attribution recomputed");
    } catch (error) {
      console.error(error);
      setToast(error instanceof Error ? error.message : "Failed to recompute attribution");
    } finally {
      setLoading(false);
    }
  }, [clientId, range, refreshRows, router]);

  useEffect(() => {
    if (!autoRecompute) return;
    void recompute();
  }, [autoRecompute, recompute]);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const sortedRows = useMemo(() => [...rows].sort((a, b) => b.revenue - a.revenue), [rows]);

  return (
    <>
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-sm text-muted-foreground">Per-post attribution</CardTitle>
          <div className="flex items-center gap-2">
            {lastComputedAt ? (
              <span className="text-xs text-muted-foreground">
                Last computed: {new Date(lastComputedAt).toLocaleString("en-US")}
              </span>
            ) : null}
            <Button size="sm" variant="outline" onClick={() => void recompute()} disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RotateCw className="mr-2 h-4 w-4" />}
              Recompute attribution
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href={`/api/attribution/export.csv?clientId=${clientId}&range=${range}`}>Export CSV</Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {sortedRows.length === 0 ? (
            <EmptyState
              title="No attribution rows"
              description="Import posts and link inbound signals to see attribution confidence and ROI."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Post</TableHead>
                  <TableHead>Theme</TableHead>
                  <TableHead>Impressions</TableHead>
                  <TableHead>Meetings</TableHead>
                  <TableHead>Pipeline</TableHead>
                  <TableHead>Revenue</TableHead>
                  <TableHead>ROI Score</TableHead>
                  <TableHead>Confidence</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedRows.map((row) => (
                  <TableRow key={row.postId}>
                    <TableCell className="max-w-[260px]">
                      <p className="line-clamp-2 text-sm">{row.postHook ?? "(missing hook)"}</p>
                    </TableCell>
                    <TableCell className="capitalize">{row.theme}</TableCell>
                    <TableCell>{row.impressions.toLocaleString("en-US")}</TableCell>
                    <TableCell>{row.meetings}</TableCell>
                    <TableCell className="font-mono">{toCurrency(row.pipeline)}</TableCell>
                    <TableCell className="font-mono">{toCurrency(row.revenue)}</TableCell>
                    <TableCell>{row.roiScore.toFixed(4)}</TableCell>
                    <TableCell>
                      <Badge variant={confidenceVariant(row.confidence)}>
                        {row.confidence === "LOW" || row.confidence === "UNATTRIBUTED"
                          ? "Low / Unattributed"
                          : row.confidence}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {toast ? (
        <div className="fixed bottom-5 right-5 z-50 rounded-lg border border-[#7f771f99] bg-[#7f771f33] px-4 py-3 text-sm text-[#e3db9d] shadow-xl backdrop-blur">
          {toast}
        </div>
      ) : null}
    </>
  );
}
