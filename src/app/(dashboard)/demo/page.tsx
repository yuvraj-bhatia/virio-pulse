import Link from "next/link";
import { CheckCircle2, Circle } from "lucide-react";

import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/db";
import { getDashboardContext } from "@/lib/page-context";

type DemoStep = {
  id: string;
  title: string;
  description: string;
  href: string;
  done: boolean;
};

export default async function DemoPage({
  searchParams
}: {
  searchParams: Record<string, string | string[] | undefined>;
}): Promise<JSX.Element> {
  const context = await getDashboardContext(searchParams);
  const range = context.range;

  const [posts, postsReady, inbounds, opportunities, reports, attributionRows] = await Promise.all([
    prisma.contentPost.count({ where: { clientId: context.clientId } }),
    prisma.contentPost.count({
      where: {
        clientId: context.clientId,
        hook: { not: null },
        postedAt: { not: null }
      }
    }),
    prisma.inboundSignal.count({ where: { clientId: context.clientId } }),
    prisma.opportunity.count({ where: { clientId: context.clientId } }),
    prisma.report.count({ where: { clientId: context.clientId } }),
    prisma.attributionResult.count({
      where: {
        clientId: context.clientId,
        windowRangeDays: Number(range),
        OR: [{ meetingsInfluencedCount: { gt: 0 } }, { pipelineCreatedAmount: { gt: 0 } }, { revenueWonAmount: { gt: 0 } }]
      }
    })
  ]);

  const base = `clientId=${context.clientId}&range=${range}`;
  const steps: DemoStep[] = [
    {
      id: "content-import",
      title: "Go to Content and import URLs",
      description: "Paste 2-5 LinkedIn URLs and import.",
      href: `/content?${base}&open=import-urls`,
      done: posts > 0
    },
    {
      id: "post-details",
      title: "Complete post details",
      description: "Open a row and fill hook + postedAt to make it attribution-ready.",
      href: `/content?${base}`,
      done: postsReady > 0
    },
    {
      id: "inbound",
      title: "Create inbound signal",
      description: "Add at least one inbound signal linked to a post or entry URL.",
      href: `/content?${base}&open=inbound`,
      done: inbounds > 0
    },
    {
      id: "opportunity",
      title: "Create opportunity",
      description: "Create one opportunity and link it to inbound or post.",
      href: `/pipeline?${base}&open=create-opportunity`,
      done: opportunities > 0
    },
    {
      id: "recompute",
      title: "Run attribution recompute",
      description: "Use the Attribution page button and verify updated row metrics.",
      href: `/attribution?${base}&recompute=1`,
      done: attributionRows > 0
    },
    {
      id: "overview-insights",
      title: "Review Overview and Insights",
      description: "Confirm KPIs and recommendations changed from your inputs.",
      href: `/insights?${base}`,
      done: attributionRows > 0
    },
    {
      id: "weekly-report",
      title: "Generate weekly report",
      description: "Click Generate Weekly Report in top bar and confirm history entry.",
      href: `/overview?${base}`,
      done: reports > 0
    }
  ];

  const completed = steps.filter((step) => step.done).length;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Demo Script"
        description="Click through this sequence live to demonstrate end-to-end product ownership."
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Completion: {completed}/{steps.length}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {steps.map((step) => (
            <div key={step.id} className="flex items-center justify-between gap-3 rounded-lg border border-border/70 bg-[#0f1218cc] p-3">
              <div className="flex items-start gap-2">
                {step.done ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 text-[#dcb268]" />
                ) : (
                  <Circle className="mt-0.5 h-4 w-4 text-muted-foreground" />
                )}
                <div>
                  <p className="text-sm font-medium">{step.title}</p>
                  <p className="text-xs text-muted-foreground">{step.description}</p>
                </div>
              </div>
              <Button asChild size="sm" variant="outline">
                <Link href={step.href}>Open</Link>
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
