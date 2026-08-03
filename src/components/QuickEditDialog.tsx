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
import { Dialog } from "@/components/ui";

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
    <Dialog
      open={true}
      onClose={onClose}
      title="Edit Deal"
      description="Update the details for this item."
      size="md"
      footer={
        <>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            type="submit"
            form="quick-edit-form"
            className="btn btn-primary"
            disabled={busy}
          >
            {busy ? "Saving…" : "Save Changes"}
          </button>
        </>
      }
    >
      <form id="quick-edit-form" onSubmit={(e) => void submit(e)} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="field sm:col-span-2">
            <label htmlFor="quick-name">Item Name</label>
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
              onChange={(e) => setCondition(parseDealCondition(e.target.value))}
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
              placeholder="eBay, GOAT, StockX…"
            />
          </div>
        </div>

        {profit !== null && (
          <p className="text-sm text-[var(--text-secondary)]">
            Profit at these numbers:{" "}
            <span className={profitToneClass(profit)}>
              {formatMoney(profit)}
            </span>
          </p>
        )}

        {error && (
          <p className="text-sm text-[var(--color-error)]">{error}</p>
        )}
      </form>
    </Dialog>
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
