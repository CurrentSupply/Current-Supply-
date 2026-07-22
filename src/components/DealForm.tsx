"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  DEAL_CONDITION_LABELS,
  DEAL_CONDITIONS,
  DEAL_OWNER_LABELS,
  DEAL_OWNERS,
  parseDealCondition,
  parseDealOwner,
  type Category,
  type Deal,
  type DealCondition,
  type DealOwner,
} from "@/db/schema";
import {
  calcProfit,
  formatMoney,
  photoUrl,
  profitToneClass,
  toInputDate,
} from "@/lib/format";
import { ALLOWED_IMAGE_TYPES, MAX_PHOTO_BYTES } from "@/lib/photoLimits";

export type DealFormValues = {
  name: string;
  size: string;
  cost: string;
  price: string;
  condition: DealCondition;
  hasBox: boolean;
  hasInsoles: boolean;
  categoryId: string;
  status: "in_stock" | "sold";
  owner: DealOwner;
  purchasedAt: string;
  soldAt: string;
  notes: string;
  platform: string;
};

export type DealFormSubmitPayload = {
  values: DealFormValues;
  coverFile: File | null;
};

type Props = {
  categories: Category[];
  initial?: Partial<Deal>;
  /** Existing cover URL/path for edit mode preview */
  initialCoverFilename?: string | null;
  submitLabel: string;
  onSubmit: (payload: DealFormSubmitPayload) => Promise<void>;
  onCancel?: () => void;
};

