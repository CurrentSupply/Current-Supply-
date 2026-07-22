"use client";

import { useRef, useState } from "react";
import type { Photo } from "@/db/schema";
import { photoUrl } from "@/lib/format";
import { uploadDealPhotos } from "@/lib/uploadCover";
import { ConfirmDialog } from "@/components/ConfirmDialog";

type Props = {
  dealId: number;
  photos: Photo[];
  onChange: () => Promise<void> | void;
};

export function PhotoUploader({ dealId, photos, onChange }: Props) {
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

  async function setCover(photoId: number) {
    setBusy(true);
    try {
      const res = await fetch(`/api/deals/${dealId}/photos`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ coverPhotoId: photoId }),
      });
      if (!res.ok) throw new Error("Could not set cover.");
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
      const res = await fetch(`/api/deals/${dealId}/photos`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order }),
      });
      if (!res.ok) throw new Error("Could not reorder photos.");
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
      const res = await fetch(`/api/photos/${deleteId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Could not delete photo.");
      setDeleteId(null);
      await onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete photo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="surface rounded-none p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Photos</h2>
        <button
          type="button"
          className="btn btn-secondary"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          Add photos
        </button>
      </div>

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
        className={`mt-4 rounded-none border border-dashed p-6 text-center transition ${
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
          if (e.dataTransfer.files) void uploadFiles(e.dataTransfer.files);
        }}
      >
        <p className="text-sm text-[var(--muted)]">
          Drag & drop images here, or use Add photos. JPG, PNG, WebP, GIF up to 8MB.
        </p>
      </div>

      {error ? <p className="mt-3 text-sm text-[var(--danger)]">{error}</p> : null}

      {photos.length === 0 ? (
        <p className="mt-4 text-sm text-[var(--muted)]">No photos yet.</p>
      ) : (
        <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {photos.map((photo, index) => (
            <li key={photo.id} className="overflow-hidden rounded-none border border-[var(--line)] bg-white">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photoUrl(photo.filename)}
                alt={photo.originalName}
                className="aspect-square w-full object-cover"
              />
              <div className="flex flex-wrap gap-1 p-2">
                {photo.isCover ? (
                  <span className="badge badge-stock">Cover</span>
                ) : (
                  <button
                    type="button"
                    className="btn btn-ghost !px-2 !py-1 text-xs"
                    disabled={busy}
                    onClick={() => void setCover(photo.id)}
                  >
                    Set cover
                  </button>
                )}
                <button
                  type="button"
                  className="btn btn-ghost !px-2 !py-1 text-xs"
                  disabled={busy || index === 0}
                  onClick={() => void move(photo.id, -1)}
                >
                  ←
                </button>
                <button
                  type="button"
                  className="btn btn-ghost !px-2 !py-1 text-xs"
                  disabled={busy || index === photos.length - 1}
                  onClick={() => void move(photo.id, 1)}
                >
                  →
                </button>
                <button
                  type="button"
                  className="btn btn-danger !px-2 !py-1 text-xs"
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
    </section>
  );
}
