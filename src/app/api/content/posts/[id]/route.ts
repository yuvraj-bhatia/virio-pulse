export const dynamic = "force-dynamic";

import { PostFormat, PostStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { recomputeAttributionAllRanges } from "@/lib/attribution-results";
import { getPostDetail } from "@/lib/analytics";
import { prisma } from "@/lib/db";
import { badRequest, serverError } from "@/lib/http";
import { normalizeLinkedInUrl } from "@/lib/linkedin";

const updateSchema = z.object({
  clientId: z.string().min(1),
  hook: z.string().optional().nullable(),
  postedAt: z.string().optional().nullable(),
  theme: z.string().optional(),
  format: z.nativeEnum(PostFormat).optional(),
  body: z.string().optional().nullable(),
  postUrl: z.string().optional().nullable(),
  impressions: z.number().int().nonnegative().optional(),
  likes: z.number().int().nonnegative().optional(),
  comments: z.number().int().nonnegative().optional(),
  shares: z.number().int().nonnegative().optional(),
  status: z.nativeEnum(PostStatus).optional()
});

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  try {
    const id = params.id;
    if (!id) return badRequest("Missing id");

    const detail = await getPostDetail(id);
    if (!detail.post) {
      return badRequest("Post not found", 404);
    }

    return NextResponse.json({ data: detail });
  } catch (error) {
    console.error(error);
    return serverError();
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  try {
    if (!params.id) {
      return badRequest("Missing post id");
    }

    const payload = await request.json();
    const parsed = updateSchema.safeParse(payload);

    if (!parsed.success) {
      return badRequest(parsed.error.issues[0]?.message ?? "Invalid post update payload");
    }

    const existing = await prisma.contentPost.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        clientId: true,
        status: true,
        hook: true,
        postedAt: true
      }
    });

    if (!existing || existing.clientId !== parsed.data.clientId) {
      return badRequest("Post not found for active client", 404);
    }

    const postedAt =
      parsed.data.postedAt === undefined
        ? undefined
        : parsed.data.postedAt
          ? new Date(parsed.data.postedAt)
          : null;

    if (postedAt && Number.isNaN(postedAt.getTime())) {
      return badRequest("postedAt must be a valid date");
    }

    const normalizedPostUrl =
      parsed.data.postUrl === undefined
        ? undefined
        : parsed.data.postUrl?.trim()
          ? normalizeLinkedInUrl(parsed.data.postUrl.trim())
          : null;

    if (parsed.data.postUrl?.trim() && !normalizedPostUrl) {
      return badRequest("postUrl must be a valid LinkedIn URL");
    }

    const hookValue =
      parsed.data.hook === undefined
        ? undefined
        : parsed.data.hook && parsed.data.hook.trim().length > 0
          ? parsed.data.hook.trim()
          : null;

    if (hookValue !== undefined && hookValue !== null && hookValue.length < 5) {
      return badRequest("hook must be at least 5 characters");
    }

    const updated = await prisma.$transaction(async (tx) => {
      const tentativeHook = hookValue !== undefined ? hookValue : existing.hook;
      const tentativePostedAt = postedAt !== undefined ? postedAt : existing.postedAt;
      const autoStatus =
        parsed.data.status ??
        (existing.status === PostStatus.posted
          ? PostStatus.posted
          : tentativeHook && tentativePostedAt
            ? PostStatus.ready
            : PostStatus.needs_details);

      const row = await tx.contentPost.update({
        where: { id: params.id },
        data: {
          ...(hookValue !== undefined ? { hook: hookValue } : {}),
          ...(postedAt !== undefined ? { postedAt } : {}),
          ...(parsed.data.theme !== undefined ? { theme: parsed.data.theme.trim() || "General" } : {}),
          ...(parsed.data.format !== undefined ? { format: parsed.data.format } : {}),
          ...(parsed.data.body !== undefined ? { body: parsed.data.body?.trim() || null } : {}),
          ...(normalizedPostUrl !== undefined ? { postUrl: normalizedPostUrl } : {}),
          ...(parsed.data.impressions !== undefined ? { impressions: parsed.data.impressions } : {}),
          ...(parsed.data.likes !== undefined ? { likes: parsed.data.likes } : {}),
          ...(parsed.data.comments !== undefined ? { comments: parsed.data.comments } : {}),
          ...(parsed.data.shares !== undefined ? { shares: parsed.data.shares } : {}),
          status: autoStatus
        }
      });
      await recomputeAttributionAllRanges(tx, parsed.data.clientId);
      return row;
    });

    const becameReady =
      existing.status === PostStatus.needs_details && updated.status === PostStatus.ready;

    return NextResponse.json({
      data: updated,
      meta: {
        becameReady
      }
    });
  } catch (error) {
    console.error(error);
    return serverError("Failed to update post");
  }
}
