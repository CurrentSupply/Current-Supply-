import { NextResponse } from "next/server";
import { jsonCatch } from "@/lib/apiResponse";
import { listDeals } from "@/lib/deals";
import {
  isGoogleSheetsConfigured,
  syncAllDealsToGoogleSheet,
} from "@/lib/googleSheets";

export async function POST() {
  try {
    if (!isGoogleSheetsConfigured()) {
      return NextResponse.json(
        {
          configured: false,
          synced: 0,
          error:
            "Google Sheets is not configured. Set GOOGLE_SHEETS_SPREADSHEET_ID, GOOGLE_SERVICE_ACCOUNT_EMAIL, and GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.",
        },
        { status: 400 },
      );
    }

    const deals = await listDeals(
      { sort: "newest" },
      { includePhotos: false },
    );
    const result = await syncAllDealsToGoogleSheet(deals);
    return NextResponse.json(result);
  } catch (err) {
    return jsonCatch(err, "Could not sync Google Sheets.");
  }
}

export async function GET() {
  return NextResponse.json({
    configured: isGoogleSheetsConfigured(),
  });
}
