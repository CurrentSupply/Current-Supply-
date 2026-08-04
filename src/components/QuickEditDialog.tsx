"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import {
  DEAL_CONDITION_LABELS,
  DEAL_CONDITIONS,
  DEAL_OWNER_LABELS,
  DEAL_OWNERS,
  parseDealCondition,
  parseDealOwner,
  type Category,
  type Photo,
} from "@/db/schema";
import { attachCoverFromTitle, type QuickEditDealFields } from "@/lib/dealClient";
import type { DealWithRelations } from "@/lib/deals";
import {
  calcProfit,
  formatMoney,
  photoUrl,
  profitToneClass,
} from "@/lib/format";
import { deleteJson, patchJson } from "@/lib/http";
import { uploadDealPhotos } from "@/lib/uploadCover";
import { Dialog } from "@/components/ui";
import { ConfirmDialog } from "@/components/ConfirmDialog";

type Props = {
  open: boolean;
  deal: DealWithRelations | null;
  categories: Category[];
  onClose: () => void;
  onSave: (fields: QuickEditDealFields) => Promise<void>;
  onPhotosChange?: () => Promise<void> | void;
};

function QuickEditDialogForm({
  deal,
  categories,
  onClose,
  onSave,
  onPhotosChange,
}: {
  deal: DealWithRelations;
  categories: Category[];
  onClose: () => void;
  onSave: (fields: QuickEditDealFields) => Promise<void>;
  onPhotosChange?: () => Promise<void> | void;
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
  
  // Photo state
  const [photos, setPhotos] = useState<Photo[]>(deal.photos);
  const [photosBusy, setPhotosBusy] = useState(false);
  const [photosError, setPhotosError] = useState("");
  const [deletePhotoId, setDeletePhotoId] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const costNum = Number(cost);
  const priceNum = Number(price);
  const profit = useMemo(() => {
    if (!Number.isFinite(costNum) || !Number.isFinite(priceNum)) return null;
    return calcProfit(priceNum, costNum);
  }, [costNum, priceNum]);

  const reloadPhotos = useCallback(async () => {
    try {
      const res = await fetch(`/api/deals/${deal.id}`);
      if (res.ok) {
        const data = await res.json();
        setPhotos(data.photos ?? []);
      }
    } catch {
      // Ignore reload errors
    }
    if (onPhotosChange) await onPhotosChange();
  }, [deal.id, onPhotosChange]);

  async function handleFileUpload(files: FileList | File[]) {
    const list = Array.from(files);
    if (list.length === 0) return;
    
    setPhotosBusy(true);
    setPhotosError("");
    try {
      await uploadDealPhotos(deal.id, list, { isCover: photos.length === 0 });
      await reloadPhotos();
    } catch (err) {
      setPhotosError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setPhotosBusy(false);
    }
  }

  async function handleFindCover() {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setPhotosError("Enter item name first to find a cover.");
      return;
    }
    setPhotosBusy(true);
    setPhotosError("");
    try {
      await attachCoverFromTitle(deal.id);
      await reloadPhotos();
    } catch (err) {
      setPhotosError(err instanceof Error ? err.message : "Could not find a photo.");
    } finally {
      setPhotosBusy(false);
    }
  }

  async function handleSetCover(photoId: number) {
    setPhotosBusy(true);
    setPhotosError("");
    try {
      await patchJson(
        `/api/deals/${deal.id}/photos`,
        { coverPhotoId: photoId },
        "Could not set cover.",
      );
      await reloadPhotos();
    } catch (err) {
      setPhotosError(err instanceof Error ? err.message : "Could not set cover.");
    } finally {
      setPhotosBusy(false);
    }
  }

  async function handleDeletePhoto() {
    if (deletePhotoId === null) return;
    setPhotosBusy(true);
    setPhotosError("");
    try {
      await deleteJson(`/api/photos/${deletePhotoId}`, "Could not delete photo.");
      setDeletePhotoId(null);
      await reloadPhotos();
    } catch (err) {
      setPhotosError(err instanceof Error ? err.message : "Could not delete photo.");
    } finally {
      setPhotosBusy(false);
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
    <>
      <Dialog
        open={true}
        onClose={onClose}
        title="Edit Deal"
        description="Update the details for this item."
        size="lg"
      >
        <form onSubmit={(e) => void submit(e)} className="space-y-5">
          {/* Photos Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-[var(--text-primary)]">Photos</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  disabled={photosBusy || !name.trim()}
                  onClick={() => void handleFindCover()}
                >
                  {photosBusy ? "Finding…" : "Find Cover"}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  disabled={photosBusy}
                  onClick={() => fileInputRef.current?.click()}
                >
                  Add Photo
                </button>
              </div>
            </div>
            
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files) void handleFileUpload(e.target.files);
                e.target.value = "";
              }}
            />

            {photos.length === 0 ? (
              <div className="flex items-center justify-center rounded-lg border-2 border-dashed border-[var(--border-primary)] bg-[var(--bg-secondary)] p-6">
                <p className="text-sm text-[var(--text-tertiary)]">No photos yet</p>
              </div>
            ) : (
              <div className="flex gap-3 overflow-x-auto pb-2">
                {photos.map((photo) => (
                  <div
                    key={photo.id}
                    className="relative shrink-0 group"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photoUrl(photo.filename)}
                      alt={photo.originalName}
                      className="h-24 w-24 rounded-lg object-cover border border-[var(--border-secondary)]"
                    />
                    {photo.isCover && (
                      <span className="absolute top-1 left-1 rounded bg-[var(--text-primary)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--text-inverse)]">
                        Cover
                      </span>
                    )}
                    <div className="absolute inset-0 flex items-center justify-center gap-1 rounded-lg bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                      {!photo.isCover && (
                        <button
                          type="button"
                          className="rounded bg-white/90 px-2 py-1 text-xs font-medium text-black hover:bg-white"
                          disabled={photosBusy}
                          onClick={() => void handleSetCover(photo.id)}
                        >
                          Cover
                        </button>
                      )}
                      <button
                        type="button"
                        className="rounded bg-red-500/90 px-2 py-1 text-xs font-medium text-white hover:bg-red-500"
                        disabled={photosBusy}
                        onClick={() => setDeletePhotoId(photo.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {photosError && (
              <p className="text-sm text-[var(--color-error)]">{photosError}</p>
            )}
          </div>

          <div className="border-t border-[var(--border-secondary)]" />

          {/* Form Fields */}
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

          <div className="flex justify-end gap-3 pt-4 border-t border-[var(--border-secondary)]">
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
              className="btn btn-primary"
              disabled={busy}
            >
              {busy ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </form>
      </Dialog>

      <ConfirmDialog
        open={deletePhotoId !== null}
        title="Delete photo?"
        message="This removes the image from this deal."
        confirmLabel="Delete"
        danger
        onCancel={() => setDeletePhotoId(null)}
        onConfirm={() => void handleDeletePhoto()}
      />
    </>
  );
}

export function QuickEditDialog({ open, deal, onPhotosChange, ...props }: Props) {
  if (!open || !deal) return null;
  return (
    <QuickEditDialogForm
      key={deal.id}
      deal={deal}
      onPhotosChange={onPhotosChange}
      {...props}
    />
  );
}
