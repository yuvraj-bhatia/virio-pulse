export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { badRequest, serverError } from "@/lib/http";

const updateSchema = z.object({
  clientId: z.string().min(1),
  attributionWindowDays: z.union([z.literal(7), z.literal(14)]).optional(),
  useSoftAttribution: z.boolean().optional()
});

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const clientId = request.nextUrl.searchParams.get("clientId");
    if (!clientId) return badRequest("Missing clientId");

    const data = await prisma.appSetting.findUnique({ where: { clientId } });

    return NextResponse.json({
      data: data ?? {
        attributionWindowDays: 7,
        useSoftAttribution: true
      }
    });
  } catch (error) {
    console.error(error);
    return serverError();
  }
}

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  try {
    const payload = await request.json();
    const parsed = updateSchema.safeParse(payload);
    if (!parsed.success) {
      return badRequest(parsed.error.issues[0]?.message ?? "Invalid request");
    }

    const data = await prisma.appSetting.upsert({
      where: { clientId: parsed.data.clientId },
      create: {
        clientId: parsed.data.clientId,
        attributionWindowDays: parsed.data.attributionWindowDays ?? 7,
        useSoftAttribution: parsed.data.useSoftAttribution ?? true
      },
      update: {
        ...(parsed.data.attributionWindowDays ? { attributionWindowDays: parsed.data.attributionWindowDays } : {}),
        ...(parsed.data.useSoftAttribution !== undefined
          ? { useSoftAttribution: parsed.data.useSoftAttribution }
          : {})
      }
    });

    return NextResponse.json({ data });
  } catch (error) {
    console.error(error);
    return serverError();
  }
}
