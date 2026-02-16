import Link from "next/link";

import { EmptyState } from "@/components/dashboard/empty-state";
import { PageHeader } from "@/components/dashboard/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getAttributionRows } from "@/lib/analytics";
import { getDashboardContext } from "@/lib/page-context";
import { toCurrency } from "@/lib/utils";

function confidenceVariant(confidence: "HIGH" | "MEDIUM" | "LOW"): "default" | "secondary" | "outline" {
  if (confidence === "HIGH") return "default";
  if (confidence === "MEDIUM") return "secondary";
  return "outline";
}

export default async function AttributionPage({
  searchParams
}: {
  searchParams: Record<string, string | string[] | undefined>;
}): Promise<JSX.Element> {
  const context = await getDashboardContext(searchParams);

  const rows = await getAttributionRows({
    clientId: context.clientId,
    startDate: context.startDate,
    endDate: context.endDate
  });

  return (
    <div className="space-y-4">
      <PageHeader
        title="Attribution"
        description="Deterministic post-level attribution with confidence tiers and ROI impact."
      />

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-sm text-muted-foreground">Per-post attribution</CardTitle>
          <Button asChild size="sm" variant="outline">
            <Link href={`/api/attribution/export.csv?clientId=${context.clientId}&range=${context.range}`}>Export CSV</Link>
          </Button>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <EmptyState title="No attribution rows" description="No posts found for this date range." />
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
                {rows
                  .sort((a, b) => b.revenue - a.revenue)
                  .map((row) => (
                    <TableRow key={row.postId}>
                      <TableCell className="max-w-[260px]">
                        <p className="line-clamp-2 text-sm">{row.postHook}</p>
                      </TableCell>
                      <TableCell className="capitalize">{row.theme}</TableCell>
                      <TableCell>{row.impressions.toLocaleString("en-US")}</TableCell>
                      <TableCell>{row.meetings}</TableCell>
                      <TableCell className="font-mono">{toCurrency(row.pipeline)}</TableCell>
                      <TableCell className="font-mono">{toCurrency(row.revenue)}</TableCell>
                      <TableCell>{row.roiScore.toFixed(4)}</TableCell>
                      <TableCell>
                        <Badge variant={confidenceVariant(row.confidence)}>
                          {row.confidence === "LOW" ? "Low / Unattributed" : row.confidence}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
