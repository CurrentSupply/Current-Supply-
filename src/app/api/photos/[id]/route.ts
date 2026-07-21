import { NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { db, ensureDb } from "@/db";
import { photos } from "@/db/schema";
import { getDeal } from "@/lib/deals";
import { deleteUpload } from "@/lib/storage";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, { params }: Params) {
  await ensureDb();
  const { id } = await params;
  const photoId = Number(id);

  const [photo] = await db.select().from(photos).where(eq(photos.id, photoId));
  if (!photo) {
    return NextResponse.json({ error: "Photo not found." }, { status: 404 });
  }

  await deleteUpload(photo.filename);

  const wasCover = photo.isCover;
  const dealId = photo.dealId;

  await db.delete(photos).where(eq(photos.id, photoId));

  if (wasCover) {
    const [next] = await db
      .select()
      .from(photos)
      .where(eq(photos.dealId, dealId))
      .orderBy(asc(photos.sortOrder))
      .limit(1);
    if (next) {
      await db
        .update(photos)
        .set({ isCover: true })
        .where(eq(photos.id, next.id));
    }
  }

  const deal = await getDeal(dealId);
  return NextResponse.json(deal);
}
