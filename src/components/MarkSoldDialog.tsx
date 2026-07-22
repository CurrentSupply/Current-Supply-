"use client";

import { useState } from "react";
import { formatMoney, profitToneClass, toInputDate } from "@/lib/format";

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
    !Number.isNaN(salePrice) && cost !== undefined ? salePrice - cost : null;

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
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="surface flex max-h-[min(100dvh,100%)] w-full max-w-md flex-col overflow-hidden rounded-none border-black sm:max-h-[min(90dvh,100%)]"
      >
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-5 pb-3">
          <h2 className="page-title text-xl">Confirm sale price</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {dealName ? (
              <>
                Selling{" "}
                <span className="font-medium text-[var(--ink)]">{dealName}</span>
                . Listed at {formatMoney(listPrice)}
                {cost !== undefined ? ` · cost ${formatMoney(cost)}` : ""}.
              </>
            ) : (
              <>Confirm the final sale price and date.</>
            )}
          </p>
          <div className="mt-4 grid min-w-0 gap-3">
            <div className="field">
              <label htmlFor="sold-price">Final sale price</label>
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
              <label htmlFor="sold-at">Sold date</label>
              <input
                id="sold-at"
                type="date"
                value={soldAt}
                onChange={(e) => setSoldAt(e.target.value)}
                required
              />
            </div>
            {profit !== null ? (
              <p className="text-sm text-[var(--muted)]">
                Profit at this price:{" "}
                <span className={profitToneClass(profit)}>
                  {formatMoney(profit)}
                </span>
              </p>
            ) : null}
            {error ? (
              <p className="text-sm text-[var(--danger)]">{error}</p>
            ) : null}
          </div>
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
            {busy ? "Saving…" : "Confirm sold"}
          </button>
        </div>
      </form>
    </div>
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
