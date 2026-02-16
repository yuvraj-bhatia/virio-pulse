"use client";

import { CtaType, InboundSource, PostFormat } from "@prisma/client";
import { Link2, Loader2, Plus, Upload } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";

import { EmptyState } from "@/components/dashboard/empty-state";
import { ImportUrlsModal, type ImportUrlsResult } from "@/components/dashboard/import-urls-modal";
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
import { toCurrency } from "@/lib/utils";
import type { ContentListItem } from "@/types";

type ExecutiveOption = {
  id: string;
  name: string;
};

type ContentPageProps = {
  clientId: string;
  range: "7" | "30" | "90";
  executives: ExecutiveOption[];
  initialDataMode: "sample" | "real";
};

type DraftForm = {
  executiveId: string;
  theme: string;
  hook: string;
  body: string;
  format: PostFormat;
  ctaType: CtaType;
};

type InboundForm = {
  source: InboundSource;
  createdAt: string;
  postId: string;
  executiveId: string;
  entryPointUrl: string;
  personName: string;
  company: string;
};

type DetailPayload = {
  post: ContentListItem & { executive: { name: string } };
  inbounds: Array<{
    id: string;
    source: string;
    personName: string | null;
    company: string | null;
    title: string | null;
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

type ImportPayloadRow = {
  postedAt: string;
  format: PostFormat;
  theme: string;
  hook: string;
  impressions: number;
  likes?: number;
  comments?: number;
  shares?: number;
  body?: string;
  postUrl?: string;
};

type ImportPreviewRow = ImportPayloadRow & {
  rowNumber: number;
};

type ToastState = {
  message: string;
  tone: "success" | "error";
};

const draftSchema = z.object({
  executiveId: z.string().min(1),
  theme: z.string().min(2),
  hook: z.string().min(6),
  body: z.string().min(10),
  format: z.nativeEnum(PostFormat),
  ctaType: z.nativeEnum(CtaType)
});

const inboundSchema = z
  .object({
    source: z.nativeEnum(InboundSource),
    createdAt: z.string().min(1),
    postId: z.string().optional(),
    executiveId: z.string().optional(),
    entryPointUrl: z.string().optional(),
    personName: z.string().optional(),
    company: z.string().optional()
  })
  .superRefine((value, ctx) => {
    if (value.entryPointUrl?.trim()) {
      try {
        new URL(value.entryPointUrl.trim());
      } catch {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Entry point URL must be a valid URL"
        });
      }
    }
  });

const requiredImportColumns = ["postedAt", "format", "theme", "hook", "impressions"] as const;
const optionalImportColumns = ["likes", "comments", "shares", "body", "postUrl"] as const;
const supportedImportColumns = [...requiredImportColumns, ...optionalImportColumns] as const;

function formatDateTimeLocal(date: Date): string {
  const pad = (value: number): string => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function parseCsvRows(rawContent: string): string[][] {
  const rows: string[][] = [];
  const text = rawContent.replace(/^\uFEFF/, "");

  let currentField = "";
  let currentRow: string[] = [];
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        currentField += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      currentRow.push(currentField);
      currentField = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") {
        index += 1;
      }
      currentRow.push(currentField);
      if (currentRow.some((value) => value.trim().length > 0)) {
        rows.push(currentRow);
      }
      currentField = "";
      currentRow = [];
      continue;
    }

    currentField += char;
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField);
    if (currentRow.some((value) => value.trim().length > 0)) {
      rows.push(currentRow);
    }
  }

  return rows;
}

