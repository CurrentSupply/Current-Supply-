import { ensureDb, getServiceSupabase, listCategoryRows } from "@/db";
import {
  mapCategory,
  mapDeal,
  mapPhoto,
  parseDealCondition,
  parseDealOwner,
  type Category,
  type CategoryRow,
  type Deal,
  type DealOwner,
  type DealRow,
  type DealStatus,
  type Photo,
  type PhotoRow,
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

export type DealWithRelations = Deal & {
  category: Category | null;
  photos: Photo[];
  coverPhoto: Photo | null;
};

function attachRelations(
  deal: Deal,
  categoriesById: Map<number, Category>,
  photosByDeal: Map<number, Photo[]>,
): DealWithRelations {
  const photos = (photosByDeal.get(deal.id) ?? []).slice().sort((a, b) => {
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    return a.id - b.id;
  });
  return {
    ...deal,
    category: deal.categoryId ? categoriesById.get(deal.categoryId) ?? null : null,
    photos,
    coverPhoto: photos.find((p) => p.isCover) ?? photos[0] ?? null,
  };
}

export async function listCategories(): Promise<Category[]> {
  await ensureDb();
  return listCategoryRows();
}

export async function listDeals(filters: DealFilters = {}): Promise<DealWithRelations[]> {
  await ensureDb();
  const supabase = getServiceSupabase();

  let query = supabase.from("deals").select("*");

  if (filters.status && filters.status !== "all") {
    query = query.eq("status", filters.status);
  }
  if (filters.owner && filters.owner !== "all") {
    query = query.eq("owner", filters.owner);
  }
  if (filters.categoryId && filters.categoryId !== "all") {
    query = query.eq("category_id", filters.categoryId);
  }
  if (filters.size?.trim()) {
    query = query.ilike("size", `%${filters.size.trim()}%`);
  }
  if (filters.purchasedFrom) {
    query = query.gte("purchased_at", filters.purchasedFrom);
  }
  if (filters.purchasedTo) {
    query = query.lte("purchased_at", filters.purchasedTo);
  }
  if (filters.q?.trim()) {
    const term = filters.q.trim();
    query = query.or(
      `name.ilike.%${term}%,notes.ilike.%${term}%,condition.ilike.%${term}%`,
    );
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const deals = ((data ?? []) as DealRow[]).map(mapDeal);
  if (deals.length === 0) return [];

  const [{ data: catRows }, { data: photoRows }] = await Promise.all([
    supabase.from("categories").select("id,name,created_at"),
    supabase
      .from("photos")
      .select("*")
      .in(
        "deal_id",
        deals.map((d) => d.id),
      ),
  ]);

  const categoriesById = new Map(
    ((catRows ?? []) as CategoryRow[]).map((row) => {
      const cat = mapCategory(row);
      return [cat.id, cat] as const;
    }),
  );

  const photosByDeal = new Map<number, Photo[]>();
  for (const row of (photoRows ?? []) as PhotoRow[]) {
    const photo = mapPhoto(row);
    const list = photosByDeal.get(photo.dealId) ?? [];
    list.push(photo);
    photosByDeal.set(photo.dealId, list);
  }

  const withRelations = deals.map((deal) =>
    attachRelations(deal, categoriesById, photosByDeal),
  );

  const sort = filters.sort ?? "newest";
  return withRelations.sort((a, b) => {
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
}

export async function getDeal(id: number): Promise<DealWithRelations | null> {
  await ensureDb();
  const supabase = getServiceSupabase();

  const { data, error } = await supabase
    .from("deals")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  const deal = mapDeal(data as DealRow);

  const [{ data: catRow }, { data: photoRows }] = await Promise.all([
    deal.categoryId
      ? supabase
          .from("categories")
          .select("id,name,created_at")
          .eq("id", deal.categoryId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from("photos").select("*").eq("deal_id", id),
  ]);

  const categoriesById = new Map<number, Category>();
  if (catRow) {
    const cat = mapCategory(catRow as CategoryRow);
    categoriesById.set(cat.id, cat);
  }

  const photosByDeal = new Map<number, Photo[]>();
  photosByDeal.set(
    id,
    ((photoRows ?? []) as PhotoRow[]).map(mapPhoto),
  );

  return attachRelations(deal, categoriesById, photosByDeal);
}

export async function createDeal(input: {
  name: string;
  size: string;
  cost: number;
  price: number;
  condition?: string;
  hasBox?: boolean;
  hasInsoles?: boolean;
  categoryId?: number | null;
  status: DealStatus;
  owner: DealOwner;
  purchasedAt: string;
  soldAt?: string | null;
  notes?: string;
  platform?: string;
}): Promise<DealWithRelations> {
  await ensureDb();
  const supabase = getServiceSupabase();

  const { data, error } = await supabase
    .from("deals")
    .insert({
      name: input.name,
      size: input.size,
      cost: input.cost,
      price: input.price,
      condition: parseDealCondition(input.condition),
      has_box: Boolean(input.hasBox),
      has_insoles: Boolean(input.hasInsoles),
      category_id: input.categoryId ?? null,
      status: input.status,
      owner: parseDealOwner(input.owner),
      purchased_at: input.purchasedAt,
      sold_at: input.soldAt ?? null,
      notes: input.notes ?? "",
      platform: input.platform ?? "",
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  const full = await getDeal((data as DealRow).id);
  if (!full) throw new Error("Deal created but could not be reloaded.");
  return full;
}

export async function updateDeal(
  id: number,
  patch: Record<string, unknown>,
): Promise<DealWithRelations> {
  await ensureDb();
  const supabase = getServiceSupabase();

  const { error } = await supabase.from("deals").update(patch).eq("id", id);
  if (error) throw new Error(error.message);

  const full = await getDeal(id);
  if (!full) throw new Error("Deal not found after update.");
  return full;
}

export async function deleteDeal(id: number): Promise<void> {
  await ensureDb();
  const supabase = getServiceSupabase();
  const { error } = await supabase.from("deals").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function createCategory(name: string): Promise<Category> {
  await ensureDb();
  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from("categories")
    .insert({ name })
    .select("id,name,created_at")
    .single();
  if (error) throw new Error(error.message);
  return mapCategory(data as CategoryRow);
}

export async function insertPhoto(input: {
  dealId: number;
  filename: string;
  originalName: string;
  isCover: boolean;
  sortOrder: number;
}): Promise<Photo> {
  await ensureDb();
  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from("photos")
    .insert({
      deal_id: input.dealId,
      filename: input.filename,
      original_name: input.originalName,
      is_cover: input.isCover,
      sort_order: input.sortOrder,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return mapPhoto(data as PhotoRow);
}

export async function listPhotosForDeal(dealId: number): Promise<Photo[]> {
  await ensureDb();
  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from("photos")
    .select("*")
    .eq("deal_id", dealId)
    .order("sort_order")
    .order("id");
  if (error) throw new Error(error.message);
  return ((data ?? []) as PhotoRow[]).map(mapPhoto);
}

export async function getPhoto(id: number): Promise<Photo | null> {
  await ensureDb();
  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from("photos")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapPhoto(data as PhotoRow) : null;
}

export async function deletePhotoRow(id: number): Promise<void> {
  await ensureDb();
  const supabase = getServiceSupabase();
  const { error } = await supabase.from("photos").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function clearCoverFlags(dealId: number): Promise<void> {
  await ensureDb();
  const supabase = getServiceSupabase();
  const { error } = await supabase
    .from("photos")
    .update({ is_cover: false })
    .eq("deal_id", dealId);
  if (error) throw new Error(error.message);
}

export async function setCoverPhoto(dealId: number, photoId: number): Promise<void> {
  await clearCoverFlags(dealId);
  const supabase = getServiceSupabase();
  const { error } = await supabase
    .from("photos")
    .update({ is_cover: true })
    .eq("id", photoId)
    .eq("deal_id", dealId);
  if (error) throw new Error(error.message);
}

export async function setPhotoSortOrder(photoId: number, sortOrder: number): Promise<void> {
  await ensureDb();
  const supabase = getServiceSupabase();
  const { error } = await supabase
    .from("photos")
    .update({ sort_order: sortOrder })
    .eq("id", photoId);
  if (error) throw new Error(error.message);
}

export type DashboardStats = {
  inStockCount: number;
  soldCount: number;
  inventoryCost: number;
  inventoryValue: number;
  projectedProfit: number;
  realizedProfit: number;
  avgRoiSold: number | null;
  avgDaysHeldSold: number | null;
  bestCategory: { name: string; profit: number } | null;
  byCategory: { name: string; count: number; inStock: number; sold: number; profit: number }[];
  byOwner: { name: string; count: number; inStock: number; sold: number; profit: number }[];
  byCondition: { name: string; count: number; inStock: number; sold: number }[];
  withBoxCount: number;
  withInsolesCount: number;
  byMonth: { month: string; sold: number; profit: number }[];
  recentlySold: DealWithRelations[];
};

export async function getDashboardStats(): Promise<DashboardStats> {
  const all = await listDeals({ sort: "newest" });

  const inStock = all.filter((d) => d.status === "in_stock");
  const sold = all.filter((d) => d.status === "sold");

  const inventoryCost = inStock.reduce((sum, d) => sum + d.cost, 0);
  const inventoryValue = inStock.reduce((sum, d) => sum + d.price, 0);
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

  const catMap = new Map<
    string,
    { count: number; inStock: number; sold: number; profit: number }
  >();
  for (const d of all) {
    const name = d.category?.name ?? "Uncategorized";
    const current = catMap.get(name) ?? {
      count: 0,
      inStock: 0,
      sold: 0,
      profit: 0,
    };
    current.count += 1;
    if (d.status === "in_stock") current.inStock += 1;
    else {
      current.sold += 1;
      current.profit += calcProfit(d.price, d.cost);
    }
    catMap.set(name, current);
  }

  const byCategory = [...catMap.entries()]
    .map(([name, v]) => ({ name, ...v, profit: roundMoney(v.profit) }))
    .sort((a, b) => b.count - a.count);

  const ownerMap = new Map<
    string,
    { count: number; inStock: number; sold: number; profit: number }
  >();
  for (const d of all) {
    const name = d.owner === "mizzy" ? "Mizzy" : d.owner === "mac" ? "Mac" : "Other";
    const current = ownerMap.get(name) ?? {
      count: 0,
      inStock: 0,
      sold: 0,
      profit: 0,
    };
    current.count += 1;
    if (d.status === "in_stock") current.inStock += 1;
    else {
      current.sold += 1;
      current.profit += calcProfit(d.price, d.cost);
    }
    ownerMap.set(name, current);
  }
  const byOwner = [...ownerMap.entries()]
    .map(([name, v]) => ({ name, ...v, profit: roundMoney(v.profit) }))
    .sort((a, b) => b.count - a.count);

  const conditionMap = new Map<
    string,
    { count: number; inStock: number; sold: number }
  >();
  for (const d of all) {
    const name = d.condition;
    const current = conditionMap.get(name) ?? {
      count: 0,
      inStock: 0,
      sold: 0,
    };
    current.count += 1;
    if (d.status === "in_stock") current.inStock += 1;
    else current.sold += 1;
    conditionMap.set(name, current);
  }
  const byCondition = [...conditionMap.entries()]
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.count - a.count);

  const topProfitCategory = [...byCategory].sort((a, b) => b.profit - a.profit)[0];
  const bestCategory =
    topProfitCategory && topProfitCategory.profit > 0
      ? {
          name: topProfitCategory.name,
          profit: topProfitCategory.profit,
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
    .map(([month, v]) => ({
      month,
      sold: v.sold,
      profit: roundMoney(v.profit),
    }))
    .sort((a, b) => a.month.localeCompare(b.month))
    .slice(-6);

  const recentlySold = sold
    .filter((d) => d.soldAt)
    .sort((a, b) => (b.soldAt ?? "").localeCompare(a.soldAt ?? ""))
    .slice(0, 6);

  return {
    inStockCount: inStock.length,
    soldCount: sold.length,
    inventoryCost: roundMoney(inventoryCost),
    inventoryValue: roundMoney(inventoryValue),
    projectedProfit: roundMoney(projectedProfit),
    realizedProfit: roundMoney(realizedProfit),
    avgRoiSold,
    avgDaysHeldSold,
    bestCategory,
    byCategory,
    byOwner,
    byCondition,
    withBoxCount: all.filter((d) => d.hasBox).length,
    withInsolesCount: all.filter((d) => d.hasInsoles).length,
    byMonth,
    recentlySold,
  };
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}
