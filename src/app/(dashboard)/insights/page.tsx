import { PageHeader } from "@/components/dashboard/page-header";
import { InsightsPanel } from "@/components/dashboard/insights-panel";
import { getDashboardContext } from "@/lib/page-context";

export default async function InsightsPage({
  searchParams
}: {
  searchParams: Record<string, string | string[] | undefined>;
}): Promise<JSX.Element> {
  const context = await getDashboardContext(searchParams);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Insights"
        description="Action-oriented recommendations powered by AI when available, with deterministic heuristic fallback."
      />
      <InsightsPanel clientId={context.clientId} range={context.range} />
    </div>
  );
}
