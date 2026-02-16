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
    <aside className="glass-card h-full w-full rounded-none border-r border-border/60 bg-[#101114cc] px-3 py-4 md:rounded-r-2xl md:px-4 md:py-5">
      <div className="mb-8 flex items-center gap-3 px-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-full border border-[#dcb26877] bg-[#dcb26822]">
          <Activity className="h-4 w-4 text-[#e5c282]" />
        </div>
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#dcb268bf]">Pulse</p>
          <p className="text-sm text-muted-foreground">Attribution Console</p>
        </div>
      </div>

      <nav className="space-y-1.5">
        {navItems.map((item) => {
          const active = pathname?.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all duration-300 ease-virio",
                active
                  ? "bg-[#dcb26824] text-[#f0d1a1] shadow-[0_0_0_1px_rgba(220,178,104,0.35)]"
                  : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              )}
            >
              <Icon className={cn("h-4 w-4", active ? "text-[#e5c282]" : "text-muted-foreground group-hover:text-foreground")} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
