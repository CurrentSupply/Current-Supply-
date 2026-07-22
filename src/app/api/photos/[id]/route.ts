import { NextResponse } from "next/server";
import { ensureDb } from "@/db";
import {
  clearCoverFlags,
  deletePhotoRow,
  getDeal,
  getPhoto,
  listPhotosForDeal,
  setCoverPhoto,
} from "@/lib/deals";
import { deleteUpload } from "@/lib/storage";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, { params }: Params) {
  try {
    await ensureDb();
    const { id } = await params;
    const photoId = Number(id);
    const photo = await getPhoto(photoId);
    if (!photo) {
      return NextResponse.json({ error: "Photo not found." }, { status: 404 });
    }

    await deleteUpload(photo.filename);
    const wasCover = photo.isCover;
    const dealId = photo.dealId;
    await deletePhotoRow(photoId);

    if (wasCover) {
      const remaining = await listPhotosForDeal(dealId);
      if (remaining[0]) {
        await setCoverPhoto(dealId, remaining[0].id);
      } else {
        await clearCoverFlags(dealId);
      }
    }

    const deal = await getDeal(dealId);
    return NextResponse.json(deal);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not delete photo.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
