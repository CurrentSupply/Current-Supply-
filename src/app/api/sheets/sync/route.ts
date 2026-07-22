import { NextResponse } from "next/server";
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

    const deals = await listDeals({ sort: "newest" });
    const result = await syncAllDealsToGoogleSheet(deals);
    return NextResponse.json(result);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Could not sync Google Sheets.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    configured: isGoogleSheetsConfigured(),
  });
}
