export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";

import { getAttributionRows, toCSV } from "@/lib/analytics";
import { getDateRangeFromPreset } from "@/lib/date";
import { badRequest, serverError } from "@/lib/http";
import { parseDateRange } from "@/lib/params";

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const clientId = request.nextUrl.searchParams.get("clientId");
    if (!clientId) return badRequest("Missing clientId");

    const range = parseDateRange(request.nextUrl.searchParams.get("range"));
    const { startDate, endDate } = getDateRangeFromPreset(range);

    const rows = await getAttributionRows({ clientId, startDate, endDate });
    const csv = toCSV(rows);

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="pulse-attribution-${range}.csv"`
      }
    });
  } catch (error) {
    console.error(error);
    return serverError();
  }
}