function fromDeal(deal?: Partial<Deal>): DealFormValues {
  return {
    name: deal?.name ?? "",
    size: deal?.size ?? "",
    cost: deal?.cost !== undefined ? String(deal.cost) : "",
    price: deal?.price !== undefined ? String(deal.price) : "",
    condition: parseDealCondition(deal?.condition),
    hasBox: Boolean(deal?.hasBox),
    hasInsoles: Boolean(deal?.hasInsoles),
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
  initialCoverFilename,
  submitLabel,
  onSubmit,
  onCancel,
}: Props) {
  const [values, setValues] = useState<DealFormValues>(() => fromDeal(initial));
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const coverPreviewUrl = useMemo(() => {
    if (coverFile) return URL.createObjectURL(coverFile);
    if (initialCoverFilename) return photoUrl(initialCoverFilename);
    return null;
  }, [coverFile, initialCoverFilename]);

  useEffect(() => {
    if (!coverFile || !coverPreviewUrl) return;
    return () => URL.revokeObjectURL(coverPreviewUrl);
  }, [coverFile, coverPreviewUrl]);

  const profitPreview = useMemo(() => {
    const cost = Number(values.cost);
    const price = Number(values.price);
    if (Number.isNaN(cost) || Number.isNaN(price)) return null;
    return calcProfit(price, cost);
  }, [values.cost, values.price]);

  function update<K extends keyof DealFormValues>(key: K, value: DealFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function setStatus(status: "in_stock" | "sold") {
    setValues((prev) => ({
      ...prev,
      status,
      soldAt:
        status === "sold" ? prev.soldAt || toInputDate() : "",
    }));
  }

  function setSoldAt(soldAt: string) {
    setValues((prev) => ({
      ...prev,
      soldAt,
      // Picking a sold date marks the deal sold; clearing it returns to in stock.
      status: soldAt ? "sold" : "in_stock",
    }));
  }

  function pickCover(file: File | null) {
    if (!file) {
      setCoverFile(null);
      return;
    }
    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
      setError("Cover photo must be an image (JPG, PNG, WebP, or GIF).");
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      setError("Cover photo must be 8MB or smaller.");
      return;
    }
    setError("");
    setCoverFile(file);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!values.name.trim() || !values.size.trim()) {
      setError("Name and size are required.");
      return;
    }
    if (!values.categoryId) {
      setError("Category is required.");
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
      await onSubmit({ values, coverFile });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save deal.");
      setBusy(false);
      return;
    }
    setBusy(false);
  }

  return (
    <form onSubmit={handleSubmit} className="surface min-w-0 rounded-none p-5 sm:p-6">
      <div className="field mb-5">
        <label htmlFor="cover-photo">Cover photo</label>
        <input
          ref={coverInputRef}
          id="cover-photo"
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          onChange={(e) => {
            pickCover(e.target.files?.[0] ?? null);
            e.target.value = "";
          }}
        />
        <div
          className={`mt-1 overflow-hidden rounded-none border border-dashed transition ${
            dragging
              ? "border-black bg-[#f3f3f3]"
              : "border-[var(--line)] bg-white"
          }`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            pickCover(e.dataTransfer.files?.[0] ?? null);
          }}
        >
          {coverPreviewUrl ? (
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={coverPreviewUrl}
                alt="Cover preview"
                className="aspect-[4/3] w-full object-cover"
              />
              <div className="flex flex-wrap gap-2 border-t border-[var(--line)] p-3">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => coverInputRef.current?.click()}
                >
                  Replace photo
                </button>
                {coverFile ? (
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => setCoverFile(null)}
                  >
                    Clear new photo
                  </button>
                ) : null}
              </div>
            </div>
          ) : (
            <button
              type="button"
              className="flex w-full flex-col items-center gap-2 px-4 py-10 text-center"
              onClick={() => coverInputRef.current?.click()}
            >
              <span className="text-sm font-medium text-[var(--ink)]">
                Add cover photo
              </span>
              <span className="text-sm text-[var(--muted)]">
                Drag & drop or click to choose. JPG, PNG, WebP, GIF up to 8MB.
              </span>
            </button>
          )}
        </div>
      </div>

      <div className="grid min-w-0 gap-4 sm:grid-cols-2">
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
            required
          >
            <option value="" disabled>
              Select category
            </option>
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
              setStatus(e.target.value as "in_stock" | "sold")
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
            onChange={(e) => setSoldAt(e.target.value)}
          />
          <p className="mt-1 text-xs text-[var(--muted)]">
            {values.status === "sold"
              ? "Change this anytime for sold items."
              : "Set a date to mark this item sold."}
          </p>
        </div>
        <div className="field">
          <label htmlFor="condition">Condition</label>
          <select
            id="condition"
            value={values.condition}
            onChange={(e) =>
              update("condition", e.target.value as DealCondition)
            }
            required
          >
            {DEAL_CONDITIONS.map((c) => (
              <option key={c} value={c}>
                {DEAL_CONDITION_LABELS[c]}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-0 sm:col-span-2">
          <p className="mb-1 text-[0.72rem] font-bold uppercase tracking-[0.1em] text-[var(--muted)]">
            Includes
          </p>
          <div className="flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:gap-x-6 sm:gap-y-2">
            <label className="flex w-full cursor-pointer items-center gap-2 py-2 text-sm text-[var(--ink)] sm:w-auto sm:py-1">
              <input
                type="checkbox"
                checked={values.hasBox}
                onChange={(e) => update("hasBox", e.target.checked)}
                className="h-4 w-4 shrink-0 accent-black"
              />
              <span>Box</span>
            </label>
            <label className="flex w-full cursor-pointer items-center gap-2 py-2 text-sm text-[var(--ink)] sm:w-auto sm:py-1">
              <input
                type="checkbox"
                checked={values.hasInsoles}
                onChange={(e) => update("hasInsoles", e.target.checked)}
                className="h-4 w-4 shrink-0 accent-black"
              />
              <span>Insoles</span>
            </label>
          </div>
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
          <span className={profitToneClass(profitPreview)}>
            {formatMoney(profitPreview)}
          </span>
        </p>
      ) : null}

      {error ? <p className="mt-3 text-sm text-[var(--danger)]">{error}</p> : null}

      <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <button
          type="submit"
          className="btn btn-primary w-full sm:w-auto"
          disabled={busy}
        >
          {busy ? "Saving…" : submitLabel}
        </button>
        {onCancel ? (
          <button
            type="button"
            className="btn btn-secondary w-full sm:w-auto"
            onClick={onCancel}
          >
            Cancel
          </button>
        ) : null}
      </div>
    </form>
  );
}
