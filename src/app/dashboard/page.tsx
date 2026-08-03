"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { MetricTile } from "@/components/MetricTile";
import { PageHeader } from "@/components/PageHeader";
import { PageEmpty, PageError, PageLoading } from "@/components/PageStatus";
import { Section } from "@/components/ui";
import type { DashboardStats } from "@/lib/deals";
import { calcProfit, formatMoney, photoUrl, profitToneClass } from "@/lib/format";
import { getJson } from "@/lib/http";

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    void getJson<DashboardStats>("/api/stats", "Could not load analytics.")
      .then(setStats)
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Could not load analytics."),
      );
  }, []);

  if (error) return <PageError message={error} />;
  if (!stats) {
    return <PageLoading label="Loading analytics…" />;
  }

  const empty = stats.inStockCount + stats.soldCount === 0;
  const maxMonthProfit = Math.max(1, ...stats.byMonth.map((m) => Math.abs(m.profit)));

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="Analytics"
        title="Dashboard"
        subtitle="Stock, sales, and capital at a glance."
      />

      {empty ? (
        <PageEmpty
          title="No deals yet"
          description="Add inventory to unlock stock and sales metrics."
          action={
            <Link href="/inventory/new" className="btn btn-primary">
              Add Deal
            </Link>
          }
        />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricTile label="In Stock" value={String(stats.inStockCount)} hint="Open deals right now" />
            <MetricTile label="Sold" value={String(stats.soldCount)} hint="Closed deals" />
            <MetricTile label="Inventory Cost" value={formatMoney(stats.inventoryCost)} hint="Cash tied up in stock" />
            <MetricTile label="List Value" value={formatMoney(stats.inventoryValue)} hint="If everything sold at list" />
            <MetricTile
              label="Projected Profit"
              value={formatMoney(stats.projectedProfit)}
              valueClassName={profitToneClass(stats.projectedProfit)}
              hint="Open stock at list price"
            />
            <MetricTile
              label="Realized Profit"
              value={formatMoney(stats.realizedProfit)}
              valueClassName={profitToneClass(stats.realizedProfit)}
              hint="Sales − cost of sold"
            />
            <MetricTile
              label="Avg ROI (Sold)"
              value={stats.avgRoiSold === null ? "—" : `${stats.avgRoiSold > 0 ? "+" : ""}${stats.avgRoiSold.toFixed(1)}%`}
              valueClassName={stats.avgRoiSold === null ? undefined : profitToneClass(stats.avgRoiSold)}
            />
            <MetricTile
              label="Avg Days Held"
              value={stats.avgDaysHeldSold === null ? "—" : `${stats.avgDaysHeldSold.toFixed(0)} days`}
            />
            <MetricTile label="With Box" value={String(stats.withBoxCount)} hint="Across all deals" />
            <MetricTile label="With Insoles" value={String(stats.withInsolesCount)} hint="Across all deals" />
            <MetricTile
              label="Best Category"
              value={stats.bestCategory?.name ?? "—"}
              hint={stats.bestCategory ? formatMoney(stats.bestCategory.profit) : "No sold profit yet"}
              hintClassName={stats.bestCategory ? profitToneClass(stats.bestCategory.profit) : "text-[var(--text-secondary)]"}
            />
            <MetricTile
              label="Sell-Through"
              value={
                stats.inStockCount + stats.soldCount === 0
                  ? "—"
                  : `${Math.round((stats.soldCount / (stats.inStockCount + stats.soldCount)) * 100)}%`
              }
              hint="Sold ÷ total deals"
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Section title="Profit by Month">
              {stats.byMonth.length === 0 ? (
                <p className="text-sm text-[var(--text-secondary)]">No sales yet.</p>
              ) : (
                <ul className="space-y-4">
                  {stats.byMonth.map((row) => (
                    <li key={row.month}>
                      <div className="mb-2 flex justify-between text-sm">
                        <span className="font-medium">{row.month}</span>
                        <span className={profitToneClass(row.profit)}>
                          {row.sold} sold · {formatMoney(row.profit)}
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-[var(--bg-secondary)]">
                        <div
                          className="h-full rounded-full bg-[var(--text-primary)] transition-all"
                          style={{
                            width: `${Math.max(8, (Math.abs(row.profit) / maxMonthProfit) * 100)}%`,
                          }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            <Section title="By Category">
              {stats.byCategory.length === 0 ? (
                <p className="text-sm text-[var(--text-secondary)]">No categories yet.</p>
              ) : (
                <ul className="divide-y divide-[var(--border-secondary)]">
                  {stats.byCategory.map((row) => (
                    <li key={row.name} className="flex items-center justify-between py-3 text-sm">
                      <div>
                        <p className="font-medium">{row.name}</p>
                        <p className="text-[var(--text-secondary)]">
                          {row.inStock} in stock · {row.sold} sold
                        </p>
                      </div>
                      <p className={profitToneClass(row.profit)}>{formatMoney(row.profit)}</p>
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            <Section title="By Owner">
              <ul className="divide-y divide-[var(--border-secondary)]">
                {stats.byOwner.map((row) => (
                  <li key={row.name} className="flex items-center justify-between py-3 text-sm">
                    <div>
                      <p className="font-medium">{row.name}</p>
                      <p className="text-[var(--text-secondary)]">
                        {row.inStock} in stock · {row.sold} sold
                      </p>
                    </div>
                    <p className={profitToneClass(row.profit)}>{formatMoney(row.profit)}</p>
                  </li>
                ))}
              </ul>
            </Section>

            <Section title="By Condition">
              <ul className="divide-y divide-[var(--border-secondary)]">
                {stats.byCondition.map((row) => (
                  <li key={row.name} className="flex items-center justify-between py-3 text-sm">
                    <p className="font-medium">{row.name}</p>
                    <p className="text-[var(--text-secondary)]">
                      {row.inStock} in stock · {row.sold} sold
                    </p>
                  </li>
                ))}
              </ul>
            </Section>
          </div>

          <Section
            title="Recently Sold"
            action={
              <Link href="/inventory?status=sold" className="text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
                View all sold →
              </Link>
            }
          >
            {stats.recentlySold.length === 0 ? (
              <p className="text-sm text-[var(--text-secondary)]">No sales recorded yet.</p>
            ) : (
              <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {stats.recentlySold.map((deal) => {
                  const soldProfit = calcProfit(deal.price, deal.cost);
                  return (
                    <li key={deal.id}>
                      <Link
                        href={`/inventory/${deal.id}`}
                        className="flex gap-3 rounded-xl border border-[var(--border-secondary)] bg-[var(--bg-elevated)] p-3 transition-all hover:border-[var(--border-primary)] hover:shadow-sm"
                      >
                        <div className="h-14 w-14 overflow-hidden rounded-lg bg-[var(--bg-secondary)]">
                          {deal.coverPhoto && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={photoUrl(deal.coverPhoto.filename)}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">{deal.name}</p>
                          <p className="text-sm text-[var(--text-secondary)]">
                            {deal.soldAt?.slice(0, 10)} ·{" "}
                            <span className={profitToneClass(soldProfit)}>{formatMoney(soldProfit)}</span>
                          </p>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Section>
        </>
      )}
    </div>
  );
}
