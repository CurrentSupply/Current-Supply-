import { NextResponse } from "next/server";
import { mediaUrl, readUpload } from "@/lib/storage";
import path from "path";

type Params = { params: Promise<{ filename: string }> };

const TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

/** Legacy local-filename route — prefers redirect to Supabase public URL. */
export async function GET(_request: Request, { params }: Params) {
  const { filename } = await params;
  const decoded = decodeURIComponent(filename);
  if (decoded.includes("..") || decoded.includes("/") || decoded.includes("\\")) {
    return NextResponse.json({ error: "Invalid filename." }, { status: 400 });
  }

  if (decoded.startsWith("http://") || decoded.startsWith("https://")) {
    return NextResponse.redirect(decoded);
  }

  const publicUrl = mediaUrl(decoded);
  if (publicUrl.startsWith("http")) {
    return NextResponse.redirect(publicUrl);
  }

  const data = await readUpload(decoded);
  if (!data) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const ext = path.extname(decoded).toLowerCase();
  return new NextResponse(new Uint8Array(data), {
    headers: {
      "Content-Type": TYPES[ext] || "application/octet-stream",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
