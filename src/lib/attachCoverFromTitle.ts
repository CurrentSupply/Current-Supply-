import { randomUUID } from "crypto";
import {
  getDeal,
  insertPhoto,
  listPhotosForDeal,
  setCoverPhoto,
  type DealWithRelations,
} from "@/lib/deals";
import { findShoeImageFromTitle } from "@/lib/findShoeImage";
import { extForContentType } from "@/lib/photoLimits";
import { saveUpload } from "@/lib/storage";

/** Find a web photo from a deal title and save it as the cover. */
export async function attachCoverPhotoFromTitle(
  dealId: number,
  name?: string,
): Promise<DealWithRelations> {
  const deal = await getDeal(dealId);
  if (!deal) {
    throw Object.assign(new Error("Deal not found."), { status: 404 });
  }

  const existing = await listPhotosForDeal(dealId);
  if (existing.length > 0) {
    throw Object.assign(
      new Error(
        "This deal already has photos. Remove them first, or upload a replacement.",
      ),
      { status: 409 },
    );
  }

  const title = (name ?? deal.name).trim();
  if (!title) {
    throw Object.assign(new Error("Deal needs a name before finding a photo."), {
      status: 400,
    });
  }

  const found = await findShoeImageFromTitle(title);
  const ext = extForContentType(found.mimeType, "cover.jpg");
  const path = `${dealId}-${randomUUID()}${ext}`;
  const publicUrl = await saveUpload(path, found.buffer, found.mimeType);

  const row = await insertPhoto({
    dealId,
    filename: publicUrl,
    originalName: `${title.slice(0, 80)}.jpg`,
    isCover: true,
    sortOrder: 0,
  });
  await setCoverPhoto(dealId, row.id);

  const full = await getDeal(dealId);
  if (!full) {
    throw Object.assign(new Error("Photo saved but deal could not be reloaded."), {
      status: 500,
    });
  }
  return full;
}
