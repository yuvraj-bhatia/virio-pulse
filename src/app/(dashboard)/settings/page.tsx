import { PageHeader } from "@/components/dashboard/page-header";
import { SettingsPanel } from "@/components/dashboard/settings-panel";
import { prisma } from "@/lib/db";
import { getDashboardContext } from "@/lib/page-context";

export default async function SettingsPage({
  searchParams
}: {
  searchParams: Record<string, string | string[] | undefined>;
}): Promise<JSX.Element> {
  const context = await getDashboardContext(searchParams);

  const [clients, setting] = await Promise.all([
    prisma.client.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, domain: true, vertical: true, dataMode: true }
    }),
    prisma.appSetting.findUnique({ where: { clientId: context.clientId } })
  ]);

  const activeClient = clients.find((client) => client.id === context.clientId);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Settings"
        description="Manage attribution window and soft-attribution behavior for your active client workspace."
      />
      <SettingsPanel
        clientId={context.clientId}
        range={context.range}
        clients={clients}
        initialDataMode={activeClient?.dataMode ?? "sample"}
        initialWindow={setting?.attributionWindowDays === 14 ? 14 : 7}
        initialSoftAttribution={setting?.useSoftAttribution ?? true}
      />
    </div>
  );
}
