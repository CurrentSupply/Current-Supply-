"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { DashboardStats } from "@/lib/deals";
import { formatMoney, photoUrl, profitToneClass } from "@/lib/format";

function StatTile({
  label,
  value,
  hint,
  valueClassName,
  hintClassName,
}: {
  label: string;
  value: string;
  hint?: string;
  valueClassName?: string;
  hintClassName?: string;
}) {
  return (
    <div className="surface rounded-none p-4">
      <p className="page-kicker">{label}</p>
      <p className={`page-title mt-2 text-2xl ${valueClassName ?? ""}`}>
        {value}
      </p>
      {hint ? (
        <p className={`mt-1 text-xs ${hintClassName ?? "text-[var(--muted)]"}`}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    void fetch("/api/stats")
      .then(async (r) => {
        if (!r.ok) throw new Error("Could not load analytics.");
        return r.json();
      })
      .then(setStats)
      .catch((err) => setError(err.message));
  }, []);

  if (error) return <p className="text-[var(--danger)]">{error}</p>;
  if (!stats) {
    return <p className="text-sm text-[var(--muted)]">Loading analytics…</p>;
  }

  const empty = stats.inStockCount + stats.soldCount === 0;
  const maxMonthProfit = Math.max(
    1,
    ...stats.byMonth.map((m) => Math.abs(m.profit)),
  );

  return (
    <div className="space-y-6">
      <div>
        <p className="page-kicker">Analytics</p>
        <h1 className="page-title mt-1 text-3xl sm:text-4xl">
          Inventory pulse
        </h1>
        <p className="mt-1 text-[var(--muted)]">
          What’s available, what’s sold, and where profit is coming from.
        </p>
      </div>

      {empty ? (
        <div className="surface rounded-none px-6 py-14 text-center">
          <h2 className="text-xl font-semibold">No deals yet</h2>
          <p className="mt-2 text-[var(--muted)]">
            Add inventory to unlock stock and sales metrics.
          </p>
          <Link href="/inventory/new" className="btn btn-primary mt-5">
            Add deal
          </Link>
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile
              label="Available"
              value={String(stats.inStockCount)}
              hint="In stock right now"
            />
            <StatTile
              label="Sold"
              value={String(stats.soldCount)}
              hint="Closed deals"
            />
            <StatTile
              label="Inventory cost"
              value={formatMoney(stats.inventoryCost)}
              hint="Cash tied up in stock"
            />
            <StatTile
              label="List value"
              value={formatMoney(stats.inventoryValue)}
              hint="If everything sold at list"
            />
            <StatTile
              label="Projected profit"
              value={formatMoney(stats.projectedProfit)}
              valueClassName={profitToneClass(stats.projectedProfit)}
              hint="Open stock at list price"
            />
            <StatTile
              label="Realized profit"
              value={formatMoney(stats.realizedProfit)}
              valueClassName={profitToneClass(stats.realizedProfit)}
              hint={`${stats.soldCount} sold`}
            />
            <StatTile
              label="Avg ROI (sold)"
              value={
                stats.avgRoiSold === null
                  ? "—"
                  : `${stats.avgRoiSold > 0 ? "+" : ""}${stats.avgRoiSold.toFixed(1)}%`
              }
              valueClassName={
                stats.avgRoiSold === null
                  ? undefined
                  : profitToneClass(stats.avgRoiSold)
              }
            />
            <StatTile
              label="Avg days held"
              value={
                stats.avgDaysHeldSold === null
                  ? "—"
                  : `${stats.avgDaysHeldSold.toFixed(0)} days`
              }
            />
            <StatTile
              label="With box"
              value={String(stats.withBoxCount)}
              hint="Across all deals"
            />
            <StatTile
              label="With insoles"
              value={String(stats.withInsolesCount)}
              hint="Across all deals"
            />
            <StatTile
              label="Best category"
              value={stats.bestCategory?.name ?? "—"}
              hint={
                stats.bestCategory
                  ? formatMoney(stats.bestCategory.profit)
                  : "No sold profit yet"
              }
              hintClassName={
                stats.bestCategory
                  ? profitToneClass(stats.bestCategory.profit)
                  : "text-[var(--muted)]"
              }
            />
            <StatTile
              label="Sell-through"
              value={
                stats.inStockCount + stats.soldCount === 0
                  ? "—"
                  : `${Math.round(
                      (stats.soldCount /
                        (stats.inStockCount + stats.soldCount)) *
                        100,
                    )}%`
              }
              hint="Sold ÷ total deals"
            />
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <section className="surface rounded-none p-5">
              <h2 className="text-lg font-semibold">Profit by month</h2>
              {stats.byMonth.length === 0 ? (
                <p className="mt-4 text-sm text-[var(--muted)]">No sales yet.</p>
              ) : (
                <ul className="mt-4 space-y-3">
                  {stats.byMonth.map((row) => (
                    <li key={row.month}>
                      <div className="mb-1 flex justify-between text-sm">
                        <span>{row.month}</span>
                        <span className={profitToneClass(row.profit)}>
                          {row.sold} sold · {formatMoney(row.profit)}
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-none bg-[var(--bg-deep)]">
                        <div
                          className="h-full rounded-none bg-[var(--accent)]"
                          style={{
                            width: `${Math.max(
                              8,
                              (Math.abs(row.profit) / maxMonthProfit) * 100,
                            )}%`,
                          }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="surface rounded-none p-5">
              <h2 className="text-lg font-semibold">By category</h2>
              {stats.byCategory.length === 0 ? (
                <p className="mt-4 text-sm text-[var(--muted)]">
                  No categories yet.
                </p>
              ) : (
                <ul className="mt-4 divide-y divide-[var(--line)]">
                  {stats.byCategory.map((row) => (
                    <li
                      key={row.name}
                      className="flex items-center justify-between py-3 text-sm"
                    >
                      <div>
                        <p className="font-medium">{row.name}</p>
                        <p className="text-[var(--muted)]">
                          {row.inStock} available · {row.sold} sold
                        </p>
                      </div>
                      <p className={profitToneClass(row.profit)}>
                        {formatMoney(row.profit)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="surface rounded-none p-5">
              <h2 className="text-lg font-semibold">By owner</h2>
              <ul className="mt-4 divide-y divide-[var(--line)]">
                {stats.byOwner.map((row) => (
                  <li
                    key={row.name}
                    className="flex items-center justify-between py-3 text-sm"
                  >
                    <div>
                      <p className="font-medium">{row.name}</p>
                      <p className="text-[var(--muted)]">
                        {row.inStock} available · {row.sold} sold
                      </p>
                    </div>
                    <p className={profitToneClass(row.profit)}>
                      {formatMoney(row.profit)}
                    </p>
                  </li>
                ))}
              </ul>
            </section>

            <section className="surface rounded-none p-5">
              <h2 className="text-lg font-semibold">By condition</h2>
              <ul className="mt-4 divide-y divide-[var(--line)]">
                {stats.byCondition.map((row) => (
                  <li
                    key={row.name}
                    className="flex items-center justify-between py-3 text-sm"
                  >
                    <p className="font-medium">{row.name}</p>
                    <p className="text-[var(--muted)]">
                      {row.inStock} available · {row.sold} sold
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          </div>

          <section className="surface rounded-none p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">Recently sold</h2>
              <Link
                href="/inventory?status=sold"
                className="text-sm font-bold uppercase tracking-[0.1em] underline underline-offset-4"
              >
                View sold
              </Link>
            </div>
            {stats.recentlySold.length === 0 ? (
              <p className="mt-4 text-sm text-[var(--muted)]">
                No sales recorded yet.
              </p>
            ) : (
              <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {stats.recentlySold.map((deal) => {
                  const soldProfit = deal.price - deal.cost;
                  return (
                    <li key={deal.id}>
                      <Link
                        href={`/inventory/${deal.id}`}
                        className="flex gap-3 rounded-none border border-[var(--line)] bg-white/70 p-2 transition hover:border-[var(--accent)]"
                      >
                        <div className="h-16 w-16 overflow-hidden rounded-none bg-[var(--bg-deep)]">
                          {deal.coverPhoto ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={photoUrl(deal.coverPhoto.filename)}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          ) : null}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-medium">{deal.name}</p>
                          <p className="text-sm text-[var(--muted)]">
                            {deal.soldAt?.slice(0, 10)} ·{" "}
                            <span className={profitToneClass(soldProfit)}>
                              {formatMoney(soldProfit)}
                            </span>
                          </p>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
