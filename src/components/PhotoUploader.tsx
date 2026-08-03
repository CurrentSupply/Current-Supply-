"use client";

import { useRef, useState } from "react";
import type { Photo } from "@/db/schema";
import { attachCoverFromTitle } from "@/lib/dealClient";
import { photoUrl } from "@/lib/format";
import { deleteJson, patchJson } from "@/lib/http";
import { uploadDealPhotos } from "@/lib/uploadCover";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Section } from "@/components/ui";

type Props = {
  dealId: number;
  dealName: string;
  photos: Photo[];
  onChange: () => Promise<void> | void;
};

export function PhotoUploader({ dealId, dealName, photos, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [deleteId, setDeleteId] = useState<number | null>(null);

  async function uploadFiles(files: FileList | File[]) {
    const list = Array.from(files);
    if (list.length === 0) return;

    setBusy(true);
    setError("");
    try {
      await uploadDealPhotos(dealId, list);
      await onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  async function findFromTitle() {
    if (!dealName.trim()) {
      setError("This deal needs a name before finding a photo.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await attachCoverFromTitle(dealId);
      await onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not find a photo.");
    } finally {
      setBusy(false);
    }
  }

  async function setCover(photoId: number) {
    setBusy(true);
    try {
      await patchJson(
        `/api/deals/${dealId}/photos`,
        { coverPhotoId: photoId },
        "Could not set cover.",
      );
      await onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not set cover.");
    } finally {
      setBusy(false);
    }
  }

  async function move(photoId: number, direction: -1 | 1) {
    const ids = photos.map((p) => p.id);
    const index = ids.indexOf(photoId);
    const next = index + direction;
    if (index < 0 || next < 0 || next >= ids.length) return;
    const order = [...ids];
    [order[index], order[next]] = [order[next], order[index]];

    setBusy(true);
    try {
      await patchJson(
        `/api/deals/${dealId}/photos`,
        { order },
        "Could not reorder photos.",
      );
      await onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reorder.");
    } finally {
      setBusy(false);
    }
  }

  async function removePhoto() {
    if (deleteId === null) return;
    setBusy(true);
    try {
      await deleteJson(`/api/photos/${deleteId}`, "Could not delete photo.");
      setDeleteId(null);
      await onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete photo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Section
      title="Photos"
      action={
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={busy || !dealName.trim()}
            onClick={() => void findFromTitle()}
          >
            {busy ? "Finding…" : photos.length > 0 ? "Replace Cover" : "Find Cover"}
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            Add Photos
          </button>
        </div>
      }
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files) void uploadFiles(e.target.files);
          e.target.value = "";
        }}
      />

      <div
        className={`rounded-xl border-2 border-dashed p-6 text-center transition-all ${
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
          if (e.dataTransfer.files) void uploadFiles(e.dataTransfer.files);
        }}
      >
        <p className="text-sm text-[var(--text-secondary)]">
          Drag & drop images here, or use Add Photos. Find Cover uses the item name.
        </p>
      </div>

      {error && (
        <div className="alert alert-error mt-4">{error}</div>
      )}

      {photos.length === 0 ? (
        <p className="mt-4 text-sm text-[var(--text-secondary)]">No photos yet.</p>
      ) : (
        <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {photos.map((photo, index) => (
            <li
              key={photo.id}
              className="overflow-hidden rounded-xl border border-[var(--border-secondary)] bg-[var(--bg-elevated)]"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photoUrl(photo.filename)}
                alt={photo.originalName}
                className="aspect-square w-full object-cover"
              />
              <div className="flex flex-wrap gap-1 p-3">
                {photo.isCover ? (
                  <span className="badge badge-stock">Cover</span>
                ) : (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    disabled={busy}
                    onClick={() => void setCover(photo.id)}
                  >
                    Set Cover
                  </button>
                )}
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  disabled={busy || index === 0}
                  onClick={() => void move(photo.id, -1)}
                >
                  ←
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  disabled={busy || index === photos.length - 1}
                  onClick={() => void move(photo.id, 1)}
                >
                  →
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm text-[var(--color-error)]"
                  disabled={busy}
                  onClick={() => setDeleteId(photo.id)}
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={deleteId !== null}
        title="Delete photo?"
        message="This removes the image from this deal and deletes the file."
        confirmLabel="Delete"
        danger
        onCancel={() => setDeleteId(null)}
        onConfirm={() => void removePhoto()}
      />
    </Section>
  );
}
