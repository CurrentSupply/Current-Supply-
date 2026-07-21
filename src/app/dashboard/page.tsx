"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { DashboardStats } from "@/lib/deals";
import { formatMoney, photoUrl } from "@/lib/format";

function StatTile({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="surface rounded-2xl p-4">
      <p className="text-sm text-[var(--muted)]">{label}</p>
      <p className="mt-2 font-[family-name:var(--font-display)] text-2xl font-semibold tracking-tight">
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-[var(--muted)]">{hint}</p> : null}
    </div>
  );
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    void fetch("/api/stats")
      .then(async (r) => {
        if (!r.ok) throw new Error("Could not load stats.");
        return r.json();
      })
      .then(setStats)
      .catch((err) => setError(err.message));
  }, []);

  if (error) return <p className="text-[var(--danger)]">{error}</p>;
  if (!stats) return <p className="text-sm text-[var(--muted)]">Loading dashboard…</p>;

  const empty = stats.inStockCount + stats.soldCount === 0;
  const maxMonthProfit = Math.max(1, ...stats.byMonth.map((m) => Math.abs(m.profit)));

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium text-[var(--accent)]">Dashboard</p>
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight sm:text-4xl">
          Business pulse
        </h1>
        <p className="mt-1 text-[var(--muted)]">
          Inventory value, profit, and recent movement at a glance.
        </p>
      </div>

      {empty ? (
        <div className="surface rounded-2xl px-6 py-14 text-center">
          <h2 className="text-xl font-semibold">No deals yet</h2>
          <p className="mt-2 text-[var(--muted)]">
            Add inventory to unlock profit and hold-time metrics.
          </p>
          <Link href="/inventory/new" className="btn btn-primary mt-5">
            Add deal
          </Link>
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile label="In stock" value={String(stats.inStockCount)} />
            <StatTile
              label="Inventory cost"
              value={formatMoney(stats.inventoryCost)}
              hint="What you have tied up"
            />
            <StatTile
              label="Projected profit"
              value={formatMoney(stats.projectedProfit)}
              hint="If current stock sells at list"
            />
            <StatTile
              label="Realized profit"
              value={formatMoney(stats.realizedProfit)}
              hint={`${stats.soldCount} sold`}
            />
            <StatTile
              label="Avg ROI (sold)"
              value={
                stats.avgRoiSold === null
                  ? "—"
                  : `${stats.avgRoiSold >= 0 ? "+" : ""}${stats.avgRoiSold.toFixed(1)}%`
              }
            />
            <StatTile
              label="Avg days held (sold)"
              value={
                stats.avgDaysHeldSold === null
                  ? "—"
                  : `${stats.avgDaysHeldSold.toFixed(0)} days`
              }
            />
            <StatTile
              label="Best category"
              value={stats.bestCategory?.name ?? "—"}
              hint={
                stats.bestCategory
                  ? formatMoney(stats.bestCategory.profit)
                  : "No sold profit yet"
              }
            />
            <StatTile label="Sold total" value={String(stats.soldCount)} />
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <section className="surface rounded-2xl p-5">
              <h2 className="text-lg font-semibold">Profit by month</h2>
              {stats.byMonth.length === 0 ? (
                <p className="mt-4 text-sm text-[var(--muted)]">No sales yet.</p>
              ) : (
                <ul className="mt-4 space-y-3">
                  {stats.byMonth.map((row) => (
                    <li key={row.month}>
                      <div className="mb-1 flex justify-between text-sm">
                        <span>{row.month}</span>
                        <span>
                          {row.sold} sold · {formatMoney(row.profit)}
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-[var(--bg-deep)]">
                        <div
                          className="h-full rounded-full bg-[var(--accent)]"
                          style={{
                            width: `${Math.max(8, (Math.abs(row.profit) / maxMonthProfit) * 100)}%`,
                          }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="surface rounded-2xl p-5">
              <h2 className="text-lg font-semibold">By category</h2>
              {stats.byCategory.length === 0 ? (
                <p className="mt-4 text-sm text-[var(--muted)]">No categories yet.</p>
              ) : (
                <ul className="mt-4 divide-y divide-[var(--line)]">
                  {stats.byCategory.map((row) => (
                    <li
                      key={row.name}
                      className="flex items-center justify-between py-3 text-sm"
                    >
                      <div>
                        <p className="font-medium">{row.name}</p>
                        <p className="text-[var(--muted)]">{row.count} items</p>
                      </div>
                      <p className={row.profit >= 0 ? "profit-pos" : "profit-neg"}>
                        {formatMoney(row.profit)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <section className="surface rounded-2xl p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">Recently sold</h2>
              <Link href="/inventory?status=sold" className="text-sm text-[var(--accent)]">
                View sold
              </Link>
            </div>
            {stats.recentlySold.length === 0 ? (
              <p className="mt-4 text-sm text-[var(--muted)]">No sales recorded yet.</p>
            ) : (
              <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {stats.recentlySold.map((deal) => (
                  <li key={deal.id}>
                    <Link
                      href={`/inventory/${deal.id}`}
                      className="flex gap-3 rounded-xl border border-[var(--line)] bg-white/70 p-2 transition hover:border-[var(--accent)]"
                    >
                      <div className="h-16 w-16 overflow-hidden rounded-lg bg-[var(--bg-deep)]">
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
                          {deal.soldAt?.slice(0, 10)} · {formatMoney(deal.price - deal.cost)}
                        </p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
