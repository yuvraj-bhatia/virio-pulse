import { AuthGate } from "@/components/providers/auth-gate";
import { Sidebar } from "@/components/dashboard/sidebar";
import { Topbar } from "@/components/dashboard/topbar";
import { getClients } from "@/lib/analytics";

export default async function DashboardLayout({ children }: { children: React.ReactNode }): Promise<JSX.Element> {
  const clients = await getClients();

  return (
    <AuthGate>
      <div className="relative grid min-h-screen grid-cols-1 md:grid-cols-[260px_1fr]">
        <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
          <div className="absolute left-[-14%] top-[-28%] h-[640px] w-[640px] rounded-full bg-[radial-gradient(circle,rgba(220,178,104,0.24),rgba(220,178,104,0)_70%)] blur-3xl" />
          <div className="absolute right-[-12%] top-[8%] h-[620px] w-[620px] rounded-full bg-[radial-gradient(circle,rgba(58,110,116,0.26),rgba(58,110,116,0)_72%)] blur-3xl" />
          <div className="absolute bottom-[-30%] left-[34%] h-[560px] w-[560px] rounded-full bg-[radial-gradient(circle,rgba(127,119,31,0.2),rgba(127,119,31,0)_70%)] blur-3xl" />
        </div>

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
