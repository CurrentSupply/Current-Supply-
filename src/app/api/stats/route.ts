import { NextResponse } from "next/server";
import { ensureDb } from "@/db";
import { getDashboardStats } from "@/lib/deals";

export async function GET() {
  try {
    await ensureDb();
    const stats = await getDashboardStats();
    return NextResponse.json(stats);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load stats.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
