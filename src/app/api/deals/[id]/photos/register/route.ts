import { NextResponse } from "next/server";
import { ensureDb } from "@/db";
import type { Photo } from "@/db/schema";
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
      return NextResponse.json({ error: "Deal not found." }, { status: 404 });
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
      return NextResponse.json({ error: "Missing path." }, { status: 400 });
    }

    // Path must be scoped to this deal (signed upload naming convention).
    if (!path.startsWith(`${dealId}-`) || path.includes("..") || path.includes("/")) {
      return NextResponse.json({ error: "Invalid storage path." }, { status: 400 });
    }

    if (contentType && !ALLOWED_IMAGE_TYPES.has(contentType)) {
      return NextResponse.json(
        { error: `Unsupported file type: ${contentType}` },
        { status: 400 },
      );
    }

    if (fileSize > MAX_PHOTO_BYTES) {
      return NextResponse.json(
        { error: `${originalName} is larger than 8MB.` },
        { status: 400 },
      );
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
    const message =
      err instanceof Error ? err.message : "Could not register photo.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
