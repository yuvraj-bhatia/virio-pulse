"use client";

import { CtaType, PostFormat } from "@prisma/client";
import { Loader2, Plus } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { z } from "zod";

import { EmptyState } from "@/components/dashboard/empty-state";
import { Badge } from "@/components/ui/badge";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import type { ContentListItem } from "@/types";
import { toCurrency } from "@/lib/utils";

type ExecutiveOption = {
  id: string;
  name: string;
};

type ContentPageProps = {
  clientId: string;
  range: "7" | "30" | "90";
  executives: ExecutiveOption[];
};

type DraftForm = {
  executiveId: string;
  theme: string;
  hook: string;
  body: string;
  format: PostFormat;
  ctaType: CtaType;
};

type DetailPayload = {
  post: ContentListItem & { executive: { name: string } };
  inbounds: Array<{
    id: string;
    source: string;
    personName: string;
    company: string;
    title: string;
    createdAt: string;
  }>;
  meetings: Array<{
    id: string;
    scheduledAt: string;
    outcome: string;
    meetingType: string;
    notes: string;
  }>;
  opportunities: Array<{
    id: string;
    stage: string;
    amount: number;
    createdAt: string;
  }>;
};

const draftSchema = z.object({
  executiveId: z.string().min(1),
  theme: z.string().min(2),
  hook: z.string().min(6),
  body: z.string().min(10),
  format: z.nativeEnum(PostFormat),
  ctaType: z.nativeEnum(CtaType)
});

