import { EmptyState } from "@/components/dashboard/empty-state";
import { FunnelChart } from "@/components/dashboard/funnel-chart";
import { PageHeader } from "@/components/dashboard/page-header";
import { StageChart } from "@/components/dashboard/stage-chart";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getPipelineData } from "@/lib/analytics";
import { getDashboardContext } from "@/lib/page-context";
import { toCurrency } from "@/lib/utils";

export default async function PipelinePage({
  searchParams
}: {
  searchParams: Record<string, string | string[] | undefined>;
}): Promise<JSX.Element> {
  const context = await getDashboardContext(searchParams);
  const data = await getPipelineData({
    clientId: context.clientId,
    startDate: context.startDate,
    endDate: context.endDate
  });

  return (
    <div className="space-y-4">
      <PageHeader
        title="Pipeline"
        description="Inspect content-influenced funnel progression from inbound to closed-won revenue."
      />

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <FunnelChart data={data.funnel} />
        <StageChart data={data.stageDistribution} />
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm text-muted-foreground">Opportunities with source post context</CardTitle>
        </CardHeader>
        <CardContent>
          {data.opportunities.length === 0 ? (
            <EmptyState title="No opportunities" description="No opportunities were created in this date range." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Stage</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Source Post</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.opportunities.map((opportunity) => (
                  <TableRow key={opportunity.id}>
                    <TableCell>
                      <Badge
                        variant={
                          opportunity.stage === "closed_won"
                            ? "success"
                            : opportunity.stage === "closed_lost"
                              ? "destructive"
                              : "secondary"
                        }
                      >
                        {opportunity.stage.replaceAll("_", " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono">{toCurrency(opportunity.amount)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(opportunity.createdAt).toLocaleDateString("en-US")}
                    </TableCell>
                    <TableCell className="max-w-[280px]">
                      {opportunity.sourceHook ? (
                        <p className="line-clamp-2 text-sm">{opportunity.sourceHook}</p>
                      ) : (
                        <span className="text-xs text-muted-foreground">Unattributed</span>
                      )}
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
