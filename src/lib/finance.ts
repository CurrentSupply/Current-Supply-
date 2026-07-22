import { ensureDb, getServiceSupabase } from "@/db";
import {
  mapFinanceEntry,
  type FinanceEntry,
  type FinanceEntryRow,
  type FinanceKind,
} from "@/db/schema";
import { listDeals } from "@/lib/deals";
import { calcProfit } from "@/lib/format";

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

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

export type FinanceSummary = {
  cashIn: number;
  cashOut: number;
  balance: number;
  entryCount: number;
  byMonth: { month: string; in: number; out: number; net: number }[];
  byCategory: { category: string; in: number; out: number; net: number }[];
  /** Inventory cost currently tied up (from deals). */
  inventoryCost: number;
  /** Realized deal profit (sold deals). */
  dealProfit: number;
  entries: FinanceEntry[];
};

export async function getFinanceSummary(): Promise<FinanceSummary> {
  const [entries, deals] = await Promise.all([
    listFinanceEntries(),
    listDeals({ sort: "newest" }),
  ]);

  let cashIn = 0;
  let cashOut = 0;
  const monthMap = new Map<string, { in: number; out: number }>();
  const catMap = new Map<string, { in: number; out: number }>();

  for (const entry of entries) {
    if (entry.kind === "in") cashIn += entry.amount;
    else cashOut += entry.amount;

    const month = entry.entryDate.slice(0, 7);
    const monthRow = monthMap.get(month) ?? { in: 0, out: 0 };
    if (entry.kind === "in") monthRow.in += entry.amount;
    else monthRow.out += entry.amount;
    monthMap.set(month, monthRow);

    const catRow = catMap.get(entry.category) ?? { in: 0, out: 0 };
    if (entry.kind === "in") catRow.in += entry.amount;
    else catRow.out += entry.amount;
    catMap.set(entry.category, catRow);
  }

  const inventoryCost = deals
    .filter((d) => d.status === "in_stock")
    .reduce((sum, d) => sum + d.cost, 0);
  const dealProfit = deals
    .filter((d) => d.status === "sold")
    .reduce((sum, d) => sum + calcProfit(d.price, d.cost), 0);

  return {
    cashIn: roundMoney(cashIn),
    cashOut: roundMoney(cashOut),
    balance: roundMoney(cashIn - cashOut),
    entryCount: entries.length,
    byMonth: [...monthMap.entries()]
      .map(([month, v]) => ({
        month,
        in: roundMoney(v.in),
        out: roundMoney(v.out),
        net: roundMoney(v.in - v.out),
      }))
      .sort((a, b) => a.month.localeCompare(b.month))
      .slice(-8),
    byCategory: [...catMap.entries()]
      .map(([category, v]) => ({
        category,
        in: roundMoney(v.in),
        out: roundMoney(v.out),
        net: roundMoney(v.in - v.out),
      }))
      .sort((a, b) => Math.abs(b.net) - Math.abs(a.net)),
    inventoryCost: roundMoney(inventoryCost),
    dealProfit: roundMoney(dealProfit),
    entries,
  };
}
