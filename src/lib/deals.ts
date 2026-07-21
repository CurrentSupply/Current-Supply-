import { and, asc, eq, gte, inArray, like, lte, or, type SQL } from "drizzle-orm";
import { db, ensureDb } from "@/db";
import {
  categories,
  deals,
  photos,
  type DealOwner,
  type DealStatus,
} from "@/db/schema";
import { calcProfit, daysBetween } from "@/lib/format";

export type DealFilters = {
  q?: string;
  status?: DealStatus | "all";
  owner?: DealOwner | "all";
  categoryId?: number | "all";
  size?: string;
  purchasedFrom?: string;
  purchasedTo?: string;
  sort?: "newest" | "oldest" | "name" | "profit" | "price";
};

export type DealWithRelations = typeof deals.$inferSelect & {
  category: typeof categories.$inferSelect | null;
  photos: (typeof photos.$inferSelect)[];
  coverPhoto: typeof photos.$inferSelect | null;
};

function buildWhere(filters: DealFilters = {}): SQL | undefined {
  const clauses: SQL[] = [];

  if (filters.q?.trim()) {
    const term = `%${filters.q.trim()}%`;
    clauses.push(
      or(like(deals.name, term), like(deals.notes, term), like(deals.condition, term))!,
    );
  }

  if (filters.status && filters.status !== "all") {
    clauses.push(eq(deals.status, filters.status));
  }

  if (filters.owner && filters.owner !== "all") {
    clauses.push(eq(deals.owner, filters.owner));
  }

  if (filters.categoryId && filters.categoryId !== "all") {
    clauses.push(eq(deals.categoryId, filters.categoryId));
  }

  if (filters.size?.trim()) {
    clauses.push(like(deals.size, `%${filters.size.trim()}%`));
  }

  if (filters.purchasedFrom) {
    clauses.push(gte(deals.purchasedAt, filters.purchasedFrom));
  }

  if (filters.purchasedTo) {
    clauses.push(lte(deals.purchasedAt, filters.purchasedTo));
  }

  if (clauses.length === 0) return undefined;
  if (clauses.length === 1) return clauses[0];
  return and(...clauses);
}

export async function listDeals(filters: DealFilters = {}): Promise<DealWithRelations[]> {
  await ensureDb();
  const where = buildWhere(filters);
  const sort = filters.sort ?? "newest";

  const idRows = where
    ? await db.select({ id: deals.id }).from(deals).where(where)
    : await db.select({ id: deals.id }).from(deals);

  if (idRows.length === 0) return [];

  const rows = await db.query.deals.findMany({
    where: inArray(
      deals.id,
      idRows.map((r) => r.id),
    ),
    with: {
      category: true,
      photos: {
        orderBy: (p, { asc: a }) => [a(p.sortOrder), a(p.id)],
      },
    },
  });

  const sorted = [...rows].sort((a, b) => {
    switch (sort) {
      case "oldest":
        return a.purchasedAt.localeCompare(b.purchasedAt);
      case "name":
        return a.name.localeCompare(b.name);
      case "profit":
        return calcProfit(b.price, b.cost) - calcProfit(a.price, a.cost);
      case "price":
        return b.price - a.price;
      case "newest":
      default:
        return b.createdAt.localeCompare(a.createdAt);
    }
  });

  return sorted.map((deal) => ({
    ...deal,
    coverPhoto: deal.photos.find((p) => p.isCover) ?? deal.photos[0] ?? null,
  }));
}

export async function getDeal(id: number): Promise<DealWithRelations | null> {
  await ensureDb();
  const deal = await db.query.deals.findFirst({
    where: eq(deals.id, id),
    with: {
      category: true,
      photos: {
        orderBy: (p, { asc: a }) => [a(p.sortOrder), a(p.id)],
      },
    },
  });

  if (!deal) return null;

  return {
    ...deal,
    coverPhoto: deal.photos.find((p) => p.isCover) ?? deal.photos[0] ?? null,
  };
}

export async function listCategories() {
  await ensureDb();
  return db.select().from(categories).orderBy(asc(categories.name));
}

export type DashboardStats = {
  inStockCount: number;
  soldCount: number;
  inventoryCost: number;
  projectedProfit: number;
  realizedProfit: number;
  avgRoiSold: number | null;
  avgDaysHeldSold: number | null;
  bestCategory: { name: string; profit: number } | null;
  byCategory: { name: string; count: number; profit: number }[];
  byMonth: { month: string; sold: number; profit: number }[];
  recentlySold: DealWithRelations[];
};

export async function getDashboardStats(): Promise<DashboardStats> {
  await ensureDb();
  const all = await listDeals({ sort: "newest" });

  const inStock = all.filter((d) => d.status === "in_stock");
  const sold = all.filter((d) => d.status === "sold");

  const inventoryCost = inStock.reduce((sum, d) => sum + d.cost, 0);
  const projectedProfit = inStock.reduce(
    (sum, d) => sum + calcProfit(d.price, d.cost),
    0,
  );
  const realizedProfit = sold.reduce(
    (sum, d) => sum + calcProfit(d.price, d.cost),
    0,
  );

  const rois = sold
    .filter((d) => d.cost > 0)
    .map((d) => ((d.price - d.cost) / d.cost) * 100);
  const avgRoiSold =
    rois.length > 0 ? rois.reduce((a, b) => a + b, 0) / rois.length : null;

  const held = sold
    .filter((d) => d.soldAt)
    .map((d) => daysBetween(d.purchasedAt, d.soldAt!));
  const avgDaysHeldSold =
    held.length > 0 ? held.reduce((a, b) => a + b, 0) / held.length : null;

  const catMap = new Map<string, { count: number; profit: number }>();
  for (const d of all) {
    const name = d.category?.name ?? "Uncategorized";
    const current = catMap.get(name) ?? { count: 0, profit: 0 };
    current.count += 1;
    if (d.status === "sold") {
      current.profit += calcProfit(d.price, d.cost);
    }
    catMap.set(name, current);
  }

  const byCategory = [...catMap.entries()]
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.profit - a.profit);

  const bestCategory = byCategory.find((c) => c.profit > 0)
    ? {
        name: byCategory[0].name,
        profit: byCategory[0].profit,
      }
    : null;

  const monthMap = new Map<string, { sold: number; profit: number }>();
  for (const d of sold) {
    const key = (d.soldAt ?? d.updatedAt).slice(0, 7);
    const current = monthMap.get(key) ?? { sold: 0, profit: 0 };
    current.sold += 1;
    current.profit += calcProfit(d.price, d.cost);
    monthMap.set(key, current);
  }

  const byMonth = [...monthMap.entries()]
    .map(([month, v]) => ({ month, ...v }))
    .sort((a, b) => a.month.localeCompare(b.month))
    .slice(-6);

  const recentlySold = sold
    .filter((d) => d.soldAt)
    .sort((a, b) => (b.soldAt ?? "").localeCompare(a.soldAt ?? ""))
    .slice(0, 6);

  return {
    inStockCount: inStock.length,
    soldCount: sold.length,
    inventoryCost,
    projectedProfit,
    realizedProfit,
    avgRoiSold,
    avgDaysHeldSold,
    bestCategory,
    byCategory,
    byMonth,
    recentlySold,
  };
}
