"use client";

import Link from "next/link";
import { DEAL_OWNER_LABELS, parseDealOwner } from "@/db/schema";
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
};

export function DealList({ deals, onMarkSold }: Props) {
  return (
    <section className="surface overflow-hidden rounded-none">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead>
            <tr className="border-b border-black text-[0.7rem] font-bold uppercase tracking-[0.1em] text-[var(--muted)]">
              <th className="px-4 py-3 font-bold">Item</th>
              <th className="px-3 py-3 font-bold">Size</th>
              <th className="px-3 py-3 font-bold">Status</th>
              <th className="px-3 py-3 font-bold">Cost</th>
              <th className="px-3 py-3 font-bold">Price</th>
              <th className="px-3 py-3 font-bold">Profit</th>
              <th className="px-3 py-3 font-bold">Owner</th>
              <th className="px-4 py-3 font-bold">
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
                  className="border-b border-[var(--line)] last:border-b-0"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/inventory/${deal.id}`}
                      className="flex min-w-0 items-center gap-3"
                    >
                      <div className="h-12 w-12 shrink-0 overflow-hidden border border-[var(--line)] bg-[#efefef]">
                        {cover ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={photoUrl(cover.filename)}
                            alt=""
                            className={`h-full w-full object-cover ${
                              isSold ? "opacity-60" : ""
                            }`}
                          />
                        ) : null}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-medium underline-offset-2 hover:underline">
                          {deal.name}
                        </p>
                        <p className="truncate text-[var(--muted)]">
                          {deal.category?.name ?? "Uncategorized"}
                          {` · ${deal.condition}`}
                          {deal.platform ? ` · ${deal.platform}` : ""}
                        </p>
                      </div>
                    </Link>
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap">{deal.size}</td>
                  <td className="px-3 py-3 whitespace-nowrap">
                    <span
                      className={`badge ${isSold ? "badge-sold" : "badge-stock"}`}
                    >
                      {isSold ? "Sold" : "In stock"}
                    </span>
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap">
                    {formatMoney(deal.cost)}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap">
                    {formatMoney(deal.price)}
                  </td>
                  <td
                    className={`px-3 py-3 whitespace-nowrap ${profitToneClass(profit)}`}
                  >
                    {profit > 0 ? "+" : ""}
                    {formatMoney(profit)}
                    <span className="ml-1 text-[var(--muted)]">
                      · {formatRoi(deal.price, deal.cost)}
                    </span>
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap">{ownerLabel}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    {deal.status === "in_stock" && onMarkSold ? (
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => onMarkSold(deal)}
                      >
                        Mark sold
                      </button>
                    ) : (
                      <Link
                        href={`/inventory/${deal.id}`}
                        className="text-xs font-bold uppercase tracking-[0.1em] underline underline-offset-4"
                      >
                        Open
                      </Link>
                    )}
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
