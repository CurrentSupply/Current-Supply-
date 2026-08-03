"use client";

import { useState } from "react";
import { formatMoney, calcProfit, profitToneClass, toInputDate } from "@/lib/format";
import { Dialog } from "@/components/ui";

type Props = {
  open: boolean;
  dealName?: string;
  listPrice: number;
  cost?: number;
  onClose: () => void;
  onConfirm: (payload: { price: number; soldAt: string }) => Promise<void>;
};

function MarkSoldDialogForm({
  dealName,
  listPrice,
  cost,
  onClose,
  onConfirm,
}: Omit<Props, "open">) {
  const [price, setPrice] = useState(String(listPrice));
  const [soldAt, setSoldAt] = useState(toInputDate());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const salePrice = Number(price);
  const profit =
    !Number.isNaN(salePrice) && cost !== undefined
      ? calcProfit(salePrice, cost)
      : null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (Number.isNaN(salePrice) || salePrice < 0) {
      setError("Enter a valid sale price.");
      return;
    }
    if (!soldAt) {
      setError("Sold date is required.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await onConfirm({ price: salePrice, soldAt });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not mark as sold.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={true}
      onClose={onClose}
      title="Confirm Sale"
      description={
        dealName
          ? `Selling ${dealName}. Listed at ${formatMoney(listPrice)}${cost !== undefined ? ` · cost ${formatMoney(cost)}` : ""}.`
          : "Confirm the final sale price and date."
      }
      size="sm"
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
            form="mark-sold-form"
            className="btn btn-primary"
            disabled={busy}
          >
            {busy ? "Saving…" : "Confirm Sale"}
          </button>
        </>
      }
    >
      <form id="mark-sold-form" onSubmit={submit} className="space-y-4">
        <div className="field">
          <label htmlFor="sold-price">Final Sale Price</label>
          <input
            id="sold-price"
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            autoFocus
            required
          />
        </div>

        <div className="field">
          <label htmlFor="sold-at">Sold Date</label>
          <input
            id="sold-at"
            type="date"
            value={soldAt}
            onChange={(e) => setSoldAt(e.target.value)}
            required
          />
        </div>

        {profit !== null && (
          <p className="text-sm text-[var(--text-secondary)]">
            Profit at this price:{" "}
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

export function MarkSoldDialog({ open, ...props }: Props) {
  if (!open) return null;
  return (
    <MarkSoldDialogForm
      key={`${props.dealName ?? ""}-${props.listPrice}`}
      {...props}
    />
  );
}
