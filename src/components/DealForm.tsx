"use client";

import { useMemo, useState } from "react";
import {
  DEAL_OWNER_LABELS,
  DEAL_OWNERS,
  parseDealOwner,
  type Category,
  type Deal,
  type DealOwner,
} from "@/db/schema";
import { toInputDate } from "@/lib/format";

export type DealFormValues = {
  name: string;
  size: string;
  cost: string;
  price: string;
  condition: string;
  categoryId: string;
  status: "in_stock" | "sold";
  owner: DealOwner;
  purchasedAt: string;
  soldAt: string;
  notes: string;
  platform: string;
};

type Props = {
  categories: Category[];
  initial?: Partial<Deal>;
  submitLabel: string;
  onSubmit: (values: DealFormValues) => Promise<void>;
  onCancel?: () => void;
};

function fromDeal(deal?: Partial<Deal>): DealFormValues {
  return {
    name: deal?.name ?? "",
    size: deal?.size ?? "",
    cost: deal?.cost !== undefined ? String(deal.cost) : "",
    price: deal?.price !== undefined ? String(deal.price) : "",
    condition: deal?.condition ?? "",
    categoryId: deal?.categoryId ? String(deal.categoryId) : "",
    status: deal?.status === "sold" ? "sold" : "in_stock",
    owner: parseDealOwner(deal?.owner),
    purchasedAt: toInputDate(deal?.purchasedAt),
    soldAt: deal?.soldAt ? toInputDate(deal.soldAt) : "",
    notes: deal?.notes ?? "",
    platform: deal?.platform ?? "",
  };
}

export function DealForm({
  categories,
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: Props) {
  const [values, setValues] = useState<DealFormValues>(() => fromDeal(initial));
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const profitPreview = useMemo(() => {
    const cost = Number(values.cost);
    const price = Number(values.price);
    if (Number.isNaN(cost) || Number.isNaN(price)) return null;
    return price - cost;
  }, [values.cost, values.price]);

  function update<K extends keyof DealFormValues>(key: K, value: DealFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!values.name.trim() || !values.size.trim()) {
      setError("Name and size are required.");
      return;
    }
    if (Number.isNaN(Number(values.cost)) || Number.isNaN(Number(values.price))) {
      setError("Cost and price must be valid numbers.");
      return;
    }
    if (!values.purchasedAt) {
      setError("Purchase date is required.");
      return;
    }
    if (values.status === "sold" && !values.soldAt) {
      setError("Sold date is required when status is sold.");
      return;
    }

    setBusy(true);
    setError("");
    try {
      await onSubmit(values);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save deal.");
      setBusy(false);
      return;
    }
    setBusy(false);
  }

  return (
    <form onSubmit={handleSubmit} className="surface rounded-none p-5 sm:p-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="field sm:col-span-2">
          <label htmlFor="name">Item name</label>
          <input
            id="name"
            value={values.name}
            onChange={(e) => update("name", e.target.value)}
            placeholder="Jordan 1 Retro High OG"
            required
          />
        </div>
        <div className="field">
          <label htmlFor="size">Size</label>
          <input
            id="size"
            value={values.size}
            onChange={(e) => update("size", e.target.value)}
            placeholder="10.5"
            required
          />
        </div>
        <div className="field">
          <label htmlFor="categoryId">Category</label>
          <select
            id="categoryId"
            value={values.categoryId}
            onChange={(e) => update("categoryId", e.target.value)}
          >
            <option value="">Uncategorized</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="owner">Owner</label>
          <select
            id="owner"
            value={values.owner}
            onChange={(e) => update("owner", e.target.value as DealOwner)}
            required
          >
            {DEAL_OWNERS.map((owner) => (
              <option key={owner} value={owner}>
                {DEAL_OWNER_LABELS[owner]}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="cost">Cost</label>
          <input
            id="cost"
            type="number"
            min="0"
            step="0.01"
            value={values.cost}
            onChange={(e) => update("cost", e.target.value)}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="price">Price</label>
          <input
            id="price"
            type="number"
            min="0"
            step="0.01"
            value={values.price}
            onChange={(e) => update("price", e.target.value)}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="status">Status</label>
          <select
            id="status"
            value={values.status}
            onChange={(e) =>
              update("status", e.target.value as "in_stock" | "sold")
            }
          >
            <option value="in_stock">In stock</option>
            <option value="sold">Sold</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="platform">Platform</label>
          <input
            id="platform"
            value={values.platform}
            onChange={(e) => update("platform", e.target.value)}
            placeholder="eBay, StockX, Facebook…"
          />
        </div>
        <div className="field">
          <label htmlFor="purchasedAt">Purchased</label>
          <input
            id="purchasedAt"
            type="date"
            value={values.purchasedAt}
            onChange={(e) => update("purchasedAt", e.target.value)}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="soldAt">Sold date</label>
          <input
            id="soldAt"
            type="date"
            value={values.soldAt}
            onChange={(e) => update("soldAt", e.target.value)}
            disabled={values.status !== "sold"}
          />
        </div>
        <div className="field sm:col-span-2">
          <label htmlFor="condition">Condition notes</label>
          <textarea
            id="condition"
            rows={2}
            value={values.condition}
            onChange={(e) => update("condition", e.target.value)}
            placeholder="DS, VNDS, box condition…"
          />
        </div>
        <div className="field sm:col-span-2">
          <label htmlFor="notes">Notes</label>
          <textarea
            id="notes"
            rows={3}
            value={values.notes}
            onChange={(e) => update("notes", e.target.value)}
            placeholder="Source, buyer info, anything useful…"
          />
        </div>
      </div>

      {profitPreview !== null ? (
        <p className="mt-4 text-sm text-[var(--muted)]">
          Profit preview:{" "}
          <span className={profitPreview >= 0 ? "profit-pos" : "profit-neg"}>
            {profitPreview >= 0 ? "+" : ""}
            {profitPreview.toFixed(2)}
          </span>
        </p>
      ) : null}

      {error ? <p className="mt-3 text-sm text-[var(--danger)]">{error}</p> : null}

      <div className="mt-5 flex flex-wrap gap-2">
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? "Saving…" : submitLabel}
        </button>
        {onCancel ? (
          <button type="button" className="btn btn-secondary" onClick={onCancel}>
            Cancel
          </button>
        ) : null}
      </div>
    </form>
  );
}
