"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { DealCard } from "@/components/DealCard";
import {
  InventoryFilters,
  type InventoryFilterState,
} from "@/components/InventoryFilters";
import { MarkSoldDialog } from "@/components/MarkSoldDialog";
import { PageHeader } from "@/components/PageHeader";
import { PageEmpty, PageError, PageLoading } from "@/components/PageStatus";
import type { Category } from "@/db/schema";
import { markDealSold } from "@/lib/dealClient";
import type { DealWithRelations } from "@/lib/deals";
import { getJson } from "@/lib/http";

const defaultFilters: InventoryFilterState = {
  q: "",
  status: "all",
  owner: "all",
  categoryId: "all",
  size: "",
  purchasedFrom: "",
  purchasedTo: "",
  sort: "newest",
};

export default function InventoryPage() {
  const [filters, setFilters] = useState<InventoryFilterState>(defaultFilters);
  const [categories, setCategories] = useState<Category[]>([]);
  const [deals, setDeals] = useState<DealWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [soldTarget, setSoldTarget] = useState<DealWithRelations | null>(null);

  useEffect(() => {
    void getJson<Category[]>("/api/categories", "Failed to load categories.")
      .then(setCategories)
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Failed to load categories."),
      );
  }, []);

  const loadDeals = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (filters.q) params.set("q", filters.q);
      if (filters.status !== "all") params.set("status", filters.status);
      if (filters.owner !== "all") params.set("owner", filters.owner);
      if (filters.categoryId !== "all") params.set("categoryId", filters.categoryId);
      if (filters.size) params.set("size", filters.size);
      if (filters.purchasedFrom) params.set("purchasedFrom", filters.purchasedFrom);
      if (filters.purchasedTo) params.set("purchasedTo", filters.purchasedTo);
      params.set("sort", filters.sort);

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
    const handle = setTimeout(() => {
      void loadDeals();
    }, 200);
    return () => clearTimeout(handle);
  }, [loadDeals]);

  return (
    <div className="min-w-0 space-y-5">
      <PageHeader
        kicker="Inventory"
        title="Your deals"
        subtitle="Log items, track cost vs price, and mark sales fast."
        actions={
          <Link href="/inventory/new" className="btn btn-primary w-full sm:w-auto">
            Add deal
          </Link>
        }
      />

      <InventoryFilters
        categories={categories}
        value={filters}
        onChange={setFilters}
      />

      {error ? <PageError message={error} /> : null}

      {loading ? (
        <PageLoading label="Loading deals…" />
      ) : deals.length === 0 ? (
        <PageEmpty
          title="No deals match"
          description="Add your first item or clear filters to see everything."
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
