"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  DEAL_CONDITION_LABELS,
  DEAL_CONDITIONS,
  DEAL_OWNER_LABELS,
  DEAL_OWNERS,
  parseDealCondition,
  parseDealOwner,
  type Category,
} from "@/db/schema";
import {
  attachCoverFromTitle,
  type QuickEditDealFields,
} from "@/lib/dealClient";
import type { DealWithRelations } from "@/lib/deals";
import {
  calcProfit,
  formatMoney,
  photoUrl,
  profitToneClass,
} from "@/lib/format";
import { patchJson } from "@/lib/http";
import { ALLOWED_IMAGE_TYPES, MAX_PHOTO_BYTES } from "@/lib/photoLimits";

export type QuickEditSavePayload = {
  fields: QuickEditDealFields;
  coverFile: File | null;
  extraFiles: File[];
};

type Props = {
  open: boolean;
  deal: DealWithRelations | null;
  categories: Category[];
  onClose: () => void;
  onSave: (payload: QuickEditSavePayload) => Promise<void>;
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
  onSave: (payload: QuickEditSavePayload) => Promise<void>;
}) {
  const coverInputRef = useRef<HTMLInputElement>(null);
  const extraInputRef = useRef<HTMLInputElement>(null);

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
  const [coverFilename, setCoverFilename] = useState(
    deal.coverPhoto?.filename ?? null,
  );
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreviewUrl, setCoverPreviewUrl] = useState<string | null>(null);
  const [extraFiles, setExtraFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [findBusy, setFindBusy] = useState(false);
  const [error, setError] = useState("");
  const [photoHint, setPhotoHint] = useState("");

  useEffect(() => {
    return () => {
      if (coverPreviewUrl) URL.revokeObjectURL(coverPreviewUrl);
    };
  }, [coverPreviewUrl]);

  const costNum = Number(cost);
  const priceNum = Number(price);
  const profit = useMemo(() => {
    if (!Number.isFinite(costNum) || !Number.isFinite(priceNum)) return null;
    return calcProfit(priceNum, costNum);
  }, [costNum, priceNum]);

  const displayCover = coverPreviewUrl
    ? coverPreviewUrl
    : coverFilename
      ? photoUrl(coverFilename)
      : null;

  function pickCover(file: File | null) {
    if (!file) return;
    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
      setError("Use JPG, PNG, WebP, or GIF.");
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      setError("Cover photo must be 8MB or smaller.");
      return;
    }
    setError("");
    setCoverFile(file);
    setCoverPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
    setPhotoHint("New cover will upload on save.");
  }

  function pickExtraFiles(list: FileList | File[]) {
    const files = Array.from(list).filter((f) => ALLOWED_IMAGE_TYPES.has(f.type));
    if (files.length === 0) {
      setError("Use JPG, PNG, WebP, or GIF.");
      return;
    }
    setError("");
    setExtraFiles((prev) => [...prev, ...files]);
    setPhotoHint(
      files.length === 1
        ? "1 photo will upload on save."
        : `${files.length} photos will upload on save.`,
    );
  }

  async function findCover() {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Add an item name before finding a cover.");
      return;
    }
    setFindBusy(true);
    setError("");
    setPhotoHint("");
    try {
      if (trimmedName !== deal.name) {
        await patchJson(
          `/api/deals/${deal.id}`,
          { name: trimmedName },
          "Could not save name.",
        );
      }
      const result = await attachCoverFromTitle(deal.id);
      const nextCover = result.deal.coverPhoto?.filename ?? null;
      setCoverFilename(nextCover);
      setCoverFile(null);
      setCoverPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      setPhotoHint(
        nextCover
          ? "Cover updated from the item name."
          : "No cover found for that name.",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not find a cover.");
    } finally {
      setFindBusy(false);
    }
  }

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
        fields: {
          name: trimmedName,
          size: trimmedSize,
          cost: costNum,
          price: priceNum,
          condition,
          owner,
          categoryId: category,
          platform: platform.trim(),
        },
        coverFile,
        extraFiles,
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
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="page-kicker">Quick edit</p>
              <h2 className="page-title mt-1 text-xl">Update deal</h2>
            </div>
            <Link
              href={`/inventory/${deal.id}/edit`}
              className="shrink-0 text-xs font-bold uppercase tracking-[0.08em] text-[var(--muted)] underline-offset-2 hover:text-[var(--ink)] hover:underline"
            >
              Full edit
            </Link>
          </div>

          <div className="mt-4">
            <p className="text-[0.72rem] font-bold uppercase tracking-[0.1em] text-[var(--muted)]">
              Cover photo
            </p>
            <div className="mt-2 overflow-hidden border border-[var(--line)] bg-[var(--bg-deep)]">
              {displayCover ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={displayCover}
                  alt=""
                  className="aspect-[4/3] w-full object-cover"
                />
              ) : (
                <div className="flex aspect-[4/3] items-center justify-center text-sm text-[var(--muted)]">
                  No cover yet
                </div>
              )}
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                className="btn btn-secondary"
                disabled={busy || findBusy}
                onClick={() => coverInputRef.current?.click()}
              >
                {displayCover ? "Replace cover" : "Add cover"}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={busy || findBusy || !name.trim()}
                onClick={() => void findCover()}
              >
                {findBusy ? "Finding…" : "Find cover"}
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                disabled={busy || findBusy}
                onClick={() => extraInputRef.current?.click()}
              >
                Add photos
              </button>
            </div>
            {extraFiles.length > 0 ? (
              <p className="mt-2 text-xs text-[var(--muted)]">
                {extraFiles.length} extra{" "}
                {extraFiles.length === 1 ? "photo" : "photos"} queued
                <button
                  type="button"
                  className="ml-2 font-bold uppercase tracking-[0.08em] underline-offset-2 hover:underline"
                  onClick={() => setExtraFiles([])}
                >
                  Clear
                </button>
              </p>
            ) : null}
            {photoHint ? (
              <p className="mt-2 text-xs text-[var(--muted)]">{photoHint}</p>
            ) : (
              <p className="mt-2 text-xs text-[var(--muted)]">
                JPG, PNG, WebP, GIF up to 8MB. Uploads apply on save (Find cover
                applies immediately).
              </p>
            )}
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
            <input
              ref={extraInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files) pickExtraFiles(e.target.files);
                e.target.value = "";
              }}
            />
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
            disabled={busy}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn-primary w-full sm:w-auto"
            disabled={busy || findBusy}
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
  return <QuickEditDialogForm key={deal.id} deal={deal} {...props} />;
}
