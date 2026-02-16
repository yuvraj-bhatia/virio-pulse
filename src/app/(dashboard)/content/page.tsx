import { prisma } from "@/lib/db";
import { getDashboardContext } from "@/lib/page-context";
import { PageHeader } from "@/components/dashboard/page-header";
import { ContentPage } from "@/components/dashboard/content-page";

export default async function ContentRoute({
  searchParams
}: {
  searchParams: Record<string, string | string[] | undefined>;
}): Promise<JSX.Element> {
  const context = await getDashboardContext(searchParams);

  const executives = await prisma.executive.findMany({
    where: { clientId: context.clientId },
    orderBy: { name: "asc" },
    select: { id: true, name: true }
  });

  return (
    <div className="space-y-4">
      <PageHeader
        title="Content"
        description="Filter executive posts, inspect attribution trails, and publish new drafts quickly."
      />
      <ContentPage clientId={context.clientId} range={context.range} executives={executives} />
    </div>
  );
}
