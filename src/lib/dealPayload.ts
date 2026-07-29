import { parseDealCondition, parseDealOwner, type DealCondition, type DealOwner } from "@/db/schema";

export type ParsedDealCreate = {
  name: string;
  size: string;
  cost: number;
  price: number;
  condition: DealCondition;
  hasBox: boolean;
  hasInsoles: boolean;
  categoryId: number;
  status: "in_stock" | "sold";
  owner: DealOwner;
  purchasedAt: string;
  soldAt: string | null;
  notes: string;
  platform: string;
};

export type ParseDealCreateResult =
  | { ok: true; data: ParsedDealCreate }
  | { ok: false; error: string };

/** Shared validation for single and bulk deal create. */
export function parseDealCreateBody(body: unknown): ParseDealCreateResult {
  const raw =
    body && typeof body === "object" ? (body as Record<string, unknown>) : {};

  const name = String(raw.name ?? "").trim();
  const size = String(raw.size ?? "").trim();
  const cost = Number(raw.cost);
  const price = Number(raw.price);
  const purchasedAt = String(raw.purchasedAt ?? "").slice(0, 10);
  const owner = parseDealOwner(raw.owner);
  const condition = parseDealCondition(raw.condition);
  const categoryId = Number(raw.categoryId);

  if (!name || !size || !Number.isFinite(cost) || !Number.isFinite(price) || !purchasedAt) {
    return {
      ok: false,
      error: "Name, size, cost, price, and purchase date are required.",
    };
  }
  if (!Number.isFinite(categoryId) || categoryId <= 0) {
    return { ok: false, error: "Category is required." };
  }

  const status = raw.status === "sold" ? "sold" : "in_stock";
  const soldAt =
    status === "sold"
      ? String(raw.soldAt ?? new Date().toISOString()).slice(0, 10)
      : null;

  return {
    ok: true,
    data: {
      name,
      size,
      cost,
      price,
      condition,
      hasBox: Boolean(raw.hasBox),
      hasInsoles: Boolean(raw.hasInsoles),
      categoryId,
      status,
      owner,
      purchasedAt,
      soldAt,
      notes: String(raw.notes ?? ""),
      platform: String(raw.platform ?? ""),
    },
  };
}
