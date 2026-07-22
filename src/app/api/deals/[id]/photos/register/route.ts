import { NextResponse } from "next/server";
import { ensureDb } from "@/db";
import type { Photo } from "@/db/schema";
import { jsonCatch, jsonError } from "@/lib/apiResponse";
import {
  getDeal,
  insertPhoto,
  listPhotosForDeal,
  setCoverPhoto,
} from "@/lib/deals";
import {
  ALLOWED_IMAGE_TYPES,
  MAX_PHOTO_BYTES,
} from "@/lib/photoLimits";
import {
  DEAL_PHOTOS_BUCKET,
  getSupabaseUrl,
} from "@/lib/supabase";

type Params = { params: Promise<{ id: string }> };

type RegisterBody = {
  path?: string;
  originalName?: string;
  contentType?: string;
  fileSize?: number;
  isCover?: boolean;
};

function publicUrlForPath(path: string): string {
  const base = getSupabaseUrl().replace(/\/$/, "");
  return `${base}/storage/v1/object/public/${DEAL_PHOTOS_BUCKET}/${path.replace(/^\/+/, "")}`;
}

export async function POST(request: Request, { params }: Params) {
  try {
    await ensureDb();
    const { id } = await params;
    const dealId = Number(id);
    const deal = await getDeal(dealId);
    if (!deal) {
      return jsonError("Deal not found.", 404);
    }

    const body = (await request.json()) as RegisterBody;
    const path = String(body.path || "").replace(/^\/+/, "");
    const originalName = String(
      body.originalName || path.split("/").pop() || "photo.jpg",
    );
    const contentType = String(body.contentType || "").toLowerCase();
    const fileSize = Number(body.fileSize ?? 0);
    const wantCover = Boolean(body.isCover);

    if (!path) {
      return jsonError("Missing path.", 400);
    }

    // Path must be scoped to this deal (signed upload naming convention).
    if (!path.startsWith(`${dealId}-`) || path.includes("..") || path.includes("/")) {
      return jsonError("Invalid storage path.", 400);
    }

    if (contentType && !ALLOWED_IMAGE_TYPES.has(contentType)) {
      return jsonError(`Unsupported file type: ${contentType}`, 400);
    }

    if (fileSize > MAX_PHOTO_BYTES) {
      return jsonError(`${originalName} is larger than 8MB.`, 400);
    }

    const existingPhotos = await listPhotosForDeal(dealId);
    const maxOrder = existingPhotos.reduce(
      (max, p) => Math.max(max, p.sortOrder),
      -1,
    );
    const makeCover = wantCover || existingPhotos.length === 0;

    const row = await insertPhoto({
      dealId,
      filename: publicUrlForPath(path),
      originalName,
      isCover: makeCover,
      sortOrder: maxOrder + 1,
    });

    if (makeCover) {
      await setCoverPhoto(dealId, row.id);
    }

    const created: Photo[] = [row];
    const full = await getDeal(dealId);
    return NextResponse.json({ photos: created, deal: full }, { status: 201 });
  } catch (err) {
    return jsonCatch(err, "Could not register photo.");
  }
}
