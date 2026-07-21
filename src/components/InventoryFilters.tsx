"use client";

import {
  DEAL_OWNER_LABELS,
  DEAL_OWNERS,
  type Category,
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

type Props = {
  categories: Category[];
  value: InventoryFilterState;
  onChange: (next: InventoryFilterState) => void;
};

export function InventoryFilters({ categories, value, onChange }: Props) {
  function update<K extends keyof InventoryFilterState>(
    key: K,
    next: InventoryFilterState[K],
  ) {
    onChange({ ...value, [key]: next });
  }

  return (
    <section className="surface rounded-none p-4">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="field md:col-span-2 xl:col-span-2">
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
            <option value="in_stock">In stock</option>
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
              <option key={c.id} value={c.id}>
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
          <label htmlFor="from">Purchased from</label>
          <input
            id="from"
            type="date"
            value={value.purchasedFrom}
            onChange={(e) => update("purchasedFrom", e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="to">Purchased to</label>
          <input
            id="to"
            type="date"
            value={value.purchasedTo}
            onChange={(e) => update("purchasedTo", e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="sort">Sort</label>
          <select
            id="sort"
            value={value.sort}
            onChange={(e) =>
              update("sort", e.target.value as InventoryFilterState["sort"])
            }
          >
            <option value="newest">Newest</option>
            <option value="oldest">Oldest purchase</option>
            <option value="name">Name</option>
            <option value="profit">Profit</option>
            <option value="price">Price</option>
          </select>
        </div>
      </div>
    </section>
  );
}
