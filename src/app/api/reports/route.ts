export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";

import { badRequest, serverError } from "@/lib/http";
import { listReports } from "@/lib/reports";

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const clientId = request.nextUrl.searchParams.get("clientId");
    if (!clientId) return badRequest("Missing clientId");

    const reports = await listReports(clientId);
    return NextResponse.json({ data: reports });
  } catch (error) {
    console.error(error);
    return serverError();
  }
}
