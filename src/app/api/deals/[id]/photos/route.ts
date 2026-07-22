import { NextResponse } from "next/server";
import { ensureDb } from "@/db";
import {
  getDeal,
  setCoverPhoto,
  setPhotoSortOrder,
} from "@/lib/deals";
import { jsonCatch } from "@/lib/apiResponse";

type Params = { params: Promise<{ id: string }> };

/** Cover/order updates only. File bytes go via /api/uploads/sign → register. */
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
    return jsonCatch(err, "Could not update photos.");
  }
}
