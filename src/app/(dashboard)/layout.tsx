import { AuthGate } from "@/components/providers/auth-gate";
import { Sidebar } from "@/components/dashboard/sidebar";
import { Topbar } from "@/components/dashboard/topbar";
import { getClients } from "@/lib/analytics";

export default async function DashboardLayout({ children }: { children: React.ReactNode }): Promise<JSX.Element> {
  const clients = await getClients();

  return (
    <AuthGate>
      <div className="grid min-h-screen grid-cols-1 md:grid-cols-[260px_1fr]">
        <div className="hidden md:block">
          <Sidebar />
        </div>
        <div className="min-w-0">
          <Topbar clients={clients.map((client) => ({ id: client.id, name: client.name }))} />
          <main className="page-enter px-4 py-4 md:px-6 md:py-6">{children}</main>
        </div>
      </div>
    </AuthGate>
  );
}
