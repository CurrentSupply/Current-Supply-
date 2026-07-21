import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, ensureDb } from "@/db";
import { deals } from "@/db/schema";
import { getDeal, listDeals, type DealFilters } from "@/lib/deals";

export async function GET(request: Request) {
  await ensureDb();
  const { searchParams } = new URL(request.url);

  const filters: DealFilters = {
    q: searchParams.get("q") ?? undefined,
    status: (searchParams.get("status") as DealFilters["status"]) ?? "all",
    size: searchParams.get("size") ?? undefined,
    purchasedFrom: searchParams.get("purchasedFrom") ?? undefined,
    purchasedTo: searchParams.get("purchasedTo") ?? undefined,
    sort: (searchParams.get("sort") as DealFilters["sort"]) ?? "newest",
  };

  const categoryId = searchParams.get("categoryId");
  if (categoryId && categoryId !== "all") {
    filters.categoryId = Number(categoryId);
  }

  const rows = await listDeals(filters);
  return NextResponse.json(rows);
}

export async function POST(request: Request) {
  await ensureDb();
  const body = await request.json();

  const name = String(body.name ?? "").trim();
  const size = String(body.size ?? "").trim();
  const cost = Number(body.cost);
  const price = Number(body.price);
  const purchasedAt = String(body.purchasedAt ?? "").slice(0, 10);

  if (!name || !size || Number.isNaN(cost) || Number.isNaN(price) || !purchasedAt) {
    return NextResponse.json(
      { error: "Name, size, cost, price, and purchase date are required." },
      { status: 400 },
    );
  }

  const status = body.status === "sold" ? "sold" : "in_stock";
  const soldAt =
    status === "sold"
      ? String(body.soldAt ?? new Date().toISOString()).slice(0, 10)
      : null;

  const [created] = await db
    .insert(deals)
    .values({
      name,
      size,
      cost,
      price,
      condition: String(body.condition ?? ""),
      categoryId: body.categoryId ? Number(body.categoryId) : null,
      status,
      purchasedAt,
      soldAt,
      notes: String(body.notes ?? ""),
      platform: String(body.platform ?? ""),
    })
    .returning();

  const full = await getDeal(created.id);
  return NextResponse.json(full, { status: 201 });
}
