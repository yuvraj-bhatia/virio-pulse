export const dynamic = "force-dynamic";

import { CtaType, PostStatus, type Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { recomputeAttributionAllRanges } from "@/lib/attribution-results";
import { prisma } from "@/lib/db";
import { badRequest, serverError } from "@/lib/http";
import { dedupeImportRows, normalizeLinkedInUrl, normalizePostFormat } from "@/lib/linkedin";
import { prepareClientForRealDataImport } from "@/lib/workspace-data";

const importRowSchema = z.object({
  postUrl: z.string().min(1),
  postedAt: z.string().optional().nullable(),
  hook: z.string().optional().nullable(),
  theme: z.string().optional(),
  format: z.string().optional(),
  body: z.string().optional(),
  impressions: z.number().int().nonnegative().optional(),
  likes: z.number().int().nonnegative().optional(),
  comments: z.number().int().nonnegative().optional(),
  shares: z.number().int().nonnegative().optional()
});

const importSchema = z.object({
  clientId: z.string().min(1),
  rows: z.array(importRowSchema).min(1).max(200)
});

type PreparedRow = {
  index: number;
  postUrl: string;
  postedAt: Date | null;
  hook: string | null;
  theme: string;
  format: ReturnType<typeof normalizePostFormat>;
  body: string;
  impressions: number;
  likes: number;
  comments: number;
  shares: number;
};

function inferStatus(input: {
  hook: string | null;
  postedAt: Date | null;
  existingStatus?: PostStatus;
}): PostStatus {
  if (input.existingStatus === PostStatus.posted) {
    return PostStatus.posted;
  }

  if (input.hook && input.postedAt) {
    return PostStatus.ready;
  }

  return PostStatus.needs_details;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const payload = await request.json();
    const parsed = importSchema.safeParse(payload);

    if (!parsed.success) {
      return badRequest(parsed.error.issues[0]?.message ?? "Invalid import payload");
    }

    const { clientId, rows } = parsed.data;

    const defaultExecutive = await prisma.executive.findFirst({
      where: { clientId },
      orderBy: { createdAt: "asc" },
      select: { id: true }
    });

    if (!defaultExecutive) {
      return badRequest("No executives available for active client");
    }

    const errors: Array<{ index: number; message: string }> = [];
    const preparedRows: PreparedRow[] = [];

    rows.forEach((row, index) => {
      const postUrl = normalizeLinkedInUrl(row.postUrl.trim());
      if (!postUrl) {
        errors.push({ index, message: "postUrl must be a valid LinkedIn URL" });
        return;
      }

      let postedAt: Date | null = null;
      const postedAtRaw = row.postedAt?.trim();
      if (postedAtRaw) {
        const parsedPostedAt = new Date(postedAtRaw);
        if (Number.isNaN(parsedPostedAt.getTime())) {
          errors.push({ index, message: "postedAt must be a valid ISO date when provided" });
          return;
        }
        postedAt = parsedPostedAt;
      }

      const hookRaw = row.hook?.trim() ?? "";
      if (hookRaw.length > 0 && hookRaw.length < 5) {
        errors.push({ index, message: "hook must be at least 5 characters when provided" });
        return;
      }

      const hook = hookRaw.length > 0 ? hookRaw : null;

      preparedRows.push({
        index,
        postUrl,
        postedAt,
        hook,
        theme: row.theme?.trim() || "General",
        format: normalizePostFormat(row.format),
        body: row.body?.trim() || "",
        impressions: row.impressions ?? 0,
        likes: row.likes ?? 0,
        comments: row.comments ?? 0,
        shares: row.shares ?? 0
      });
    });

    const { uniqueRows, skippedDuplicates } = dedupeImportRows(preparedRows);

    let imported = 0;
    let switchedToRealMode = false;

    await prisma.$transaction(async (tx) => {
      const modeResult = await prepareClientForRealDataImport(tx, clientId);
      switchedToRealMode = modeResult.clearedSampleData;

      for (const row of uniqueRows) {
        const existing = await tx.contentPost.findFirst({
          where: {
            clientId,
            OR: [
              { postUrl: row.postUrl },
              ...(row.hook && row.postedAt
                ? [
                    {
                      hook: row.hook,
                      postedAt: row.postedAt
                    }
                  ]
                : [])
            ]
          },
          select: {
            id: true,
            hook: true,
            postedAt: true,
            status: true
          }
        });

        if (existing) {
          const updateData: Prisma.ContentPostUpdateInput = {
            postUrl: row.postUrl,
            theme: row.theme,
            format: row.format,
            body: row.body,
            impressions: row.impressions,
            likes: row.likes,
            comments: row.comments,
            shares: row.shares
          };

          if (row.hook) {
            updateData.hook = row.hook;
          }

          if (row.postedAt) {
            updateData.postedAt = row.postedAt;
          }

          const effectiveHook = row.hook ?? existing.hook ?? null;
          const effectivePostedAt = row.postedAt ?? existing.postedAt ?? null;
          updateData.status = inferStatus({
            hook: effectiveHook,
            postedAt: effectivePostedAt,
            existingStatus: existing.status
          });

          await tx.contentPost.update({
            where: { id: existing.id },
            data: updateData
          });
          imported += 1;
          continue;
        }

        await tx.contentPost.create({
          data: {
            clientId,
            executiveId: defaultExecutive.id,
            postUrl: row.postUrl,
            postedAt: row.postedAt,
            format: row.format,
            theme: row.theme,
            hook: row.hook,
            body: row.body,
            impressions: row.impressions,
            likes: row.likes,
            comments: row.comments,
            shares: row.shares,
            ctaType: CtaType.none,
            status: inferStatus({
              hook: row.hook,
              postedAt: row.postedAt
            })
          }
        });

        imported += 1;
      }

      await recomputeAttributionAllRanges(tx, clientId);
    });

    const needsDetails = uniqueRows.filter((row) => !row.hook || !row.postedAt).length;

    return NextResponse.json({
      imported,
      skippedDuplicates,
      needsDetails,
      switchedToRealMode,
      ...(errors.length > 0 ? { errors } : {})
    });
  } catch (error) {
    console.error(error);
    return serverError("Import failed");
  }
}
