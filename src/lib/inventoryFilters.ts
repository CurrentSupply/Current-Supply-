import {
  DEAL_OWNERS,
  type DealOwner,
} from "@/db/schema";

export type InventoryFilterState = {
  q: string;
  status: "all" | "in_stock" | "sold";
  owner: "all" | DealOwner;
  categoryId: string;
  size: string;
  purchasedFrom: string;
  purchasedTo: string;
  sort: "newest" | "oldest" | "name" | "profit" | "price";
};

export const INVENTORY_FILTERS_STORAGE_KEY = "current-supply.inventory.filters";

const SORTS = new Set<InventoryFilterState["sort"]>([
  "newest",
  "oldest",
  "name",
  "profit",
  "price",
]);

export const DEFAULT_INVENTORY_FILTERS: InventoryFilterState = {
  q: "",
  status: "all",
  owner: "all",
  categoryId: "all",
  size: "",
  purchasedFrom: "",
  purchasedTo: "",
  sort: "newest",
};

export function filtersFromSearchParams(
  searchParams: URLSearchParams,
): InventoryFilterState {
  const statusRaw = searchParams.get("status");
  const status =
    statusRaw === "in_stock" || statusRaw === "sold" ? statusRaw : "all";

  const ownerRaw = searchParams.get("owner");
  const owner =
    ownerRaw && (DEAL_OWNERS as readonly string[]).includes(ownerRaw)
      ? (ownerRaw as DealOwner)
      : "all";

  const sortRaw = searchParams.get("sort");
  const sort =
    sortRaw && SORTS.has(sortRaw as InventoryFilterState["sort"])
      ? (sortRaw as InventoryFilterState["sort"])
      : "newest";

  const categoryId = searchParams.get("categoryId");
  const categoryOk =
    categoryId &&
    categoryId !== "all" &&
    Number.isFinite(Number(categoryId)) &&
    Number(categoryId) > 0
      ? categoryId
      : "all";

  return {
    q: searchParams.get("q") ?? "",
    status,
    owner,
    categoryId: categoryOk,
    size: searchParams.get("size") ?? "",
    purchasedFrom: searchParams.get("purchasedFrom") ?? "",
    purchasedTo: searchParams.get("purchasedTo") ?? "",
    sort,
  };
}

/** True when the URL carries any inventory filter/sort intent. */
export function searchParamsHaveFilters(searchParams: URLSearchParams): boolean {
  return (
    searchParams.has("q") ||
    searchParams.has("status") ||
    searchParams.has("owner") ||
    searchParams.has("categoryId") ||
    searchParams.has("size") ||
    searchParams.has("purchasedFrom") ||
    searchParams.has("purchasedTo") ||
    searchParams.has("sort")
  );
}

/** True when filters (not sort alone) narrow the inventory list. */
export function inventoryFiltersAreRestrictive(
  filters: InventoryFilterState,
): boolean {
  return (
    filters.q !== "" ||
    filters.status !== "all" ||
    filters.owner !== "all" ||
    filters.categoryId !== "all" ||
    filters.size !== "" ||
    filters.purchasedFrom !== "" ||
    filters.purchasedTo !== ""
  );
}

export function filtersToSearchParams(
  filters: InventoryFilterState,
): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.status !== "all") params.set("status", filters.status);
  if (filters.owner !== "all") params.set("owner", filters.owner);
  if (filters.categoryId !== "all") params.set("categoryId", filters.categoryId);
  if (filters.size) params.set("size", filters.size);
  if (filters.purchasedFrom) params.set("purchasedFrom", filters.purchasedFrom);
  if (filters.purchasedTo) params.set("purchasedTo", filters.purchasedTo);
  if (filters.sort !== "newest") params.set("sort", filters.sort);
  return params;
}

export function filtersToQueryString(filters: InventoryFilterState): string {
  return filtersToSearchParams(filters).toString();
}

function isFilterState(value: unknown): value is InventoryFilterState {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  const statusOk =
    v.status === "all" || v.status === "in_stock" || v.status === "sold";
  const ownerOk =
    v.owner === "all" ||
    (typeof v.owner === "string" &&
      (DEAL_OWNERS as readonly string[]).includes(v.owner));
  const sortOk =
    typeof v.sort === "string" &&
    SORTS.has(v.sort as InventoryFilterState["sort"]);
  return (
    typeof v.q === "string" &&
    statusOk &&
    ownerOk &&
    typeof v.categoryId === "string" &&
    typeof v.size === "string" &&
    typeof v.purchasedFrom === "string" &&
    typeof v.purchasedTo === "string" &&
    sortOk
  );
}

export function readStoredInventoryFilters(): InventoryFilterState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(INVENTORY_FILTERS_STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isFilterState(parsed)) return null;
    return {
      ...DEFAULT_INVENTORY_FILTERS,
      ...parsed,
      owner: parsed.owner as InventoryFilterState["owner"],
      status: parsed.status,
      sort: parsed.sort,
    };
  } catch {
    return null;
  }
}

export function writeStoredInventoryFilters(filters: InventoryFilterState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      INVENTORY_FILTERS_STORAGE_KEY,
      JSON.stringify(filters),
    );
  } catch {
    // Ignore quota / private mode failures.
  }
}
