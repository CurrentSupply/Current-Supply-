"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { DealCard } from "@/components/DealCard";
import { InventoryFilters } from "@/components/InventoryFilters";
import { MarkSoldDialog } from "@/components/MarkSoldDialog";
import { PageHeader } from "@/components/PageHeader";
import { PageEmpty, PageError, PageLoading } from "@/components/PageStatus";
import type { Category } from "@/db/schema";
import { markDealSold } from "@/lib/dealClient";
import type { DealWithRelations } from "@/lib/deals";
import { getJson } from "@/lib/http";
import {
  filtersFromSearchParams,
  filtersToQueryString,
  filtersToSearchParams,
  inventoryFiltersAreRestrictive,
  type InventoryFilterState,
  readStoredInventoryFilters,
  searchParamsHaveFilters,
  writeStoredInventoryFilters,
} from "@/lib/inventoryFilters";

function InventoryPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [restoreChecked, setRestoreChecked] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [deals, setDeals] = useState<DealWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [soldTarget, setSoldTarget] = useState<DealWithRelations | null>(null);

  const filters = useMemo(
    () => filtersFromSearchParams(searchParams),
    [searchParams],
  );

  useEffect(() => {
    void getJson<Category[]>("/api/categories", "Failed to load categories.")
      .then(setCategories)
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Failed to load categories."),
      );
  }, []);

  // Restore last filter/sort onto bare /inventory after leaving the page.
  useEffect(() => {
    if (searchParamsHaveFilters(searchParams)) {
      queueMicrotask(() => setRestoreChecked(true));
      return;
    }
    const stored = readStoredInventoryFilters();
    const qs = stored ? filtersToQueryString(stored) : "";
    if (qs) {
      router.replace(`/inventory?${qs}`, { scroll: false });
    }
    queueMicrotask(() => setRestoreChecked(true));
  }, [router, searchParams]);

  const updateFilters = useCallback(
    (next: InventoryFilterState) => {
      writeStoredInventoryFilters(next);
      const qs = filtersToQueryString(next);
      router.replace(qs ? `/inventory?${qs}` : "/inventory", { scroll: false });
    },
    [router],
  );

  const loadDeals = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = filtersToSearchParams(filters);
      if (!params.has("sort")) params.set("sort", filters.sort);

      const rows = await getJson<DealWithRelations[]>(
        `/api/deals?${params.toString()}`,
        "Failed to load inventory.",
      );
      setDeals(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load inventory.");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    if (!restoreChecked) return;
    // Wait until a pending localStorage → URL restore has landed in the address bar.
    if (!searchParamsHaveFilters(searchParams)) {
      const stored = readStoredInventoryFilters();
      if (stored && filtersToQueryString(stored)) return;
    }
    const handle = setTimeout(() => {
      void loadDeals();
    }, 200);
    return () => clearTimeout(handle);
  }, [loadDeals, restoreChecked, searchParams]);

  return (
    <div className="min-w-0 space-y-5">
      <PageHeader
        kicker="Inventory"
        title="Your deals"
        subtitle="Log items, track cost vs price, and mark sales fast."
        actions={
          <>
            <Link
              href="/inventory/bulk"
              className="btn btn-secondary w-full sm:w-auto"
            >
              Add many
            </Link>
            <Link href="/inventory/new" className="btn btn-primary w-full sm:w-auto">
              Add deal
            </Link>
          </>
        }
      />

      <InventoryFilters
        categories={categories}
        value={filters}
        onChange={updateFilters}
      />

      {error ? <PageError message={error} /> : null}

      {loading || !restoreChecked ? (
        <PageLoading label="Loading deals…" />
      ) : deals.length === 0 ? (
        <PageEmpty
          title={
            inventoryFiltersAreRestrictive(filters)
              ? "No deals match"
              : "No deals yet"
          }
          description={
            inventoryFiltersAreRestrictive(filters)
              ? "Try clearing filters or search to see everything."
              : "Add your first item to start tracking deals."
          }
          action={
            <Link href="/inventory/new" className="btn btn-primary">
              Add deal
            </Link>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {deals.map((deal) => (
            <DealCard
              key={deal.id}
              deal={deal}
              onMarkSold={setSoldTarget}
            />
          ))}
        </div>
      )}

      <MarkSoldDialog
        open={soldTarget !== null}
        dealName={soldTarget?.name}
        listPrice={soldTarget?.price ?? 0}
        cost={soldTarget?.cost}
        onClose={() => setSoldTarget(null)}
        onConfirm={async ({ price, soldAt }) => {
          if (!soldTarget) return;
          await markDealSold(soldTarget.id, { price, soldAt });
          await loadDeals();
        }}
      />
    </div>
  );
}

export default function InventoryPage() {
  return (
    <Suspense fallback={<PageLoading label="Loading deals…" />}>
      <InventoryPageInner />
    </Suspense>
  );
}
