export const dynamic = "force-dynamic";

import { InboundSource } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { recomputeAttributionAllRanges } from "@/lib/attribution-results";
import { prisma } from "@/lib/db";
import { badRequest, serverError } from "@/lib/http";

const inboundSchema = z.object({
  clientId: z.string().min(1),
  source: z.nativeEnum(InboundSource),
  createdAt: z.coerce.date(),
  postId: z.string().optional().nullable(),
  executiveId: z.string().optional().nullable(),
  entryPointUrl: z.string().optional().nullable(),
  personName: z.string().optional().nullable(),
  company: z.string().optional().nullable(),
  title: z.string().optional().nullable()
});

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const clientId = request.nextUrl.searchParams.get("clientId");
    if (!clientId) {
      return badRequest("Missing clientId");
    }

    const rows = await prisma.inboundSignal.findMany({
      where: { clientId },
      include: {
        post: {
          select: {
            id: true,
            hook: true
          }
        }
      },
      orderBy: { createdAt: "desc" },
      take: 30
    });

    return NextResponse.json({
      data: rows.map((row) => ({
        id: row.id,
        source: row.source,
        createdAt: row.createdAt,
        personName: row.personName,
        company: row.company,
        entryPointUrl: row.entryPointUrl,
        postId: row.postId,
        postHook: row.post?.hook ?? null
      }))
    });
  } catch (error) {
    console.error(error);
    return serverError("Failed to list inbound signals");
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const payload = await request.json();
    const parsed = inboundSchema.safeParse(payload);

    if (!parsed.success) {
      return badRequest(parsed.error.issues[0]?.message ?? "Invalid inbound payload");
    }

    const data = parsed.data;

    if (data.postId) {
      const post = await prisma.contentPost.findFirst({
        where: { id: data.postId, clientId: data.clientId },
        select: { id: true }
      });
      if (!post) {
        return badRequest("Selected post does not belong to active client");
      }
    }

    if (data.executiveId) {
      const executive = await prisma.executive.findFirst({
        where: { id: data.executiveId, clientId: data.clientId },
        select: { id: true }
      });
      if (!executive) {
        return badRequest("Selected executive does not belong to active client");
      }
    }

    const inbound = await prisma.$transaction(async (tx) => {
      const created = await tx.inboundSignal.create({
        data: {
          clientId: data.clientId,
          source: data.source,
          createdAt: data.createdAt,
          postId: data.postId?.trim() ? data.postId : null,
          executiveId: data.executiveId?.trim() ? data.executiveId : null,
          entryPointUrl: data.entryPointUrl?.trim() ? data.entryPointUrl : null,
          personName: data.personName?.trim() ? data.personName : null,
          company: data.company?.trim() ? data.company : null,
          title: data.title?.trim() ? data.title : null
        }
      });
      await recomputeAttributionAllRanges(tx, data.clientId);
      return created;
    });

    return NextResponse.json({ data: inbound }, { status: 201 });
  } catch (error) {
    console.error(error);
    return serverError("Failed to add inbound signal");
  }
}
