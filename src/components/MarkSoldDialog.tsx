"use client";

import { useState } from "react";
import { toInputDate } from "@/lib/format";

type Props = {
  open: boolean;
  currentPrice: number;
  onClose: () => void;
  onConfirm: (payload: { price: number; soldAt: string }) => Promise<void>;
};

export function MarkSoldDialog({ open, currentPrice, onClose, onConfirm }: Props) {
  const [price, setPrice] = useState(String(currentPrice));
  const [soldAt, setSoldAt] = useState(toInputDate());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (!open) return null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const value = Number(price);
    if (Number.isNaN(value) || value < 0) {
      setError("Enter a valid sale price.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await onConfirm({ price: value, soldAt });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not mark as sold.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(12,20,26,0.45)] p-4">
      <form onSubmit={submit} className="surface w-full max-w-md rounded-2xl p-5">
        <h2 className="text-lg font-semibold">Mark as sold</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Confirm the final sale price and date.
        </p>
        <div className="mt-4 grid gap-3">
          <div className="field">
            <label htmlFor="sold-price">Sale price</label>
            <input
              id="sold-price"
              type="number"
              min="0"
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
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
        </div>
        {error ? <p className="mt-3 text-sm text-[var(--danger)]">{error}</p> : null}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? "Saving…" : "Mark sold"}
          </button>
        </div>
      </form>
    </div>
  );
}