export function ContentPage({ clientId, range, executives }: ContentPageProps): JSX.Element {
  const [theme, setTheme] = useState<string>("all");
  const [format, setFormat] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [executiveId, setExecutiveId] = useState<string>("all");
  const [search, setSearch] = useState("");

  const [posts, setPosts] = useState<ContentListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [detail, setDetail] = useState<DetailPayload | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const [draftOpen, setDraftOpen] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [draftForm, setDraftForm] = useState<DraftForm>({
    executiveId: executives[0]?.id ?? "",
    theme: "",
    hook: "",
    body: "",
    format: PostFormat.post,
    ctaType: CtaType.book_call
  });

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    params.set("clientId", clientId);
    params.set("range", range);
    if (theme !== "all") params.set("theme", theme);
    if (format !== "all") params.set("format", format);
    if (status !== "all") params.set("status", status);
    if (executiveId !== "all") params.set("executiveId", executiveId);
    if (search.trim()) params.set("search", search.trim());
    return params.toString();
  }, [clientId, range, theme, format, status, executiveId, search]);

  const fetchPosts = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      const response = await fetch(`/api/content/posts?${queryString}`, { cache: "no-store" });
      if (!response.ok) throw new Error("Failed to load posts");
      const payload = (await response.json()) as { data: ContentListItem[] };
      setPosts(payload.data);
    } catch (error) {
      console.error(error);
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }, [queryString]);

  useEffect(() => {
    void fetchPosts();
  }, [fetchPosts]);

  useEffect(() => {
    if (!selectedPostId) {
      setDetail(null);
      return;
    }

    const run = async (): Promise<void> => {
      setLoadingDetail(true);
      try {
        const response = await fetch(`/api/content/posts/${selectedPostId}`, { cache: "no-store" });
        if (!response.ok) throw new Error("Failed to load post detail");
        const payload = (await response.json()) as { data: DetailPayload };
        setDetail(payload.data);
      } catch (error) {
        console.error(error);
      } finally {
        setLoadingDetail(false);
      }
    };

    void run();
  }, [selectedPostId]);

  const onDraftSubmit = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    setDraftError(null);

    const parsed = draftSchema.safeParse(draftForm);
    if (!parsed.success) {
      setDraftError(parsed.error.issues[0]?.message ?? "Invalid draft");
      return;
    }

    setSavingDraft(true);
    try {
      const response = await fetch("/api/content/posts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          clientId,
          ...parsed.data
        })
      });

      if (!response.ok) {
        throw new Error("Failed to create draft");
      }

      setDraftOpen(false);
      setDraftForm((current) => ({ ...current, theme: "", hook: "", body: "" }));
      await fetchPosts();
    } catch (error) {
      console.error(error);
      setDraftError("Failed to save draft");
    } finally {
      setSavingDraft(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
          <Select value={executiveId} onValueChange={setExecutiveId}>
            <SelectTrigger className="w-full"><SelectValue placeholder="Executive" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All executives</SelectItem>
              {executives.map((executive) => (
                <SelectItem key={executive.id} value={executive.id}>
                  {executive.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={theme} onValueChange={setTheme}>
            <SelectTrigger><SelectValue placeholder="Theme" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All themes</SelectItem>
              {["pricing", "security", "ROI", "case study", "hiring", "product launches"].map((option) => (
                <SelectItem key={option} value={option}>{option}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={format} onValueChange={setFormat}>
            <SelectTrigger><SelectValue placeholder="Format" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All formats</SelectItem>
              {Object.values(PostFormat).map((option) => (
                <SelectItem key={option} value={option}>{option}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="draft">draft</SelectItem>
              <SelectItem value="scheduled">scheduled</SelectItem>
              <SelectItem value="posted">posted</SelectItem>
            </SelectContent>
          </Select>

          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search hook/body"
          />
        </div>

        <Button onClick={() => setDraftOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Create new draft
        </Button>
      </div>

      <div className="glass-card rounded-xl p-4">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading content...
          </div>
        ) : posts.length === 0 ? (
          <EmptyState title="No content found" description="Try changing filters or date range." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Executive</TableHead>
                <TableHead>Theme</TableHead>
                <TableHead>Format</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Posted</TableHead>
                <TableHead>Impressions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {posts.map((post) => (
                <TableRow key={post.id} onClick={() => setSelectedPostId(post.id)} className="cursor-pointer">
                  <TableCell>{post.executiveName}</TableCell>
                  <TableCell><Badge variant="secondary">{post.theme}</Badge></TableCell>
                  <TableCell className="capitalize text-muted-foreground">{post.format}</TableCell>
                  <TableCell>
                    <Badge variant={post.status === "posted" ? "success" : post.status === "draft" ? "outline" : "default"}>
                      {post.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{new Date(post.postedAt).toLocaleDateString("en-US")}</TableCell>
                  <TableCell>{post.impressions.toLocaleString("en-US")}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={Boolean(selectedPostId)} onOpenChange={(value) => !value && setSelectedPostId(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Post Details</DialogTitle>
            <DialogDescription>Metrics, attributed meetings, opportunities, and inbound signals.</DialogDescription>
          </DialogHeader>

          {loadingDetail || !detail ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading post details...
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="space-y-3 rounded-lg border border-border/60 bg-[#0f1218cc] p-4">
                <h4 className="font-semibold">Post Summary</h4>
                <p className="text-sm text-foreground">{detail.post.hook}</p>
                <p className="text-sm text-muted-foreground">{detail.post.body}</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <p>Impressions: {detail.post.impressions.toLocaleString("en-US")}</p>
                  <p>Likes: {detail.post.likes.toLocaleString("en-US")}</p>
                  <p>Comments: {detail.post.comments.toLocaleString("en-US")}</p>
                  <p>Shares: {detail.post.shares.toLocaleString("en-US")}</p>
                </div>
              </div>

              <div className="space-y-3 rounded-lg border border-border/60 bg-[#0f1218cc] p-4">
                <h4 className="font-semibold">Attributed Outcomes</h4>
                <p className="text-sm text-muted-foreground">Inbound signals: {detail.inbounds.length}</p>
                <p className="text-sm text-muted-foreground">Meetings: {detail.meetings.length}</p>
                <p className="text-sm text-muted-foreground">
                  Opportunities: {detail.opportunities.length} (
                  {toCurrency(detail.opportunities.reduce((sum, opportunity) => sum + opportunity.amount, 0))})
                </p>
              </div>

              <div className="rounded-lg border border-border/60 bg-[#0f1218cc] p-4">
                <h4 className="mb-2 font-semibold">Inbound signals</h4>
                {detail.inbounds.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No inbound signals linked to this post.</p>
                ) : (
                  <ul className="space-y-2 text-sm">
                    {detail.inbounds.map((inbound) => (
                      <li key={inbound.id}>
                        <span className="text-foreground">{inbound.personName}</span>
                        <span className="text-muted-foreground"> · {inbound.company} · {inbound.source}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="rounded-lg border border-border/60 bg-[#0f1218cc] p-4">
                <h4 className="mb-2 font-semibold">Opportunities</h4>
                {detail.opportunities.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No opportunities linked yet.</p>
                ) : (
                  <ul className="space-y-2 text-sm">
                    {detail.opportunities.map((opportunity) => (
                      <li key={opportunity.id}>
                        <span className="capitalize text-foreground">{opportunity.stage.replaceAll("_", " ")}</span>
                        <span className="text-muted-foreground"> · {toCurrency(opportunity.amount)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={draftOpen} onOpenChange={setDraftOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create draft</DialogTitle>
            <DialogDescription>Save a new internal draft to the content pipeline.</DialogDescription>
          </DialogHeader>

          <form className="space-y-4" onSubmit={(event) => void onDraftSubmit(event)}>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <Label>Executive</Label>
                <Select
                  value={draftForm.executiveId}
                  onValueChange={(value) => setDraftForm((current) => ({ ...current, executiveId: value }))}
                >
                  <SelectTrigger><SelectValue placeholder="Executive" /></SelectTrigger>
                  <SelectContent>
                    {executives.map((executive) => (
                      <SelectItem key={executive.id} value={executive.id}>{executive.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Theme</Label>
                <Input
                  value={draftForm.theme}
                  onChange={(event) => setDraftForm((current) => ({ ...current, theme: event.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label>Format</Label>
                <Select
                  value={draftForm.format}
                  onValueChange={(value) => setDraftForm((current) => ({ ...current, format: value as PostFormat }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.values(PostFormat).map((option) => (
                      <SelectItem key={option} value={option}>{option}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>CTA Type</Label>
                <Select
                  value={draftForm.ctaType}
                  onValueChange={(value) => setDraftForm((current) => ({ ...current, ctaType: value as CtaType }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.values(CtaType).map((option) => (
                      <SelectItem key={option} value={option}>{option}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1">
              <Label>Hook</Label>
              <Input
                value={draftForm.hook}
                onChange={(event) => setDraftForm((current) => ({ ...current, hook: event.target.value }))}
              />
            </div>

            <div className="space-y-1">
              <Label>Body</Label>
              <Textarea
                value={draftForm.body}
                onChange={(event) => setDraftForm((current) => ({ ...current, body: event.target.value }))}
              />
            </div>

            {draftError ? <p className="text-sm text-[#ffb499]">{draftError}</p> : null}

            <DialogFooter>
              <Button variant="secondary" type="button" onClick={() => setDraftOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={savingDraft}>
                {savingDraft ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Save draft
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
