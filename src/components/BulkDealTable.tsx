"use client";

import { useMemo, useState } from "react";
import {
  DEAL_CONDITION_LABELS,
  DEAL_CONDITIONS,
  DEAL_OWNER_LABELS,
  DEAL_OWNERS,
  type Category,
  type DealCondition,
  type DealOwner,
} from "@/db/schema";
import { createDealsBulk, type SerializedDealPayload } from "@/lib/dealClient";
import { toInputDate } from "@/lib/format";

type BulkRow = {
  key: string;
  name: string;
  size: string;
  cost: string;
  price: string;
  categoryId: string;
  owner: DealOwner;
  condition: DealCondition;
  purchasedAt: string;
};

type Props = {
  categories: Category[];
  onSuccess: () => void;
  onCancel?: () => void;
};

let rowSeq = 0;
function nextKey() {
  rowSeq += 1;
  return `row-${rowSeq}-${Date.now()}`;
}

function emptyRow(defaults?: Partial<BulkRow>): BulkRow {
  return {
    key: nextKey(),
    name: "",
    size: "",
    cost: "",
    price: "",
    categoryId: defaults?.categoryId ?? "",
    owner: defaults?.owner ?? "other",
    condition: defaults?.condition ?? "Used",
    purchasedAt: defaults?.purchasedAt ?? toInputDate(),
  };
}

function isBlankRow(row: BulkRow): boolean {
  return !row.name.trim() && !row.size.trim() && !row.cost.trim() && !row.price.trim();
}

function validateRow(row: BulkRow): string | null {
  if (!row.name.trim()) return "Name is required.";
  if (!row.size.trim()) return "Size is required.";
  if (!row.cost.trim() || !Number.isFinite(Number(row.cost))) return "Cost is required.";
  if (!row.price.trim() || !Number.isFinite(Number(row.price))) return "Price is required.";
  if (!row.purchasedAt) return "Purchase date is required.";
  if (!row.categoryId || Number(row.categoryId) <= 0) return "Category is required.";
  return null;
}

function toPayload(row: BulkRow): SerializedDealPayload {
  return {
    name: row.name.trim(),
    size: row.size.trim(),
    cost: Number(row.cost),
    price: Number(row.price),
    condition: row.condition,
    hasBox: false,
    hasInsoles: false,
    categoryId: Number(row.categoryId),
    status: "in_stock",
    owner: row.owner,
    purchasedAt: row.purchasedAt,
    soldAt: null,
    notes: "",
    platform: "",
  };
}

