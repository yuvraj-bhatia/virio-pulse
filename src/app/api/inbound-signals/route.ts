export const dynamic = "force-dynamic";

import { InboundSource } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

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

    const inbound = await prisma.inboundSignal.create({
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

    return NextResponse.json({ data: inbound }, { status: 201 });
  } catch (error) {
    console.error(error);
    return serverError("Failed to add inbound signal");
  }
}
