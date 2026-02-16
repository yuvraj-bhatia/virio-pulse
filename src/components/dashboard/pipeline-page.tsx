"use client";

import { OpportunityStage } from "@prisma/client";
import { Loader2, Plus } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { EmptyState } from "@/components/dashboard/empty-state";
import { FunnelChart } from "@/components/dashboard/funnel-chart";
import { StageChart } from "@/components/dashboard/stage-chart";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toCurrency } from "@/lib/utils";
import type { FunnelMetrics, OpportunityListItem, StageDistributionItem } from "@/types";

type PipelinePageProps = {
  clientId: string;
  range: "7" | "30" | "90";
  initialOpenAction?: "create-opportunity" | null;
};

type SignalOption = {
  id: string;
  source: string;
  personName: string | null;
};

type PostOption = {
  id: string;
  hook: string | null;
  postUrl: string | null;
};

type PipelinePayload = {
  funnel: FunnelMetrics;
  opportunities: OpportunityListItem[];
  stageDistribution: StageDistributionItem[];
};

type OpportunityFormState = {
  name: string;
  amount: string;
  stage: OpportunityStage;
  createdAt: string;
  closeDate: string;
  postId: string;
  inboundSignalId: string;
};

function formatDateTimeLocal(date: Date): string {
  const pad = (value: number): string => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function PipelinePage({ clientId, range, initialOpenAction }: PipelinePageProps): JSX.Element {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<PipelinePayload>({
    funnel: {
      inboundSignals: 0,
      meetingsHeld: 0,
      opportunitiesCreated: 0,
      closedWon: 0
    },
    opportunities: [],
    stageDistribution: []
  });
  const [openCreate, setOpenCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [posts, setPosts] = useState<PostOption[]>([]);
  const [signals, setSignals] = useState<SignalOption[]>([]);
  const [updatingOpportunityId, setUpdatingOpportunityId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [form, setForm] = useState<OpportunityFormState>({
    name: "",
    amount: "",
    stage: OpportunityStage.qualified,
    createdAt: formatDateTimeLocal(new Date()),
    closeDate: "",
    postId: "",
    inboundSignalId: ""
  });

  const fetchPipeline = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      const response = await fetch(`/api/pipeline?clientId=${clientId}&range=${range}`, { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Failed to load pipeline");
      }
      const payload = (await response.json()) as { data: PipelinePayload };
      setData(payload.data);
    } catch (error) {
      console.error(error);
      setData({
        funnel: { inboundSignals: 0, meetingsHeld: 0, opportunitiesCreated: 0, closedWon: 0 },
        opportunities: [],
        stageDistribution: []
      });
    } finally {
      setLoading(false);
    }
  }, [clientId, range]);

  const fetchReferences = useCallback(async (): Promise<void> => {
    try {
      const [postsResponse, signalsResponse] = await Promise.all([
        fetch(`/api/content/posts?clientId=${clientId}&range=90`, { cache: "no-store" }),
        fetch(`/api/inbound-signals?clientId=${clientId}`, { cache: "no-store" })
      ]);

      if (postsResponse.ok) {
        const payload = (await postsResponse.json()) as { data: Array<{ id: string; hook: string | null; postUrl: string | null }> };
        setPosts(payload.data.map((post) => ({ id: post.id, hook: post.hook, postUrl: post.postUrl })));
      }

      if (signalsResponse.ok) {
        const payload = (await signalsResponse.json()) as { data: Array<{ id: string; source: string; personName: string | null }> };
        setSignals(payload.data.map((signal) => ({ id: signal.id, source: signal.source, personName: signal.personName })));
      }
    } catch (error) {
      console.error(error);
    }
  }, [clientId]);

  useEffect(() => {
    void fetchPipeline();
    void fetchReferences();
  }, [fetchPipeline, fetchReferences]);

  useEffect(() => {
    if (initialOpenAction === "create-opportunity") {
      setOpenCreate(true);
    }
  }, [initialOpenAction]);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const hasPipelineData = useMemo(
    () =>
      data.funnel.inboundSignals > 0 ||
      data.funnel.meetingsHeld > 0 ||
      data.funnel.opportunitiesCreated > 0 ||
      data.funnel.closedWon > 0,
    [data.funnel]
  );

  const createOpportunity = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    setSaveError(null);
    const amount = Number.parseInt(form.amount, 10);
    if (Number.isNaN(amount) || amount < 0) {
      setSaveError("Amount must be a non-negative whole number");
      return;
    }

    const createdAt = new Date(form.createdAt);
    if (Number.isNaN(createdAt.getTime())) {
      setSaveError("Created at must be a valid date");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/opportunities", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          clientId,
          name: form.name.trim() || "New opportunity",
          amount,
          stage: form.stage,
          createdAt: createdAt.toISOString(),
          closeDate: form.closeDate ? new Date(form.closeDate).toISOString() : null,
          postId: form.postId || null,
          inboundSignalId: form.inboundSignalId || null
        })
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to create opportunity");
      }

      setOpenCreate(false);
      setForm({
        name: "",
        amount: "",
        stage: OpportunityStage.qualified,
        createdAt: formatDateTimeLocal(new Date()),
        closeDate: "",
        postId: "",
        inboundSignalId: ""
      });
      await fetchPipeline();
      router.refresh();
      setToast("Opportunity created");
    } catch (error) {
      console.error(error);
      setSaveError(error instanceof Error ? error.message : "Failed to create opportunity");
    } finally {
      setSaving(false);
    }
  };

  const updateStage = async (id: string, stage: OpportunityStage): Promise<void> => {
    setUpdatingOpportunityId(id);
    try {
      const response = await fetch(`/api/opportunities/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          clientId,
          stage
        })
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to update stage");
      }

      await fetchPipeline();
      router.refresh();
      setToast("Opportunity stage updated");
    } catch (error) {
      console.error(error);
      setToast(error instanceof Error ? error.message : "Failed to update stage");
    } finally {
      setUpdatingOpportunityId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setOpenCreate(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Create opportunity
        </Button>
      </div>

      {!hasPipelineData && !loading ? (
        <EmptyState
          title="No pipeline data yet"
          description="Add inbound signals and opportunities to view funnel progression and influenced revenue."
          action={
            <Button onClick={() => setOpenCreate(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create opportunity
            </Button>
          }
        />
      ) : (
        <>
          <section className="stagger-in grid grid-cols-1 gap-4 lg:grid-cols-2">
            <FunnelChart data={data.funnel} />
            <StageChart data={data.stageDistribution} />
          </section>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm text-muted-foreground">Opportunities with source post context</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading pipeline...
                </div>
              ) : data.opportunities.length === 0 ? (
                <EmptyState title="No opportunities" description="No opportunities were created in this date range." />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Stage</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Source Post</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.opportunities.map((opportunity) => (
                      <TableRow key={opportunity.id}>
                        <TableCell>
                          <Select
                            value={opportunity.stage}
                            onValueChange={(value) => void updateStage(opportunity.id, value as OpportunityStage)}
                            disabled={updatingOpportunityId === opportunity.id}
                          >
                            <SelectTrigger className="w-[180px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {Object.values(OpportunityStage).map((stage) => (
                                <SelectItem key={stage} value={stage}>
                                  {stage.replaceAll("_", " ")}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="font-mono">{toCurrency(opportunity.amount)}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(opportunity.createdAt).toLocaleDateString("en-US")}
                        </TableCell>
                        <TableCell className="max-w-[280px]">
                          {opportunity.sourceHook ? (
                            <p className="line-clamp-2 text-sm">{opportunity.sourceHook}</p>
                          ) : (
                            <span className="text-xs text-muted-foreground">Unattributed</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}

      <Dialog open={openCreate} onOpenChange={setOpenCreate}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create opportunity</DialogTitle>
            <DialogDescription>
              Add opportunity details and optional source links for deterministic attribution.
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={(event) => void createOpportunity(event)}>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="space-y-1 md:col-span-2">
                <Label>Name</Label>
                <Input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Amount</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.amount}
                  onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label>Stage</Label>
                <Select
                  value={form.stage}
                  onValueChange={(value) => setForm((current) => ({ ...current, stage: value as OpportunityStage }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.values(OpportunityStage).map((stage) => (
                      <SelectItem key={stage} value={stage}>
                        {stage.replaceAll("_", " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Created at</Label>
                <Input
                  type="datetime-local"
                  value={form.createdAt}
                  onChange={(event) => setForm((current) => ({ ...current, createdAt: event.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label>Close date (optional)</Label>
                <Input
                  type="datetime-local"
                  value={form.closeDate}
                  onChange={(event) => setForm((current) => ({ ...current, closeDate: event.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label>Linked post (optional)</Label>
                <Select value={form.postId || "none"} onValueChange={(value) => setForm((current) => ({ ...current, postId: value === "none" ? "" : value }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No linked post</SelectItem>
                    {posts.map((post) => (
                      <SelectItem key={post.id} value={post.id}>
                        {post.hook ?? post.postUrl ?? post.id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Linked inbound signal (optional)</Label>
                <Select
                  value={form.inboundSignalId || "none"}
                  onValueChange={(value) => setForm((current) => ({ ...current, inboundSignalId: value === "none" ? "" : value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No linked inbound signal</SelectItem>
                    {signals.map((signal) => (
                      <SelectItem key={signal.id} value={signal.id}>
                        {(signal.personName ?? "Unknown")} · {signal.source.replaceAll("_", " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {saveError ? <p className="text-sm text-[#ffb499]">{saveError}</p> : null}
            <DialogFooter>
              <Button variant="secondary" type="button" onClick={() => setOpenCreate(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {toast ? (
        <div className="fixed bottom-5 right-5 z-50 rounded-lg border border-[#7f771f99] bg-[#7f771f33] px-4 py-3 text-sm text-[#e3db9d] shadow-xl backdrop-blur">
          {toast}
        </div>
      ) : null}
    </div>
  );
}
