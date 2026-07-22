import { google } from "googleapis";
import {
  DEAL_OWNER_LABELS,
  parseDealOwner,
  type Deal,
} from "@/db/schema";
import type { DealWithRelations } from "@/lib/deals";
import { calcProfit } from "@/lib/format";

const SHEET_TAB = "Deals";

const HEADERS = [
  "id",
  "name",
  "size",
  "cost",
  "price",
  "profit",
  "condition",
  "has_box",
  "has_insoles",
  "category",
  "status",
  "owner",
  "purchased_at",
  "sold_at",
  "platform",
  "notes",
  "updated_at",
] as const;

function getSpreadsheetId(): string | null {
  const id = process.env.GOOGLE_SHEETS_SPREADSHEET_ID?.trim();
  return id || null;
}

function getServiceAccount() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim();
  const key = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(
    /\\n/g,
    "\n",
  );
  if (!email || !key) return null;
  return { email, key };
}

export function isGoogleSheetsConfigured(): boolean {
  return Boolean(getSpreadsheetId() && getServiceAccount());
}

async function getSheetsClient() {
  const account = getServiceAccount();
  const spreadsheetId = getSpreadsheetId();
  if (!account || !spreadsheetId) return null;

  const auth = new google.auth.JWT({
    email: account.email,
    key: account.key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  await auth.authorize();
  return {
    sheets: google.sheets({ version: "v4", auth }),
    spreadsheetId,
  };
}

function dealToRow(deal: DealWithRelations | Deal): string[] {
  const categoryName =
    "category" in deal && deal.category ? deal.category.name : "";
  const owner = DEAL_OWNER_LABELS[parseDealOwner(deal.owner)];
  const profit =
    deal.status === "sold" ? calcProfit(deal.price, deal.cost) : "";

  return [
    String(deal.id),
    deal.name,
    deal.size,
    String(deal.cost),
    String(deal.price),
    profit === "" ? "" : String(profit),
    deal.condition,
    deal.hasBox ? "yes" : "no",
    deal.hasInsoles ? "yes" : "no",
    categoryName,
    deal.status,
    owner,
    deal.purchasedAt.slice(0, 10),
    deal.soldAt ? deal.soldAt.slice(0, 10) : "",
    deal.platform,
    deal.notes,
    deal.updatedAt,
  ];
}

async function ensureHeaderRow(
  sheets: ReturnType<typeof google.sheets>,
  spreadsheetId: string,
) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${SHEET_TAB}!A1:Q1`,
  });
  const first = res.data.values?.[0];
  if (first && first[0] === "id") return;

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${SHEET_TAB}!A1`,
    valueInputOption: "RAW",
    requestBody: { values: [[...HEADERS]] },
  });
}

async function findRowIndexByDealId(
  sheets: ReturnType<typeof google.sheets>,
  spreadsheetId: string,
  dealId: number,
): Promise<number | null> {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${SHEET_TAB}!A:A`,
  });
  const rows = res.data.values ?? [];
  for (let i = 0; i < rows.length; i++) {
    if (String(rows[i]?.[0]) === String(dealId)) return i + 1; // 1-based
  }
  return null;
}

/** Upsert a deal row. No-ops if Sheets env is not configured. */
export async function syncDealToGoogleSheet(
  deal: DealWithRelations,
): Promise<void> {
  try {
    const client = await getSheetsClient();
    if (!client) return;
    const { sheets, spreadsheetId } = client;

    await ensureHeaderRow(sheets, spreadsheetId);
    const row = dealToRow(deal);
    const existing = await findRowIndexByDealId(sheets, spreadsheetId, deal.id);

    if (existing) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${SHEET_TAB}!A${existing}:Q${existing}`,
        valueInputOption: "RAW",
        requestBody: { values: [row] },
      });
    } else {
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `${SHEET_TAB}!A:Q`,
        valueInputOption: "RAW",
        insertDataOption: "INSERT_ROWS",
        requestBody: { values: [row] },
      });
    }
  } catch (err) {
    console.error("Google Sheets sync failed:", err);
  }
}

export async function removeDealFromGoogleSheet(dealId: number): Promise<void> {
  try {
    const client = await getSheetsClient();
    if (!client) return;
    const { sheets, spreadsheetId } = client;

    const rowIndex = await findRowIndexByDealId(sheets, spreadsheetId, dealId);
    if (!rowIndex) return;

    // Clear the row (safer than deleteDimension without sheetId lookup).
    await sheets.spreadsheets.values.clear({
      spreadsheetId,
      range: `${SHEET_TAB}!A${rowIndex}:Q${rowIndex}`,
    });
  } catch (err) {
    console.error("Google Sheets remove failed:", err);
  }
}

/** Full rewrite of the Deals tab from current inventory. */
export async function syncAllDealsToGoogleSheet(
  deals: DealWithRelations[],
): Promise<{ synced: number; configured: boolean }> {
  const client = await getSheetsClient();
  if (!client) return { synced: 0, configured: false };
  const { sheets, spreadsheetId } = client;

  const values = [[...HEADERS], ...deals.map((d) => dealToRow(d))];
  await sheets.spreadsheets.values.clear({
    spreadsheetId,
    range: `${SHEET_TAB}!A:Q`,
  });
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${SHEET_TAB}!A1`,
    valueInputOption: "RAW",
    requestBody: { values },
  });
  return { synced: deals.length, configured: true };
}
