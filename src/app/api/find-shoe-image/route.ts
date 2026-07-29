import { NextResponse } from "next/server";
import { jsonCatch, jsonError } from "@/lib/apiResponse";
import { findShoeImageFromTitle } from "@/lib/findShoeImage";

export const runtime = "nodejs";
export const maxDuration = 60;

type Body = {
  name?: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Body;
    const name = String(body.name ?? "").trim();
    if (!name) {
      return jsonError("Enter an item name first.", 400);
    }

    const found = await findShoeImageFromTitle(name);
    return NextResponse.json({
      imageBase64: found.buffer.toString("base64"),
      mimeType: found.mimeType,
      sourceUrl: found.sourceUrl,
      query: found.query,
    });
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
