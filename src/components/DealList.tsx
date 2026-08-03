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
  deals: DealWithRelations[];
  onMarkSold?: (deal: DealWithRelations) => void;
  onQuickEdit?: (deal: DealWithRelations) => void;
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "—";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
}

export function DealList({ deals, onMarkSold, onQuickEdit }: Props) {
  return (
    <section className="table-container">
      <table className="table">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 bg-[var(--bg-secondary)]">Item</th>
            <th>Size</th>
            <th>Status</th>
            <th className="text-right">Cost</th>
            <th className="text-right">Price</th>
            <th className="text-right">Profit</th>
            <th>Owner</th>
            <th><span className="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          {deals.map((deal) => {
            const profit = calcProfit(deal.price, deal.cost);
            const cover = deal.coverPhoto;
            const ownerLabel = DEAL_OWNER_LABELS[parseDealOwner(deal.owner)];
            const isSold = deal.status === "sold";

            return (
              <tr key={deal.id} className="group">
                <td className="sticky left-0 z-10 bg-[var(--bg-elevated)] group-hover:bg-[var(--bg-hover)]">
                  <Link
                    href={`/inventory/${deal.id}`}
                    className="flex items-center gap-3 min-w-0"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[var(--bg-secondary)] text-xs font-medium text-[var(--text-tertiary)]">
                      {cover ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={photoUrl(cover.filename)}
                          alt=""
                          className={`h-full w-full object-cover ${
                            isSold ? "opacity-50 grayscale" : ""
                          }`}
                        />
                      ) : (
                        <span aria-hidden>{initials(deal.name)}</span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium truncate group-hover:text-[var(--text-primary)]">
                        {deal.name}
                      </p>
                      <p className="text-xs text-[var(--text-tertiary)] truncate">
                        {deal.category?.name ?? "Uncategorized"}
                        {` · ${deal.condition}`}
                        {deal.platform ? ` · ${deal.platform}` : ""}
                      </p>
                    </div>
                  </Link>
                </td>
                <td className="whitespace-nowrap tabular-nums">
                  {deal.size}
                </td>
                <td className="whitespace-nowrap">
                  <StatusBadge
                    status={isSold ? "sold" : "in_stock"}
                    variant="badge"
                  />
                </td>
                <td className="text-right whitespace-nowrap tabular-nums text-[var(--text-secondary)]">
                  {formatMoney(deal.cost)}
                </td>
                <td className="text-right whitespace-nowrap tabular-nums font-medium">
                  {formatMoney(deal.price)}
                </td>
                <td className={`text-right whitespace-nowrap tabular-nums ${profitToneClass(profit)}`}>
                  <span>
                    {profit > 0 ? "+" : ""}
                    {formatMoney(profit)}
                  </span>
                  <span className="ml-1.5 text-xs text-[var(--text-tertiary)]">
                    {formatRoi(deal.price, deal.cost)}
                  </span>
                </td>
                <td className="whitespace-nowrap text-[var(--text-secondary)]">
                  {ownerLabel}
                </td>
                <td className="text-right whitespace-nowrap">
                  <div className="flex items-center justify-end gap-1">
                    {onQuickEdit && (
                      <button
                        type="button"
                        aria-label="Edit"
                        title="Edit"
                        className="inline-flex items-center justify-center p-1.5 text-[var(--text-tertiary)] transition-colors hover:text-[var(--text-primary)]"
                        onClick={() => onQuickEdit(deal)}
                      >
                        <PencilIcon className="h-3.5 w-3.5" />
                      </button>
                    )}
                    {deal.status === "in_stock" && onMarkSold ? (
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => onMarkSold(deal)}
                      >
                        Sell
                      </button>
                    ) : (
                      <Link
                        href={`/inventory/${deal.id}`}
                        className="btn btn-ghost btn-sm"
                      >
                        View
                      </Link>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
