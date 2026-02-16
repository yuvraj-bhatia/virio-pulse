"use client";

import { PostFormat } from "@prisma/client";
import { AlertTriangle, Link2, Loader2 } from "lucide-react";
import { useMemo, useState } from "react";

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
import { normalizeLinkedInUrl } from "@/lib/linkedin";

const maxUrlLines = 200;

export type ImportUrlsResult = {
  imported: number;
  skippedDuplicates: number;
  needsDetails?: number;
  errors?: Array<{ index: number; message: string }>;
};

type UrlImportRow = {
  postUrl: string;
  postedAt: string;
  hook: string;
  theme: string;
  format: PostFormat;
  body: string;
};

type RowValidation = {
  postedAt?: string;
  hook?: string;
  messages: string[];
};

type ParsedPasteResult = {
  validUrls: string[];
  invalidLines: string[];
  duplicateCount: number;
  overflowCount: number;
};

type ImportUrlsModalProps = {
  open: boolean;
  clientId: string;
  onOpenChange: (open: boolean) => void;
  onImported: (result: ImportUrlsResult) => Promise<void> | void;
};

function parsePastedUrls(raw: string): ParsedPasteResult {
  const rawLines = raw.split(/\r?\n/);
  const overflowCount = Math.max(rawLines.length - maxUrlLines, 0);
  const lines = rawLines.slice(0, maxUrlLines);

  const seen = new Set<string>();
  const validUrls: string[] = [];
  const invalidLines: string[] = [];
  let duplicateCount = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }

    const normalized = normalizeLinkedInUrl(trimmed);
    if (!normalized) {
      invalidLines.push(trimmed);
      continue;
    }

    if (seen.has(normalized)) {
      duplicateCount += 1;
      continue;
    }

    seen.add(normalized);
    validUrls.push(normalized);
  }

  return {
    validUrls,
    invalidLines,
    duplicateCount,
    overflowCount
  };
}

function validateRow(row: UrlImportRow): RowValidation {
  const result: RowValidation = {
    messages: []
  };

  if (row.postedAt.trim() && Number.isNaN(new Date(row.postedAt).getTime())) {
    result.postedAt = "postedAt must be a valid date";
    result.messages.push("postedAt must be a valid date");
  }

  if (row.hook.trim() && row.hook.trim().length < 5) {
    result.hook = "hook must be at least 5 characters";
    result.messages.push("hook must be at least 5 characters");
  }

  return result;
}

