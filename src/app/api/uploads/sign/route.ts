import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { ensureDb } from "@/db";
import { jsonCatch, jsonError } from "@/lib/apiResponse";
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
      return jsonError("Invalid dealId.", 400);
    }

    const deal = await getDeal(dealId);
    if (!deal) {
      return jsonError("Deal not found.", 404);
    }

    if (!ALLOWED_IMAGE_TYPES.has(contentType)) {
      return jsonError(
        `Unsupported file type: ${contentType || originalName}`,
        400,
      );
    }

    if (fileSize > MAX_PHOTO_BYTES) {
      return jsonError(`${originalName} is larger than 8MB.`, 400);
    }

    const ext = extForContentType(contentType, originalName);
    const path = `${dealId}-${randomUUID()}${ext}`;

    const supabase = getServiceSupabase();
    const { data, error } = await supabase.storage
      .from(DEAL_PHOTOS_BUCKET)
      .createSignedUploadUrl(path, { upsert: true });

    if (error || !data) {
      return jsonError(error?.message || "Could not create upload URL.", 500);
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
    return jsonCatch(err, "Could not sign upload.");
  }
}
