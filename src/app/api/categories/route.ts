import { NextResponse } from "next/server";
import { ensureDb } from "@/db";
import { createCategory, listCategories } from "@/lib/deals";

export async function GET() {
  try {
    await ensureDb();
    const rows = await listCategories();
    return NextResponse.json(rows);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load categories.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await ensureDb();
    const body = await request.json();
    const name = String(body.name ?? "").trim();
    if (!name) {
      return NextResponse.json({ error: "Name is required." }, { status: 400 });
    }

    const created = await createCategory(name);
    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not create category.";
    const status = message.toLowerCase().includes("duplicate") ? 409 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
