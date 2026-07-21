"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { MarkSoldDialog } from "@/components/MarkSoldDialog";
import { PhotoUploader } from "@/components/PhotoUploader";
import type { DealWithRelations } from "@/lib/deals";
import {
  calcProfit,
  daysBetween,
  formatMoney,
  formatRoi,
  photoUrl,
} from "@/lib/format";

export default function DealDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [deal, setDeal] = useState<DealWithRelations | null>(null);
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [markSoldOpen, setMarkSoldOpen] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/deals/${params.id}`);
    if (!res.ok) {
      setError("Deal not found.");
      setDeal(null);
      return;
    }
    setDeal(await res.json());
  }, [params.id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (error) {
    return (
      <div className="surface rounded-2xl p-8 text-center">
        <p>{error}</p>
        <Link href="/inventory" className="btn btn-secondary mt-4">
          Back to inventory
        </Link>
      </div>
    );
  }

  if (!deal) {
    return <p className="text-sm text-[var(--muted)]">Loading deal…</p>;
  }

  const profit = calcProfit(deal.price, deal.cost);
  const held = daysBetween(
    deal.purchasedAt,
    deal.status === "sold" && deal.soldAt ? deal.soldAt : undefined,
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/inventory" className="text-sm text-[var(--muted)] hover:text-[var(--ink)]">
            ← Inventory
          </Link>
          <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl font-semibold sm:text-4xl">
            {deal.name}
          </h1>
          <p className="mt-1 text-[var(--muted)]">
            Size {deal.size}
            {deal.category ? ` · ${deal.category.name}` : ""}
            {deal.platform ? ` · ${deal.platform}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {deal.status === "in_stock" ? (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setMarkSoldOpen(true)}
            >
              Mark sold
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={async () => {
                await fetch(`/api/deals/${deal.id}`, {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ status: "in_stock" }),
                });
                await load();
              }}
            >
              Mark in stock
            </button>
          )}
          <Link href={`/inventory/${deal.id}/edit`} className="btn btn-secondary">
            Edit
          </Link>
          <Link href={`/overlay?dealId=${deal.id}`} className="btn btn-secondary">
            Stamp photo
          </Link>
          <button
            type="button"
            className="btn btn-danger"
            onClick={() => setConfirmDelete(true)}
          >
            Delete
          </button>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="surface overflow-hidden rounded-2xl">
          <div className="aspect-[4/3] bg-[linear-gradient(135deg,#d9e4eb,#c7d7cf)]">
            {deal.coverPhoto ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={photoUrl(deal.coverPhoto.filename)}
                alt={deal.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-[var(--muted)]">
                No cover photo
              </div>
            )}
          </div>
        </div>

        <div className="surface rounded-2xl p-5">
          <span
            className={`badge ${deal.status === "sold" ? "badge-sold" : "badge-stock"}`}
          >
            {deal.status === "sold" ? "Sold" : "In stock"}
          </span>
          <dl className="mt-4 grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-[var(--muted)]">Cost</dt>
              <dd className="text-lg font-semibold">{formatMoney(deal.cost)}</dd>
            </div>
            <div>
              <dt className="text-[var(--muted)]">Price</dt>
              <dd className="text-lg font-semibold">{formatMoney(deal.price)}</dd>
            </div>
            <div>
              <dt className="text-[var(--muted)]">Profit</dt>
              <dd className={`text-lg font-semibold ${profit >= 0 ? "profit-pos" : "profit-neg"}`}>
                {formatMoney(profit)}
              </dd>
            </div>
            <div>
              <dt className="text-[var(--muted)]">ROI</dt>
              <dd className="text-lg font-semibold">
                {formatRoi(deal.price, deal.cost)}
              </dd>
            </div>
            <div>
              <dt className="text-[var(--muted)]">Purchased</dt>
              <dd className="font-medium">{deal.purchasedAt.slice(0, 10)}</dd>
            </div>
            <div>
              <dt className="text-[var(--muted)]">
                {deal.status === "sold" ? "Sold" : "Days held"}
              </dt>
              <dd className="font-medium">
                {deal.status === "sold" && deal.soldAt
                  ? deal.soldAt.slice(0, 10)
                  : `${held} days`}
              </dd>
            </div>
          </dl>
          {deal.condition ? (
            <div className="mt-5">
              <h3 className="text-sm font-semibold text-[var(--muted)]">Condition</h3>
              <p className="mt-1 whitespace-pre-wrap">{deal.condition}</p>
            </div>
          ) : null}
          {deal.notes ? (
            <div className="mt-4">
              <h3 className="text-sm font-semibold text-[var(--muted)]">Notes</h3>
              <p className="mt-1 whitespace-pre-wrap">{deal.notes}</p>
            </div>
          ) : null}
        </div>
      </div>

      <PhotoUploader dealId={deal.id} photos={deal.photos} onChange={load} />

      <MarkSoldDialog
        open={markSoldOpen}
        currentPrice={deal.price}
        onClose={() => setMarkSoldOpen(false)}
        onConfirm={async ({ price, soldAt }) => {
          const res = await fetch(`/api/deals/${deal.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "sold", price, soldAt }),
          });
          if (!res.ok) {
            const data = await res.json();
            throw new Error(data.error || "Could not mark sold.");
          }
          await load();
        }}
      />

      <ConfirmDialog
        open={confirmDelete}
        title="Delete this deal?"
        message="This permanently removes the deal and its photos."
        confirmLabel="Delete"
        danger
        onCancel={() => setConfirmDelete(false)}
        onConfirm={async () => {
          await fetch(`/api/deals/${deal.id}`, { method: "DELETE" });
          router.push("/inventory");
        }}
      />
    </div>
  );
}
