import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, ensureDb } from "@/db";
import { deals, photos, parseDealOwner } from "@/db/schema";
import { getDeal } from "@/lib/deals";
import { deleteUpload } from "@/lib/storage";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  await ensureDb();
  const { id } = await params;
  const deal = await getDeal(Number(id));
  if (!deal) {
    return NextResponse.json({ error: "Deal not found." }, { status: 404 });
  }
  return NextResponse.json(deal);
}

export async function PATCH(request: Request, { params }: Params) {
  await ensureDb();
  const { id } = await params;
  const dealId = Number(id);
  const existing = await getDeal(dealId);
  if (!existing) {
    return NextResponse.json({ error: "Deal not found." }, { status: 404 });
  }

  const body = await request.json();
  const updates: Partial<typeof deals.$inferInsert> = {
    updatedAt: new Date().toISOString().replace("T", " ").slice(0, 19),
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
    updates.purchasedAt = String(body.purchasedAt).slice(0, 10);
  }
  if (body.categoryId !== undefined) {
    updates.categoryId = body.categoryId ? Number(body.categoryId) : null;
  }

  if (body.status !== undefined) {
    const status = body.status === "sold" ? "sold" : "in_stock";
    updates.status = status;
    if (status === "sold") {
      updates.soldAt = String(
        body.soldAt ?? existing.soldAt ?? new Date().toISOString(),
      ).slice(0, 10);
      if (body.price !== undefined) updates.price = Number(body.price);
    } else {
      updates.soldAt = null;
    }
  } else if (body.soldAt !== undefined) {
    updates.soldAt = body.soldAt
      ? String(body.soldAt).slice(0, 10)
      : null;
  }

  await db.update(deals).set(updates).where(eq(deals.id, dealId));
  const full = await getDeal(dealId);
  return NextResponse.json(full);
}

export async function DELETE(_request: Request, { params }: Params) {
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

  await db.delete(photos).where(eq(photos.dealId, dealId));
  await db.delete(deals).where(eq(deals.id, dealId));

  return NextResponse.json({ ok: true });
}
