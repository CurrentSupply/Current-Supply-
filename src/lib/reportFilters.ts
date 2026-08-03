import {
  DEAL_CONDITIONS,
  DEAL_OWNERS,
  type DealCondition,
  type DealOwner,
} from "@/db/schema";
import type { DealFilters } from "@/lib/deals";

export type ReportFilterState = {
  owner: "all" | DealOwner;
  categoryId: string;
  size: string;
  status: "all" | "in_stock" | "sold";
  condition: "all" | DealCondition;
  purchasedFrom: string;
  purchasedTo: string;
  soldFrom: string;
  soldTo: string;
};

export const DEFAULT_REPORT_FILTERS: ReportFilterState = {
  owner: "all",
  categoryId: "all",
  size: "",
  status: "all",
  condition: "all",
  purchasedFrom: "",
  purchasedTo: "",
  soldFrom: "",
  soldTo: "",
};

export const ANALYTICS_FILTERS_STORAGE_KEY =
  "current-supply.analytics.filters";
export const FINANCE_FILTERS_STORAGE_KEY = "current-supply.finance.filters";

export function reportFiltersFromSearchParams(
  searchParams: URLSearchParams,
): ReportFilterState {
  const statusRaw = searchParams.get("status");
  const status =
    statusRaw === "in_stock" || statusRaw === "sold" ? statusRaw : "all";

  const ownerRaw = searchParams.get("owner");
  const owner =
    ownerRaw && (DEAL_OWNERS as readonly string[]).includes(ownerRaw)
      ? (ownerRaw as DealOwner)
      : "all";

  const conditionRaw = searchParams.get("condition");
  const condition =
    conditionRaw &&
    (DEAL_CONDITIONS as readonly string[]).includes(conditionRaw)
      ? (conditionRaw as DealCondition)
      : "all";

  const categoryId = searchParams.get("categoryId");
  const categoryOk =
    categoryId &&
    categoryId !== "all" &&
    Number.isFinite(Number(categoryId)) &&
    Number(categoryId) > 0
      ? categoryId
      : "all";

  return {
    owner,
    categoryId: categoryOk,
    size: searchParams.get("size") ?? "",
    status,
    condition,
    purchasedFrom: searchParams.get("purchasedFrom") ?? "",
    purchasedTo: searchParams.get("purchasedTo") ?? "",
    soldFrom: searchParams.get("soldFrom") ?? "",
    soldTo: searchParams.get("soldTo") ?? "",
  };
}

export function reportFiltersToSearchParams(
  filters: ReportFilterState,
): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.owner !== "all") params.set("owner", filters.owner);
  if (filters.categoryId !== "all") params.set("categoryId", filters.categoryId);
  if (filters.size) params.set("size", filters.size);
  if (filters.status !== "all") params.set("status", filters.status);
  if (filters.condition !== "all") params.set("condition", filters.condition);
  if (filters.purchasedFrom) params.set("purchasedFrom", filters.purchasedFrom);
  if (filters.purchasedTo) params.set("purchasedTo", filters.purchasedTo);
  if (filters.soldFrom) params.set("soldFrom", filters.soldFrom);
  if (filters.soldTo) params.set("soldTo", filters.soldTo);
  return params;
}

export function reportFiltersToQueryString(filters: ReportFilterState): string {
  return reportFiltersToSearchParams(filters).toString();
}

export function reportFiltersAreRestrictive(filters: ReportFilterState): boolean {
  return (
    filters.owner !== "all" ||
    filters.categoryId !== "all" ||
    filters.size !== "" ||
    filters.status !== "all" ||
    filters.condition !== "all" ||
    filters.purchasedFrom !== "" ||
    filters.purchasedTo !== "" ||
    filters.soldFrom !== "" ||
    filters.soldTo !== ""
  );
}

/** DealFilters for listDeals — sold dates are applied after fetch. */
export function dealFiltersFromReport(
  filters: ReportFilterState,
): DealFilters {
  return {
    owner: filters.owner,
    categoryId:
      filters.categoryId === "all" ? "all" : Number(filters.categoryId),
    size: filters.size.trim() || undefined,
    status: filters.status,
    condition: filters.condition,
    purchasedFrom: filters.purchasedFrom || undefined,
    purchasedTo: filters.purchasedTo || undefined,
    sort: "newest",
  };
}

export function soldDateInRange(
  soldAt: string | null | undefined,
  soldFrom?: string,
  soldTo?: string,
): boolean {
  if (!soldAt) return false;
  const day = soldAt.slice(0, 10);
  if (soldFrom && day < soldFrom) return false;
  if (soldTo && day > soldTo) return false;
  return true;
}

function isReportFilterState(value: unknown): value is ReportFilterState {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  const statusOk =
    v.status === "all" || v.status === "in_stock" || v.status === "sold";
  const ownerOk =
    v.owner === "all" ||
    (typeof v.owner === "string" &&
      (DEAL_OWNERS as readonly string[]).includes(v.owner));
  const conditionOk =
    v.condition === "all" ||
    (typeof v.condition === "string" &&
      (DEAL_CONDITIONS as readonly string[]).includes(v.condition));
  return (
    statusOk &&
    ownerOk &&
    conditionOk &&
    typeof v.categoryId === "string" &&
    typeof v.size === "string" &&
    typeof v.purchasedFrom === "string" &&
    typeof v.purchasedTo === "string" &&
    typeof v.soldFrom === "string" &&
    typeof v.soldTo === "string"
  );
}

export function readStoredReportFilters(
  storageKey: string,
): ReportFilterState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isReportFilterState(parsed)) return null;
    return { ...DEFAULT_REPORT_FILTERS, ...parsed };
  } catch {
    return null;
  }
}

export function writeStoredReportFilters(
  storageKey: string,
  filters: ReportFilterState,
): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(filters));
  } catch {
    // Ignore quota / private mode failures.
  }
}

/** Parse report filters from an API request URL. */
export function reportFiltersFromRequestUrl(url: string): ReportFilterState {
  return reportFiltersFromSearchParams(new URL(url).searchParams);
}
