import { ensureDb, getServiceSupabase } from "@/db";
import {
  DEAL_OWNER_LABELS,
  mapFinanceEntry,
  parseDealOwner,
  type FinanceEntry,
  type FinanceEntryRow,
  type FinanceKind,
} from "@/db/schema";
import { listDeals, type DealWithRelations } from "@/lib/deals";
import { calcProfit, roundMoney } from "@/lib/format";
import { isGoogleSheetsConfigured } from "@/lib/googleSheets";

export async function listFinanceEntries(): Promise<FinanceEntry[]> {
  await ensureDb();
  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from("finance_entries")
    .select("*")
    .order("entry_date", { ascending: false })
    .order("id", { ascending: false });

  if (error) throw new Error(error.message);
  return ((data ?? []) as FinanceEntryRow[]).map(mapFinanceEntry);
}

export async function createFinanceEntry(input: {
  entryDate: string;
  kind: FinanceKind;
  amount: number;
  category: string;
  note?: string;
  dealId?: number | null;
}): Promise<FinanceEntry> {
  await ensureDb();
  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from("finance_entries")
    .insert({
      entry_date: input.entryDate.slice(0, 10),
      kind: input.kind,
      amount: input.amount,
      category: input.category || "Other",
      note: input.note ?? "",
      deal_id: input.dealId ?? null,
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return mapFinanceEntry(data as FinanceEntryRow);
}

export async function deleteFinanceEntry(id: number): Promise<void> {
  await ensureDb();
  const supabase = getServiceSupabase();
  const { error } = await supabase.from("finance_entries").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export type SoldDealRow = {
  id: number;
  name: string;
  size: string;
  cost: number;
  price: number;
  profit: number;
  owner: string;
  category: string | null;
  soldAt: string;
  purchasedAt: string;
  platform: string;
};

export type FinanceActivity = {
  id: string;
  date: string;
  kind: "in" | "out";
  source: "deal_sale" | "deal_purchase" | "manual";
  label: string;
  amount: number;
  dealId?: number;
  entryId?: number;
};

export type FinanceSummary = {
  /** Sale revenue from sold deals. */
  salesRevenue: number;
  /** Cost of goods for sold deals. */
  soldCost: number;
  /** Realized profit on sold deals. */
  dealProfit: number;
  /** Cost still tied up in open inventory. */
  inventoryCost: number;
  /** Money spent acquiring all deals (sold + open). */
  purchaseSpend: number;
  /** Manual cash in/out. */
  manualIn: number;
  manualOut: number;
  /** Combined: sales + manual in − purchases − manual out. */
  netCash: number;
  soldCount: number;
  inStockCount: number;
  soldDeals: SoldDealRow[];
  activity: FinanceActivity[];
  byMonth: { month: string; sales: number; profit: number; sold: number }[];
  entries: FinanceEntry[];
  sheetsConfigured: boolean;
};

function toSoldRow(d: DealWithRelations): SoldDealRow | null {
  if (d.status !== "sold" || !d.soldAt) return null;
  return {
    id: d.id,
    name: d.name,
    size: d.size,
    cost: d.cost,
    price: d.price,
    profit: calcProfit(d.price, d.cost),
    owner: DEAL_OWNER_LABELS[parseDealOwner(d.owner)],
    category: d.category?.name ?? null,
    soldAt: d.soldAt.slice(0, 10),
    purchasedAt: d.purchasedAt.slice(0, 10),
    platform: d.platform,
  };
}

export async function getFinanceSummary(): Promise<FinanceSummary> {
  const [entries, deals] = await Promise.all([
    listFinanceEntries().catch(() => [] as FinanceEntry[]),
    listDeals({ sort: "newest" }, { includePhotos: false }),
  ]);

  const sold = deals.filter((d) => d.status === "sold");
  const inStock = deals.filter((d) => d.status === "in_stock");

  const soldDeals = sold
    .map(toSoldRow)
    .filter((r): r is SoldDealRow => r !== null)
    .sort((a, b) => b.soldAt.localeCompare(a.soldAt));

  const salesRevenue = sold.reduce((sum, d) => sum + d.price, 0);
  const soldCost = sold.reduce((sum, d) => sum + d.cost, 0);
  const dealProfit = salesRevenue - soldCost;
  const inventoryCost = inStock.reduce((sum, d) => sum + d.cost, 0);
  const purchaseSpend = deals.reduce((sum, d) => sum + d.cost, 0);

  let manualIn = 0;
  let manualOut = 0;
  for (const entry of entries) {
    if (entry.kind === "in") manualIn += entry.amount;
    else manualOut += entry.amount;
  }

  const activity: FinanceActivity[] = [];

  for (const d of deals) {
    activity.push({
      id: `purchase-${d.id}`,
      date: d.purchasedAt.slice(0, 10),
      kind: "out",
      source: "deal_purchase",
      label: `Bought ${d.name} (${d.size})`,
      amount: d.cost,
      dealId: d.id,
    });
  }
  for (const d of sold) {
    activity.push({
      id: `sale-${d.id}`,
      date: (d.soldAt ?? d.updatedAt).slice(0, 10),
      kind: "in",
      source: "deal_sale",
      label: `Sold ${d.name} (${d.size})`,
      amount: d.price,
      dealId: d.id,
    });
  }
  for (const entry of entries) {
    activity.push({
      id: `manual-${entry.id}`,
      date: entry.entryDate.slice(0, 10),
      kind: entry.kind,
      source: "manual",
      label: entry.note
        ? `${entry.category}: ${entry.note}`
        : entry.category,
      amount: entry.amount,
      entryId: entry.id,
    });
  }

  activity.sort((a, b) => {
    const byDate = b.date.localeCompare(a.date);
    if (byDate !== 0) return byDate;
    return a.id.localeCompare(b.id);
  });

  const monthMap = new Map<string, { sales: number; profit: number; sold: number }>();
  for (const row of soldDeals) {
    const month = row.soldAt.slice(0, 7);
    const current = monthMap.get(month) ?? { sales: 0, profit: 0, sold: 0 };
    current.sales += row.price;
    current.profit += row.profit;
    current.sold += 1;
    monthMap.set(month, current);
  }

  const byMonth = [...monthMap.entries()]
    .map(([month, v]) => ({
      month,
      sales: roundMoney(v.sales),
      profit: roundMoney(v.profit),
      sold: v.sold,
    }))
    .sort((a, b) => a.month.localeCompare(b.month))
    .slice(-8);

  return {
    salesRevenue: roundMoney(salesRevenue),
    soldCost: roundMoney(soldCost),
    dealProfit: roundMoney(dealProfit),
    inventoryCost: roundMoney(inventoryCost),
    purchaseSpend: roundMoney(purchaseSpend),
    manualIn: roundMoney(manualIn),
    manualOut: roundMoney(manualOut),
    netCash: roundMoney(salesRevenue + manualIn - purchaseSpend - manualOut),
    soldCount: sold.length,
    inStockCount: inStock.length,
    soldDeals,
    activity: activity.slice(0, 40),
    byMonth,
    entries,
    sheetsConfigured: isGoogleSheetsConfigured(),
  };
}
