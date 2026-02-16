export const dynamic = "force-dynamic";

import { CtaType, PostStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { badRequest, serverError } from "@/lib/http";
import { dedupeImportRows, normalizeLinkedInUrl, normalizePostFormat } from "@/lib/linkedin";
import { prepareClientForRealDataImport } from "@/lib/workspace-data";

const importRowSchema = z.object({
  postUrl: z.string().optional().nullable(),
  postedAt: z.string().min(1),
  hook: z.string().min(5),
  theme: z.string().optional(),
  format: z.string().optional(),
  body: z.string().optional()
});

const importSchema = z.object({
  clientId: z.string().min(1),
  rows: z.array(importRowSchema).min(1).max(200)
});

type PreparedRow = {
  index: number;
  postUrl: string | null;
  postedAt: Date;
  hook: string;
  theme: string;
  format: ReturnType<typeof normalizePostFormat>;
  body: string;
};

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
      const postedAt = new Date(row.postedAt);
      if (Number.isNaN(postedAt.getTime())) {
        errors.push({ index, message: "postedAt must be a valid ISO date" });
        return;
      }

      const hook = row.hook.trim();
      if (hook.length < 5) {
        errors.push({ index, message: "hook must be at least 5 characters" });
        return;
      }

      const postUrl = row.postUrl?.trim() ? normalizeLinkedInUrl(row.postUrl.trim()) : null;
      if (row.postUrl?.trim() && !postUrl) {
        errors.push({ index, message: "postUrl must be a valid LinkedIn URL" });
        return;
      }

      preparedRows.push({
        index,
        postUrl,
        postedAt,
        hook,
        theme: row.theme?.trim() || "General",
        format: normalizePostFormat(row.format),
        body: row.body?.trim() || ""
      });
    });

    const { uniqueRows, skippedDuplicates } = dedupeImportRows(preparedRows);

    let imported = 0;
    let switchedToRealMode = false;

    await prisma.$transaction(async (tx) => {
      const modeResult = await prepareClientForRealDataImport(tx, clientId);
      switchedToRealMode = modeResult.clearedSampleData;

      for (const row of uniqueRows) {
        const existing = row.postUrl
          ? await tx.contentPost.findFirst({
              where: {
                clientId,
                postUrl: row.postUrl
              },
              select: {
                id: true
              }
            })
          : await tx.contentPost.findFirst({
              where: {
                clientId,
                hook: row.hook,
                postedAt: row.postedAt
              },
              select: {
                id: true
              }
            });

        if (existing) {
          await tx.contentPost.update({
            where: { id: existing.id },
            data: {
              ...(row.postUrl ? { postUrl: row.postUrl } : {}),
              postedAt: row.postedAt,
              hook: row.hook,
              theme: row.theme,
              format: row.format,
              body: row.body,
              impressions: 0,
              likes: 0,
              comments: 0,
              shares: 0
            }
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
            impressions: 0,
            likes: 0,
            comments: 0,
            shares: 0,
            ctaType: CtaType.none,
            status: PostStatus.posted
          }
        });

        imported += 1;
      }
    });

    return NextResponse.json({
      imported,
      skippedDuplicates,
      switchedToRealMode,
      ...(errors.length > 0 ? { errors } : {})
    });
  } catch (error) {
    console.error(error);
    return serverError("Import failed");
  }
}
