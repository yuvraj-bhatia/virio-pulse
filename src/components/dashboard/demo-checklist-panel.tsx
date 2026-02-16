"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { CheckCircle2, ChevronDown, ChevronUp, Circle, ClipboardList, Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ChecklistPayload = {
  clientName: string;
  range: "7" | "30" | "90";
  posts: number;
  postsReady: number;
  inbounds: number;
  opportunities: number;
  reports: number;
  attributionRows: number;
  lastAttributionComputedAt: string | null;
  isEmptyWorkspace: boolean;
};

type Step = {
  id: string;
  label: string;
  done: boolean;
  href: string;
};

export function DemoChecklistPanel(): JSX.Element | null {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const clientId = searchParams.get("clientId");
  const range = (searchParams.get("range") as "7" | "30" | "90" | null) ?? "30";

  const [collapsed, setCollapsed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [state, setState] = useState<ChecklistPayload | null>(null);

  useEffect(() => {
    if (!clientId) return;
    setLoading(true);
    void fetch(`/api/demo/checklist?clientId=${clientId}&range=${range}`, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Failed to load checklist");
        }
        const payload = (await response.json()) as { data: ChecklistPayload };
        setState(payload.data);
      })
      .catch((error) => {
        console.error(error);
        setState(null);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [clientId, range, pathname]);

  const baseQuery = useMemo(() => {
    if (!clientId) return null;
    return `clientId=${clientId}&range=${range}`;
  }, [clientId, range]);

  const steps = useMemo<Step[]>(() => {
    if (!baseQuery || !state) return [];
    return [
      {
        id: "import",
        label: "Import posts",
        done: state.posts > 0,
        href: `/content?${baseQuery}&open=import-urls`
      },
      {
        id: "details",
        label: "Complete post details",
        done: state.postsReady > 0,
        href: `/content?${baseQuery}`
      },
      {
        id: "inbound",
        label: "Add inbound signal",
        done: state.inbounds > 0,
        href: `/content?${baseQuery}&open=inbound`
      },
      {
        id: "opportunity",
        label: "Create opportunity",
        done: state.opportunities > 0,
        href: `/pipeline?${baseQuery}&open=create-opportunity`
      },
      {
        id: "attribution",
        label: "Run attribution",
        done: state.attributionRows > 0,
        href: `/attribution?${baseQuery}&recompute=1`
      },
      {
        id: "report",
        label: "Generate weekly report",
        done: state.reports > 0,
        href: `/overview?${baseQuery}`
      }
    ];
  }, [baseQuery, state]);

  if (!clientId || !state) {
    return null;
  }

  const completed = steps.filter((step) => step.done).length;

  return (
    <div className="fixed bottom-5 left-5 z-[70] hidden w-[300px] rounded-2xl border border-[#dcb26845] bg-[linear-gradient(180deg,rgba(15,18,24,0.96),rgba(12,16,22,0.92))] p-3 shadow-[0_22px_60px_rgba(0,0,0,0.45)] backdrop-blur lg:block">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 rounded-lg px-1 py-1 text-left"
        onClick={() => setCollapsed((current) => !current)}
      >
        <div className="flex items-center gap-2">
          <ClipboardList className="h-4 w-4 text-[#e3c17f]" />
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#d8bc87]">Demo checklist</p>
            <p className="text-xs text-muted-foreground">
              {completed}/{steps.length} done · {state.clientName}
            </p>
          </div>
        </div>
        {collapsed ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {collapsed ? null : (
        <div className="mt-2 space-y-1.5">
          {steps.map((step) => (
            <Link
              key={step.id}
              href={step.href}
              className={cn(
                "flex items-center justify-between rounded-lg border px-2.5 py-2 text-sm transition-all duration-300 ease-virio",
                step.done
                  ? "border-[#7f771f77] bg-[#7f771f1f] text-[#e6d99d]"
                  : "border-[#dcb26830] bg-[#dcb26810] text-foreground hover:border-[#dcb26866]"
              )}
            >
              <span>{step.label}</span>
              {step.done ? <CheckCircle2 className="h-4 w-4" /> : <Circle className="h-4 w-4 text-muted-foreground" />}
            </Link>
          ))}
          {loading ? (
            <div className="flex items-center gap-2 px-1 pt-1 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Refreshing status...
            </div>
          ) : null}
          {process.env.NODE_ENV === "development" ? (
            <div className="rounded-md border border-[#dcb26833] bg-[#0f1218cc] p-2 text-[11px] text-muted-foreground">
              posts: {state.posts} · signals: {state.inbounds} · opps: {state.opportunities}
              <br />
              attribution: {state.lastAttributionComputedAt ? new Date(state.lastAttributionComputedAt).toLocaleString("en-US") : "not computed"}
            </div>
          ) : null}
          {completed === steps.length ? (
            <Button
              asChild
              size="sm"
              className="mt-1 w-full"
            >
              <Link href={`/demo?${baseQuery}`}>Open demo script</Link>
            </Button>
          ) : null}
        </div>
      )}
    </div>
  );
}
