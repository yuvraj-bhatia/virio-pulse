"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, BarChart3, GaugeCircle, Lightbulb, PanelLeft, Settings, Workflow } from "lucide-react";

import { cn } from "@/lib/utils";

const navItems = [
  { href: "/overview", label: "Overview", icon: GaugeCircle },
  { href: "/content", label: "Content", icon: PanelLeft },
  { href: "/attribution", label: "Attribution", icon: BarChart3 },
  { href: "/pipeline", label: "Pipeline", icon: Workflow },
  { href: "/insights", label: "Insights", icon: Lightbulb },
  { href: "/settings", label: "Settings", icon: Settings }
] as const;

export function Sidebar(): JSX.Element {
  const pathname = usePathname();

  return (
    <aside className="relative h-full w-full overflow-hidden border-r border-[#dcb2682f] bg-[linear-gradient(180deg,rgba(16,17,20,0.86),rgba(13,16,22,0.88))] px-3 py-4 backdrop-blur-2xl md:rounded-r-2xl md:px-4 md:py-5">
      <div className="pointer-events-none absolute inset-y-0 right-0 w-px bg-[linear-gradient(180deg,transparent,rgba(220,178,104,0.35),transparent)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[220px] bg-[radial-gradient(circle_at_25%_0%,rgba(220,178,104,0.2),transparent_56%)]" />

      <div className="relative mb-8 flex items-center gap-3 px-2">
        <div className="relative flex h-9 w-9 items-center justify-center rounded-full border border-[#dcb26877] bg-[#dcb26822] shadow-[inset_0_1px_0_rgba(255,255,255,0.25)]">
          <Activity className="h-4 w-4 text-[#e5c282]" />
          <span className="logo-dot absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border border-[#10141b] bg-[#dcb268]" />
        </div>
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#dcb268bf]">Pulse</p>
          <p className="text-sm text-muted-foreground">Attribution Console</p>
        </div>
      </div>

      <nav className="relative space-y-1.5">
        {navItems.map((item) => {
          const active = pathname?.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all duration-300 ease-virio",
                active
                  ? "border border-[#dcb26866] bg-[linear-gradient(90deg,rgba(220,178,104,0.2),rgba(220,178,104,0.07)_60%,transparent)] text-[#f0d1a1] shadow-[0_0_0_1px_rgba(220,178,104,0.15)]"
                  : "border border-transparent text-muted-foreground hover:border-[#dcb2683f] hover:bg-[#dcb26812] hover:text-foreground"
              )}
            >
              <Icon
                className={cn(
                  "h-4 w-4 transition-colors duration-300 ease-virio",
                  active ? "text-[#e5c282]" : "text-muted-foreground group-hover:text-foreground"
                )}
              />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
