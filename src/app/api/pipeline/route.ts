export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";

import { getPipelineData } from "@/lib/analytics";
import { getDateRangeFromPreset } from "@/lib/date";
import { badRequest, serverError } from "@/lib/http";
import { parseDateRange } from "@/lib/params";

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const clientId = request.nextUrl.searchParams.get("clientId");
    if (!clientId) return badRequest("Missing clientId");

    const range = parseDateRange(request.nextUrl.searchParams.get("range"));
    const { startDate, endDate } = getDateRangeFromPreset(range);

    const data = await getPipelineData({ clientId, startDate, endDate });

    return NextResponse.json({ data });
  } catch (error) {
    console.error(error);
    return serverError();
  }
}
