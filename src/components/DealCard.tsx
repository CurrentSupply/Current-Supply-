"use client";

import Link from "next/link";
import { DEAL_OWNER_LABELS, parseDealOwner } from "@/db/schema";
import type { DealWithRelations } from "@/lib/deals";
import {
  calcProfit,
  formatMoney,
  formatRoi,
  photoUrl,
} from "@/lib/format";

type Props = {
  deal: DealWithRelations;
  onMarkSold?: (deal: DealWithRelations) => void;
};

export function DealCard({ deal, onMarkSold }: Props) {
  const profit = calcProfit(deal.price, deal.cost);
  const cover = deal.coverPhoto;
  const ownerLabel = DEAL_OWNER_LABELS[parseDealOwner(deal.owner)];
  const isSold = deal.status === "sold";

  return (
    <article className="surface group overflow-hidden rounded-none transition hover:border-black">
      <Link href={`/inventory/${deal.id}`} className="block">
        <div className="relative aspect-[4/3] overflow-hidden bg-[#efefef]">
          {cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photoUrl(cover.filename)}
              alt={deal.name}
              className={`h-full w-full object-cover ${
                isSold ? "scale-105 blur-[6px]" : ""
              }`}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm uppercase tracking-[0.12em] text-[var(--muted)]">
              No photo
            </div>
          )}
          {isSold ? (
            <>
              <div className="absolute inset-0 bg-black/25" aria-hidden />
              <span
                className="pointer-events-none absolute inset-0 flex items-center justify-center text-4xl font-black uppercase tracking-[0.14em] text-black sm:text-5xl"
                style={{
                  WebkitTextStroke: "2px white",
                  textShadow:
                    "0 0 2px #fff, 1px 1px 0 #fff, -1px -1px 0 #fff, 1px -1px 0 #fff, -1px 1px 0 #fff",
                }}
              >
                Sold
              </span>
            </>
          ) : (
            <span className="badge badge-stock absolute left-3 top-3">
              In stock
            </span>
          )}
        </div>
        <div className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="page-title text-xl leading-tight">
                {deal.name}
              </h3>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Size {deal.size}
                {deal.category ? ` · ${deal.category.name}` : ""}
                {` · ${deal.condition}`}
                {` · ${ownerLabel}`}
                {deal.hasBox ? " · Box" : ""}
                {deal.hasInsoles ? " · Insoles" : ""}
              </p>
            </div>
            <div className="text-right">
              <p className="font-semibold">{formatMoney(deal.price)}</p>
              <p className="text-xs text-[var(--muted)]">
                cost {formatMoney(deal.cost)}
              </p>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between text-sm">
            <span className={profit >= 0 ? "profit-pos" : "profit-neg"}>
              {profit >= 0 ? "+" : ""}
              {formatMoney(profit)} · {formatRoi(deal.price, deal.cost)}
            </span>
            {deal.platform ? (
              <span className="text-[var(--muted)]">{deal.platform}</span>
            ) : null}
          </div>
        </div>
      </Link>
      {deal.status === "in_stock" && onMarkSold ? (
        <div className="border-t border-[var(--line)] px-4 py-3">
          <button
            type="button"
            className="btn btn-secondary w-full"
            onClick={() => onMarkSold(deal)}
          >
            Mark sold
          </button>
        </div>
      ) : null}
    </article>
  );
}
