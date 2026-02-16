"use client";

import { format } from "date-fns";
import { Download, Loader2, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { WeeklyReportPayload } from "@/types";

type Props = {
  clientId: string | null;
  range: "7" | "30" | "90";
};

function downloadMarkdown(filename: string, markdown: string): void {
  const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function ReportDialog({ clientId, range }: Props): JSX.Element {
  const [open, setOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"internal" | "client_safe">("internal");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [reports, setReports] = useState<WeeklyReportPayload[]>([]);

  const loadHistory = useCallback(async (): Promise<void> => {
    if (!clientId) return;
    setIsRefreshing(true);
    try {
      const response = await fetch(`/api/reports?clientId=${clientId}`, { cache: "no-store" });
      if (!response.ok) throw new Error("Failed to load report history");
      const payload = (await response.json()) as { data: WeeklyReportPayload[] };
      setReports(payload.data);
    } catch (error) {
      console.error(error);
    } finally {
      setIsRefreshing(false);
    }
  }, [clientId]);

  useEffect(() => {
    if (!open) return;
    void loadHistory();
  }, [open, loadHistory]);

  const onGenerate = async (): Promise<void> => {
    if (!clientId || isGenerating) return;

    setIsGenerating(true);
    try {
      const response = await fetch("/api/reports/weekly", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          clientId,
          range,
          viewMode
        })
      });

      if (!response.ok) {
        throw new Error("Failed to generate report");
      }

      const payload = (await response.json()) as { data: WeeklyReportPayload };
      downloadMarkdown(payload.data.filename, payload.data.markdown);
      await loadHistory();
    } catch (error) {
      console.error(error);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="min-w-[190px]">Generate Weekly Report</Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Weekly Report Generator</DialogTitle>
          <DialogDescription>
            Generate and download markdown reports, then review history for this client.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Tabs value={viewMode} onValueChange={(value) => setViewMode(value as "internal" | "client_safe")}> 
            <TabsList>
              <TabsTrigger value="internal">Internal view</TabsTrigger>
              <TabsTrigger value="client_safe">Client-safe view</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="glass-card rounded-2xl p-4">
            <div className="mb-3 flex items-center justify-between">
              <h4 className="text-sm font-semibold text-[#f2dbb0]">Report history</h4>
              <Button variant="ghost" size="sm" onClick={() => void loadHistory()} disabled={isRefreshing || !clientId}>
                {isRefreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              </Button>
            </div>

            {reports.length === 0 ? (
              <p className="text-sm text-muted-foreground">No reports generated yet for this client.</p>
            ) : (
              <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
                {reports.map((report) => (
                  <div
                    key={report.id}
                    className="rounded-xl border border-[#dcb2683e] bg-[linear-gradient(180deg,rgba(15,17,22,0.84),rgba(12,16,20,0.92))] p-3 transition-all duration-300 ease-virio hover:border-[#dcb26877]"
                  >
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Badge variant={report.viewMode === "internal" ? "default" : "secondary"}>
                          {report.viewMode === "internal" ? "Internal" : "Client-safe"}
                        </Badge>
                        <span className="font-mono text-xs text-muted-foreground">{report.rangePreset}d</span>
                      </div>
                      <span className="text-xs text-muted-foreground">{format(new Date(report.createdAt), "PP p")}</span>
                    </div>
                    <p className="line-clamp-2 text-xs text-muted-foreground">{report.markdown.slice(0, 180)}</p>
                    <div className="mt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => downloadMarkdown(report.filename, report.markdown)}
                      >
                        <Download className="mr-2 h-3.5 w-3.5" />
                        Download
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={() => setOpen(false)}>
            Close
          </Button>
          <Button onClick={() => void onGenerate()} disabled={!clientId || isGenerating}>
            {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Generate + Download
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
