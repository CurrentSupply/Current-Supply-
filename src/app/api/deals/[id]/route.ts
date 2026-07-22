import { NextResponse } from "next/server";
import { ensureDb } from "@/db";
import { parseDealOwner } from "@/db/schema";
import { deleteDeal, getDeal, updateDeal } from "@/lib/deals";
import { deleteUpload } from "@/lib/storage";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    await ensureDb();
    const { id } = await params;
    const deal = await getDeal(Number(id));
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
    const dealId = Number(id);
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
    if (body.condition !== undefined) updates.condition = String(body.condition);
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
        updates.sold_at = String(
          body.soldAt ?? existing.soldAt ?? new Date().toISOString(),
        ).slice(0, 10);
        if (body.price !== undefined) updates.price = Number(body.price);
      } else {
        updates.sold_at = null;
      }
    } else if (body.soldAt !== undefined) {
      updates.sold_at = body.soldAt ? String(body.soldAt).slice(0, 10) : null;
    }

    const full = await updateDeal(dealId, updates);
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
    const dealId = Number(id);
    const existing = await getDeal(dealId);
    if (!existing) {
      return NextResponse.json({ error: "Deal not found." }, { status: 404 });
    }

    for (const photo of existing.photos) {
      await deleteUpload(photo.filename);
    }

    await deleteDeal(dealId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not delete deal.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
