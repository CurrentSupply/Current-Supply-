"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { MetricTile } from "@/components/MetricTile";
import { PageHeader } from "@/components/PageHeader";
import { PageError, PageLoading } from "@/components/PageStatus";
import { ReportFilters } from "@/components/ReportFilters";
import { FINANCE_CATEGORIES, type Category } from "@/db/schema";
import type { FinanceSummary } from "@/lib/finance";
import { formatMoney, profitToneClass, toInputDate } from "@/lib/format";
import { deleteJson, getJson, postJson } from "@/lib/http";
import {
  DEFAULT_REPORT_FILTERS,
  FINANCE_FILTERS_STORAGE_KEY,
  reportFiltersToQueryString,
  readStoredReportFilters,
  writeStoredReportFilters,
  type ReportFilterState,
} from "@/lib/reportFilters";

type SoldSort = "newest" | "profit" | "size";

export default function FinancePage() {
  const [filters, setFilters] = useState<ReportFilterState>(
    DEFAULT_REPORT_FILTERS,
  );
  const [hydrated, setHydrated] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [summary, setSummary] = useState<FinanceSummary | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [syncBusy, setSyncBusy] = useState(false);
  const [syncMsg, setSyncMsg] = useState("");
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [soldSort, setSoldSort] = useState<SoldSort>("newest");
  const [form, setForm] = useState({
    entryDate: toInputDate(),
    kind: "out" as "in" | "out",
    amount: "",
    category: "Fees",
    note: "",
  });

  useEffect(() => {
    queueMicrotask(() => {
      setFilters(
        readStoredReportFilters(FINANCE_FILTERS_STORAGE_KEY) ??
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

  const load = useCallback(async (active: ReportFilterState) => {
    const qs = reportFiltersToQueryString(active);
    const data = await getJson<FinanceSummary>(
      qs ? `/api/finance?${qs}` : "/api/finance",
      "Could not load finance.",
    );
    setSummary(data);
    setError("");
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const handle = window.setTimeout(() => {
      void load(filters).catch((err) =>
        setError(err instanceof Error ? err.message : "Could not load finance."),
      );
    }, 200);
    return () => window.clearTimeout(handle);
  }, [filters, hydrated, load]);

  function updateFilters(next: ReportFilterState) {
    writeStoredReportFilters(FINANCE_FILTERS_STORAGE_KEY, next);
    setFilters(next);
  }

  const sortedSoldDeals = useMemo(() => {
    const rows = summary?.soldDeals ?? [];
    const copy = [...rows];
    switch (soldSort) {
      case "profit":
        return copy.sort((a, b) => b.profit - a.profit);
      case "size":
        return copy.sort((a, b) =>
          a.size.localeCompare(b.size, undefined, { numeric: true }),
        );
      case "newest":
      default:
        return copy.sort((a, b) => b.soldAt.localeCompare(a.soldAt));
    }
  }, [summary?.soldDeals, soldSort]);

  async function addEntry(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await postJson(
        "/api/finance",
        {
          ...form,
          amount: Number(form.amount),
        },
        "Could not save entry.",
      );
      setForm((prev) => ({ ...prev, amount: "", note: "" }));
      await load(filters);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save entry.");
    } finally {
      setBusy(false);
    }
  }

  async function syncSheets() {
    setSyncBusy(true);
    setSyncMsg("");
    try {
      const data = await postJson<{
        configured?: boolean;
        synced?: number;
      }>("/api/sheets/sync", {}, "Sheets sync failed.");
      setSyncMsg(
        data.configured
          ? `Synced ${data.synced} deals to Google Sheets.`
          : "Google Sheets is not configured yet.",
      );
    } catch (err) {
      setSyncMsg(err instanceof Error ? err.message : "Sheets sync failed.");
    } finally {
      setSyncBusy(false);
    }
  }

  if (!hydrated || (!summary && !error)) {
    return <PageLoading label="Loading finance…" />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="Finance"
        title="Deal money"
        subtitle="Sales, purchases, and profit from your inventory — plus optional manual fees. Deals can sync live to Google Sheets."
        actions={
          <button
            type="button"
            className="btn btn-secondary"
            disabled={syncBusy}
            onClick={() => void syncSheets()}
          >
            {syncBusy ? "Syncing…" : "Sync Google Sheets"}
          </button>
        }
      />

      <ReportFilters
        categories={categories}
        value={filters}
        onChange={updateFilters}
        showStatus={false}
      />

      {error ? <PageError message={error} /> : null}
      {syncMsg ? (
        <p className="text-sm text-[var(--muted)]">{syncMsg}</p>
      ) : null}
      {summary && !summary.sheetsConfigured ? (
        <div className="border border-black bg-[#f3f3f3] p-4 text-sm">
          <p className="font-semibold">Set up Google Sheets auto-sync</p>
          <p className="mt-1 text-[var(--muted)]">
            Uses a Google Cloud <strong>service account</strong> (not an OAuth
            “Web application” client ID/secret). Env vars must be set on the{" "}
            <strong>same Vercel project</strong> that serves this site
            (for this URL that is usually{" "}
            <code className="font-mono text-xs">current-supply-3joz</code> under
            team <code className="font-mono text-xs">currentsupplys-projects</code>
            — not a different “current-supply” project). Once configured, new and
            updated deals sync automatically; use the button above for a full
            rewrite.
          </p>
          <ol className="mt-3 list-decimal space-y-1.5 pl-5">
            <li>
              Google Cloud Console → APIs &amp; Services → enable{" "}
              <strong>Google Sheets API</strong>.
            </li>
            <li>
              IAM &amp; Admin → Service Accounts → Create → open the account →
              Keys → Add key → Create new key → <strong>JSON</strong>. Save the
              file locally (do not commit it).
            </li>
            <li>
              Create a spreadsheet with a tab named exactly{" "}
              <code className="font-mono text-xs">Deals</code>. Share it with the
              service account email from the JSON (
              <code className="font-mono text-xs">client_email</code>) as{" "}
              <strong>Editor</strong>.
            </li>
            <li>
              In Vercel open project{" "}
              <code className="font-mono text-xs">current-supply-3joz</code>{" "}
              (team{" "}
              <code className="font-mono text-xs">currentsupplys-projects</code>
              ) → Settings → Environment Variables. Set for Production + Preview:{" "}
              <code className="font-mono text-xs">
                GOOGLE_SHEETS_SPREADSHEET_ID
              </code>{" "}
              (from the sheet URL),{" "}
              <code className="font-mono text-xs">
                GOOGLE_SERVICE_ACCOUNT_EMAIL
              </code>{" "}
              (<code className="font-mono text-xs">client_email</code>), and{" "}
              <code className="font-mono text-xs">
                GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
              </code>{" "}
              (<code className="font-mono text-xs">private_key</code>, keep
              newlines as <code className="font-mono text-xs">\n</code>). Redeploy,
              then Sync. From this repo (logged into that team):{" "}
              <code className="font-mono text-xs">
                .\scripts\set-vercel-env-3joz.ps1
              </code>
            </li>
          </ol>
        </div>
      ) : null}

      {summary ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricTile
              label="Sales revenue"
              value={formatMoney(summary.salesRevenue)}
              hint={`${summary.soldCount} sold`}
            />
            <MetricTile
              label="Deal profit"
              value={formatMoney(summary.dealProfit)}
              valueClassName={profitToneClass(summary.dealProfit)}
              hint="Sales − cost of sold"
            />
            <MetricTile
              label="Purchase spend"
              value={formatMoney(summary.purchaseSpend)}
              hint="All deals bought"
            />
            <MetricTile
              label="Inventory cost"
              value={formatMoney(summary.inventoryCost)}
              hint={`${summary.inStockCount} still in stock`}
            />
          </div>

          <section className="surface rounded-none p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">Sold deals breakdown</h2>
              <div className="flex flex-wrap items-center gap-3">
                <div className="field min-w-[10rem]">
                  <label htmlFor="sold-sort" className="sr-only">
                    Sort sold deals
                  </label>
                  <select
                    id="sold-sort"
                    value={soldSort}
                    onChange={(e) => setSoldSort(e.target.value as SoldSort)}
                  >
                    <option value="newest">Newest sale</option>
                    <option value="profit">Highest profit</option>
                    <option value="size">Size</option>
                  </select>
                </div>
                <Link
                  href="/inventory?status=sold"
                  className="text-sm font-bold uppercase tracking-[0.1em] underline underline-offset-4"
                >
                  View sold
                </Link>
              </div>
            </div>
            {sortedSoldDeals.length === 0 ? (
              <p className="mt-4 text-sm text-[var(--muted)]">
                No sales match these filters. Mark a deal sold or clear filters.
              </p>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-black text-[0.7rem] font-bold uppercase tracking-[0.1em] text-[var(--muted)]">
                      <th className="py-2 pr-3 font-bold">Sold</th>
                      <th className="py-2 pr-3 font-bold">Item</th>
                      <th className="py-2 pr-3 font-bold">Cost</th>
                      <th className="py-2 pr-3 font-bold">Sale</th>
                      <th className="py-2 pr-3 font-bold">Profit</th>
                      <th className="py-2 font-bold">Owner</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedSoldDeals.map((row) => (
                      <tr
                        key={row.id}
                        className="border-b border-[var(--line)]"
                      >
                        <td className="py-3 pr-3 whitespace-nowrap">
                          {row.soldAt}
                        </td>
                        <td className="py-3 pr-3">
                          <Link
                            href={`/inventory/${row.id}`}
                            className="font-medium underline-offset-2 hover:underline"
                          >
                            {row.name}
                          </Link>
                          <p className="text-[var(--muted)]">
                            {row.size}
                            {row.category ? ` · ${row.category}` : ""}
                            {row.platform ? ` · ${row.platform}` : ""}
                          </p>
                        </td>
                        <td className="py-3 pr-3 whitespace-nowrap">
                          {formatMoney(row.cost)}
                        </td>
                        <td className="py-3 pr-3 whitespace-nowrap">
                          {formatMoney(row.price)}
                        </td>
                        <td
                          className={`py-3 pr-3 whitespace-nowrap ${profitToneClass(
                            row.profit,
                          )}`}
                        >
                          {formatMoney(row.profit)}
                        </td>
                        <td className="py-3 whitespace-nowrap">{row.owner}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <div className="grid gap-5 lg:grid-cols-2">
            <section className="surface rounded-none p-5">
              <h2 className="text-lg font-semibold">Profit by month</h2>
              {summary.byMonth.length === 0 ? (
                <p className="mt-3 text-sm text-[var(--muted)]">No sales yet.</p>
              ) : (
                <ul className="mt-3 divide-y divide-[var(--line)] text-sm">
                  {summary.byMonth.map((row) => (
                    <li
                      key={row.month}
                      className="flex items-center justify-between py-2"
                    >
                      <span>
                        {row.month} · {row.sold} sold
                      </span>
                      <span className={profitToneClass(row.profit)}>
                        {formatMoney(row.profit)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="surface rounded-none p-5">
              <h2 className="text-lg font-semibold">Recent activity</h2>
              {summary.activity.length === 0 ? (
                <p className="mt-3 text-sm text-[var(--muted)]">
                  Buys and sales will land here automatically.
                </p>
              ) : (
                <ul className="mt-3 divide-y divide-[var(--line)] text-sm">
                  {summary.activity.slice(0, 12).map((row) => (
                    <li
                      key={row.id}
                      className="flex items-center justify-between gap-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium">{row.label}</p>
                        <p className="text-[var(--muted)]">
                          {row.date} ·{" "}
                          {row.source === "deal_sale"
                            ? "Sale"
                            : row.source === "deal_purchase"
                              ? "Purchase"
                              : "Manual"}
                        </p>
                      </div>
                      <span
                        className={
                          row.kind === "in" ? "profit-pos" : "profit-neg"
                        }
                      >
                        {row.kind === "in" ? "+" : "−"}
                        {formatMoney(row.amount)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <div className="grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
            <form
              onSubmit={(e) => void addEntry(e)}
              className="surface space-y-4 rounded-none p-5"
            >
              <h2 className="text-lg font-semibold">Manual adjustment</h2>
              <p className="text-sm text-[var(--muted)]">
                Fees, shipping, payouts — not tied to a single deal.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="field">
                  <label htmlFor="entryDate">Date</label>
                  <input
                    id="entryDate"
                    type="date"
                    value={form.entryDate}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, entryDate: e.target.value }))
                    }
                    required
                  />
                </div>
                <div className="field">
                  <label htmlFor="kind">Type</label>
                  <select
                    id="kind"
                    value={form.kind}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        kind: e.target.value as "in" | "out",
                      }))
                    }
                  >
                    <option value="out">Cash out</option>
                    <option value="in">Cash in</option>
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="amount">Amount</label>
                  <input
                    id="amount"
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.amount}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, amount: e.target.value }))
                    }
                    required
                  />
                </div>
                <div className="field">
                  <label htmlFor="category">Category</label>
                  <select
                    id="category"
                    value={form.category}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, category: e.target.value }))
                    }
                  >
                    {FINANCE_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field sm:col-span-2">
                  <label htmlFor="note">Note</label>
                  <input
                    id="note"
                    value={form.note}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, note: e.target.value }))
                    }
                    placeholder="eBay fees, shipping, payout…"
                  />
                </div>
              </div>
              <button type="submit" className="btn btn-primary" disabled={busy}>
                {busy ? "Saving…" : "Add adjustment"}
              </button>
            </form>

            <section className="surface rounded-none p-5">
              <h2 className="text-lg font-semibold">Manual ledger</h2>
              {summary.entries.length === 0 ? (
                <p className="mt-3 text-sm text-[var(--muted)]">
                  No manual adjustments yet.
                </p>
              ) : (
                <ul className="mt-4 divide-y divide-[var(--line)]">
                  {summary.entries.map((entry) => (
                    <li
                      key={entry.id}
                      className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"
                    >
                      <div>
                        <p className="font-medium">
                          {entry.entryDate} · {entry.category}
                        </p>
                        <p className="text-[var(--muted)]">
                          {entry.kind === "in" ? "Cash in" : "Cash out"}
                          {entry.note ? ` · ${entry.note}` : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span
                          className={
                            entry.kind === "in" ? "profit-pos" : "profit-neg"
                          }
                        >
                          {entry.kind === "in" ? "+" : "−"}
                          {formatMoney(entry.amount)}
                        </span>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => setDeleteId(entry.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </>
      ) : null}

      <ConfirmDialog
        open={deleteId !== null}
        title="Delete this entry?"
        message="This removes the manual cash entry."
        confirmLabel="Delete"
        danger
        onCancel={() => setDeleteId(null)}
        onConfirm={async () => {
          if (deleteId === null) return;
          await deleteJson(`/api/finance?id=${deleteId}`, "Could not delete.");
          setDeleteId(null);
          await load(filters);
        }}
      />
    </div>
  );
}
