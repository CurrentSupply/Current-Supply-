import { NextResponse } from "next/server";
import { and, eq, max } from "drizzle-orm";
import { db, ensureDb } from "@/db";
import { photos, type Photo } from "@/db/schema";
import { getDeal } from "@/lib/deals";
import { deleteUpload, saveUpload } from "@/lib/storage";
import { randomUUID } from "crypto";
import path from "path";

type Params = { params: Promise<{ id: string }> };

const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const MAX_BYTES = 8 * 1024 * 1024;

export async function POST(request: Request, { params }: Params) {
  await ensureDb();
  const { id } = await params;
  const dealId = Number(id);
  const deal = await getDeal(dealId);
  if (!deal) {
    return NextResponse.json({ error: "Deal not found." }, { status: 404 });
  }

  const form = await request.formData();
  const files = form.getAll("files").filter((f): f is File => f instanceof File);

  if (files.length === 0) {
    return NextResponse.json({ error: "No files uploaded." }, { status: 400 });
  }

  const [{ value: maxOrder }] = await db
    .select({ value: max(photos.sortOrder) })
    .from(photos)
    .where(eq(photos.dealId, dealId));

  let nextOrder = (maxOrder ?? -1) + 1;
  const needsCover = !deal.photos.some((p) => p.isCover) && deal.photos.length === 0;
  const created: Photo[] = [];

  for (const file of files) {
    if (!ALLOWED.has(file.type)) {
      return NextResponse.json(
        { error: `Unsupported file type: ${file.type || file.name}` },
        { status: 400 },
      );
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: `${file.name} is larger than 8MB.` },
        { status: 400 },
      );
    }

    const ext = path.extname(file.name) || ".jpg";
    const filename = `${dealId}-${randomUUID()}${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    const stored = await saveUpload(filename, buffer, file.type || "image/jpeg");

    const makeCover: boolean = needsCover && created.length === 0;

    const [row] = await db
      .insert(photos)
      .values({
        dealId,
        filename: stored,
        originalName: file.name,
        isCover: makeCover,
        sortOrder: nextOrder++,
      })
      .returning();

    created.push(row);
  }

  const full = await getDeal(dealId);
  return NextResponse.json({ photos: created, deal: full }, { status: 201 });
}

export async function PATCH(request: Request, { params }: Params) {
  await ensureDb();
  const { id } = await params;
  const dealId = Number(id);
  const body = await request.json();

  if (body.coverPhotoId) {
    await db
      .update(photos)
      .set({ isCover: false })
      .where(eq(photos.dealId, dealId));
    await db
      .update(photos)
      .set({ isCover: true })
      .where(and(eq(photos.id, Number(body.coverPhotoId)), eq(photos.dealId, dealId)));
  }

  if (Array.isArray(body.order)) {
    for (let i = 0; i < body.order.length; i++) {
      await db
        .update(photos)
        .set({ sortOrder: i })
        .where(and(eq(photos.id, Number(body.order[i])), eq(photos.dealId, dealId)));
    }
  }

  const full = await getDeal(dealId);
  return NextResponse.json(full);
}
