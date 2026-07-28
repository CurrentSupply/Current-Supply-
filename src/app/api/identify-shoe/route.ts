import { NextResponse } from "next/server";
import { jsonCatch, jsonError } from "@/lib/apiResponse";
import {
  identifyConfigErrorResponse,
  identifyShoeFromImage,
  isShoeIdentifyConfigured,
} from "@/lib/identifyShoe";
import { ALLOWED_IMAGE_TYPES, MAX_PHOTO_BYTES } from "@/lib/photoLimits";

export const runtime = "nodejs";

type Body = {
  imageBase64?: string;
  mimeType?: string;
  imageUrl?: string;
};

async function loadFromUrl(imageUrl: string): Promise<{
  base64: string;
  mimeType: string;
}> {
  const res = await fetch(imageUrl);
  if (!res.ok) {
    throw Object.assign(new Error("Could not download cover photo."), {
      status: 400,
    });
  }
  const mimeType = (res.headers.get("content-type") || "image/jpeg")
    .split(";")[0]
    .trim()
    .toLowerCase();
  if (!ALLOWED_IMAGE_TYPES.has(mimeType)) {
    throw Object.assign(new Error("Cover photo must be an image."), {
      status: 400,
    });
  }
  const buffer = Buffer.from(await res.arrayBuffer());
  if (buffer.byteLength > MAX_PHOTO_BYTES) {
    throw Object.assign(new Error("Cover photo is too large to identify."), {
      status: 400,
    });
  }
  return { base64: buffer.toString("base64"), mimeType };
}

export async function GET() {
  return NextResponse.json({
    configured: isShoeIdentifyConfigured(),
  });
}

export async function POST(request: Request) {
  try {
    if (!isShoeIdentifyConfigured()) {
      return identifyConfigErrorResponse();
    }

    const body = (await request.json()) as Body;
    let base64 = "";
    let mimeType = "image/jpeg";

    if (body.imageBase64?.trim()) {
      base64 = body.imageBase64.trim();
      mimeType = String(body.mimeType || "image/jpeg")
        .split(";")[0]
        .trim()
        .toLowerCase();
      if (!ALLOWED_IMAGE_TYPES.has(mimeType)) {
        return jsonError("Image must be JPG, PNG, WebP, or GIF.", 400);
      }
      const raw = base64.replace(/^data:[^;]+;base64,/, "");
      const approxBytes = Math.floor((raw.length * 3) / 4);
      if (approxBytes > MAX_PHOTO_BYTES) {
        return jsonError("Image is too large to identify (max 8MB).", 400);
      }
    } else if (body.imageUrl?.trim()) {
      const loaded = await loadFromUrl(body.imageUrl.trim());
      base64 = loaded.base64;
      mimeType = loaded.mimeType;
    } else {
      return jsonError("Provide imageBase64 or imageUrl.", 400);
    }

    const result = await identifyShoeFromImage({ base64, mimeType });
    return NextResponse.json(result);
  } catch (err) {
    const status =
      err &&
      typeof err === "object" &&
      "status" in err &&
      typeof (err as { status: unknown }).status === "number"
        ? (err as { status: number }).status
        : 500;
    if (status !== 500) {
      return jsonError(
        err instanceof Error ? err.message : "Could not identify shoe.",
        status,
      );
    }
    return jsonCatch(err, "Could not identify shoe.");
  }
}
