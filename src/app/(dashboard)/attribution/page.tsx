import { AttributionPage } from "@/components/dashboard/attribution-page";
import { PageHeader } from "@/components/dashboard/page-header";
import { getAttributionRows } from "@/lib/analytics";
import { getDashboardContext } from "@/lib/page-context";

export default async function AttributionRoute({
  searchParams
}: {
  searchParams: Record<string, string | string[] | undefined>;
}): Promise<JSX.Element> {
  const context = await getDashboardContext(searchParams);
  const recomputeRaw = searchParams.recompute;
  const recompute = Array.isArray(recomputeRaw) ? recomputeRaw[0] : recomputeRaw;
  const autoRecompute = recompute === "1";
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
      <AttributionPage clientId={context.clientId} range={context.range} initialRows={rows} autoRecompute={autoRecompute} />
    </div>
  );
}
