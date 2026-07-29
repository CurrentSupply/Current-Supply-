import { NextResponse } from "next/server";
import { ensureDb } from "@/db";
import { jsonCatch, jsonError } from "@/lib/apiResponse";
import { attachCoverPhotoFromTitle } from "@/lib/attachCoverFromTitle";

export const runtime = "nodejs";
export const maxDuration = 60;

type Params = { params: Promise<{ id: string }> };

/** Find a web photo from the deal title and save it as cover when none exist. */
export async function POST(_request: Request, { params }: Params) {
  try {
    await ensureDb();
    const { id } = await params;
    const dealId = Number(id);
    if (!Number.isFinite(dealId) || dealId <= 0) {
      return jsonError("Invalid deal id.", 400);
    }

    const full = await attachCoverPhotoFromTitle(dealId);
    return NextResponse.json(
      {
        photo: full.coverPhoto,
        deal: full,
      },
      { status: 201 },
    );
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
        err instanceof Error ? err.message : "Could not find a photo.",
        status,
      );
    }
    return jsonCatch(err, "Could not find a photo.");
  }
}
