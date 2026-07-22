import { NextResponse } from "next/server";
import { ensureDb } from "@/db";
import { getDashboardStats } from "@/lib/deals";
import { jsonCatch } from "@/lib/apiResponse";

export async function GET() {
  try {
    await ensureDb();
    const stats = await getDashboardStats();
    return NextResponse.json(stats);
  } catch (err) {
    return jsonCatch(err, "Failed to load stats.");
  }
}
