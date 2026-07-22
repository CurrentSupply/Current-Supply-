import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { ensureDb } from "@/db";
import { getDeal } from "@/lib/deals";
import {
  ALLOWED_IMAGE_TYPES,
  MAX_PHOTO_BYTES,
  extForContentType,
} from "@/lib/photoLimits";
import {
  DEAL_PHOTOS_BUCKET,
  getServiceSupabase,
  getSupabaseUrl,
} from "@/lib/supabase";

type SignBody = {
  dealId?: number;
  contentType?: string;
  originalName?: string;
  fileSize?: number;
};

export async function POST(request: Request) {
  try {
    await ensureDb();
    const body = (await request.json()) as SignBody;
    const dealId = Number(body.dealId);
    const contentType = String(body.contentType || "").toLowerCase();
    const originalName = String(body.originalName || "photo.jpg");
    const fileSize = Number(body.fileSize ?? 0);

    if (!Number.isFinite(dealId) || dealId <= 0) {
      return NextResponse.json({ error: "Invalid dealId." }, { status: 400 });
    }

    const deal = await getDeal(dealId);
    if (!deal) {
      return NextResponse.json({ error: "Deal not found." }, { status: 404 });
    }

    if (!ALLOWED_IMAGE_TYPES.has(contentType)) {
      return NextResponse.json(
        { error: `Unsupported file type: ${contentType || originalName}` },
        { status: 400 },
      );
    }

    if (fileSize > MAX_PHOTO_BYTES) {
      return NextResponse.json(
        { error: `${originalName} is larger than 8MB.` },
        { status: 400 },
      );
    }

    const ext = extForContentType(contentType, originalName);
    const path = `${dealId}-${randomUUID()}${ext}`;

    const supabase = getServiceSupabase();
    const { data, error } = await supabase.storage
      .from(DEAL_PHOTOS_BUCKET)
      .createSignedUploadUrl(path, { upsert: true });

    if (error || !data) {
      return NextResponse.json(
        { error: error?.message || "Could not create upload URL." },
        { status: 500 },
      );
    }

    const base = getSupabaseUrl().replace(/\/$/, "");
    const publicUrl = `${base}/storage/v1/object/public/${DEAL_PHOTOS_BUCKET}/${path}`;

    return NextResponse.json({
      path: data.path || path,
      token: data.token,
      signedUrl: data.signedUrl,
      publicUrl,
      contentType,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not sign upload.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
