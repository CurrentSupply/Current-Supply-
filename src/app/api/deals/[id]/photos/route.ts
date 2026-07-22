import { NextResponse } from "next/server";
import { ensureDb } from "@/db";
import type { Photo } from "@/db/schema";
import {
  getDeal,
  insertPhoto,
  listPhotosForDeal,
  setCoverPhoto,
  setPhotoSortOrder,
} from "@/lib/deals";
import { saveUpload } from "@/lib/storage";
import { randomUUID } from "crypto";
import path from "path";

type Params = { params: Promise<{ id: string }> };

const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const MAX_BYTES = 8 * 1024 * 1024;

export async function POST(request: Request, { params }: Params) {
  try {
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

    const existingPhotos = await listPhotosForDeal(dealId);
    const maxOrder = existingPhotos.reduce(
      (max, p) => Math.max(max, p.sortOrder),
      -1,
    );
    let nextOrder = maxOrder + 1;
    const needsCover =
      !existingPhotos.some((p) => p.isCover) && existingPhotos.length === 0;
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

      const makeCover = needsCover && created.length === 0;
      const row = await insertPhoto({
        dealId,
        filename: stored,
        originalName: file.name,
        isCover: makeCover,
        sortOrder: nextOrder++,
      });
      created.push(row);
    }

    const full = await getDeal(dealId);
    return NextResponse.json({ photos: created, deal: full }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    await ensureDb();
    const { id } = await params;
    const dealId = Number(id);
    const body = await request.json();

    if (body.coverPhotoId) {
      await setCoverPhoto(dealId, Number(body.coverPhotoId));
    }

    if (Array.isArray(body.order)) {
      for (let i = 0; i < body.order.length; i++) {
        await setPhotoSortOrder(Number(body.order[i]), i);
      }
    }

    const full = await getDeal(dealId);
    return NextResponse.json(full);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not update photos.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
