export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getDateRangeFromPreset } from "@/lib/date";
import { badRequest, serverError } from "@/lib/http";
import { generateWeeklyReport } from "@/lib/reports";

const payloadSchema = z.object({
  clientId: z.string().min(1),
  range: z.enum(["7", "30", "90"]),
  viewMode: z.enum(["internal", "client_safe"])
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const payload = await request.json();
    const parsed = payloadSchema.safeParse(payload);
    if (!parsed.success) {
      return badRequest(parsed.error.issues[0]?.message ?? "Invalid request");
    }

    const { startDate, endDate } = getDateRangeFromPreset(parsed.data.range);

    const report = await generateWeeklyReport({
      clientId: parsed.data.clientId,
      rangePreset: parsed.data.range,
      startDate,
      endDate,
      viewMode: parsed.data.viewMode
    });

    return NextResponse.json({ data: report }, { status: 201 });
  } catch (error) {
    console.error(error);
    return serverError();
  }
}
