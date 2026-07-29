import { NextResponse } from "next/server";
import { ensureDb } from "@/db";
import { jsonCatch, jsonError } from "@/lib/apiResponse";
import { parseDealCreateBody } from "@/lib/dealPayload";
import { createDeal, type DealWithRelations } from "@/lib/deals";
import { syncDealToGoogleSheet } from "@/lib/googleSheets";

const MAX_BULK_DEALS = 50;

export async function POST(request: Request) {
  try {
    await ensureDb();
    const body = await request.json();
    const deals = Array.isArray(body?.deals) ? body.deals : null;

    if (!deals) {
      return jsonError("Body must include a deals array.", 400);
    }
    if (deals.length === 0) {
      return jsonError("Add at least one deal.", 400);
    }
    if (deals.length > MAX_BULK_DEALS) {
      return jsonError(`At most ${MAX_BULK_DEALS} deals per request.`, 400);
    }

    const created: DealWithRelations[] = [];
    const failed: { index: number; error: string }[] = [];

    for (let index = 0; index < deals.length; index += 1) {
      const parsed = parseDealCreateBody(deals[index]);
      if (!parsed.ok) {
        failed.push({ index, error: parsed.error });
        continue;
      }

      try {
        // Bulk entry is always in-stock; photos / sold flow stay on detail.
        const full = await createDeal({
          ...parsed.data,
          status: "in_stock",
          soldAt: null,
          hasBox: false,
          hasInsoles: false,
        });
        void syncDealToGoogleSheet(full);
        created.push(full);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Could not create deal.";
        const needsMigration = /has_box|has_insoles|schema cache/i.test(message);
        failed.push({
          index,
          error: needsMigration
            ? "Database needs an update. Run supabase/migrations/003_condition_box_finance.sql in the Supabase SQL Editor."
            : message,
        });
      }
    }

    // Always return the batch result so the client can map per-row failures
    // without treating a partial/total create miss as a transport error.
    return NextResponse.json(
      {
        created,
        ...(failed.length > 0 ? { failed } : {}),
      },
      { status: created.length > 0 ? 201 : 200 },
    );
  } catch (err) {
    return jsonCatch(err, "Could not create deals.");
  }
}
