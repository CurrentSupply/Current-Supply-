"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { MarkSoldDialog } from "@/components/MarkSoldDialog";
import { PageHeader } from "@/components/PageHeader";
import { PageEmpty, PageError, PageLoading } from "@/components/PageStatus";
import { PhotoUploader } from "@/components/PhotoUploader";
import { QuickEditDialog } from "@/components/QuickEditDialog";
import { BackLink, StatusBadge } from "@/components/ui";
import { DEAL_CONDITION_LABELS, DEAL_OWNER_LABELS, parseDealOwner, type Category } from "@/db/schema";
import {
  deleteDeal,
  fetchDeal,
  markDealInStock,
  markDealSold,
  patchDealFields,
  updateDealSoldAt,
} from "@/lib/dealClient";
import type { DealWithRelations } from "@/lib/deals";
import { getJson } from "@/lib/http";
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
  const [categories, setCategories] = useState<Category[]>([]);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [soldDateError, setSoldDateError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [markSoldOpen, setMarkSoldOpen] = useState(false);
  const [quickEditOpen, setQuickEditOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const [data, cats] = await Promise.all([
        fetchDeal(params.id),
        getJson<Category[]>("/api/categories", "Failed to load categories."),
      ]);
      setDeal(data);
      setCategories(cats);
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
            Back to Inventory
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
    <div className="space-y-6">
      <PageHeader
        title={deal.name}
        subtitle={`Size ${deal.size}${deal.category ? ` · ${deal.category.name}` : ""} · ${ownerLabel}${deal.platform ? ` · ${deal.platform}` : ""}`}
        back={<BackLink href="/inventory">Back to Inventory</BackLink>}
        actions={
          <>
            {deal.status === "in_stock" ? (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setMarkSoldOpen(true)}
              >
                Mark Sold
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
                      err instanceof Error ? err.message : "Could not mark in stock.",
                    );
                  }
                }}
              >
                Mark In Stock
              </button>
            )}
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setQuickEditOpen(true)}
            >
              Edit
            </button>
            <Link href={`/overlay?dealId=${deal.id}`} className="btn btn-secondary">
              Stamp
            </Link>
            <button
              type="button"
              className="btn btn-outline text-[var(--color-error)]"
              onClick={() => setConfirmDelete(true)}
            >
              Delete
            </button>
          </>
        }
      />

      {actionError && <PageError message={actionError} />}

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="card overflow-hidden">
          <div className="aspect-[4/3] bg-[var(--bg-secondary)]">
            {deal.coverPhoto ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={photoUrl(deal.coverPhoto.filename)}
                alt={deal.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-[var(--text-tertiary)]">
                No cover photo
              </div>
            )}
          </div>
        </div>

        <div className="card p-6">
          <StatusBadge status={deal.status === "sold" ? "sold" : "in_stock"} />

          <dl className="mt-5 grid grid-cols-2 gap-4">
            <div>
              <dt className="text-sm text-[var(--text-secondary)]">Owner</dt>
              <dd className="mt-1 text-lg font-semibold">{ownerLabel}</dd>
            </div>
            <div>
              <dt className="text-sm text-[var(--text-secondary)]">Condition</dt>
              <dd className="mt-1 text-lg font-semibold">
                {DEAL_CONDITION_LABELS[deal.condition]}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-[var(--text-secondary)]">Box</dt>
              <dd className="mt-1 font-medium">{deal.hasBox ? "Yes" : "No"}</dd>
            </div>
            <div>
              <dt className="text-sm text-[var(--text-secondary)]">Insoles</dt>
              <dd className="mt-1 font-medium">{deal.hasInsoles ? "Yes" : "No"}</dd>
            </div>
            <div>
              <dt className="text-sm text-[var(--text-secondary)]">Cost</dt>
              <dd className="mt-1 text-lg font-semibold tabular-nums">{formatMoney(deal.cost)}</dd>
            </div>
            <div>
              <dt className="text-sm text-[var(--text-secondary)]">Price</dt>
              <dd className="mt-1 text-lg font-semibold tabular-nums">{formatMoney(deal.price)}</dd>
            </div>
            <div>
              <dt className="text-sm text-[var(--text-secondary)]">Profit</dt>
              <dd className={`mt-1 text-lg font-semibold tabular-nums ${profitToneClass(profit)}`}>
                {formatMoney(profit)}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-[var(--text-secondary)]">ROI</dt>
              <dd className={`mt-1 text-lg font-semibold tabular-nums ${roi === null ? "" : profitToneClass(roi)}`}>
                {formatRoi(deal.price, deal.cost)}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-[var(--text-secondary)]">Purchased</dt>
              <dd className="mt-1 font-medium">{deal.purchasedAt.slice(0, 10)}</dd>
            </div>
            <div>
              <dt className="text-sm text-[var(--text-secondary)]">
                {deal.status === "sold" ? "Sold" : "Days Held"}
              </dt>
              <dd className="mt-1 font-medium">
                {deal.status === "sold" ? (
                  <div>
                    <input
                      type="date"
                      className="w-full rounded-lg border border-[var(--border-primary)] bg-[var(--bg)] px-3 py-2 text-sm"
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
                            err instanceof Error ? err.message : "Could not update sold date.",
                          );
                        }
                      }}
                      aria-label="Sold date"
                    />
                    {soldDateError && (
                      <p className="mt-1 text-xs text-[var(--color-error)]">{soldDateError}</p>
                    )}
                  </div>
                ) : (
                  `${held} days`
                )}
              </dd>
            </div>
          </dl>

          {deal.notes && (
            <div className="mt-5 border-t border-[var(--border-secondary)] pt-5">
              <h3 className="text-sm font-medium text-[var(--text-secondary)]">Notes</h3>
              <p className="mt-2 whitespace-pre-wrap text-sm">{deal.notes}</p>
            </div>
          )}
        </div>
      </div>

      <PhotoUploader
        dealId={deal.id}
        dealName={deal.name}
        photos={deal.photos}
        onChange={load}
      />

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

      <QuickEditDialog
        open={quickEditOpen}
        deal={deal}
        categories={categories}
        onClose={() => setQuickEditOpen(false)}
        onSave={async (fields) => {
          await patchDealFields(deal.id, fields);
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
            setActionError(err instanceof Error ? err.message : "Could not delete deal.");
          }
        }}
      />
    </div>
  );
}
