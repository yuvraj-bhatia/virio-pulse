export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getDateRangeFromPreset } from "@/lib/date";
import { badRequest, serverError } from "@/lib/http";
import { generateInsights } from "@/lib/insights";

const requestSchema = z.object({
  clientId: z.string().min(1),
  range: z.enum(["7", "30", "90"])
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const json = await request.json();
    const parsed = requestSchema.safeParse(json);

    if (!parsed.success) {
      return badRequest(parsed.error.issues[0]?.message ?? "Invalid request");
    }

    const { startDate, endDate } = getDateRangeFromPreset(parsed.data.range);

    const data = await generateInsights({
      clientId: parsed.data.clientId,
      startDate,
      endDate
    });

    return NextResponse.json({ data });
  } catch (error) {
    console.error(error);
    return serverError();
  }
}
