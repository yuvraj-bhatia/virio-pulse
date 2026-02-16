"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo } from "react";
import { CalendarClock } from "lucide-react";

import { ReportDialog } from "@/components/dashboard/report-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type ClientOption = {
  id: string;
  name: string;
};

type TopbarProps = {
  clients: ClientOption[];
};

const dateRanges = [
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" }
] as const;

const mobileNav = [
  { href: "/overview", label: "Overview" },
  { href: "/content", label: "Content" },
  { href: "/attribution", label: "Attribution" },
  { href: "/pipeline", label: "Pipeline" },
  { href: "/insights", label: "Insights" },
  { href: "/settings", label: "Settings" }
] as const;

export function Topbar({ clients }: TopbarProps): JSX.Element {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const selectedClientId = searchParams.get("clientId");
  const selectedRange = (searchParams.get("range") as "7" | "30" | "90" | null) ?? "30";

  const fallbackClientId = clients[0]?.id ?? null;

  const effectiveClientId = selectedClientId ?? fallbackClientId;

  useEffect(() => {
    if (!selectedClientId && fallbackClientId) {
      const next = new URLSearchParams(searchParams);
      next.set("clientId", fallbackClientId);
      if (!next.get("range")) next.set("range", "30");
      router.replace(`${pathname}?${next.toString()}`);
    }
  }, [selectedClientId, fallbackClientId, pathname, router, searchParams]);

  const selectedClient = useMemo(
    () => clients.find((client) => client.id === effectiveClientId) ?? null,
    [clients, effectiveClientId]
  );

  const updateQuery = (key: "clientId" | "range", value: string): void => {
    const next = new URLSearchParams(searchParams);
    next.set(key, value);
    router.push(`${pathname}?${next.toString()}`);
  };

  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-[#0e1015d9] px-4 py-3 backdrop-blur-xl md:px-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Select value={effectiveClientId ?? undefined} onValueChange={(value) => updateQuery("clientId", value)}>
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="Choose client" />
            </SelectTrigger>
            <SelectContent>
              {clients.map((client) => (
                <SelectItem key={client.id} value={client.id}>
                  {client.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedRange} onValueChange={(value) => updateQuery("range", value)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Date range" />
            </SelectTrigger>
            <SelectContent>
              {dateRanges.map((range) => (
                <SelectItem key={range.value} value={range.value}>
                  {range.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="hidden items-center gap-2 rounded-lg border border-[#dcb26844] bg-[#dcb2681f] px-3 py-2 lg:flex">
            <CalendarClock className="h-4 w-4 text-[#e4c17f]" />
            <span className="text-xs text-muted-foreground">{selectedClient?.name ?? "No client selected"}</span>
          </div>
          <ReportDialog clientId={effectiveClientId} range={selectedRange} />
        </div>
      </div>
      <div className="mt-3 flex gap-2 overflow-x-auto pb-1 md:hidden">
        {mobileNav.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={
              pathname.startsWith(item.href)
                ? "rounded-full border border-[#dcb26888] bg-[#dcb26822] px-3 py-1 text-xs text-[#f4d6a3]"
                : "rounded-full border border-border/80 bg-[#12151b] px-3 py-1 text-xs text-muted-foreground"
            }
          >
            {item.label}
          </Link>
        ))}
      </div>
    </header>
  );
}
