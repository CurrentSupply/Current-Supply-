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
import { findShoeImage } from "@/lib/dealClient";
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

function base64ToFile(base64: string, mimeType: string, filename: string): File {
  const raw = atob(base64.replace(/^data:[^;]+;base64,/, ""));
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    bytes[i] = raw.charCodeAt(i);
  }
  return new File([bytes], filename, { type: mimeType });
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
  const [findBusy, setFindBusy] = useState(false);
  const [photoHint, setPhotoHint] = useState("");
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
      soldAt: status === "sold" ? prev.soldAt || toInputDate() : "",
    }));
  }

  function setSoldAt(soldAt: string) {
    setValues((prev) => ({
      ...prev,
      soldAt,
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
    setPhotoHint("");
    setCoverFile(file);
  }

  async function findPhotoFromName() {
    const name = values.name.trim();
    if (!name) {
      setError("Enter an item name first, then find a photo.");
      return;
    }

    setFindBusy(true);
    setError("");
    setPhotoHint("");
    try {
      const result = await findShoeImage(name);
      const ext =
        result.mimeType === "image/png"
          ? "png"
          : result.mimeType === "image/webp"
            ? "webp"
            : result.mimeType === "image/gif"
              ? "gif"
              : "jpg";
      const file = base64ToFile(
        result.imageBase64,
        result.mimeType,
        `${name.slice(0, 60)}.${ext}`,
      );
      setCoverFile(file);
      setPhotoHint(
        initialCoverFilename
          ? "New cover ready — saving replaces the previous cover."
          : "Cover found — double-check it's correct, then save.",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not find a photo.");
    } finally {
      setFindBusy(false);
    }
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
    <form onSubmit={handleSubmit} className="card p-6">
      {/* Cover Photo Section */}
      <div className="mb-6">
        <label className="field-label mb-2 block">Cover Photo</label>
        <input
          ref={coverInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          onChange={(e) => {
            pickCover(e.target.files?.[0] ?? null);
            e.target.value = "";
          }}
        />
        <div
          className={`overflow-hidden rounded-xl border-2 border-dashed transition-all ${
            dragging
              ? "border-[var(--text-primary)] bg-[var(--bg-secondary)]"
              : "border-[var(--border-primary)] bg-[var(--bg)]"
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
            <div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={coverPreviewUrl}
                alt="Cover preview"
                className="aspect-[4/3] w-full object-cover"
              />
              <div className="flex flex-wrap gap-2 border-t border-[var(--border-secondary)] p-4">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => coverInputRef.current?.click()}
                >
                  Replace
                </button>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  disabled={findBusy || busy || !values.name.trim()}
                  onClick={() => void findPhotoFromName()}
                >
                  {findBusy ? "Finding…" : "Find Cover"}
                </button>
                {coverFile && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => {
                      setCoverFile(null);
                      setPhotoHint("");
                    }}
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="px-6 py-12 text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--bg-secondary)]">
                <svg className="h-6 w-6 text-[var(--text-tertiary)]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                </svg>
              </div>
              <button
                type="button"
                className="text-sm font-medium text-[var(--text-primary)] hover:underline"
                onClick={() => coverInputRef.current?.click()}
              >
                Add cover photo
              </button>
              <p className="mt-1 text-xs text-[var(--text-tertiary)]">
                Drag & drop or click to choose. JPG, PNG, WebP up to 8MB.
              </p>
              <div className="mt-4">
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  disabled={findBusy || busy || !values.name.trim()}
                  onClick={() => void findPhotoFromName()}
                >
                  {findBusy ? "Finding…" : "Find Cover from Name"}
                </button>
              </div>
            </div>
          )}
        </div>
        {photoHint && (
          <p className="mt-2 text-xs text-[var(--text-secondary)]">{photoHint}</p>
        )}
      </div>

      {/* Form Fields */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="field sm:col-span-2">
          <label htmlFor="name">Item Name</label>
          <input
            id="name"
            value={values.name}
            onChange={(e) => update("name", e.target.value)}
            placeholder="Jordan 1 Retro High OG"
            required
          />
          <span className="field-hint">
            Use a clear product name (brand, model, colorway) for best cover search results.
          </span>
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
            <option value="" disabled>Select category</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
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
              <option key={owner} value={owner}>{DEAL_OWNER_LABELS[owner]}</option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="condition">Condition</label>
          <select
            id="condition"
            value={values.condition}
            onChange={(e) => update("condition", e.target.value as DealCondition)}
            required
          >
            {DEAL_CONDITIONS.map((c) => (
              <option key={c} value={c}>{DEAL_CONDITION_LABELS[c]}</option>
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
            onChange={(e) => setStatus(e.target.value as "in_stock" | "sold")}
          >
            <option value="in_stock">In Stock</option>
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
          <label htmlFor="purchasedAt">Purchase Date</label>
          <input
            id="purchasedAt"
            type="date"
            value={values.purchasedAt}
            onChange={(e) => update("purchasedAt", e.target.value)}
            required
          />
        </div>

        <div className="field">
          <label htmlFor="soldAt">Sold Date</label>
          <input
            id="soldAt"
            type="date"
            value={values.soldAt}
            onChange={(e) => setSoldAt(e.target.value)}
          />
          <span className="field-hint">
            {values.status === "sold"
              ? "Change this anytime for sold items."
              : "Set a date to mark this item sold."}
          </span>
        </div>

        <div className="sm:col-span-2">
          <label className="field-label mb-3 block">Includes</label>
          <div className="flex flex-wrap gap-6">
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={values.hasBox}
                onChange={(e) => update("hasBox", e.target.checked)}
                className="h-4 w-4 rounded border-[var(--border-primary)] accent-[var(--text-primary)]"
              />
              <span className="text-sm">Box</span>
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={values.hasInsoles}
                onChange={(e) => update("hasInsoles", e.target.checked)}
                className="h-4 w-4 rounded border-[var(--border-primary)] accent-[var(--text-primary)]"
              />
              <span className="text-sm">Insoles</span>
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

      {/* Profit Preview */}
      {profitPreview !== null && (
        <div className="mt-6 rounded-lg bg-[var(--bg-secondary)] p-4">
          <p className="text-sm text-[var(--text-secondary)]">
            Profit Preview:{" "}
            <span className={`font-semibold ${profitToneClass(profitPreview)}`}>
              {formatMoney(profitPreview)}
            </span>
          </p>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="alert alert-error mt-4">
          {error}
        </div>
      )}

      {/* Actions */}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <button
          type="submit"
          className="btn btn-primary"
          disabled={busy}
        >
          {busy ? "Saving…" : submitLabel}
        </button>
        {onCancel && (
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onCancel}
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
