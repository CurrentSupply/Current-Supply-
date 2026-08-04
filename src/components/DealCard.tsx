"use client";

import Link from "next/link";
import { DEAL_OWNER_LABELS, parseDealOwner } from "@/db/schema";
import { PencilIcon } from "@/components/icons";
import type { DealWithRelations } from "@/lib/deals";
import {
  calcProfit,
  formatMoney,
  formatRoi,
  photoUrl,
  profitToneClass,
} from "@/lib/format";
import { StatusBadge } from "@/components/ui";

type Props = {
  deal: DealWithRelations;
  onMarkSold?: (deal: DealWithRelations) => void;
  onQuickEdit?: (deal: DealWithRelations) => void;
};

export function DealCard({ deal, onMarkSold, onQuickEdit }: Props) {
  const profit = calcProfit(deal.price, deal.cost);
  const cover = deal.coverPhoto;
  const ownerLabel = DEAL_OWNER_LABELS[parseDealOwner(deal.owner)];
  const isSold = deal.status === "sold";

  return (
    <article className="card card-interactive group overflow-hidden">
      <Link href={`/inventory/${deal.id}`} className="block">
        <div className="relative aspect-[4/3] overflow-hidden bg-[var(--bg-secondary)]">
          {cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photoUrl(cover.filename)}
              alt={deal.name}
              className={`h-full w-full object-cover transition-transform duration-300 group-hover:scale-105 ${
                isSold ? "opacity-60 grayscale" : ""
              }`}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-[var(--text-tertiary)]">
              No photo
            </div>
          )}
          <div className="absolute left-3 top-3">
            <StatusBadge status={deal.status === "sold" ? "sold" : "in_stock"} />
          </div>
        </div>

        <div className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h3 className="text-heading text-base truncate">{deal.name}</h3>
              <p className="mt-1 text-sm text-[var(--text-secondary)] truncate">
                Size {deal.size}
                {deal.category ? ` · ${deal.category.name}` : ""}
                {` · ${ownerLabel}`}
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className="font-semibold tabular-nums">{formatMoney(deal.price)}</p>
              <p className="text-xs text-[var(--text-tertiary)] tabular-nums">
                {formatMoney(deal.cost)} cost
              </p>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between">
            <span className={`text-sm tabular-nums ${profitToneClass(profit)}`}>
              {profit > 0 ? "+" : ""}
              {formatMoney(profit)} · {formatRoi(deal.price, deal.cost)}
            </span>
            {deal.platform && (
              <span className="text-xs text-[var(--text-tertiary)]">
                {deal.platform}
              </span>
            )}
          </div>
        </div>
      </Link>

      {(onQuickEdit || (deal.status === "in_stock" && onMarkSold)) && (
        <div className="flex border-t border-[var(--border-secondary)]">
          {onQuickEdit && (
            <button
              type="button"
              aria-label="Edit"
              title="Edit"
              className="inline-flex items-center justify-center px-4 py-3 text-[var(--text-tertiary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
              onClick={() => onQuickEdit(deal)}
            >
              <PencilIcon className="h-4 w-4" />
            </button>
          )}
          {deal.status === "in_stock" && onMarkSold && (
            <button
              type="button"
              className={`btn btn-secondary flex-1 rounded-none border-0 ${
                onQuickEdit ? "border-l border-[var(--border-secondary)]" : ""
              }`}
              onClick={() => onMarkSold(deal)}
            >
              Mark Sold
            </button>
          )}
        </div>
      )}
    </article>
  );
}
