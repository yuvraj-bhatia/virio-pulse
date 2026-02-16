export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";

import { getPostDetail } from "@/lib/analytics";
import { badRequest, serverError } from "@/lib/http";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  try {
    const id = params.id;
    if (!id) return badRequest("Missing id");

    const detail = await getPostDetail(id);
    if (!detail.post) {
      return badRequest("Post not found", 404);
    }

    return NextResponse.json({ data: detail });
  } catch (error) {
    console.error(error);
    return serverError();
  }
}
