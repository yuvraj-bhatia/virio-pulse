export const dynamic = "force-dynamic";

import { CtaType, PostFormat, PostStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { recomputeAttributionAllRanges } from "@/lib/attribution-results";
import { prisma } from "@/lib/db";
import { badRequest, serverError } from "@/lib/http";
import { prepareClientForRealDataImport } from "@/lib/workspace-data";

const importRowSchema = z.object({
  postedAt: z.string().min(1),
  format: z.nativeEnum(PostFormat),
  theme: z.string().min(1),
  hook: z.string().min(1),
  impressions: z.number().int().nonnegative(),
  likes: z.number().int().nonnegative().optional(),
  comments: z.number().int().nonnegative().optional(),
  shares: z.number().int().nonnegative().optional(),
  body: z.string().optional(),
  postUrl: z.string().optional()
});

const importSchema = z.object({
  clientId: z.string().min(1),
  executiveId: z.string().min(1),
  rows: z.array(importRowSchema).min(1)
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const payload = await request.json();
    const parsed = importSchema.safeParse(payload);

    if (!parsed.success) {
      return badRequest(parsed.error.issues[0]?.message ?? "Invalid import payload");
    }

    const { clientId, executiveId, rows } = parsed.data;

    const executive = await prisma.executive.findFirst({
      where: {
        id: executiveId,
        clientId
      },
      select: { id: true }
    });

    if (!executive) {
      return badRequest("Selected executive does not belong to active client");
    }

    let created = 0;
    let updated = 0;
    let switchedToRealMode = false;

    await prisma.$transaction(async (tx) => {
      const modeResult = await prepareClientForRealDataImport(tx, clientId);
      switchedToRealMode = modeResult.clearedSampleData;

      for (const row of rows) {
        const postedAt = new Date(row.postedAt);
        if (Number.isNaN(postedAt.getTime())) {
          throw new Error(`Invalid postedAt value: ${row.postedAt}`);
        }

        const postUrl = row.postUrl?.trim() ? row.postUrl.trim() : null;

        const existing = postUrl
          ? await tx.contentPost.findUnique({
              where: {
                clientId_postUrl: {
                  clientId,
                  postUrl
                }
              },
              select: { id: true }
            })
          : await tx.contentPost.findFirst({
              where: {
                clientId,
                hook: row.hook,
                postedAt
              },
              select: { id: true }
            });

        const writeData = {
          clientId,
          executiveId,
          postedAt,
          format: row.format,
          theme: row.theme,
          hook: row.hook,
          body: row.body?.trim() ?? "",
          impressions: row.impressions,
          likes: row.likes ?? 0,
          comments: row.comments ?? 0,
          shares: row.shares ?? 0,
          postUrl,
          ctaType: CtaType.none,
          status: PostStatus.posted
        };

        if (existing) {
          await tx.contentPost.update({
            where: { id: existing.id },
            data: writeData
          });
          updated += 1;
        } else {
          await tx.contentPost.create({ data: writeData });
          created += 1;
        }
      }

      await recomputeAttributionAllRanges(tx, clientId);
    });

    return NextResponse.json({
      data: {
        imported: created + updated,
        created,
        updated,
        switchedToRealMode
      }
    });
  } catch (error) {
    console.error(error);
    return serverError("Import failed");
  }
}
