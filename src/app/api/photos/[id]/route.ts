import { NextResponse } from "next/server";
import { ensureDb } from "@/db";
import { jsonCatch, jsonError } from "@/lib/apiResponse";
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
      return jsonError("Photo not found.", 404);
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
    return jsonCatch(err, "Could not delete photo.");
  }
}
