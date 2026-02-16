import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { PageHeader } from "@/components/dashboard/page-header";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { TimeSeriesChart } from "@/components/dashboard/time-series-chart";
import { EmptyState } from "@/components/dashboard/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { computeWeeklyBuckets, getOverviewData } from "@/lib/analytics";
import { prisma } from "@/lib/db";
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
  const [postCount, inboundCount, opportunityCount] = await Promise.all([
    prisma.contentPost.count({ where: { clientId: context.clientId } }),
    prisma.inboundSignal.count({ where: { clientId: context.clientId } }),
    prisma.opportunity.count({ where: { clientId: context.clientId } })
  ]);
  const isFirstRun = postCount === 0 && inboundCount === 0 && opportunityCount === 0;

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

      {isFirstRun ? (
        <Card className="section-glow border-[#dcb26866]">
          <CardHeader>
            <CardTitle>Start in under 3 minutes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              <Button asChild variant="outline">
                <Link href={`/content?clientId=${context.clientId}&range=${context.range}&open=import-urls`}>
                  Step 1: Import posts
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href={`/content?clientId=${context.clientId}&range=${context.range}&open=inbound`}>
                  Step 2: Add inbound signals
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href={`/pipeline?clientId=${context.clientId}&range=${context.range}&open=create-opportunity`}>
                  Step 3: Create opportunities
                </Link>
              </Button>
              <Button asChild>
                <Link href={`/attribution?clientId=${context.clientId}&range=${context.range}&recompute=1`}>
                  Step 4: See attribution + insights
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <section className="stagger-in grid grid-cols-1 gap-4 xl:grid-cols-2">
        <TimeSeriesChart
          title="Revenue Won Over Time"
          data={chartData}
          dataKey="revenueWon"
          color="#dcb268"
          yAxisFormat="currencyK"
          emptyMessage="No data yet"
        />
        <TimeSeriesChart
          title="Meetings Influenced Over Time"
          data={chartData}
          dataKey="meetingsInfluenced"
          color="#3a6e74"
          emptyMessage="No data yet"
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
              description="Import posts and capture inbound signals to begin attribution tracking."
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
                    <TableCell className="text-muted-foreground">
                      {post.postedAt ? post.postedAt.toLocaleDateString("en-US") : "No date"}
                    </TableCell>
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
