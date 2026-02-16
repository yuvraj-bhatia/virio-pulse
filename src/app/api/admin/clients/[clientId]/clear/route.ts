export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { badRequest, serverError } from "@/lib/http";
import { clearClientWorkspaceData, setClientDataMode } from "@/lib/workspace-data";

const paramsSchema = z.object({
  clientId: z.string().min(1)
});

export async function POST(
  _request: Request,
  { params }: { params: { clientId: string } }
): Promise<NextResponse> {
  try {
    const parsed = paramsSchema.safeParse(params);
    if (!parsed.success) {
      return badRequest(parsed.error.issues[0]?.message ?? "Invalid clientId");
    }

    const result = await prisma.$transaction(async (tx) => {
      const clearResult = await clearClientWorkspaceData(tx, parsed.data.clientId);
      await setClientDataMode(tx, parsed.data.clientId, "real");
      return clearResult;
    });

    return NextResponse.json({
      data: {
        message: "Workspace cleared",
        ...result
      }
    });
  } catch (error) {
    console.error(error);
    if (error instanceof Error && error.message === "Client not found") {
      return badRequest("Client not found", 404);
    }
    return serverError("Failed to clear workspace data");
  }
}
