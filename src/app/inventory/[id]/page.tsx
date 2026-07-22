"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { MarkSoldDialog } from "@/components/MarkSoldDialog";
import { PageHeader } from "@/components/PageHeader";
import { PageEmpty, PageError, PageLoading } from "@/components/PageStatus";
import { PhotoUploader } from "@/components/PhotoUploader";
import { DEAL_CONDITION_LABELS, DEAL_OWNER_LABELS, parseDealOwner } from "@/db/schema";
import {
  deleteDeal,
  fetchDeal,
  markDealInStock,
  markDealSold,
  updateDealSoldAt,
} from "@/lib/dealClient";
import type { DealWithRelations } from "@/lib/deals";
import {
  calcProfit,
  calcRoi,
  daysBetween,
  formatMoney,
  formatRoi,
  photoUrl,
  profitToneClass,
} from "@/lib/format";

export default function DealDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [deal, setDeal] = useState<DealWithRelations | null>(null);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [soldDateError, setSoldDateError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [markSoldOpen, setMarkSoldOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await fetchDeal(params.id);
      setDeal(data);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Deal not found.");
      setDeal(null);
    }
  }, [params.id]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(handle);
  }, [load]);

  if (error) {
    return (
      <PageEmpty
        title={error}
        action={
          <Link href="/inventory" className="btn btn-secondary">
            Back to inventory
          </Link>
        }
      />
    );
  }

  if (!deal) {
    return <PageLoading label="Loading deal…" />;
  }

  const profit = calcProfit(deal.price, deal.cost);
  const roi = calcRoi(deal.price, deal.cost);
  const held = daysBetween(
    deal.purchasedAt,
    deal.status === "sold" && deal.soldAt ? deal.soldAt : undefined,
  );
  const ownerLabel = DEAL_OWNER_LABELS[parseDealOwner(deal.owner)];

  return (
    <div className="space-y-5">
      <PageHeader
        title={deal.name}
        subtitle={`Size ${deal.size}${deal.category ? ` · ${deal.category.name}` : ""} · ${ownerLabel}${deal.platform ? ` · ${deal.platform}` : ""}`}
        back={
          <Link
            href="/inventory"
            className="mb-1 block text-sm text-[var(--muted)] hover:text-[var(--ink)]"
          >
            ← Inventory
          </Link>
        }
        actions={
          <>
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
                  setActionError("");
                  try {
                    await markDealInStock(deal.id);
                    await load();
                  } catch (err) {
                    setActionError(
                      err instanceof Error
                        ? err.message
                        : "Could not mark in stock.",
                    );
                  }
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
          </>
        }
      />

      {actionError ? <PageError message={actionError} /> : null}

      <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="surface overflow-hidden rounded-none">
          <div className="aspect-[4/3] bg-[#efefef]">
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

        <div className="surface rounded-none p-5">
          <span
            className={`badge ${deal.status === "sold" ? "badge-sold" : "badge-stock"}`}
          >
            {deal.status === "sold" ? "Sold" : "In stock"}
          </span>
          <dl className="mt-4 grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-[var(--muted)]">Owner</dt>
              <dd className="text-lg font-semibold">{ownerLabel}</dd>
            </div>
            <div>
              <dt className="text-[var(--muted)]">Condition</dt>
              <dd className="text-lg font-semibold">
                {DEAL_CONDITION_LABELS[deal.condition]}
              </dd>
            </div>
            <div>
              <dt className="text-[var(--muted)]">Box</dt>
              <dd className="font-medium">{deal.hasBox ? "Yes" : "No"}</dd>
            </div>
            <div>
              <dt className="text-[var(--muted)]">Insoles</dt>
              <dd className="font-medium">{deal.hasInsoles ? "Yes" : "No"}</dd>
            </div>
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
              <dd className={`text-lg font-semibold ${profitToneClass(profit)}`}>
                {formatMoney(profit)}
              </dd>
            </div>
            <div>
              <dt className="text-[var(--muted)]">ROI</dt>
              <dd
                className={`text-lg font-semibold ${
                  roi === null ? "" : profitToneClass(roi)
                }`}
              >
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
                {deal.status === "sold" ? (
                  <div>
                    <input
                      type="date"
                      className="mt-0.5 w-full max-w-full min-w-0 border border-[var(--line)] bg-white px-2 py-1.5 text-base font-medium text-[var(--ink)]"
                      value={deal.soldAt ? deal.soldAt.slice(0, 10) : ""}
                      onChange={async (e) => {
                        const soldAt = e.target.value;
                        if (!soldAt) return;
                        setSoldDateError("");
                        try {
                          await updateDealSoldAt(deal.id, soldAt);
                          await load();
                        } catch (err) {
                          setSoldDateError(
                            err instanceof Error
                              ? err.message
                              : "Could not update sold date.",
                          );
                        }
                      }}
                      aria-label="Sold date"
                    />
                    {soldDateError ? (
                      <p className="mt-1 text-xs text-[var(--danger)]">
                        {soldDateError}
                      </p>
                    ) : null}
                  </div>
                ) : (
                  `${held} days`
                )}
              </dd>
            </div>
          </dl>
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
        dealName={deal.name}
        listPrice={deal.price}
        cost={deal.cost}
        onClose={() => setMarkSoldOpen(false)}
        onConfirm={async ({ price, soldAt }) => {
          await markDealSold(deal.id, { price, soldAt });
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
          setActionError("");
          try {
            await deleteDeal(deal.id);
            router.push("/inventory");
          } catch (err) {
            setConfirmDelete(false);
            setActionError(
              err instanceof Error ? err.message : "Could not delete deal.",
            );
          }
        }}
      />
    </div>
  );
}
