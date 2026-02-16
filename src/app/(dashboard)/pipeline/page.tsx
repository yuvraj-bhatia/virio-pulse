import { PageHeader } from "@/components/dashboard/page-header";
import { PipelinePage } from "@/components/dashboard/pipeline-page";
import { getDashboardContext } from "@/lib/page-context";

export default async function PipelineRoute({
  searchParams
}: {
  searchParams: Record<string, string | string[] | undefined>;
}): Promise<JSX.Element> {
  const context = await getDashboardContext(searchParams);
  const openParamRaw = searchParams.open;
  const openParam = Array.isArray(openParamRaw) ? openParamRaw[0] : openParamRaw;
  const initialOpenAction = openParam === "create-opportunity" ? "create-opportunity" : null;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Pipeline"
        description="Inspect content-influenced funnel progression from inbound to closed-won revenue."
      />
      <PipelinePage clientId={context.clientId} range={context.range} initialOpenAction={initialOpenAction} />
    </div>
  );
}
