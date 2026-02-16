export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { recomputeAttributionAllRanges, recomputeAttributionRange } from "@/lib/attribution-results";
import { prisma } from "@/lib/db";
import { badRequest, serverError } from "@/lib/http";

const payloadSchema = z.object({
  clientId: z.string().min(1),
  rangeDays: z.union([z.literal(7), z.literal(30), z.literal(90)]).optional()
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const payload = await request.json();
    const parsed = payloadSchema.safeParse(payload);

    if (!parsed.success) {
      return badRequest(parsed.error.issues[0]?.message ?? "Invalid recompute payload");
    }

    if (parsed.data.rangeDays) {
      const result = await recomputeAttributionRange(prisma, parsed.data.clientId, parsed.data.rangeDays);
      return NextResponse.json({
        data: {
          ranges: [
            {
              rangeDays: parsed.data.rangeDays,
              computedAt: result.computedAt.toISOString(),
              rows: result.rows
            }
          ]
        }
      });
    }

    const results = await recomputeAttributionAllRanges(prisma, parsed.data.clientId);
    return NextResponse.json({
      data: {
        ranges: results.map((result) => ({
          rangeDays: result.rangeDays,
          computedAt: result.computedAt.toISOString(),
          rows: result.rows
        }))
      }
    });
  } catch (error) {
    console.error(error);
    return serverError("Failed to recompute attribution");
  }
}
