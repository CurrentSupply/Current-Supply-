import { NextResponse } from "next/server";
import { ensureDb } from "@/db";
import { listCategories } from "@/lib/deals";
import { jsonCatch } from "@/lib/apiResponse";

export async function GET() {
  try {
    await ensureDb();
    const rows = await listCategories();
    return NextResponse.json(rows);
  } catch (err) {
    return jsonCatch(err, "Failed to load categories.");
  }
}
