export const dynamic = "force-dynamic";

import { PostFormat, PostStatus, CtaType } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getContentData } from "@/lib/analytics";
import { getDateRangeFromPreset } from "@/lib/date";
import { prisma } from "@/lib/db";
import { badRequest, serverError } from "@/lib/http";
import { parseDateRange } from "@/lib/params";

const createDraftSchema = z.object({
  clientId: z.string().min(1),
  executiveId: z.string().min(1),
  theme: z.string().min(2),
  hook: z.string().min(5),
  body: z.string().min(10),
  format: z.nativeEnum(PostFormat),
  ctaType: z.nativeEnum(CtaType)
});

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const clientId = request.nextUrl.searchParams.get("clientId");
    if (!clientId) {
      return badRequest("Missing clientId");
    }

    const range = parseDateRange(request.nextUrl.searchParams.get("range"));
    const { startDate, endDate } = getDateRangeFromPreset(range);

    const data = await getContentData(
      { clientId, startDate, endDate },
      {
        executiveId: request.nextUrl.searchParams.get("executiveId") ?? undefined,
        theme: request.nextUrl.searchParams.get("theme") ?? undefined,
        format: (request.nextUrl.searchParams.get("format") as PostFormat | null) ?? undefined,
        status: (request.nextUrl.searchParams.get("status") as PostStatus | null) ?? undefined,
        search: request.nextUrl.searchParams.get("search") ?? undefined
      }
    );

    return NextResponse.json({ data });
  } catch (error) {
    console.error(error);
    return serverError();
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const payload = await request.json();
    const parsed = createDraftSchema.safeParse(payload);
    if (!parsed.success) {
      return badRequest(parsed.error.issues[0]?.message ?? "Invalid request");
    }

    const data = await prisma.contentPost.create({
      data: {
        clientId: parsed.data.clientId,
        executiveId: parsed.data.executiveId,
        postedAt: new Date(),
        format: parsed.data.format,
        theme: parsed.data.theme,
        hook: parsed.data.hook,
        body: parsed.data.body,
        impressions: 0,
        likes: 0,
        comments: 0,
        shares: 0,
        ctaType: parsed.data.ctaType,
        status: PostStatus.draft
      }
    });

    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    console.error(error);
    return serverError();
  }
}