function parseImportCsv(content: string): {
  rows: ImportPayloadRow[];
  preview: ImportPreviewRow[];
  errors: string[];
} {
  const table = parseCsvRows(content);
  if (table.length === 0) {
    return {
      rows: [],
      preview: [],
      errors: ["CSV is empty."]
    };
  }

  const headerRaw = table[0] ?? [];
  const header = headerRaw.map((column) => column.trim());

  const normalizedToCanonical = new Map<string, (typeof supportedImportColumns)[number]>(
    supportedImportColumns.map((column) => [column.toLowerCase(), column])
  );

  const headerIndex = new Map<(typeof supportedImportColumns)[number], number>();
  header.forEach((column, index) => {
    const canonical = normalizedToCanonical.get(column.toLowerCase());
    if (canonical && !headerIndex.has(canonical)) {
      headerIndex.set(canonical, index);
    }
  });

  const errors: string[] = [];

  for (const requiredColumn of requiredImportColumns) {
    if (!headerIndex.has(requiredColumn)) {
      errors.push(`Missing required column: ${requiredColumn}`);
    }
  }

  const rows: ImportPayloadRow[] = [];
  const preview: ImportPreviewRow[] = [];

  for (let rowIndex = 1; rowIndex < table.length; rowIndex += 1) {
    const row = table[rowIndex] ?? [];

    const getValue = (column: (typeof supportedImportColumns)[number]): string => {
      const index = headerIndex.get(column);
      if (index === undefined) return "";
      return row[index]?.trim() ?? "";
    };

    const hasData = supportedImportColumns.some((column) => getValue(column).length > 0);
    if (!hasData) {
      continue;
    }

    const rowErrors: string[] = [];

    const postedAtRaw = getValue("postedAt");
    const postedAtDate = new Date(postedAtRaw);
    if (!postedAtRaw || Number.isNaN(postedAtDate.getTime())) {
      rowErrors.push("postedAt must be a valid date");
    }

    const formatRaw = getValue("format").toLowerCase();
    const format = Object.values(PostFormat).find((value) => value === formatRaw);
    if (!format) {
      rowErrors.push("format must be one of: post, thread, carousel");
    }

    const theme = getValue("theme");
    if (!theme) {
      rowErrors.push("theme is required");
    }

    const hook = getValue("hook");
    if (!hook) {
      rowErrors.push("hook is required");
    }

    const impressionsRaw = getValue("impressions");
    const impressions = Number.parseInt(impressionsRaw, 10);
    if (!impressionsRaw || Number.isNaN(impressions) || impressions < 0) {
      rowErrors.push("impressions must be a non-negative integer");
    }

    const likesRaw = getValue("likes");
    const commentsRaw = getValue("comments");
    const sharesRaw = getValue("shares");

    const parseOptionalMetric = (raw: string, field: string): number | undefined => {
      if (!raw) return undefined;
      const value = Number.parseInt(raw, 10);
      if (Number.isNaN(value) || value < 0) {
        rowErrors.push(`${field} must be a non-negative integer when provided`);
        return undefined;
      }
      return value;
    };

    const likes = parseOptionalMetric(likesRaw, "likes");
    const comments = parseOptionalMetric(commentsRaw, "comments");
    const shares = parseOptionalMetric(sharesRaw, "shares");

    const body = getValue("body");
    const postUrl = getValue("postUrl");

    if (postUrl) {
      try {
        new URL(postUrl);
      } catch {
        rowErrors.push("postUrl must be a valid URL when provided");
      }
    }

    if (rowErrors.length > 0) {
      errors.push(`Row ${rowIndex + 1}: ${rowErrors.join("; ")}`);
      continue;
    }

    const parsedRow: ImportPayloadRow = {
      postedAt: postedAtDate.toISOString(),
      format: format as PostFormat,
      theme,
      hook,
      impressions,
      ...(likes !== undefined ? { likes } : {}),
      ...(comments !== undefined ? { comments } : {}),
      ...(shares !== undefined ? { shares } : {}),
      ...(body ? { body } : {}),
      ...(postUrl ? { postUrl } : {})
    };

    rows.push(parsedRow);
    preview.push({
      rowNumber: rowIndex + 1,
      ...parsedRow
    });
  }

  if (rows.length === 0 && errors.length === 0) {
    errors.push("CSV has no valid data rows to import.");
  }

  return { rows, preview, errors };
}