export function BulkDealTable({ categories, onSuccess, onCancel }: Props) {
  const [rows, setRows] = useState<BulkRow[]>(() =>
    Array.from({ length: 5 }, () => emptyRow()),
  );
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);

  const filledCount = useMemo(
    () => rows.filter((row) => !isBlankRow(row)).length,
    [rows],
  );

  function updateRow<K extends keyof BulkRow>(key: string, field: K, value: BulkRow[K]) {
    setRows((prev) =>
      prev.map((row) => (row.key === key ? { ...row, [field]: value } : row)),
    );
    setRowErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  function addRow() {
    setRows((prev) => {
      const last = prev[prev.length - 1];
      return [
        ...prev,
        emptyRow({
          categoryId: last?.categoryId,
          owner: last?.owner,
          condition: last?.condition,
          purchasedAt: last?.purchasedAt ?? toInputDate(),
        }),
      ];
    });
  }

  function removeRow(key: string) {
    setRows((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((row) => row.key !== key);
    });
    setRowErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  async function onSave() {
    setFormError("");
    const candidates = rows.filter((row) => !isBlankRow(row));
    if (candidates.length === 0) {
      setFormError("Fill in at least one row to save.");
      return;
    }

    const errors: Record<string, string> = {};
    for (const row of candidates) {
      const message = validateRow(row);
      if (message) errors[row.key] = message;
    }
    if (Object.keys(errors).length > 0) {
      setRowErrors(errors);
      setFormError("Fix the highlighted rows, then try again.");
      return;
    }

    setBusy(true);
    try {
      const result = await createDealsBulk(candidates.map(toPayload));
      if (result.failed && result.failed.length > 0) {
        const nextErrors: Record<string, string> = {};
        for (const failure of result.failed) {
          const row = candidates[failure.index];
          if (row) nextErrors[row.key] = failure.error;
        }
        setRowErrors(nextErrors);
        if (result.created.length === 0) {
          setFormError("No deals were saved. Check row errors below.");
          return;
        }
        setFormError(
          `Saved ${result.created.length}, but ${result.failed.length} failed.`,
        );
        const failedKeys = new Set(Object.keys(nextErrors));
        setRows((prev) => prev.filter((row) => failedKeys.has(row.key)));
        return;
      }
      onSuccess();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not create deals.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--text-secondary)]">
        Enter deals as rows — no photo upload here. Covers are filled from each title when possible.
        Blank rows are skipped. Status is always in stock.
      </p>

      {formError && (
        <div className="alert alert-error">{formError}</div>
      )}

      <div className="table-container overflow-x-auto">
        <table className="table min-w-[960px]">
          <thead>
            <tr>
              <th>Name</th>
              <th>Size</th>
              <th>Cost</th>
              <th>Price</th>
              <th>Category</th>
              <th>Owner</th>
              <th>Condition</th>
              <th>Purchased</th>
              <th className="w-12"><span className="sr-only">Remove</span></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const error = rowErrors[row.key];
              return (
                <tr
                  key={row.key}
                  className={error ? "bg-[var(--color-error-subtle)]" : ""}
                >
                  <td className="align-top">
                    <div className="field">
                      <label className="sr-only" htmlFor={`${row.key}-name`}>
                        Name {index + 1}
                      </label>
                      <input
                        id={`${row.key}-name`}
                        value={row.name}
                        onChange={(e) => updateRow(row.key, "name", e.target.value)}
                        placeholder="Jordan 1…"
                        disabled={busy}
                      />
                    </div>
                    {error && (
                      <p className="mt-1 text-xs text-[var(--color-error)]">{error}</p>
                    )}
                  </td>
                  <td>
                    <div className="field">
                      <label className="sr-only" htmlFor={`${row.key}-size`}>
                        Size {index + 1}
                      </label>
                      <input
                        id={`${row.key}-size`}
                        value={row.size}
                        onChange={(e) => updateRow(row.key, "size", e.target.value)}
                        placeholder="10.5"
                        disabled={busy}
                      />
                    </div>
                  </td>
                  <td>
                    <div className="field">
                      <label className="sr-only" htmlFor={`${row.key}-cost`}>
                        Cost {index + 1}
                      </label>
                      <input
                        id={`${row.key}-cost`}
                        type="number"
                        min="0"
                        step="0.01"
                        value={row.cost}
                        onChange={(e) => updateRow(row.key, "cost", e.target.value)}
                        disabled={busy}
                      />
                    </div>
                  </td>
                  <td>
                    <div className="field">
                      <label className="sr-only" htmlFor={`${row.key}-price`}>
                        Price {index + 1}
                      </label>
                      <input
                        id={`${row.key}-price`}
                        type="number"
                        min="0"
                        step="0.01"
                        value={row.price}
                        onChange={(e) => updateRow(row.key, "price", e.target.value)}
                        disabled={busy}
                      />
                    </div>
                  </td>
                  <td>
                    <div className="field">
                      <label className="sr-only" htmlFor={`${row.key}-category`}>
                        Category {index + 1}
                      </label>
                      <select
                        id={`${row.key}-category`}
                        value={row.categoryId}
                        onChange={(e) => updateRow(row.key, "categoryId", e.target.value)}
                        disabled={busy}
                      >
                        <option value="">Select</option>
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                  </td>
                  <td>
                    <div className="field">
                      <label className="sr-only" htmlFor={`${row.key}-owner`}>
                        Owner {index + 1}
                      </label>
                      <select
                        id={`${row.key}-owner`}
                        value={row.owner}
                        onChange={(e) =>
                          updateRow(row.key, "owner", e.target.value as DealOwner)
                        }
                        disabled={busy}
                      >
                        {DEAL_OWNERS.map((owner) => (
                          <option key={owner} value={owner}>{DEAL_OWNER_LABELS[owner]}</option>
                        ))}
                      </select>
                    </div>
                  </td>
                  <td>
                    <div className="field">
                      <label className="sr-only" htmlFor={`${row.key}-condition`}>
                        Condition {index + 1}
                      </label>
                      <select
                        id={`${row.key}-condition`}
                        value={row.condition}
                        onChange={(e) =>
                          updateRow(row.key, "condition", e.target.value as DealCondition)
                        }
                        disabled={busy}
                      >
                        {DEAL_CONDITIONS.map((condition) => (
                          <option key={condition} value={condition}>
                            {DEAL_CONDITION_LABELS[condition]}
                          </option>
                        ))}
                      </select>
                    </div>
                  </td>
                  <td>
                    <div className="field">
                      <label className="sr-only" htmlFor={`${row.key}-purchased`}>
                        Purchased {index + 1}
                      </label>
                      <input
                        id={`${row.key}-purchased`}
                        type="date"
                        value={row.purchasedAt}
                        onChange={(e) => updateRow(row.key, "purchasedAt", e.target.value)}
                        disabled={busy}
                      />
                    </div>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="btn btn-ghost btn-icon"
                      onClick={() => removeRow(row.key)}
                      disabled={busy || rows.length <= 1}
                      aria-label={`Remove row ${index + 1}`}
                    >
                      ×
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="sticky bottom-0 z-10 border-t border-[var(--border-secondary)] bg-[var(--bg)] py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={addRow}
            disabled={busy}
          >
            Add Row
          </button>
          <div className="flex gap-3">
            {onCancel && (
              <button
                type="button"
                className="btn btn-ghost"
                onClick={onCancel}
                disabled={busy}
              >
                Cancel
              </button>
            )}
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void onSave()}
              disabled={busy}
            >
              {busy ? "Saving…" : `Save ${filledCount || 0} Deal${filledCount === 1 ? "" : "s"}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
