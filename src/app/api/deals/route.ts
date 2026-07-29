import { NextResponse } from "next/server";
import { ensureDb } from "@/db";
import { jsonCatch, jsonError } from "@/lib/apiResponse";
import { parseDealCreateBody } from "@/lib/dealPayload";
import {
  createDeal,
  listDeals,
  type DealFilters,
} from "@/lib/deals";
import { syncDealToGoogleSheet } from "@/lib/googleSheets";

export async function GET(request: Request) {
  try {
    await ensureDb();
    const { searchParams } = new URL(request.url);

    const filters: DealFilters = {
      q: searchParams.get("q") ?? undefined,
      status: (searchParams.get("status") as DealFilters["status"]) ?? "all",
      owner: (searchParams.get("owner") as DealFilters["owner"]) ?? "all",
      size: searchParams.get("size") ?? undefined,
      purchasedFrom: searchParams.get("purchasedFrom") ?? undefined,
      purchasedTo: searchParams.get("purchasedTo") ?? undefined,
      sort: (searchParams.get("sort") as DealFilters["sort"]) ?? "newest",
    };

    const categoryId = searchParams.get("categoryId");
    if (categoryId && categoryId !== "all") {
      const parsed = Number(categoryId);
      if (Number.isFinite(parsed) && parsed > 0) {
        filters.categoryId = parsed;
      }
    }

    const rows = await listDeals(filters);
    return NextResponse.json(rows);
  } catch (err) {
    return jsonCatch(err, "Failed to load deals.");
  }
}

export async function POST(request: Request) {
  try {
    await ensureDb();
    const body = await request.json();
    const parsed = parseDealCreateBody(body);
    if (!parsed.ok) {
      return jsonError(parsed.error, 400);
    }

    const full = await createDeal(parsed.data);

    void syncDealToGoogleSheet(full);

    return NextResponse.json(full, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not create deal.";
    const needsMigration = /has_box|has_insoles|schema cache/i.test(message);
    return jsonError(
      needsMigration
        ? "Database needs an update. Run supabase/migrations/003_condition_box_finance.sql in the Supabase SQL Editor."
        : message,
      500,
    );
  }
}
