"use client";

import { useMemo, useState } from "react";
import {
  DEAL_CONDITION_LABELS,
  DEAL_CONDITIONS,
  DEAL_OWNER_LABELS,
  DEAL_OWNERS,
  parseDealCondition,
  parseDealOwner,
  type Category,
} from "@/db/schema";
import type { QuickEditDealFields } from "@/lib/dealClient";
import type { DealWithRelations } from "@/lib/deals";
import {
  calcProfit,
  formatMoney,
  profitToneClass,
} from "@/lib/format";

type Props = {
  open: boolean;
  deal: DealWithRelations | null;
  categories: Category[];
  onClose: () => void;
  onSave: (fields: QuickEditDealFields) => Promise<void>;
};

function QuickEditDialogForm({
  deal,
  categories,
  onClose,
  onSave,
}: {
  deal: DealWithRelations;
  categories: Category[];
  onClose: () => void;
  onSave: (fields: QuickEditDealFields) => Promise<void>;
}) {
  const [name, setName] = useState(deal.name);
  const [size, setSize] = useState(deal.size);
  const [cost, setCost] = useState(String(deal.cost));
  const [price, setPrice] = useState(String(deal.price));
  const [condition, setCondition] = useState(parseDealCondition(deal.condition));
  const [owner, setOwner] = useState(parseDealOwner(deal.owner));
  const [categoryId, setCategoryId] = useState(
    deal.categoryId ? String(deal.categoryId) : "",
  );
  const [platform, setPlatform] = useState(deal.platform ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const costNum = Number(cost);
  const priceNum = Number(price);
  const profit = useMemo(() => {
    if (!Number.isFinite(costNum) || !Number.isFinite(priceNum)) return null;
    return calcProfit(priceNum, costNum);
  }, [costNum, priceNum]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmedName = name.trim();
    const trimmedSize = size.trim();
    if (!trimmedName) {
      setError("Name is required.");
      return;
    }
    if (!trimmedSize) {
      setError("Size is required.");
      return;
    }
    if (!Number.isFinite(costNum) || costNum < 0) {
      setError("Enter a valid cost.");
      return;
    }
    if (!Number.isFinite(priceNum) || priceNum < 0) {
      setError("Enter a valid price.");
      return;
    }
    const category = Number(categoryId);
    if (!Number.isFinite(category) || category <= 0) {
      setError("Category is required.");
      return;
    }

    setBusy(true);
    setError("");
    try {
      await onSave({
        name: trimmedName,
        size: trimmedSize,
        cost: costNum,
        price: priceNum,
        condition,
        owner,
        categoryId: category,
        platform: platform.trim(),
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save deal.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <form
        onSubmit={(e) => void submit(e)}
        onClick={(e) => e.stopPropagation()}
        className="surface flex max-h-[min(100dvh,100%)] w-full max-w-lg flex-col overflow-hidden rounded-none border-black sm:max-h-[min(90dvh,100%)]"
      >
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-5 pb-3">
          <div>
            <p className="page-kicker">Quick edit</p>
            <h2 className="page-title mt-1 text-xl">Update deal</h2>
          </div>

          <div className="mt-4 grid min-w-0 gap-3 sm:grid-cols-2">
            <div className="field sm:col-span-2">
              <label htmlFor="quick-name">Item name</label>
              <input
                id="quick-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
                required
              />
            </div>
            <div className="field">
              <label htmlFor="quick-size">Size</label>
              <input
                id="quick-size"
                value={size}
                onChange={(e) => setSize(e.target.value)}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="quick-category">Category</label>
              <select
                id="quick-category"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                required
              >
                <option value="">Select…</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="quick-cost">Cost</label>
              <input
                id="quick-cost"
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={cost}
                onChange={(e) => setCost(e.target.value)}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="quick-price">Price</label>
              <input
                id="quick-price"
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="quick-condition">Condition</label>
              <select
                id="quick-condition"
                value={condition}
                onChange={(e) =>
                  setCondition(parseDealCondition(e.target.value))
                }
              >
                {DEAL_CONDITIONS.map((c) => (
                  <option key={c} value={c}>
                    {DEAL_CONDITION_LABELS[c]}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="quick-owner">Owner</label>
              <select
                id="quick-owner"
                value={owner}
                onChange={(e) => setOwner(parseDealOwner(e.target.value))}
              >
                {DEAL_OWNERS.map((o) => (
                  <option key={o} value={o}>
                    {DEAL_OWNER_LABELS[o]}
                  </option>
                ))}
              </select>
            </div>
            <div className="field sm:col-span-2">
              <label htmlFor="quick-platform">Platform</label>
              <input
                id="quick-platform"
                value={platform}
                onChange={(e) => setPlatform(e.target.value)}
                placeholder="eBay, GOAT…"
              />
            </div>
          </div>

          {profit !== null ? (
            <p className="mt-3 text-sm text-[var(--muted)]">
              Profit at these numbers:{" "}
              <span className={profitToneClass(profit)}>
                {formatMoney(profit)}
              </span>
            </p>
          ) : null}
          {error ? (
            <p className="mt-3 text-sm text-[var(--danger)]">{error}</p>
          ) : null}
        </div>

        <div className="sticky bottom-0 flex shrink-0 flex-col gap-2 border-t border-[var(--line)] bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:flex-row sm:justify-end">
          <button
            type="button"
            className="btn btn-secondary w-full sm:w-auto"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn-primary w-full sm:w-auto"
            disabled={busy}
          >
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </div>
  );
}

export function QuickEditDialog({ open, deal, ...props }: Props) {
  if (!open || !deal) return null;
  return (
    <QuickEditDialogForm
      key={deal.id}
      deal={deal}
      {...props}
    />
  );
}
