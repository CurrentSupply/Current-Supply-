"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { PageEmpty, PageError, PageLoading } from "@/components/PageStatus";
import type { DealWithRelations } from "@/lib/deals";
import { formatMoney, photoUrl } from "@/lib/format";
import { getJson, postJson } from "@/lib/http";

function OverlayTool() {
  const searchParams = useSearchParams();
  const initialDealId = searchParams.get("dealId") ?? "";

  const [deals, setDeals] = useState<DealWithRelations[]>([]);
  const [dealId, setDealId] = useState(initialDealId);
  const [photoId, setPhotoId] = useState("");
  const [size, setSize] = useState("");
  const [price, setPrice] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [resultUrl, setResultUrl] = useState("");

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const rows = await getJson<DealWithRelations[]>(
          "/api/deals?sort=newest",
          "Could not load deals.",
        );
        if (cancelled) return;

        setDeals(rows);
        const chosen =
          rows.find((d) => String(d.id) === initialDealId) ??
          rows.find((d) => d.photos.length > 0) ??
          rows[0];
        if (chosen) {
          setDealId(String(chosen.id));
          setSize(chosen.size);
          setPrice(String(chosen.price));
          const cover = chosen.coverPhoto ?? chosen.photos[0];
          setPhotoId(cover ? String(cover.id) : "");
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not load deals.");
          setDeals([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [initialDealId]);

  const selected = useMemo(
    () => deals.find((d) => String(d.id) === dealId) ?? null,
    [deals, dealId],
  );

  function selectDeal(nextId: string) {
    setDealId(nextId);
    setResultUrl("");
    const next = deals.find((d) => String(d.id) === nextId);
    if (!next) return;
    setSize(next.size);
    setPrice(String(next.price));
    const cover = next.coverPhoto ?? next.photos[0];
    setPhotoId(cover ? String(cover.id) : "");
  }
  async function stamp() {
    if (!selected) return;
    setBusy(true);
    setError("");
    try {
      const data = await postJson<{ url?: string }>(
        "/api/overlay",
        {
          dealId: selected.id,
          photoId: photoId ? Number(photoId) : null,
          size,
          price: Number(price),
        },
        "Could not stamp image.",
      );
      if (!data.url) throw new Error("Stamp succeeded but no image URL returned.");
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
      <PageHeader
        kicker="Listing Stamp"
        title="Price & size on photos"
        subtitle="Stamps size and price onto a deal photo for listings. Layout is a clean default for now — we can match your reference image later."
      />

      {loading ? (
        <PageLoading label="Loading deals…" />
      ) : error && deals.length === 0 ? (
        <PageError message={error} />
      ) : deals.length === 0 ? (
        <PageEmpty
          title="No deals to stamp"
          description="Add a deal with a photo first."
          action={
            <Link href="/inventory/new" className="btn btn-primary">
              Add deal
            </Link>
          }
        />
      ) : (
        <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
          <section className="surface space-y-4 rounded-none p-5">
            <div className="field">
              <label htmlFor="deal">Deal</label>
              <select
                id="deal"
                value={dealId}
                onChange={(e) => selectDeal(e.target.value)}
              >
                {deals.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} · {d.size}
                    {d.photos.length === 0 ? " (no photos)" : ""}
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
            {error ? <PageError message={error} /> : null}
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

          <section className="surface rounded-none p-5">
            <h2 className="text-lg font-semibold">Preview</h2>
            <div className="mt-4 overflow-hidden rounded-none border border-black bg-[#efefef]">
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
                  <span className="absolute left-4 top-4 border border-black bg-black px-3 py-1 text-sm font-bold uppercase tracking-[0.08em] text-white">
                    {size || "Size"}
                  </span>
                  <span className="absolute bottom-4 left-4 text-2xl font-bold uppercase tracking-wide text-white">
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
    <Suspense fallback={<PageLoading />}>
      <OverlayTool />
    </Suspense>
  );
}
