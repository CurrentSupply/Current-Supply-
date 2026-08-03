"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { MetricTile } from "@/components/MetricTile";
import { PageHeader } from "@/components/PageHeader";
import { PageEmpty, PageError, PageLoading } from "@/components/PageStatus";
import { ReportFilters } from "@/components/ReportFilters";
import type { Category } from "@/db/schema";
import type { DashboardStats } from "@/lib/deals";
import { calcProfit, formatMoney, photoUrl, profitToneClass } from "@/lib/format";
import { getJson } from "@/lib/http";
import {
  ANALYTICS_FILTERS_STORAGE_KEY,
  DEFAULT_REPORT_FILTERS,
  reportFiltersAreRestrictive,
  reportFiltersToQueryString,
  readStoredReportFilters,
  writeStoredReportFilters,
  type ReportFilterState,
} from "@/lib/reportFilters";

export default function DashboardPage() {
  const [filters, setFilters] = useState<ReportFilterState>(
    DEFAULT_REPORT_FILTERS,
  );
  const [hydrated, setHydrated] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    queueMicrotask(() => {
      setFilters(
        readStoredReportFilters(ANALYTICS_FILTERS_STORAGE_KEY) ??
          DEFAULT_REPORT_FILTERS,
      );
      setHydrated(true);
    });
  }, []);

  useEffect(() => {
    void getJson<Category[]>("/api/categories", "Failed to load categories.")
      .then(setCategories)
      .catch(() => setCategories([]));
  }, []);

  const loadStats = useCallback(async (active: ReportFilterState) => {
    setLoading(true);
    setError("");
    try {
      const qs = reportFiltersToQueryString(active);
      const data = await getJson<DashboardStats>(
        qs ? `/api/stats?${qs}` : "/api/stats",
        "Could not load analytics.",
      );
      setStats(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not load analytics.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const handle = setTimeout(() => {
      void loadStats(filters);
    }, 200);
    return () => clearTimeout(handle);
  }, [filters, hydrated, loadStats]);

  function updateFilters(next: ReportFilterState) {
    writeStoredReportFilters(ANALYTICS_FILTERS_STORAGE_KEY, next);
    setFilters(next);
  }

  if (error && !stats) return <PageError message={error} />;
  if (!hydrated || (!stats && loading)) {
    return <PageLoading label="Loading analytics…" />;
  }
  if (!stats) return <PageError message={error || "Could not load analytics."} />;

  const empty = stats.inStockCount + stats.soldCount === 0;
  const filteredEmpty = empty && reportFiltersAreRestrictive(filters);
  const maxMonthProfit = Math.max(
    1,
    ...stats.byMonth.map((m) => Math.abs(m.profit)),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="Analytics"
        title="Analytics"
        subtitle="Stock, sales, and capital at a glance."
      />

      <ReportFilters
        categories={categories}
        value={filters}
        onChange={updateFilters}
      />

      {error ? <PageError message={error} /> : null}

      {loading ? (
        <PageLoading label="Updating analytics…" />
      ) : empty ? (
        <PageEmpty
          title={filteredEmpty ? "No deals match" : "No deals yet"}
          description={
            filteredEmpty
              ? "Try clearing filters to see everything."
              : "Add inventory to unlock stock and sales metrics."
          }
          action={
            filteredEmpty ? undefined : (
              <Link href="/inventory/new" className="btn btn-primary">
                Add deal
              </Link>
            )
          }
        />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricTile
              label="In stock"
              value={String(stats.inStockCount)}
              hint="Open deals right now"
            />
            <MetricTile
              label="Sold"
              value={String(stats.soldCount)}
              hint="Closed deals in view"
            />
            <MetricTile
              label="Inventory cost"
              value={formatMoney(stats.inventoryCost)}
              hint="Cash tied up in stock"
            />
            <MetricTile
              label="List value"
              value={formatMoney(stats.inventoryValue)}
              hint="If everything sold at list"
            />
            <MetricTile
              label="Projected profit"
              value={formatMoney(stats.projectedProfit)}
              valueClassName={profitToneClass(stats.projectedProfit)}
              hint="Open stock at list price"
            />
            <MetricTile
              label="Realized profit"
              value={formatMoney(stats.realizedProfit)}
              valueClassName={profitToneClass(stats.realizedProfit)}
              hint="Sales − cost of sold"
            />
            <MetricTile
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
            <MetricTile
              label="Avg days held"
              value={
                stats.avgDaysHeldSold === null
                  ? "—"
                  : `${stats.avgDaysHeldSold.toFixed(0)} days`
              }
            />
            <MetricTile
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
            <MetricTile
              label="Best size"
              value={stats.bestSize ? `Size ${stats.bestSize.name}` : "—"}
              hint={
                stats.bestSize
                  ? `${stats.bestSize.sold} sold · ${formatMoney(stats.bestSize.profit)}`
                  : "No sold profit yet"
              }
              hintClassName={
                stats.bestSize
                  ? profitToneClass(stats.bestSize.profit)
                  : "text-[var(--muted)]"
              }
            />
            <MetricTile
              label="With box"
              value={String(stats.withBoxCount)}
              hint="Across deals in view"
            />
            <MetricTile
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
              <h2 className="text-lg font-semibold">By size</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Ranked by sold profit — see what size moves best.
              </p>
              {stats.bySize.length === 0 ? (
                <p className="mt-4 text-sm text-[var(--muted)]">No sizes yet.</p>
              ) : (
                <ul className="mt-4 divide-y divide-[var(--line)]">
                  {stats.bySize.map((row) => (
                    <li
                      key={row.name}
                      className="flex items-center justify-between py-3 text-sm"
                    >
                      <div>
                        <p className="font-medium">Size {row.name}</p>
                        <p className="text-[var(--muted)]">
                          {row.inStock} in stock · {row.sold} sold
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
                          {row.inStock} in stock · {row.sold} sold
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
                        {row.inStock} in stock · {row.sold} sold
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
                      {row.inStock} in stock · {row.sold} sold
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
                  const soldProfit = calcProfit(deal.price, deal.cost);
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
                            {deal.size} · {deal.soldAt?.slice(0, 10)} ·{" "}
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
