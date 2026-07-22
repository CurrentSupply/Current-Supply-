"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { DealCard } from "@/components/DealCard";
import {
  InventoryFilters,
  type InventoryFilterState,
} from "@/components/InventoryFilters";
import { MarkSoldDialog } from "@/components/MarkSoldDialog";
import type { Category } from "@/db/schema";
import type { DealWithRelations } from "@/lib/deals";

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

  const load = useCallback(async () => {
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

      const [dealsRes, catsRes] = await Promise.all([
        fetch(`/api/deals?${params.toString()}`),
        fetch("/api/categories"),
      ]);
      if (!dealsRes.ok || !catsRes.ok) throw new Error("Failed to load inventory.");
      setDeals(await dealsRes.json());
      setCategories(await catsRes.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load inventory.");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    const handle = setTimeout(() => {
      void load();
    }, 200);
    return () => clearTimeout(handle);
  }, [load]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="page-kicker">Inventory</p>
          <h1 className="page-title mt-1 text-3xl sm:text-4xl">
            Your deals
          </h1>
          <p className="mt-1 text-[var(--muted)]">
            Log items, track cost vs price, and mark sales fast.
          </p>
        </div>
        <Link href="/inventory/new" className="btn btn-primary">
          Add deal
        </Link>
      </div>

      <InventoryFilters
        categories={categories}
        value={filters}
        onChange={setFilters}
      />

      {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}

      {loading ? (
        <p className="text-sm text-[var(--muted)]">Loading deals…</p>
      ) : deals.length === 0 ? (
        <div className="surface rounded-none px-6 py-14 text-center">
          <h2 className="page-title text-2xl">No deals match</h2>
          <p className="mt-2 text-[var(--muted)]">
            Add your first item or clear filters to see everything.
          </p>
          <Link href="/inventory/new" className="btn btn-primary mt-5">
            Add deal
          </Link>
        </div>
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
          const res = await fetch(`/api/deals/${soldTarget.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "sold", price, soldAt }),
          });
          if (!res.ok) {
            const data = await res.json();
            throw new Error(data.error || "Could not mark sold.");
          }
          await load();
        }}
      />
    </div>
  );
}
