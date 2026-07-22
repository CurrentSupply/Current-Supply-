import { NextResponse } from "next/server";

export function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export function jsonCatch(err: unknown, fallback: string, status = 500) {
  const message = err instanceof Error ? err.message : fallback;
  return jsonError(message, status);
}
