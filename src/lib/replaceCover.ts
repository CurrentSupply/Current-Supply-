import type { Photo } from "@/db/schema";
import {
  deletePhotoRow,
  setCoverPhoto,
} from "@/lib/deals";
import { deleteUpload } from "@/lib/storage";

export function pickCoverPhoto(photos: Photo[]): Photo | null {
  return photos.find((p) => p.isCover) ?? photos[0] ?? null;
}

/**
 * Make `newPhotoId` the cover and delete the previous cover (DB + storage).
 * Gallery photos that were not cover are left alone.
 */
export async function promoteCoverAndRetirePrevious(
  dealId: number,
  newPhotoId: number,
  previousCover: Photo | null,
): Promise<void> {
  await setCoverPhoto(dealId, newPhotoId);
  if (!previousCover || previousCover.id === newPhotoId) return;

  await deleteUpload(previousCover.filename);
  await deletePhotoRow(previousCover.id);
}
