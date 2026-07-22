import { NextResponse } from "next/server";
import { ensureDb } from "@/db";
import { parseDealCondition, parseDealOwner } from "@/db/schema";
import { deleteDeal, getDeal, updateDeal } from "@/lib/deals";
import {
  removeDealFromGoogleSheet,
  syncDealToGoogleSheet,
} from "@/lib/googleSheets";
import { deleteUpload } from "@/lib/storage";

type Params = { params: Promise<{ id: string }> };

function parseDealId(raw: string): number | null {
  const id = Number(raw);
  return Number.isFinite(id) && id > 0 ? id : null;
}

export async function GET(_request: Request, { params }: Params) {
  try {
    await ensureDb();
    const { id } = await params;
    const dealId = parseDealId(id);
    if (dealId === null) {
      return NextResponse.json({ error: "Deal not found." }, { status: 404 });
    }
    const deal = await getDeal(dealId);
    if (!deal) {
      return NextResponse.json({ error: "Deal not found." }, { status: 404 });
    }
    return NextResponse.json(deal);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load deal.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    await ensureDb();
    const { id } = await params;
    const dealId = parseDealId(id);
    if (dealId === null) {
      return NextResponse.json({ error: "Deal not found." }, { status: 404 });
    }
    const existing = await getDeal(dealId);
    if (!existing) {
      return NextResponse.json({ error: "Deal not found." }, { status: 404 });
    }

    const body = await request.json();
    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (body.name !== undefined) updates.name = String(body.name).trim();
    if (body.size !== undefined) updates.size = String(body.size).trim();
    if (body.cost !== undefined) updates.cost = Number(body.cost);
    if (body.price !== undefined) updates.price = Number(body.price);
    if (body.condition !== undefined) {
      updates.condition = parseDealCondition(body.condition);
    }
    if (body.hasBox !== undefined) updates.has_box = Boolean(body.hasBox);
    if (body.hasInsoles !== undefined) {
      updates.has_insoles = Boolean(body.hasInsoles);
    }
    if (body.notes !== undefined) updates.notes = String(body.notes);
    if (body.platform !== undefined) updates.platform = String(body.platform);
    if (body.owner !== undefined) updates.owner = parseDealOwner(body.owner);
    if (body.purchasedAt !== undefined) {
      updates.purchased_at = String(body.purchasedAt).slice(0, 10);
    }
    if (body.categoryId !== undefined) {
      updates.category_id = body.categoryId ? Number(body.categoryId) : null;
    }

    if (body.status !== undefined) {
      const status = body.status === "sold" ? "sold" : "in_stock";
      updates.status = status;
      if (status === "sold") {
        const explicit =
          body.soldAt !== undefined && body.soldAt !== null && body.soldAt !== ""
            ? String(body.soldAt).slice(0, 10)
            : null;
        updates.sold_at =
          explicit ||
          (existing.soldAt ? String(existing.soldAt).slice(0, 10) : null) ||
          new Date().toISOString().slice(0, 10);
        if (body.price !== undefined) updates.price = Number(body.price);
      } else {
        updates.sold_at = null;
      }
    } else if (body.soldAt !== undefined) {
      // Allow correcting sold date on already-sold deals without re-sending status.
      updates.sold_at = body.soldAt ? String(body.soldAt).slice(0, 10) : null;
      if (body.soldAt && existing.status !== "sold") {
        updates.status = "sold";
      }
      if (!body.soldAt && existing.status === "sold") {
        updates.status = "in_stock";
      }
    }

    const full = await updateDeal(dealId, updates);
    void syncDealToGoogleSheet(full);
    return NextResponse.json(full);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not update deal.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    await ensureDb();
    const { id } = await params;
    const dealId = parseDealId(id);
    if (dealId === null) {
      return NextResponse.json({ error: "Deal not found." }, { status: 404 });
    }
    const existing = await getDeal(dealId);
    if (!existing) {
      return NextResponse.json({ error: "Deal not found." }, { status: 404 });
    }

    for (const photo of existing.photos) {
      await deleteUpload(photo.filename);
    }

    await deleteDeal(dealId);
    void removeDealFromGoogleSheet(dealId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not delete deal.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
