export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";

import { getDateRangeFromPreset } from "@/lib/date";
import { prisma } from "@/lib/db";
import { badRequest, serverError } from "@/lib/http";
import { parseDateRange } from "@/lib/params";

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const clientId = request.nextUrl.searchParams.get("clientId");
    if (!clientId) {
      return badRequest("Missing clientId");
    }

    const range = parseDateRange(request.nextUrl.searchParams.get("range"));
    const { startDate, endDate } = getDateRangeFromPreset(range);
    const rangeDays = Number(range);

    const [posts, postsReady, inbounds, opportunities, reports, attributionRows, client, latestAttribution] = await Promise.all([
      prisma.contentPost.count({ where: { clientId } }),
      prisma.contentPost.count({
        where: {
          clientId,
          hook: { not: null },
          postedAt: { not: null }
        }
      }),
      prisma.inboundSignal.count({ where: { clientId } }),
      prisma.opportunity.count({ where: { clientId } }),
      prisma.report.count({ where: { clientId } }),
      prisma.attributionResult.count({
        where: {
          clientId,
          windowRangeDays: rangeDays,
          OR: [{ meetingsInfluencedCount: { gt: 0 } }, { pipelineCreatedAmount: { gt: 0 } }, { revenueWonAmount: { gt: 0 } }]
        }
      }),
      prisma.client.findUnique({
        where: { id: clientId },
        select: { name: true }
      }),
      prisma.attributionResult.findFirst({
        where: { clientId, windowRangeDays: rangeDays },
        orderBy: { computedAt: "desc" },
        select: { computedAt: true }
      })
    ]);

    return NextResponse.json({
      data: {
        clientName: client?.name ?? "Unknown client",
        range,
        posts,
        postsReady,
        inbounds,
        opportunities,
        reports,
        attributionRows,
        lastAttributionComputedAt: latestAttribution?.computedAt?.toISOString() ?? null,
        isEmptyWorkspace: posts === 0 && inbounds === 0 && opportunities === 0,
        rangeStart: startDate.toISOString(),
        rangeEnd: endDate.toISOString()
      }
    });
  } catch (error) {
    console.error(error);
    return serverError("Failed to load demo checklist state");
  }
}