export function ImportUrlsModal({ open, clientId, onOpenChange, onImported }: ImportUrlsModalProps): JSX.Element {
  const [step, setStep] = useState<1 | 2>(1);
  const [pastedUrls, setPastedUrls] = useState("");
  const [rows, setRows] = useState<UrlImportRow[]>([]);
  const [bulkTheme, setBulkTheme] = useState("General");
  const [bulkFormat, setBulkFormat] = useState<PostFormat>(PostFormat.post);
  const [bulkPostedAt, setBulkPostedAt] = useState("");
  const [importing, setImporting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const parsedUrls = useMemo(() => parsePastedUrls(pastedUrls), [pastedUrls]);
  const validations = useMemo(() => rows.map((row) => validateRow(row)), [rows]);

  const importableRows = useMemo(
    () => rows.filter((_, index) => validations[index]?.messages.length === 0),
    [rows, validations]
  );

  const resetState = (): void => {
    setStep(1);
    setPastedUrls("");
    setRows([]);
    setBulkTheme("General");
    setBulkFormat(PostFormat.post);
    setBulkPostedAt("");
    setImporting(false);
    setErrorMessage(null);
  };

  const openStepTwo = (): void => {
    setRows(
      parsedUrls.validUrls.map((postUrl) => ({
        postUrl,
        postedAt: "",
        hook: "",
        theme: "General",
        format: PostFormat.post,
        body: ""
      }))
    );
    setStep(2);
    setErrorMessage(null);
  };

  const updateRow = (index: number, patch: Partial<UrlImportRow>): void => {
    setRows((current) => current.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)));
  };

  const applyBulkTheme = (): void => {
    setRows((current) => current.map((row) => ({ ...row, theme: bulkTheme })));
  };

  const applyBulkFormat = (): void => {
    setRows((current) => current.map((row) => ({ ...row, format: bulkFormat })));
  };

  const applyBulkPostedAt = (): void => {
    setRows((current) => current.map((row) => ({ ...row, postedAt: bulkPostedAt })));
  };

  const onImport = async (): Promise<void> => {
    setErrorMessage(null);

    if (importableRows.length === 0) {
      setErrorMessage("Fix row errors before importing.");
      return;
    }

    setImporting(true);
    try {
      const response = await fetch("/api/content/import-urls", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          clientId,
          rows: importableRows.map((row) => ({
            postUrl: row.postUrl,
            postedAt: row.postedAt.trim() ? new Date(row.postedAt).toISOString() : undefined,
            hook: row.hook.trim() || undefined,
            theme: row.theme.trim() || "General",
            format: row.format,
            body: row.body.trim() || undefined
          }))
        })
      });

      const payload = (await response.json()) as
        | ImportUrlsResult
        | {
            error?: string;
          };

      if (!response.ok) {
        throw new Error("error" in payload ? payload.error ?? "Import failed" : "Import failed");
      }

      const result = payload as ImportUrlsResult;
      await onImported(result);
      onOpenChange(false);
      resetState();
    } catch (error) {
      console.error(error);
      setErrorMessage(error instanceof Error ? error.message : "Import failed");
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) {
          resetState();
        }
      }}
    >
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>Import LinkedIn post URLs</DialogTitle>
          <DialogDescription>
            Paste post URLs, fill minimal metadata, and import directly without CSV exports.
          </DialogDescription>
        </DialogHeader>

        {step === 1 ? (
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>Paste URLs</Label>
              <Textarea
                rows={10}
                value={pastedUrls}
                onChange={(event) => setPastedUrls(event.target.value)}
                placeholder="Paste LinkedIn post URLs, one per line..."
              />
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs md:grid-cols-4">
              <p className="rounded-lg border border-[#dcb26844] bg-[#dcb26812] px-2 py-1">Valid: {parsedUrls.validUrls.length}</p>
              <p className="rounded-lg border border-[#df551f55] bg-[#df551f17] px-2 py-1">Invalid: {parsedUrls.invalidLines.length}</p>
              <p className="rounded-lg border border-[#3a6e7466] bg-[#3a6e741c] px-2 py-1">Deduped: {parsedUrls.duplicateCount}</p>
              <p className="rounded-lg border border-[#dcb26844] bg-[#dcb26812] px-2 py-1">Line limit: {maxUrlLines}</p>
            </div>

            {parsedUrls.overflowCount > 0 ? (
              <p className="text-xs text-[#ffb499]">Ignored {parsedUrls.overflowCount} lines beyond the 200 line limit.</p>
            ) : null}

            {parsedUrls.invalidLines.length > 0 ? (
              <details className="rounded-lg border border-[#df551f55] bg-[#df551f17] p-3 text-xs text-[#ffb499]">
                <summary className="cursor-pointer select-none font-medium">
                  {parsedUrls.invalidLines.length} invalid lines
                </summary>
                <ul className="mt-2 max-h-40 list-disc space-y-1 overflow-y-auto pl-5">
                  {parsedUrls.invalidLines.slice(0, 60).map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </details>
            ) : null}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 rounded-xl border border-[#dcb26840] bg-[#dcb26810] p-3 md:grid-cols-3">
              <div className="space-y-1">
                <Label>Set theme for all</Label>
                <div className="flex gap-2">
                  <Input value={bulkTheme} onChange={(event) => setBulkTheme(event.target.value)} placeholder="General" />
                  <Button type="button" variant="outline" onClick={applyBulkTheme}>Apply</Button>
                </div>
              </div>
              <div className="space-y-1">
                <Label>Set format for all</Label>
                <div className="flex gap-2">
                  <Select value={bulkFormat} onValueChange={(value) => setBulkFormat(value as PostFormat)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={PostFormat.post}>Post</SelectItem>
                      <SelectItem value={PostFormat.thread}>Thread</SelectItem>
                      <SelectItem value={PostFormat.carousel}>Carousel</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button type="button" variant="outline" onClick={applyBulkFormat}>Apply</Button>
                </div>
              </div>
              <div className="space-y-1">
                <Label>Set postedAt for all</Label>
                <div className="flex gap-2">
                  <Input type="date" value={bulkPostedAt} onChange={(event) => setBulkPostedAt(event.target.value)} />
                  <Button type="button" variant="outline" onClick={applyBulkPostedAt}>Apply</Button>
                </div>
              </div>
            </div>

            <div className="max-h-[55vh] overflow-auto rounded-xl border border-[#dcb26833]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>URL</TableHead>
                    <TableHead>postedAt</TableHead>
                    <TableHead>Hook</TableHead>
                    <TableHead>Theme</TableHead>
                    <TableHead>Format</TableHead>
                    <TableHead>Body</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row, index) => {
                    const validation = validations[index];
                    return (
                      <TableRow key={`${row.postUrl}-${index}`}>
                        <TableCell className="max-w-[220px] align-top">
                          <p className="line-clamp-3 text-xs text-muted-foreground">{row.postUrl}</p>
                        </TableCell>
                        <TableCell className="align-top">
                          <Input
                            type="date"
                            value={row.postedAt}
                            onChange={(event) => updateRow(index, { postedAt: event.target.value })}
                            className={validation?.postedAt ? "border-[#df551f8c]" : ""}
                          />
                          {validation?.postedAt ? <p className="mt-1 text-[11px] text-[#ffb499]">{validation.postedAt}</p> : null}
                        </TableCell>
                        <TableCell className="align-top">
                          <Input
                            value={row.hook}
                            onChange={(event) => updateRow(index, { hook: event.target.value })}
                            placeholder="Optional hook (required later for READY)"
                            className={validation?.hook ? "border-[#df551f8c]" : ""}
                          />
                          {validation?.hook ? <p className="mt-1 text-[11px] text-[#ffb499]">{validation.hook}</p> : null}
                        </TableCell>
                        <TableCell className="align-top">
                          <Input
                            value={row.theme}
                            onChange={(event) => updateRow(index, { theme: event.target.value })}
                            placeholder="General"
                          />
                        </TableCell>
                        <TableCell className="align-top">
                          <Select
                            value={row.format}
                            onValueChange={(value) => updateRow(index, { format: value as PostFormat })}
                          >
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value={PostFormat.post}>Post</SelectItem>
                              <SelectItem value={PostFormat.thread}>Thread</SelectItem>
                              <SelectItem value={PostFormat.carousel}>Carousel</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="align-top">
                          <Input
                            value={row.body}
                            onChange={(event) => updateRow(index, { body: event.target.value })}
                            placeholder="Optional body"
                          />
                          {validation?.messages.length ? (
                            <p className="mt-1 text-[11px] text-[#ffb499]">{validation.messages.join("; ")}</p>
                          ) : null}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {errorMessage ? (
              <div className="flex items-center gap-2 rounded-lg border border-[#df551f55] bg-[#df551f17] p-2 text-sm text-[#ffb499]">
                <AlertTriangle className="h-4 w-4" />
                {errorMessage}
              </div>
            ) : null}
          </div>
        )}

        <DialogFooter>
          {step === 1 ? (
            <>
              <Button variant="secondary" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="button" onClick={openStepTwo} disabled={parsedUrls.validUrls.length === 0}>
                <Link2 className="mr-2 h-4 w-4" />
                Continue
              </Button>
            </>
          ) : (
            <>
              <Button variant="secondary" onClick={() => setStep(1)} disabled={importing}>
                Back
              </Button>
              <Button type="button" onClick={() => void onImport()} disabled={importing || importableRows.length === 0}>
                {importing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Import {importableRows.length} posts
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
