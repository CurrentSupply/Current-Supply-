"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { DealCard } from "@/components/DealCard";
import { DealList } from "@/components/DealList";
import { InventoryFilters } from "@/components/InventoryFilters";
import { InventoryViewToggle } from "@/components/InventoryViewToggle";
import { MarkSoldDialog } from "@/components/MarkSoldDialog";
import { PageHeader } from "@/components/PageHeader";
import { PageEmpty, PageError, PageLoading } from "@/components/PageStatus";
import { QuickEditDialog } from "@/components/QuickEditDialog";
import type { Category } from "@/db/schema";
import { markDealSold, patchDealFields } from "@/lib/dealClient";
import type { DealWithRelations } from "@/lib/deals";
import { getJson } from "@/lib/http";
import {
  DEFAULT_INVENTORY_FILTERS,
  filtersFromSearchParams,
  filtersToQueryString,
  filtersToSearchParams,
  inventoryFiltersAreRestrictive,
  type InventoryFilterState,
  readStoredInventoryFilters,
  searchParamsHaveFilters,
  writeStoredInventoryFilters,
} from "@/lib/inventoryFilters";
import {
  type InventoryViewMode,
  readStoredInventoryView,
  writeStoredInventoryView,
} from "@/lib/inventoryView";

function normalizeFilterQs(filters: InventoryFilterState): string {
  return filtersToQueryString(filters);
}

function InventoryPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [hydrated, setHydrated] = useState(false);
  const [filters, setFilters] = useState<InventoryFilterState>(
    DEFAULT_INVENTORY_FILTERS,
  );
  const [categories, setCategories] = useState<Category[]>([]);
  const [deals, setDeals] = useState<DealWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [soldTarget, setSoldTarget] = useState<DealWithRelations | null>(null);
  const [editTarget, setEditTarget] = useState<DealWithRelations | null>(null);
  const [view, setView] = useState<InventoryViewMode>("grid");
  /** Query string we last wrote — ignore matching searchParams echoes. */
  const lastWrittenQs = useRef<string | null>(null);
  /** Non-null while waiting for an initial localStorage → URL restore. */
  const pendingRestoreQs = useRef<string | null>(null);

  useEffect(() => {
    queueMicrotask(() => setView(readStoredInventoryView()));
  }, []);

  useEffect(() => {
    void getJson<Category[]>("/api/categories", "Failed to load categories.")
      .then(setCategories)
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Failed to load categories."),
      );
  }, []);

  // Hydrate once: URL wins, else restore saved filters into state + URL.
  useEffect(() => {
    queueMicrotask(() => {
      if (searchParamsHaveFilters(searchParams)) {
        const fromUrl = filtersFromSearchParams(searchParams);
        setFilters(fromUrl);
        lastWrittenQs.current = normalizeFilterQs(fromUrl);
        writeStoredInventoryFilters(fromUrl);
      } else {
        const stored = readStoredInventoryFilters();
        const qs = stored ? normalizeFilterQs(stored) : "";
        if (stored && qs) {
          setFilters(stored);
          lastWrittenQs.current = qs;
          pendingRestoreQs.current = qs;
          router.replace(`/inventory?${qs}`, { scroll: false });
        } else {
          setFilters(DEFAULT_INVENTORY_FILTERS);
          lastWrittenQs.current = "";
        }
      }
      setHydrated(true);
    });
    // Intentionally once on mount — do not re-restore when the URL goes bare.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Adopt external URL changes (back/forward, deep links) after hydrate.
  useEffect(() => {
    if (!hydrated) return;
    const fromUrl = filtersFromSearchParams(searchParams);
    const qs = normalizeFilterQs(fromUrl);

    if (pendingRestoreQs.current !== null) {
      if (qs === pendingRestoreQs.current) {
        pendingRestoreQs.current = null;
      }
      return;
    }

    if (lastWrittenQs.current !== null && qs === lastWrittenQs.current) {
      return;
    }
    lastWrittenQs.current = qs;
    queueMicrotask(() => {
      setFilters(fromUrl);
      writeStoredInventoryFilters(fromUrl);
    });
  }, [hydrated, searchParams]);

  const updateFilters = useCallback(
    (next: InventoryFilterState) => {
      setFilters(next);
      writeStoredInventoryFilters(next);
      const qs = normalizeFilterQs(next);
      lastWrittenQs.current = qs;
      router.replace(qs ? `/inventory?${qs}` : "/inventory", { scroll: false });
    },
    [router],
  );

  const updateView = useCallback((next: InventoryViewMode) => {
    writeStoredInventoryView(next);
    setView(next);
  }, []);

  const loadDeals = useCallback(async (active: InventoryFilterState) => {
    setLoading(true);
    setError("");
    try {
      const params = filtersToSearchParams(active);
      if (!params.has("sort")) params.set("sort", active.sort);

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
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const handle = setTimeout(() => {
      void loadDeals(filters);
    }, 200);
    return () => clearTimeout(handle);
  }, [filters, hydrated, loadDeals]);

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

      {loading || !hydrated ? (
        <PageLoading label="Loading deals…" />
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-label">
              {deals.length} {deals.length === 1 ? "deal" : "deals"}
            </p>
            <InventoryViewToggle value={view} onChange={updateView} />
          </div>

          {deals.length === 0 ? (
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
                !inventoryFiltersAreRestrictive(filters) ? (
                  <Link href="/inventory/new" className="btn btn-primary">
                    Add deal
                  </Link>
                ) : undefined
              }
            />
          ) : view === "list" ? (
            <DealList
              deals={deals}
              onMarkSold={setSoldTarget}
              onQuickEdit={setEditTarget}
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {deals.map((deal) => (
                <DealCard
                  key={deal.id}
                  deal={deal}
                  onMarkSold={setSoldTarget}
                  onQuickEdit={setEditTarget}
                />
              ))}
            </div>
          )}
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
          await loadDeals(filters);
        }}
      />

      <QuickEditDialog
        open={editTarget !== null}
        deal={editTarget}
        categories={categories}
        onClose={() => setEditTarget(null)}
        onSave={async (fields) => {
          if (!editTarget) return;
          await patchDealFields(editTarget.id, fields);
          await loadDeals(filters);
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
