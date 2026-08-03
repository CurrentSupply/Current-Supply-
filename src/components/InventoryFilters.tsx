"use client";

import { useState } from "react";
import {
  DEAL_OWNER_LABELS,
  DEAL_OWNERS,
  type Category,
} from "@/db/schema";
import type { InventoryFilterState } from "@/lib/inventoryFilters";

export type { InventoryFilterState } from "@/lib/inventoryFilters";

type Props = {
  categories: Category[];
  value: InventoryFilterState;
  onChange: (next: InventoryFilterState) => void;
};

function hasActiveFilters(value: InventoryFilterState): boolean {
  return (
    value.q !== "" ||
    value.status !== "all" ||
    value.owner !== "all" ||
    value.categoryId !== "all" ||
    value.size !== "" ||
    value.purchasedFrom !== "" ||
    value.purchasedTo !== "" ||
    value.sort !== "newest"
  );
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      className={`transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
    >
      <path
        d="M4 6L8 10L12 6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function InventoryFilters({ categories, value, onChange }: Props) {
  const [expanded, setExpanded] = useState(false);
  const activeFilters = hasActiveFilters(value);

  function update<K extends keyof InventoryFilterState>(
    key: K,
    next: InventoryFilterState[K],
  ) {
    onChange({ ...value, [key]: next });
  }

  function clearFilters() {
    onChange({
      q: "",
      status: "all",
      owner: "all",
      categoryId: "all",
      size: "",
      purchasedFrom: "",
      purchasedTo: "",
      sort: "newest",
    });
  }

  return (
    <section className="card">
      {/* Mobile: Collapsible header */}
      <div className="sm:hidden">
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="flex w-full items-center justify-between p-4"
        >
          <div className="flex items-center gap-2">
            <span className="font-medium">Filters</span>
            {activeFilters && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--text-primary)] text-xs text-[var(--text-inverse)]">
                !
              </span>
            )}
          </div>
          <ChevronIcon expanded={expanded} />
        </button>
        
        {expanded && (
          <div className="border-t border-[var(--border-secondary)] p-4 pt-4">
            <div className="grid gap-4">
              <div className="field">
                <label htmlFor="search-mobile">Search</label>
                <input
                  id="search-mobile"
                  value={value.q}
                  onChange={(e) => update("q", e.target.value)}
                  placeholder="Name, notes, condition…"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="field">
                  <label htmlFor="status-mobile">Status</label>
                  <select
                    id="status-mobile"
                    value={value.status}
                    onChange={(e) =>
                      update("status", e.target.value as InventoryFilterState["status"])
                    }
                  >
                    <option value="all">All</option>
                    <option value="in_stock">In Stock</option>
                    <option value="sold">Sold</option>
                  </select>
                </div>

                <div className="field">
                  <label htmlFor="sort-mobile">Sort</label>
                  <select
                    id="sort-mobile"
                    value={value.sort}
                    onChange={(e) =>
                      update("sort", e.target.value as InventoryFilterState["sort"])
                    }
                  >
                    <option value="newest">Newest</option>
                    <option value="oldest">Oldest</option>
                    <option value="name">Name</option>
                    <option value="profit">Profit</option>
                    <option value="price">Price</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="field">
                  <label htmlFor="owner-mobile">Owner</label>
                  <select
                    id="owner-mobile"
                    value={value.owner}
                    onChange={(e) =>
                      update("owner", e.target.value as InventoryFilterState["owner"])
                    }
                  >
                    <option value="all">All</option>
                    {DEAL_OWNERS.map((owner) => (
                      <option key={owner} value={owner}>
                        {DEAL_OWNER_LABELS[owner]}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="field">
                  <label htmlFor="category-mobile">Category</label>
                  <select
                    id="category-mobile"
                    value={value.categoryId}
                    onChange={(e) => update("categoryId", e.target.value)}
                  >
                    <option value="all">All</option>
                    {categories.map((c) => (
                      <option key={c.id} value={String(c.id)}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="field">
                <label htmlFor="size-mobile">Size</label>
                <input
                  id="size-mobile"
                  value={value.size}
                  onChange={(e) => update("size", e.target.value)}
                  placeholder="10.5"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="field">
                  <label htmlFor="from-mobile">From</label>
                  <input
                    id="from-mobile"
                    type="date"
                    value={value.purchasedFrom}
                    onChange={(e) => update("purchasedFrom", e.target.value)}
                  />
                </div>

                <div className="field">
                  <label htmlFor="to-mobile">To</label>
                  <input
                    id="to-mobile"
                    type="date"
                    value={value.purchasedTo}
                    onChange={(e) => update("purchasedTo", e.target.value)}
                  />
                </div>
              </div>

              {activeFilters && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="btn btn-ghost text-[var(--color-error)]"
                >
                  Clear filters
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Desktop: Always visible grid */}
      <div className="hidden sm:block p-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="field sm:col-span-2">
            <label htmlFor="search">Search</label>
            <input
              id="search"
              value={value.q}
              onChange={(e) => update("q", e.target.value)}
              placeholder="Name, notes, condition…"
            />
          </div>

          <div className="field">
            <label htmlFor="status">Status</label>
            <select
              id="status"
              value={value.status}
              onChange={(e) =>
                update("status", e.target.value as InventoryFilterState["status"])
              }
            >
              <option value="all">All</option>
              <option value="in_stock">In Stock</option>
              <option value="sold">Sold</option>
            </select>
          </div>

          <div className="field">
            <label htmlFor="owner">Owner</label>
            <select
              id="owner"
              value={value.owner}
              onChange={(e) =>
                update("owner", e.target.value as InventoryFilterState["owner"])
              }
            >
              <option value="all">All</option>
              {DEAL_OWNERS.map((owner) => (
                <option key={owner} value={owner}>
                  {DEAL_OWNER_LABELS[owner]}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="category">Category</label>
            <select
              id="category"
              value={value.categoryId}
              onChange={(e) => update("categoryId", e.target.value)}
            >
              <option value="all">All</option>
              {categories.map((c) => (
                <option key={c.id} value={String(c.id)}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="size">Size</label>
            <input
              id="size"
              value={value.size}
              onChange={(e) => update("size", e.target.value)}
              placeholder="10.5"
            />
          </div>

          <div className="field">
            <label htmlFor="from">Purchased From</label>
            <input
              id="from"
              type="date"
              value={value.purchasedFrom}
              onChange={(e) => update("purchasedFrom", e.target.value)}
            />
          </div>

          <div className="field">
            <label htmlFor="to">Purchased To</label>
            <input
              id="to"
              type="date"
              value={value.purchasedTo}
              onChange={(e) => update("purchasedTo", e.target.value)}
            />
          </div>

          <div className="field">
            <label htmlFor="sort">Sort By</label>
            <select
              id="sort"
              value={value.sort}
              onChange={(e) =>
                update("sort", e.target.value as InventoryFilterState["sort"])
              }
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="name">Name</option>
              <option value="profit">Profit</option>
              <option value="price">Price</option>
            </select>
          </div>
        </div>
      </div>
    </section>
  );
}
