import { PostFormat } from "@prisma/client";

export type ImportDedupeRow = {
  postUrl?: string | null;
  hook: string;
  postedAt: string | Date;
};

const acceptedPathPatterns = [
  /^\/posts\//i,
  /^\/feed\/update\//i,
  /^\/pulse\//i,
  /^\/in\/[^/]+\/recent-activity\/all\/?$/i
] as const;

function coerceUrlInput(raw: string): string {
  const trimmed = raw.trim();

  if (trimmed.startsWith("http://")) {
    return `https://${trimmed.slice("http://".length)}`;
  }

  if (trimmed.startsWith("https://")) {
    return trimmed;
  }

  if (trimmed.startsWith("www.linkedin.com/") || trimmed.startsWith("linkedin.com/")) {
    return `https://${trimmed}`;
  }

  return trimmed;
}

export function normalizeLinkedInUrl(rawUrl: string): string | null {
  if (!rawUrl.trim()) {
    return null;
  }

  const prepared = coerceUrlInput(rawUrl);

  let parsed: URL;
  try {
    parsed = new URL(prepared);
  } catch {
    return null;
  }

  const protocol = parsed.protocol.toLowerCase();
  if (protocol !== "https:") {
    return null;
  }

  const hostname = parsed.hostname.toLowerCase();
  if (hostname !== "www.linkedin.com" && hostname !== "linkedin.com") {
    return null;
  }

  let pathname = parsed.pathname.trim();
  if (!pathname.startsWith("/")) {
    pathname = `/${pathname}`;
  }

  pathname = pathname.replace(/\/+$/, "");
  if (!pathname) {
    pathname = "/";
  }

  const isAcceptedPath = acceptedPathPatterns.some((pattern) => pattern.test(pathname));
  if (!isAcceptedPath) {
    return null;
  }

  return `https://www.linkedin.com${pathname}`;
}

export function validateLinkedInUrl(rawUrl: string): boolean {
  return Boolean(normalizeLinkedInUrl(rawUrl));
}

export function normalizePostFormat(rawFormat?: string | null): PostFormat {
  const normalized = rawFormat?.trim().toLowerCase();

  if (normalized === PostFormat.thread) {
    return PostFormat.thread;
  }

  if (normalized === PostFormat.carousel) {
    return PostFormat.carousel;
  }

  return PostFormat.post;
}

function coercePostedAtKey(rawPostedAt: string | Date): string {
  if (rawPostedAt instanceof Date) {
    return rawPostedAt.toISOString();
  }

  const parsed = new Date(rawPostedAt);
  if (Number.isNaN(parsed.getTime())) {
    return rawPostedAt.trim();
  }

  return parsed.toISOString();
}

export function buildImportDedupeKey(row: ImportDedupeRow): string {
  const normalizedUrl = row.postUrl ? normalizeLinkedInUrl(row.postUrl) : null;
  if (normalizedUrl) {
    return `url:${normalizedUrl}`;
  }

  const postedAtKey = coercePostedAtKey(row.postedAt);
  const hookKey = row.hook.trim().toLowerCase();
  return `fallback:${hookKey}::${postedAtKey}`;
}

export function dedupeImportRows<T extends ImportDedupeRow>(rows: T[]): {
  uniqueRows: T[];
  skippedDuplicates: number;
} {
  const seen = new Set<string>();
  const uniqueRows: T[] = [];
  let skippedDuplicates = 0;

  for (const row of rows) {
    const key = buildImportDedupeKey(row);
    if (seen.has(key)) {
      skippedDuplicates += 1;
      continue;
    }

    seen.add(key);
    uniqueRows.push(row);
  }

  return {
    uniqueRows,
    skippedDuplicates
  };
}
