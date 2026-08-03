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
import {
  createDealsBulk,
  type SerializedDealPayload,
} from "@/lib/dealClient";
import { toInputDate } from "@/lib/format";

type BulkRow = {
  key: string;
  name: string;
  size: string;
  cost: string;
  price: string;
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
    condition: defaults?.condition ?? "Used",
    purchasedAt: defaults?.purchasedAt ?? toInputDate(),
  };
}

function isBlankRow(row: BulkRow): boolean {
  return (
    !row.name.trim() &&
    !row.size.trim() &&
    !row.cost.trim() &&
    !row.price.trim()
  );
}

function validateRow(
  row: BulkRow,
  shared: { categoryId: string },
): string | null {
  if (!row.name.trim()) return "Name is required.";
  if (!row.size.trim()) return "Size is required.";
  if (!row.cost.trim() || !Number.isFinite(Number(row.cost))) {
    return "Cost is required.";
  }
  if (!row.price.trim() || !Number.isFinite(Number(row.price))) {
    return "Price is required.";
  }
  if (!row.purchasedAt) return "Purchase date is required.";
  if (!shared.categoryId || Number(shared.categoryId) <= 0) {
    return "Category is required.";
  }
  return null;
}

function toPayload(
  row: BulkRow,
  shared: { categoryId: string; owner: DealOwner },
): SerializedDealPayload {
  return {
    name: row.name.trim(),
    size: row.size.trim(),
    cost: Number(row.cost),
    price: Number(row.price),
    condition: row.condition,
    hasBox: false,
    hasInsoles: false,
    categoryId: Number(shared.categoryId),
    status: "in_stock",
    owner: shared.owner,
    purchasedAt: row.purchasedAt,
    soldAt: null,
    notes: "",
    platform: "",
  };
}

