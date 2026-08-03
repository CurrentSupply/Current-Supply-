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
    <section className="surface overflow-hidden rounded-none">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-black bg-white text-[0.65rem] font-bold uppercase tracking-[0.12em] text-[var(--muted)]">
              <th className="sticky left-0 z-[1] bg-white px-3 py-2.5 font-bold sm:px-4">
                Item
              </th>
              <th className="px-2 py-2.5 font-bold">Size</th>
              <th className="px-2 py-2.5 font-bold">Status</th>
              <th className="px-2 py-2.5 text-right font-bold">Cost</th>
              <th className="px-2 py-2.5 text-right font-bold">Price</th>
              <th className="px-2 py-2.5 text-right font-bold">Profit</th>
              <th className="px-2 py-2.5 font-bold">Owner</th>
              <th className="px-3 py-2.5 font-bold sm:px-4">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {deals.map((deal) => {
              const profit = calcProfit(deal.price, deal.cost);
              const cover = deal.coverPhoto;
              const ownerLabel = DEAL_OWNER_LABELS[parseDealOwner(deal.owner)];
              const isSold = deal.status === "sold";

              return (
                <tr
                  key={deal.id}
                  className="group border-b border-[var(--line)] last:border-b-0 hover:bg-[#fafafa]"
                >
                  <td className="sticky left-0 z-[1] bg-white px-3 py-2 group-hover:bg-[#fafafa] sm:px-4">
                    <Link
                      href={`/inventory/${deal.id}`}
                      className="flex min-w-0 items-center gap-2.5"
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden bg-[var(--bg-deep)] text-[0.62rem] font-bold tracking-[0.06em] text-[var(--muted)]">
                        {cover ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={photoUrl(cover.filename)}
                            alt=""
                            className={`h-full w-full object-cover ${
                              isSold ? "opacity-55 grayscale" : ""
                            }`}
                          />
                        ) : (
                          <span aria-hidden>{initials(deal.name)}</span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-semibold leading-tight group-hover:underline group-hover:underline-offset-2">
                          {deal.name}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-[var(--muted)]">
                          {deal.category?.name ?? "Uncategorized"}
                          {` · ${deal.condition}`}
                          {deal.platform ? ` · ${deal.platform}` : ""}
                        </p>
                      </div>
                    </Link>
                  </td>
                  <td className="px-2 py-2 whitespace-nowrap tabular-nums">
                    {deal.size}
                  </td>
                  <td className="px-2 py-2 whitespace-nowrap">
                    <span
                      className={`text-xs font-bold uppercase tracking-[0.08em] ${
                        isSold ? "text-[var(--ink)]" : "text-[var(--muted)]"
                      }`}
                    >
                      {isSold ? "Sold" : "Stock"}
                    </span>
                  </td>
                  <td className="px-2 py-2 text-right whitespace-nowrap tabular-nums text-[var(--muted)]">
                    {formatMoney(deal.cost)}
                  </td>
                  <td className="px-2 py-2 text-right whitespace-nowrap tabular-nums font-medium">
                    {formatMoney(deal.price)}
                  </td>
                  <td
                    className={`px-2 py-2 text-right whitespace-nowrap tabular-nums ${profitToneClass(profit)}`}
                  >
                    <span>
                      {profit > 0 ? "+" : ""}
                      {formatMoney(profit)}
                    </span>
                    <span className="ml-1.5 text-xs font-semibold text-[var(--muted)]">
                      {formatRoi(deal.price, deal.cost)}
                    </span>
                  </td>
                  <td className="px-2 py-2 whitespace-nowrap text-[var(--muted)]">
                    {ownerLabel}
                  </td>
                  <td className="px-3 py-2 text-right whitespace-nowrap sm:px-4">
                    <div className="flex items-center justify-end gap-3">
                      {onQuickEdit ? (
                        <button
                          type="button"
                          aria-label="Edit"
                          title="Edit"
                          className="inline-flex items-center justify-center p-1 text-[var(--muted)] transition hover:text-[var(--ink)]"
                          onClick={() => onQuickEdit(deal)}
                        >
                          <PencilIcon className="h-3.5 w-3.5" />
                        </button>
                      ) : null}
                      {deal.status === "in_stock" && onMarkSold ? (
                        <button
                          type="button"
                          className="text-xs font-bold uppercase tracking-[0.08em] text-[var(--muted)] underline-offset-2 transition hover:text-[var(--ink)] hover:underline"
                          onClick={() => onMarkSold(deal)}
                        >
                          Mark sold
                        </button>
                      ) : (
                        <Link
                          href={`/inventory/${deal.id}`}
                          className="text-xs font-bold uppercase tracking-[0.08em] text-[var(--muted)] underline-offset-2 hover:text-[var(--ink)] hover:underline"
                        >
                          Open
                        </Link>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
