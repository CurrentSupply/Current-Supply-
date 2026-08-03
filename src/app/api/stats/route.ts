import { NextResponse } from "next/server";
import { ensureDb } from "@/db";
import { getDashboardStats } from "@/lib/deals";
import { jsonCatch } from "@/lib/apiResponse";
import { reportFiltersFromRequestUrl } from "@/lib/reportFilters";

export async function GET(request: Request) {
  try {
    await ensureDb();
    const filters = reportFiltersFromRequestUrl(request.url);
    const stats = await getDashboardStats(filters);
    return NextResponse.json(stats);
  } catch (err) {
    return jsonCatch(err, "Failed to load stats.");
  }
}
