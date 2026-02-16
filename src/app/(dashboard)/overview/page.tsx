import { ArrowRight } from "lucide-react";

import { PageHeader } from "@/components/dashboard/page-header";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { TimeSeriesChart } from "@/components/dashboard/time-series-chart";
import { EmptyState } from "@/components/dashboard/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { computeWeeklyBuckets, getOverviewData } from "@/lib/analytics";
import { getDashboardContext } from "@/lib/page-context";
import { toCurrency, toPercent } from "@/lib/utils";

export default async function OverviewPage({
  searchParams
}: {
  searchParams: Record<string, string | string[] | undefined>;
}): Promise<JSX.Element> {
  const context = await getDashboardContext(searchParams);
  const data = await getOverviewData({
    clientId: context.clientId,
    startDate: context.startDate,
    endDate: context.endDate
  });

  const bucketMap = new Map(data.weeklySeries.map((point) => [point.weekStart, point]));
  const chartData = computeWeeklyBuckets(context.startDate, context.endDate).map((bucket) => {
    const existing = bucketMap.get(bucket);
    return {
      weekStart: bucket,
      meetingsInfluenced: existing?.meetingsInfluenced ?? 0,
      revenueWon: existing?.revenueWon ?? 0
    };
  });

  return (
    <div className="space-y-5">
      <PageHeader
        title="Overview"
        description="Track how executive-led content influences pipeline and closed-won outcomes."
      />

      <section className="stagger-in grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        <KpiCard label="Meetings Influenced" value={data.kpis.meetingsInfluenced.toLocaleString("en-US")} trend="up" hint="active" />
        <KpiCard label="Pipeline Created" value={toCurrency(data.kpis.pipelineCreated)} trend="up" hint="growing" />
        <KpiCard label="Revenue Won" value={toCurrency(data.kpis.revenueWon)} trend="up" hint="won" />
        <KpiCard label="Content-to-Meeting" value={toPercent(data.kpis.contentToMeetingRate)} trend="neutral" hint="conversion" />
        <KpiCard label="Meeting-to-Win" value={toPercent(data.kpis.meetingToWinRate)} trend="neutral" hint="win rate" />
      </section>

      <section className="stagger-in grid grid-cols-1 gap-4 xl:grid-cols-2">
        <TimeSeriesChart
          title="Revenue Won Over Time"
          data={chartData}
          dataKey="revenueWon"
          color="#dcb268"
          yAxisFormat="currencyK"
        />
        <TimeSeriesChart
          title="Meetings Influenced Over Time"
          data={chartData}
          dataKey="meetingsInfluenced"
          color="#3a6e74"
        />
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm text-muted-foreground">Top Posts by Revenue Influence</CardTitle>
        </CardHeader>
        <CardContent>
          {data.topPostsByRevenue.length === 0 ? (
            <EmptyState
              title="No attributed posts yet"
              description="Seed data or widen the date range to see influenced revenue by post."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Theme</TableHead>
                  <TableHead>Format</TableHead>
                  <TableHead>Posted</TableHead>
                  <TableHead>Meetings</TableHead>
                  <TableHead>Revenue</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.topPostsByRevenue.map((post) => (
                  <TableRow key={post.postId}>
                    <TableCell>
                      <Badge variant="secondary">{post.theme}</Badge>
                    </TableCell>
                    <TableCell className="capitalize text-muted-foreground">{post.format}</TableCell>
                    <TableCell className="text-muted-foreground">{post.postedAt.toLocaleDateString("en-US")}</TableCell>
                    <TableCell>{post.meetings}</TableCell>
                    <TableCell className="font-mono">{toCurrency(post.revenue)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card className="section-glow">
        <CardHeader>
          <CardTitle className="text-sm text-muted-foreground">What changed this week</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-start gap-3 text-sm">
            <ArrowRight className="mt-0.5 h-4 w-4 text-[#dcb268]" />
            <p className="text-foreground">{data.whatChanged}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
