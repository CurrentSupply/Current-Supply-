"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { MetricTile } from "@/components/MetricTile";
import { PageHeader } from "@/components/PageHeader";
import { PageError, PageLoading } from "@/components/PageStatus";
import { Alert, Section } from "@/components/ui";
import { FINANCE_CATEGORIES } from "@/db/schema";
import type { FinanceSummary } from "@/lib/finance";
import { formatMoney, profitToneClass, toInputDate } from "@/lib/format";
import { deleteJson, getJson, postJson } from "@/lib/http";

export default function FinancePage() {
  const [summary, setSummary] = useState<FinanceSummary | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [syncBusy, setSyncBusy] = useState(false);
  const [syncMsg, setSyncMsg] = useState("");
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [form, setForm] = useState({
    entryDate: toInputDate(),
    kind: "out" as "in" | "out",
    amount: "",
    category: "Fees",
    note: "",
  });

  const load = useCallback(async () => {
    const data = await getJson<FinanceSummary>("/api/finance", "Could not load finance.");
    setSummary(data);
    setError("");
  }, []);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      void load().catch((err) =>
        setError(err instanceof Error ? err.message : "Could not load finance."),
      );
    }, 0);
    return () => window.clearTimeout(handle);
  }, [load]);

  async function addEntry(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await postJson("/api/finance", { ...form, amount: Number(form.amount) }, "Could not save entry.");
      setForm((prev) => ({ ...prev, amount: "", note: "" }));
      await load();
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
      const data = await postJson<{ configured?: boolean; synced?: number }>(
        "/api/sheets/sync",
        {},
        "Sheets sync failed.",
      );
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

  if (!summary && !error) {
    return <PageLoading label="Loading finance…" />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="Finance"
        title="Deal Money"
        subtitle="Sales, purchases, and profit from your inventory — plus optional manual fees."
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

      {error && <PageError message={error} />}
      {syncMsg && <Alert variant="info">{syncMsg}</Alert>}

      {summary && !summary.sheetsConfigured && (
        <Alert variant="info" title="Set up Google Sheets auto-sync">
          <p className="text-sm">
            Configure a Google Cloud service account to sync deals automatically to Sheets.
            See documentation for setup instructions.
          </p>
        </Alert>
      )}

      {summary && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricTile
              label="Sales Revenue"
              value={formatMoney(summary.salesRevenue)}
              hint={`${summary.soldCount} sold`}
            />
            <MetricTile
              label="Deal Profit"
              value={formatMoney(summary.dealProfit)}
              valueClassName={profitToneClass(summary.dealProfit)}
              hint="Sales − cost of sold"
            />
            <MetricTile
              label="Purchase Spend"
              value={formatMoney(summary.purchaseSpend)}
              hint="All deals bought"
            />
            <MetricTile
              label="Inventory Cost"
              value={formatMoney(summary.inventoryCost)}
              hint={`${summary.inStockCount} still in stock`}
            />
          </div>

          <Section
            title="Sold Deals Breakdown"
            action={
              <Link
                href="/inventory?status=sold"
                className="text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              >
                View all sold →
              </Link>
            }
          >
            {summary.soldDeals.length === 0 ? (
              <p className="text-sm text-[var(--text-secondary)]">
                No sales yet. Mark a deal sold and it will show here.
              </p>
            ) : (
              <div className="table-container overflow-x-auto">
                <table className="table min-w-[640px]">
                  <thead>
                    <tr>
                      <th>Sold</th>
                      <th>Item</th>
                      <th className="text-right">Cost</th>
                      <th className="text-right">Sale</th>
                      <th className="text-right">Profit</th>
                      <th>Owner</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.soldDeals.map((row) => (
                      <tr key={row.id}>
                        <td className="whitespace-nowrap">{row.soldAt}</td>
                        <td>
                          <Link
                            href={`/inventory/${row.id}`}
                            className="font-medium hover:underline"
                          >
                            {row.name}
                          </Link>
                          <p className="text-xs text-[var(--text-tertiary)]">
                            {row.size}
                            {row.category ? ` · ${row.category}` : ""}
                            {row.platform ? ` · ${row.platform}` : ""}
                          </p>
                        </td>
                        <td className="text-right whitespace-nowrap tabular-nums">
                          {formatMoney(row.cost)}
                        </td>
                        <td className="text-right whitespace-nowrap tabular-nums">
                          {formatMoney(row.price)}
                        </td>
                        <td className={`text-right whitespace-nowrap tabular-nums ${profitToneClass(row.profit)}`}>
                          {formatMoney(row.profit)}
                        </td>
                        <td className="whitespace-nowrap">{row.owner}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>

          <div className="grid gap-6 lg:grid-cols-2">
            <Section title="Profit by Month">
              {summary.byMonth.length === 0 ? (
                <p className="text-sm text-[var(--text-secondary)]">No sales yet.</p>
              ) : (
                <ul className="divide-y divide-[var(--border-secondary)]">
                  {summary.byMonth.map((row) => (
                    <li key={row.month} className="flex items-center justify-between py-3 text-sm">
                      <span>
                        {row.month} · {row.sold} sold
                      </span>
                      <span className={profitToneClass(row.profit)}>{formatMoney(row.profit)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            <Section title="Recent Activity">
              {summary.activity.length === 0 ? (
                <p className="text-sm text-[var(--text-secondary)]">
                  Buys and sales will land here automatically.
                </p>
              ) : (
                <ul className="divide-y divide-[var(--border-secondary)]">
                  {summary.activity.slice(0, 12).map((row) => (
                    <li key={row.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{row.label}</p>
                        <p className="text-[var(--text-tertiary)]">
                          {row.date} ·{" "}
                          {row.source === "deal_sale" ? "Sale" : row.source === "deal_purchase" ? "Purchase" : "Manual"}
                        </p>
                      </div>
                      <span className={row.kind === "in" ? "profit-pos" : "profit-neg"}>
                        {row.kind === "in" ? "+" : "−"}
                        {formatMoney(row.amount)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Section title="Manual Adjustment" subtitle="Fees, shipping, payouts — not tied to a single deal.">
              <form onSubmit={(e) => void addEntry(e)} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="field">
                    <label htmlFor="entryDate">Date</label>
                    <input
                      id="entryDate"
                      type="date"
                      value={form.entryDate}
                      onChange={(e) => setForm((p) => ({ ...p, entryDate: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="kind">Type</label>
                    <select
                      id="kind"
                      value={form.kind}
                      onChange={(e) => setForm((p) => ({ ...p, kind: e.target.value as "in" | "out" }))}
                    >
                      <option value="out">Cash Out</option>
                      <option value="in">Cash In</option>
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
                      onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="category">Category</label>
                    <select
                      id="category"
                      value={form.category}
                      onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
                    >
                      {FINANCE_CATEGORIES.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                  <div className="field sm:col-span-2">
                    <label htmlFor="note">Note</label>
                    <input
                      id="note"
                      value={form.note}
                      onChange={(e) => setForm((p) => ({ ...p, note: e.target.value }))}
                      placeholder="eBay fees, shipping, payout…"
                    />
                  </div>
                </div>
                <button type="submit" className="btn btn-primary" disabled={busy}>
                  {busy ? "Saving…" : "Add Adjustment"}
                </button>
              </form>
            </Section>

            <Section title="Manual Ledger">
              {summary.entries.length === 0 ? (
                <p className="text-sm text-[var(--text-secondary)]">No manual adjustments yet.</p>
              ) : (
                <ul className="divide-y divide-[var(--border-secondary)]">
                  {summary.entries.map((entry) => (
                    <li key={entry.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                      <div>
                        <p className="font-medium">
                          {entry.entryDate} · {entry.category}
                        </p>
                        <p className="text-[var(--text-tertiary)]">
                          {entry.kind === "in" ? "Cash in" : "Cash out"}
                          {entry.note ? ` · ${entry.note}` : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={entry.kind === "in" ? "profit-pos" : "profit-neg"}>
                          {entry.kind === "in" ? "+" : "−"}
                          {formatMoney(entry.amount)}
                        </span>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm text-[var(--color-error)]"
                          onClick={() => setDeleteId(entry.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          </div>
        </>
      )}

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
          await load();
        }}
      />
    </div>
  );
}
