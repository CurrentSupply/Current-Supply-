import { NextResponse } from "next/server";
import { FINANCE_CATEGORIES, FINANCE_KINDS } from "@/db/schema";
import { jsonCatch, jsonError } from "@/lib/apiResponse";
import {
  createFinanceEntry,
  deleteFinanceEntry,
  getFinanceSummary,
} from "@/lib/finance";

export async function GET() {
  try {
    const summary = await getFinanceSummary();
    return NextResponse.json(summary);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Could not load finance data.";
    const needsMigration =
      /finance_entries|does not exist|schema cache/i.test(message);
    return jsonError(
      needsMigration
        ? "Finance table missing. Run supabase/migrations/003_condition_box_finance.sql in the Supabase SQL Editor."
        : message,
      500,
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const kind = body.kind === "in" ? "in" : body.kind === "out" ? "out" : null;
    const amount = Number(body.amount);
    const entryDate = String(body.entryDate ?? "").slice(0, 10);
    const category = String(body.category ?? "Other").trim() || "Other";
    const note = String(body.note ?? "");
    const dealId =
      body.dealId !== undefined && body.dealId !== null && body.dealId !== ""
        ? Number(body.dealId)
        : null;

    if (!kind || !FINANCE_KINDS.includes(kind)) {
      return jsonError("Kind must be in or out.", 400);
    }
    if (!entryDate || !Number.isFinite(amount) || amount < 0) {
      return jsonError("Date and a valid amount are required.", 400);
    }
    if (
      !(FINANCE_CATEGORIES as readonly string[]).includes(category)
    ) {
      return jsonError("Invalid finance category.", 400);
    }

    const entry = await createFinanceEntry({
      entryDate,
      kind,
      amount,
      category,
      note,
      dealId: dealId && Number.isFinite(dealId) ? dealId : null,
    });
    return NextResponse.json(entry, { status: 201 });
  } catch (err) {
    return jsonCatch(err, "Could not create finance entry.");
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = Number(searchParams.get("id"));
    if (!Number.isFinite(id) || id <= 0) {
      return jsonError("Invalid id.", 400);
    }
    await deleteFinanceEntry(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return jsonCatch(err, "Could not delete finance entry.");
  }
}