export function BulkDealTable({ categories, onSuccess, onCancel }: Props) {
  const [sharedCategoryId, setSharedCategoryId] = useState(
    () => (categories[0] ? String(categories[0].id) : ""),
  );
  const [sharedOwner, setSharedOwner] = useState<DealOwner>("other");
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

  const shared = useMemo(
    () => ({ categoryId: sharedCategoryId, owner: sharedOwner }),
    [sharedCategoryId, sharedOwner],
  );

  function updateRow<K extends keyof BulkRow>(
    key: string,
    field: K,
    value: BulkRow[K],
  ) {
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

    if (!sharedCategoryId || Number(sharedCategoryId) <= 0) {
      setFormError("Choose a category for all deals.");
      return;
    }

    const errors: Record<string, string> = {};
    for (const row of candidates) {
      const message = validateRow(row, shared);
      if (message) errors[row.key] = message;
    }
    if (Object.keys(errors).length > 0) {
      setRowErrors(errors);
      setFormError("Fix the highlighted rows, then try again.");
      return;
    }

    setBusy(true);
    try {
      const result = await createDealsBulk(
        candidates.map((row) => toPayload(row, shared)),
      );
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
          `Saved ${result.created.length}, but ${result.failed.length} failed. Fix remaining rows or open inventory.`,
        );
        // Drop successfully created rows so retries only retry failures.
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
      <p className="text-sm text-[var(--muted)]">
        Enter deals as rows — no photo upload here. Covers are filled from each
        title when possible; you can replace them later on the deal page. Blank
        rows are skipped. Status is always in stock.
      </p>

      <section className="surface rounded-none p-4">
        <p className="text-[0.72rem] font-bold uppercase tracking-[0.1em] text-[var(--muted)]">
          Applies to every row
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="field">
            <label htmlFor="bulk-shared-category">Category</label>
            <select
              id="bulk-shared-category"
              value={sharedCategoryId}
              onChange={(e) => {
                setSharedCategoryId(e.target.value);
                setFormError("");
              }}
              disabled={busy}
              required
            >
              <option value="">Select…</option>
              {categories.map((c) => (
                <option key={c.id} value={String(c.id)}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="bulk-shared-owner">Owner</label>
            <select
              id="bulk-shared-owner"
              value={sharedOwner}
              onChange={(e) => setSharedOwner(e.target.value as DealOwner)}
              disabled={busy}
            >
              {DEAL_OWNERS.map((owner) => (
                <option key={owner} value={owner}>
                  {DEAL_OWNER_LABELS[owner]}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {formError ? (
        <p className="border border-black bg-[#f3f3f3] p-3 text-sm text-[var(--danger)]">
          {formError}
        </p>
      ) : null}

      <div className="-mx-1 overflow-x-auto">
        <table className="min-w-[760px] w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-black text-[0.7rem] font-bold uppercase tracking-[0.1em] text-[var(--muted)]">
              <th className="px-2 py-2">Name</th>
              <th className="px-2 py-2">Size</th>
              <th className="px-2 py-2">Cost</th>
              <th className="px-2 py-2">Price</th>
              <th className="px-2 py-2">Condition</th>
              <th className="px-2 py-2">Purchased</th>
              <th className="px-2 py-2 w-12">
                <span className="sr-only">Remove</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const error = rowErrors[row.key];
              return (
                <tr
                  key={row.key}
                  className={`border-b border-[var(--line)] align-top ${
                    error ? "bg-[#fff4f4]" : ""
                  }`}
                >
                  <td className="px-2 py-2">
                    <div className="field">
                      <label className="sr-only" htmlFor={`${row.key}-name`}>
                        Name {index + 1}
                      </label>
                      <input
                        id={`${row.key}-name`}
                        value={row.name}
                        onChange={(e) =>
                          updateRow(row.key, "name", e.target.value)
                        }
                        placeholder="Jordan 1…"
                        disabled={busy}
                      />
                    </div>
                    {error ? (
                      <p className="mt-1 text-xs text-[var(--danger)]">{error}</p>
                    ) : null}
                  </td>
                  <td className="px-2 py-2">
                    <div className="field">
                      <label className="sr-only" htmlFor={`${row.key}-size`}>
                        Size {index + 1}
                      </label>
                      <input
                        id={`${row.key}-size`}
                        value={row.size}
                        onChange={(e) =>
                          updateRow(row.key, "size", e.target.value)
                        }
                        placeholder="10.5"
                        disabled={busy}
                      />
                    </div>
                  </td>
                  <td className="px-2 py-2">
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
                        onChange={(e) =>
                          updateRow(row.key, "cost", e.target.value)
                        }
                        disabled={busy}
                      />
                    </div>
                  </td>
                  <td className="px-2 py-2">
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
                        onChange={(e) =>
                          updateRow(row.key, "price", e.target.value)
                        }
                        disabled={busy}
                      />
                    </div>
                  </td>
                  <td className="px-2 py-2">
                    <div className="field">
                      <label
                        className="sr-only"
                        htmlFor={`${row.key}-condition`}
                      >
                        Condition {index + 1}
                      </label>
                      <select
                        id={`${row.key}-condition`}
                        value={row.condition}
                        onChange={(e) =>
                          updateRow(
                            row.key,
                            "condition",
                            e.target.value as DealCondition,
                          )
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
                  <td className="px-2 py-2">
                    <div className="field">
                      <label
                        className="sr-only"
                        htmlFor={`${row.key}-purchased`}
                      >
                        Purchased {index + 1}
                      </label>
                      <input
                        id={`${row.key}-purchased`}
                        type="date"
                        value={row.purchasedAt}
                        onChange={(e) =>
                          updateRow(row.key, "purchasedAt", e.target.value)
                        }
                        disabled={busy}
                      />
                    </div>
                  </td>
                  <td className="px-2 py-2">
                    <button
                      type="button"
                      className="btn btn-ghost px-2 py-2"
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

      <div className="sticky bottom-0 z-10 -mx-1 border-t border-[var(--line)] bg-[var(--bg)] px-1 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <button
            type="button"
            className="btn btn-secondary w-full sm:w-auto"
            onClick={addRow}
            disabled={busy}
          >
            Add row
          </button>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            {onCancel ? (
              <button
                type="button"
                className="btn btn-ghost w-full sm:w-auto"
                onClick={onCancel}
                disabled={busy}
              >
                Cancel
              </button>
            ) : null}
            <button
              type="button"
              className="btn btn-primary w-full sm:w-auto"
              onClick={() => void onSave()}
              disabled={busy}
            >
              {busy
                ? "Saving…"
                : `Save ${filledCount || 0} deal${filledCount === 1 ? "" : "s"}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
