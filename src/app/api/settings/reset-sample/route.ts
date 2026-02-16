export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { badRequest, serverError } from "@/lib/http";
import { resetClientToSampleData } from "@/lib/sample-data";

const resetSchema = z.object({
  clientId: z.string().min(1)
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const payload = await request.json();
    const parsed = resetSchema.safeParse(payload);

    if (!parsed.success) {
      return badRequest(parsed.error.issues[0]?.message ?? "Invalid reset payload");
    }

    const result = await prisma.$transaction((tx) => resetClientToSampleData(tx, parsed.data.clientId));

    return NextResponse.json({
      data: {
        message: "Sample data loaded",
        ...result
      }
    });
  } catch (error) {
    console.error(error);
    return serverError("Failed to reset sample data");
  }
}
