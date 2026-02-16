export const dynamic = "force-dynamic";

import { OpportunityStage } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { recomputeAttributionAllRanges } from "@/lib/attribution-results";
import { prisma } from "@/lib/db";
import { badRequest, serverError } from "@/lib/http";

const createOpportunitySchema = z.object({
  clientId: z.string().min(1),
  name: z.string().min(2),
  amount: z.number().int().nonnegative(),
  stage: z.nativeEnum(OpportunityStage),
  createdAt: z.coerce.date(),
  closeDate: z.coerce.date().optional().nullable(),
  postId: z.string().optional().nullable(),
  inboundSignalId: z.string().optional().nullable(),
  meetingId: z.string().optional().nullable()
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const payload = await request.json();
    const parsed = createOpportunitySchema.safeParse(payload);
    if (!parsed.success) {
      return badRequest(parsed.error.issues[0]?.message ?? "Invalid opportunity payload");
    }

    const data = parsed.data;

    if (data.postId) {
      const post = await prisma.contentPost.findFirst({
        where: {
          id: data.postId,
          clientId: data.clientId
        },
        select: { id: true }
      });

      if (!post) {
        return badRequest("Selected post does not belong to active client");
      }
    }

    if (data.inboundSignalId) {
      const inbound = await prisma.inboundSignal.findFirst({
        where: {
          id: data.inboundSignalId,
          clientId: data.clientId
        },
        select: { id: true }
      });

      if (!inbound) {
        return badRequest("Selected inbound signal does not belong to active client");
      }
    }

    const opportunity = await prisma.$transaction(async (tx) => {
      const created = await tx.opportunity.create({
        data: {
          clientId: data.clientId,
          name: data.name.trim(),
          amount: data.amount,
          stage: data.stage,
          createdAt: data.createdAt,
          closeDate: data.closeDate ?? null,
          closedAt: data.stage === OpportunityStage.closed_won || data.stage === OpportunityStage.closed_lost ? data.closeDate ?? null : null,
          postId: data.postId?.trim() ? data.postId : null,
          inboundSignalId: data.inboundSignalId?.trim() ? data.inboundSignalId : null,
          meetingId: data.meetingId?.trim() ? data.meetingId : null
        }
      });
      await recomputeAttributionAllRanges(tx, data.clientId);
      return created;
    });

    return NextResponse.json({ data: opportunity }, { status: 201 });
  } catch (error) {
    console.error(error);
    return serverError("Failed to create opportunity");
  }
}
