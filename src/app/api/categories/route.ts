import { NextResponse } from "next/server";
import { db, ensureDb } from "@/db";
import { categories } from "@/db/schema";
import { listCategories } from "@/lib/deals";

export async function GET() {
  await ensureDb();
  const rows = await listCategories();
  return NextResponse.json(rows);
}

export async function POST(request: Request) {
  await ensureDb();
  const body = await request.json();
  const name = String(body.name ?? "").trim();
  if (!name) {
    return NextResponse.json({ error: "Name is required." }, { status: 400 });
  }

  try {
    const [created] = await db.insert(categories).values({ name }).returning();
    return NextResponse.json(created, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "A category with that name already exists." },
      { status: 409 },
    );
  }
}
