"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import type { DealWithRelations } from "@/lib/deals";
import { formatMoney, photoUrl } from "@/lib/format";

function OverlayTool() {
  const searchParams = useSearchParams();
  const initialDealId = searchParams.get("dealId") ?? "";

  const [deals, setDeals] = useState<DealWithRelations[]>([]);
  const [dealId, setDealId] = useState(initialDealId);
  const [photoId, setPhotoId] = useState("");
  const [size, setSize] = useState("");
  const [price, setPrice] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [resultUrl, setResultUrl] = useState("");

  useEffect(() => {
    void fetch("/api/deals?sort=newest")
      .then((r) => r.json())
      .then((rows: DealWithRelations[]) => {
        setDeals(rows);
        const chosen =
          rows.find((d) => String(d.id) === initialDealId) ?? rows[0];
        if (chosen) {
          setDealId(String(chosen.id));
          setSize(chosen.size);
          setPrice(String(chosen.price));
          const cover = chosen.coverPhoto ?? chosen.photos[0];
          setPhotoId(cover ? String(cover.id) : "");
        }
      });
  }, [initialDealId]);

  const selected = useMemo(
    () => deals.find((d) => String(d.id) === dealId) ?? null,
    [deals, dealId],
  );

  useEffect(() => {
    if (!selected) return;
    setSize(selected.size);
    setPrice(String(selected.price));
    const cover = selected.coverPhoto ?? selected.photos[0];
    setPhotoId(cover ? String(cover.id) : "");
    setResultUrl("");
  }, [selected]);

  async function stamp() {
    if (!selected) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/overlay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dealId: selected.id,
          photoId: photoId ? Number(photoId) : null,
          size,
          price: Number(price),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not stamp image.");
      setResultUrl(data.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not stamp image.");
    } finally {
      setBusy(false);
    }
  }

  const previewPhoto =
    selected?.photos.find((p) => String(p.id) === photoId) ??
    selected?.coverPhoto ??
    selected?.photos[0] ??
    null;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium text-[var(--accent)]">Listing Stamp</p>
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight sm:text-4xl">
          Price & size on photos
        </h1>
        <p className="mt-1 max-w-2xl text-[var(--muted)]">
          Stamps size and price onto a deal photo for listings. Layout is a clean
          default for now — we can match your reference image later.
        </p>
      </div>

      {deals.length === 0 ? (
        <div className="surface rounded-2xl px-6 py-14 text-center">
          <h2 className="text-xl font-semibold">No deals to stamp</h2>
          <p className="mt-2 text-[var(--muted)]">
            Add a deal with a photo first.
          </p>
          <Link href="/inventory/new" className="btn btn-primary mt-5">
            Add deal
          </Link>
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
          <section className="surface space-y-4 rounded-2xl p-5">
            <div className="field">
              <label htmlFor="deal">Deal</label>
              <select
                id="deal"
                value={dealId}
                onChange={(e) => setDealId(e.target.value)}
              >
                {deals.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} · {d.size}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="photo">Photo</label>
              <select
                id="photo"
                value={photoId}
                onChange={(e) => setPhotoId(e.target.value)}
                disabled={!selected || selected.photos.length === 0}
              >
                {selected?.photos.length ? (
                  selected.photos.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.isCover ? "Cover · " : ""}
                      {p.originalName}
                    </option>
                  ))
                ) : (
                  <option value="">No photos</option>
                )}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="field">
                <label htmlFor="size">Size text</label>
                <input
                  id="size"
                  value={size}
                  onChange={(e) => setSize(e.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="price">Price</label>
                <input
                  id="price"
                  type="number"
                  min="0"
                  step="0.01"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                />
              </div>
            </div>
            {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
            <button
              type="button"
              className="btn btn-primary w-full"
              disabled={busy || !previewPhoto}
              onClick={() => void stamp()}
            >
              {busy ? "Stamping…" : "Stamp & download preview"}
            </button>
            {resultUrl ? (
              <a
                href={resultUrl}
                download
                className="btn btn-secondary w-full"
              >
                Download stamped image
              </a>
            ) : null}
          </section>

          <section className="surface rounded-2xl p-5">
            <h2 className="text-lg font-semibold">Preview</h2>
            <div className="mt-4 overflow-hidden rounded-xl bg-[linear-gradient(135deg,#d9e4eb,#c7d7cf)]">
              {resultUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={resultUrl} alt="Stamped preview" className="w-full" />
              ) : previewPhoto ? (
                <div className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photoUrl(previewPhoto.filename)}
                    alt="Original"
                    className="w-full"
                  />
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                  <span className="absolute left-4 top-4 rounded-full bg-[var(--accent)] px-3 py-1 text-sm font-bold text-white">
                    {size || "Size"}
                  </span>
                  <span className="absolute bottom-4 left-4 text-2xl font-bold text-white">
                    {price ? formatMoney(Number(price) || 0) : "$—"}
                  </span>
                </div>
              ) : (
                <div className="flex aspect-[4/3] items-center justify-center text-[var(--muted)]">
                  Upload a photo on the deal first
                </div>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

export default function OverlayPage() {
  return (
    <Suspense fallback={<p className="text-sm text-[var(--muted)]">Loading…</p>}>
      <OverlayTool />
    </Suspense>
  );
}