export function ContentPage({ clientId, range, executives, initialDataMode }: ContentPageProps): JSX.Element {
  const router = useRouter();

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

  const [importOpen, setImportOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importFileName, setImportFileName] = useState<string>("");
  const [importExecutiveId, setImportExecutiveId] = useState<string>(executives[0]?.id ?? "");
  const [importRows, setImportRows] = useState<ImportPayloadRow[]>([]);
  const [importPreviewRows, setImportPreviewRows] = useState<ImportPreviewRow[]>([]);
  const [importValidationErrors, setImportValidationErrors] = useState<string[]>([]);
  const [importUrlsOpen, setImportUrlsOpen] = useState(false);
  const [dataMode, setDataMode] = useState<"sample" | "real">(initialDataMode);

  const [inboundOpen, setInboundOpen] = useState(false);
  const [savingInbound, setSavingInbound] = useState(false);
  const [inboundError, setInboundError] = useState<string | null>(null);
  const [inboundForm, setInboundForm] = useState<InboundForm>({
    source: InboundSource.linkedin_dm,
    createdAt: formatDateTimeLocal(new Date()),
    postId: "",
    executiveId: "",
    entryPointUrl: "",
    personName: "",
    company: ""
  });

  const [toast, setToast] = useState<ToastState | null>(null);

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

  const fetchPostDetail = useCallback(async (postId: string): Promise<void> => {
    setLoadingDetail(true);
    try {
      const response = await fetch(`/api/content/posts/${postId}`, { cache: "no-store" });
      if (!response.ok) throw new Error("Failed to load post detail");
      const payload = (await response.json()) as { data: DetailPayload };
      setDetail(payload.data);
    } catch (error) {
      console.error(error);
      setDetail(null);
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  useEffect(() => {
    void fetchPosts();
  }, [fetchPosts]);

  useEffect(() => {
    if (!selectedPostId) {
      setDetail(null);
      return;
    }

    void fetchPostDetail(selectedPostId);
  }, [selectedPostId, fetchPostDetail]);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(timeout);
  }, [toast]);

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
      setToast({ message: "Draft created", tone: "success" });
    } catch (error) {
      console.error(error);
      setDraftError("Failed to save draft");
    } finally {
      setSavingDraft(false);
    }
  };

  const resetImportState = (): void => {
    setImportFileName("");
    setImportRows([]);
    setImportPreviewRows([]);
    setImportValidationErrors([]);
    setImportError(null);
  };

  const onImportFileChange = async (event: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.target.files?.[0];
    resetImportState();

    if (!file) {
      return;
    }

    setImportFileName(file.name);

    try {
      const text = await file.text();
      const parsed = parseImportCsv(text);
      setImportRows(parsed.rows);
      setImportPreviewRows(parsed.preview);
      setImportValidationErrors(parsed.errors);
      if (parsed.errors.length > 0) {
        setImportError("Fix validation errors before importing.");
      }
    } catch (error) {
      console.error(error);
      setImportError("Failed to parse CSV file.");
      setImportValidationErrors(["Unable to read the uploaded CSV file."]);
    }
  };

  const onImportSubmit = async (): Promise<void> => {
    setImportError(null);

    if (!importExecutiveId) {
      setImportError("Select an executive for imported posts.");
      return;
    }

    if (importRows.length === 0) {
      setImportError("Upload a valid CSV before importing.");
      return;
    }

    if (importValidationErrors.length > 0) {
      setImportError("Fix validation errors before importing.");
      return;
    }

    setImporting(true);
    try {
      const response = await fetch("/api/content/import", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          clientId,
          executiveId: importExecutiveId,
          rows: importRows
        })
      });

      const payload = (await response.json()) as {
        data?: { imported: number };
        error?: string;
      };

      if (!response.ok || !payload.data) {
        throw new Error(payload.error ?? "Import failed");
      }

      const imported = payload.data.imported;
      setImportOpen(false);
      resetImportState();
      await fetchPosts();
      setDataMode("real");
      router.refresh();
      setToast({ message: `Imported ${imported} posts`, tone: "success" });
    } catch (error) {
      console.error(error);
      setImportError(error instanceof Error ? error.message : "Import failed");
      setToast({ message: "Import failed", tone: "error" });
    } finally {
      setImporting(false);
    }
  };

  const onUrlsImported = useCallback(
    async (result: ImportUrlsResult): Promise<void> => {
      await fetchPosts();
      setDataMode("real");
      router.refresh();

      const toastMessage =
        result.skippedDuplicates > 0
          ? `Imported ${result.imported} posts. Skipped ${result.skippedDuplicates} duplicates`
          : `Imported ${result.imported} posts`;

      setToast({ message: toastMessage, tone: "success" });
    },
    [fetchPosts, router]
  );

  const onInboundSubmit = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    setInboundError(null);

    const parsed = inboundSchema.safeParse(inboundForm);
    if (!parsed.success) {
      setInboundError(parsed.error.issues[0]?.message ?? "Invalid inbound signal");
      return;
    }

    const createdAtDate = new Date(parsed.data.createdAt);
    if (Number.isNaN(createdAtDate.getTime())) {
      setInboundError("createdAt must be a valid date/time");
      return;
    }

    setSavingInbound(true);
    try {
      const response = await fetch("/api/inbound-signals", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          clientId,
          source: parsed.data.source,
          createdAt: createdAtDate.toISOString(),
          postId: parsed.data.postId?.trim() ? parsed.data.postId.trim() : null,
          executiveId: parsed.data.executiveId?.trim() ? parsed.data.executiveId.trim() : null,
          entryPointUrl: parsed.data.entryPointUrl?.trim() ? parsed.data.entryPointUrl.trim() : null,
          personName: parsed.data.personName?.trim() ? parsed.data.personName.trim() : null,
          company: parsed.data.company?.trim() ? parsed.data.company.trim() : null
        })
      });

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? "Failed to add inbound signal");
      }

      setInboundOpen(false);
      setInboundForm({
        source: InboundSource.linkedin_dm,
        createdAt: formatDateTimeLocal(new Date()),
        postId: "",
        executiveId: "",
        entryPointUrl: "",
        personName: "",
        company: ""
      });

      if (selectedPostId) {
        await fetchPostDetail(selectedPostId);
      }
      await fetchPosts();
      router.refresh();
      setToast({ message: "Inbound signal added", tone: "success" });
    } catch (error) {
      console.error(error);
      setInboundError(error instanceof Error ? error.message : "Failed to add inbound signal");
      setToast({ message: "Failed to add inbound signal", tone: "error" });
    } finally {
      setSavingInbound(false);
    }
  };

  return (
    <div className="space-y-4">
      {dataMode === "sample" ? (
        <div className="glass-card flex flex-col gap-3 rounded-xl border border-[#dcb26855] bg-[#dcb26812] p-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-semibold text-[#f2d5a5]">Sample data loaded</p>
            <p className="text-xs text-muted-foreground">
              Replace seeded posts with your real LinkedIn exports to evaluate true content-to-revenue signals.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              <Upload className="mr-2 h-4 w-4" />
              Import your posts
            </Button>
            <Button variant="outline" onClick={() => setImportUrlsOpen(true)}>
              <Link2 className="mr-2 h-4 w-4" />
              Import URLs
            </Button>
          </div>
        </div>
      ) : (
        <div className="glass-card flex flex-col gap-3 rounded-xl p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-2">
            <Badge variant="secondary">Real data</Badge>
            <p className="text-xs text-muted-foreground">This workspace is running on imported client data.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              <Upload className="mr-2 h-4 w-4" />
              Import CSV
            </Button>
            <Button variant="outline" onClick={() => setImportUrlsOpen(true)}>
              <Link2 className="mr-2 h-4 w-4" />
              Import URLs
            </Button>
          </div>
        </div>
      )}

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

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setInboundOpen(true)}>
            Add inbound signal
          </Button>
          <Button onClick={() => setDraftOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Create new draft
          </Button>
        </div>
      </div>

      <div className="glass-card rounded-xl p-4">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading content...
          </div>
        ) : posts.length === 0 ? (
          <EmptyState
            title="No posts yet"
            description="Import LinkedIn post URLs to start building a real attribution workspace."
            action={(
              <Button size="sm" onClick={() => setImportUrlsOpen(true)}>
                <Link2 className="mr-2 h-4 w-4" />
                Import URLs
              </Button>
            )}
          />
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
                        <span className="text-foreground">{inbound.personName ?? "Unknown"}</span>
                        <span className="text-muted-foreground"> · {inbound.company ?? "Unknown company"} · {inbound.source}</span>
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

      <Dialog open={importOpen} onOpenChange={(next) => {
        setImportOpen(next);
        if (!next) resetImportState();
      }}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Import LinkedIn posts (CSV)</DialogTitle>
            <DialogDescription>
              Required columns: postedAt, format, theme, hook, impressions. Optional: likes, comments, shares, body, postUrl.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-[220px_1fr]">
              <div className="space-y-1">
                <Label>Assign posts to executive</Label>
                <Select value={importExecutiveId} onValueChange={setImportExecutiveId}>
                  <SelectTrigger><SelectValue placeholder="Executive" /></SelectTrigger>
                  <SelectContent>
                    {executives.map((executive) => (
                      <SelectItem key={executive.id} value={executive.id}>{executive.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>CSV file</Label>
                <Input accept=".csv,text/csv" type="file" onChange={(event) => void onImportFileChange(event)} />
                {importFileName ? (
                  <p className="text-xs text-muted-foreground">Loaded: {importFileName}</p>
                ) : (
                  <p className="text-xs text-muted-foreground">Upload your LinkedIn export CSV.</p>
                )}
              </div>
            </div>

            {importValidationErrors.length > 0 ? (
              <div className="max-h-36 space-y-1 overflow-y-auto rounded-lg border border-[#df551f66] bg-[#df551f1a] p-3 text-xs text-[#ffb499]">
                {importValidationErrors.map((error) => (
                  <p key={error}>{error}</p>
                ))}
              </div>
            ) : null}

            <div className="rounded-lg border border-border/70 bg-[#0f1218cc] p-3">
              <p className="mb-2 text-sm font-medium">Preview</p>
              {importPreviewRows.length === 0 ? (
                <p className="text-sm text-muted-foreground">No rows parsed yet.</p>
              ) : (
                <div className="max-h-64 overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Row</TableHead>
                        <TableHead>Posted At</TableHead>
                        <TableHead>Format</TableHead>
                        <TableHead>Theme</TableHead>
                        <TableHead>Hook</TableHead>
                        <TableHead>Impressions</TableHead>
                        <TableHead>Post URL</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {importPreviewRows.slice(0, 12).map((row) => (
                        <TableRow key={`${row.rowNumber}-${row.hook}`}>
                          <TableCell>{row.rowNumber}</TableCell>
                          <TableCell>{new Date(row.postedAt).toLocaleDateString("en-US")}</TableCell>
                          <TableCell className="capitalize">{row.format}</TableCell>
                          <TableCell>{row.theme}</TableCell>
                          <TableCell className="max-w-[300px] truncate">{row.hook}</TableCell>
                          <TableCell>{row.impressions.toLocaleString("en-US")}</TableCell>
                          <TableCell className="max-w-[220px] truncate text-muted-foreground">{row.postUrl ?? "-"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>

            {importError ? <p className="text-sm text-[#ffb499]">{importError}</p> : null}
          </div>

          <DialogFooter>
            <Button variant="secondary" onClick={() => setImportOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={importing || importRows.length === 0 || importValidationErrors.length > 0}
              onClick={() => void onImportSubmit()}
            >
              {importing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Import posts
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ImportUrlsModal
        open={importUrlsOpen}
        onOpenChange={setImportUrlsOpen}
        clientId={clientId}
        onImported={onUrlsImported}
      />

      <Dialog open={inboundOpen} onOpenChange={setInboundOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add inbound signal</DialogTitle>
            <DialogDescription>
              Capture demand signals and optionally link to a post or executive.
            </DialogDescription>
          </DialogHeader>

          <form className="space-y-4" onSubmit={(event) => void onInboundSubmit(event)}>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <Label>Source</Label>
                <Select
                  value={inboundForm.source}
                  onValueChange={(value) =>
                    setInboundForm((current) => ({ ...current, source: value as InboundSource }))
                  }
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.values(InboundSource).map((source) => (
                      <SelectItem key={source} value={source}>{source.replaceAll("_", " ")}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Created at</Label>
                <Input
                  type="datetime-local"
                  value={inboundForm.createdAt}
                  onChange={(event) =>
                    setInboundForm((current) => ({ ...current, createdAt: event.target.value }))
                  }
                />
              </div>

              <div className="space-y-1">
                <Label>Post (optional)</Label>
                <Select
                  value={inboundForm.postId || "none"}
                  onValueChange={(value) =>
                    setInboundForm((current) => ({ ...current, postId: value === "none" ? "" : value }))
                  }
                >
                  <SelectTrigger><SelectValue placeholder="No linked post" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No linked post</SelectItem>
                    {posts.map((post) => (
                      <SelectItem key={post.id} value={post.id}>{post.hook}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label>Executive (optional)</Label>
                <Select
                  value={inboundForm.executiveId || "none"}
                  onValueChange={(value) =>
                    setInboundForm((current) => ({ ...current, executiveId: value === "none" ? "" : value }))
                  }
                >
                  <SelectTrigger><SelectValue placeholder="No executive" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No executive</SelectItem>
                    {executives.map((executive) => (
                      <SelectItem key={executive.id} value={executive.id}>{executive.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1 md:col-span-2">
                <Label>Entry point URL (optional)</Label>
                <Input
                  placeholder="https://www.linkedin.com/..."
                  value={inboundForm.entryPointUrl}
                  onChange={(event) =>
                    setInboundForm((current) => ({ ...current, entryPointUrl: event.target.value }))
                  }
                />
              </div>

              <div className="space-y-1">
                <Label>Person name (optional)</Label>
                <Input
                  value={inboundForm.personName}
                  onChange={(event) =>
                    setInboundForm((current) => ({ ...current, personName: event.target.value }))
                  }
                />
              </div>
              <div className="space-y-1">
                <Label>Company (optional)</Label>
                <Input
                  value={inboundForm.company}
                  onChange={(event) =>
                    setInboundForm((current) => ({ ...current, company: event.target.value }))
                  }
                />
              </div>
            </div>

            {inboundError ? <p className="text-sm text-[#ffb499]">{inboundError}</p> : null}

            <DialogFooter>
              <Button variant="secondary" type="button" onClick={() => setInboundOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={savingInbound}>
                {savingInbound ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Save inbound
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {toast ? (
        <div
          className={`fixed bottom-5 right-5 z-50 rounded-lg border px-4 py-3 text-sm shadow-xl backdrop-blur ${
            toast.tone === "success"
              ? "border-[#7f771f99] bg-[#7f771f33] text-[#e3db9d]"
              : "border-[#df551f99] bg-[#df551f2f] text-[#ffb499]"
          }`}
        >
          {toast.message}
        </div>
      ) : null}
    </div>
  );
}
