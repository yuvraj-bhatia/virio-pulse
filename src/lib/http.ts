import { NextResponse } from "next/server";

export function badRequest(message: string, status = 400): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

export function serverError(message = "Internal server error"): NextResponse {
  return NextResponse.json({ error: message }, { status: 500 });
}
