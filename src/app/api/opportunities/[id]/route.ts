export const dynamic = "force-dynamic";

import { OpportunityStage } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { recomputeAttributionAllRanges } from "@/lib/attribution-results";
import { prisma } from "@/lib/db";
import { badRequest, serverError } from "@/lib/http";

const updateSchema = z.object({
  clientId: z.string().min(1),
  stage: z.nativeEnum(OpportunityStage).optional(),
  amount: z.number().int().nonnegative().optional(),
  name: z.string().min(2).optional(),
  closeDate: z.coerce.date().optional().nullable(),
  postId: z.string().optional().nullable(),
  inboundSignalId: z.string().optional().nullable()
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  try {
    if (!params.id) {
      return badRequest("Missing opportunity id");
    }

    const payload = await request.json();
    const parsed = updateSchema.safeParse(payload);
    if (!parsed.success) {
      return badRequest(parsed.error.issues[0]?.message ?? "Invalid update payload");
    }

    const data = parsed.data;
    const existing = await prisma.opportunity.findUnique({
      where: { id: params.id },
      select: { id: true, clientId: true }
    });

    if (!existing || existing.clientId !== data.clientId) {
      return badRequest("Opportunity not found for client", 404);
    }

    if (data.postId) {
      const post = await prisma.contentPost.findFirst({
        where: { id: data.postId, clientId: data.clientId },
        select: { id: true }
      });
      if (!post) {
        return badRequest("Selected post does not belong to active client");
      }
    }

    if (data.inboundSignalId) {
      const inbound = await prisma.inboundSignal.findFirst({
        where: { id: data.inboundSignalId, clientId: data.clientId },
        select: { id: true }
      });
      if (!inbound) {
        return badRequest("Selected inbound signal does not belong to active client");
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      const closedAt =
        data.stage === OpportunityStage.closed_won || data.stage === OpportunityStage.closed_lost
          ? data.closeDate ?? new Date()
          : null;

      const row = await tx.opportunity.update({
        where: { id: params.id },
        data: {
          ...(data.stage ? { stage: data.stage } : {}),
          ...(data.amount !== undefined ? { amount: data.amount } : {}),
          ...(data.name ? { name: data.name.trim() } : {}),
          ...(data.closeDate !== undefined ? { closeDate: data.closeDate } : {}),
          ...(data.stage ? { closedAt } : {}),
          ...(data.postId !== undefined ? { postId: data.postId?.trim() || null } : {}),
          ...(data.inboundSignalId !== undefined ? { inboundSignalId: data.inboundSignalId?.trim() || null } : {})
        }
      });

      await recomputeAttributionAllRanges(tx, data.clientId);
      return row;
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error(error);
    return serverError("Failed to update opportunity");
  }
}
