import { NextResponse } from "next/server";
import { ensureDb } from "@/db";
import { getDashboardStats } from "@/lib/deals";

export async function GET() {
  await ensureDb();
  const stats = await getDashboardStats();
  return NextResponse.json(stats);
}
