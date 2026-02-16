import { EmptyState } from "@/components/dashboard/empty-state";
import { PageHeader } from "@/components/dashboard/page-header";
import { InsightsPanel } from "@/components/dashboard/insights-panel";
import { prisma } from "@/lib/db";
import { getDashboardContext } from "@/lib/page-context";

export default async function InsightsPage({
  searchParams
}: {
  searchParams: Record<string, string | string[] | undefined>;
}): Promise<JSX.Element> {
  const context = await getDashboardContext(searchParams);
  const postCount = await prisma.contentPost.count({
    where: {
      clientId: context.clientId,
      postedAt: {
        gte: context.startDate,
        lte: context.endDate
      }
    }
  });

  return (
    <div className="space-y-4">
      <PageHeader
        title="Insights"
        description="Action-oriented recommendations powered by AI when available, with deterministic heuristic fallback."
      />
      {postCount === 0 ? (
        <EmptyState
          title="No insights yet"
          description="Import posts first. Insights will appear once content and attribution signals are available."
        />
      ) : (
        <InsightsPanel clientId={context.clientId} range={context.range} />
      )}
    </div>
  );
}
