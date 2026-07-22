import { NextResponse } from "next/server";
import { ensureDb } from "@/db";
import {
  getDeal,
  setCoverPhoto,
  setPhotoSortOrder,
} from "@/lib/deals";

type Params = { params: Promise<{ id: string }> };

/**
 * Photo file bytes must NOT go through this route (Vercel ~4.5MB body limit → 413).
 * Clients upload via /api/uploads/sign → Supabase Storage → /photos/register.
 */
export async function POST() {
  return NextResponse.json(
    {
      error:
        "Direct photo upload is disabled. Refresh the page and try again (uploads go to storage).",
    },
    { status: 410 },
  );
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
