"use client";

import { useEffect, useState } from "react";
import { formatMoney, toInputDate } from "@/lib/format";

type Props = {
  open: boolean;
  dealName?: string;
  listPrice: number;
  cost?: number;
  onClose: () => void;
  onConfirm: (payload: { price: number; soldAt: string }) => Promise<void>;
};

export function MarkSoldDialog({
  open,
  dealName,
  listPrice,
  cost,
  onClose,
  onConfirm,
}: Props) {
  const [price, setPrice] = useState("");
  const [soldAt, setSoldAt] = useState(toInputDate());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setPrice(String(listPrice));
    setSoldAt(toInputDate());
    setError("");
    setBusy(false);
  }, [open, listPrice]);

  if (!open) return null;

  const salePrice = Number(price);
  const profit =
    !Number.isNaN(salePrice) && cost !== undefined
      ? salePrice - cost
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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="surface w-full max-w-md rounded-none border-black p-5"
      >
        <h2 className="page-title text-xl">Confirm sale price</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          {dealName ? (
            <>
              Selling <span className="font-medium text-[var(--ink)]">{dealName}</span>
              . Listed at {formatMoney(listPrice)}
              {cost !== undefined ? ` · cost ${formatMoney(cost)}` : ""}.
            </>
          ) : (
            <>Confirm the final sale price and date.</>
          )}
        </p>
        <div className="mt-4 grid gap-3">
          <div className="field">
            <label htmlFor="sold-price">Final sale price</label>
            <input
              id="sold-price"
              type="number"
              min="0"
              step="0.01"
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
              <span className={profit >= 0 ? "profit-pos" : "profit-neg"}>
                {formatMoney(profit)}
              </span>
            </p>
          ) : null}
        </div>
        {error ? <p className="mt-3 text-sm text-[var(--danger)]">{error}</p> : null}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? "Saving…" : "Confirm sold"}
          </button>
        </div>
      </form>
    </div>
  );
}
