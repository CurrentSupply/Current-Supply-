"use client";

import { useCallback, useEffect, useState } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { FINANCE_CATEGORIES } from "@/db/schema";
import type { FinanceSummary } from "@/lib/finance";
import { formatMoney, toInputDate } from "@/lib/format";

export default function FinancePage() {
  const [summary, setSummary] = useState<FinanceSummary | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [form, setForm] = useState({
    entryDate: toInputDate(),
    kind: "out" as "in" | "out",
    amount: "",
    category: "Purchase",
    note: "",
  });

  const load = useCallback(async () => {
    setError("");
    const res = await fetch("/api/finance");
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Could not load finance.");
    setSummary(data);
  }, []);

  useEffect(() => {
    void load().catch((err) =>
      setError(err instanceof Error ? err.message : "Could not load finance."),
    );
  }, [load]);

  async function addEntry(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/finance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          amount: Number(form.amount),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save entry.");
      setForm((prev) => ({ ...prev, amount: "", note: "" }));
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save entry.");
    } finally {
      setBusy(false);
    }
  }

  if (!summary && !error) {
    return <p className="text-sm text-[var(--muted)]">Loading finance…</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="page-kicker">Finance</p>
        <h1 className="page-title mt-1 text-3xl sm:text-4xl">Cash tracker</h1>
        <p className="mt-1 text-[var(--muted)]">
          Log money in and out. Inventory cost and deal profit are shown for
          context.
        </p>
      </div>

      {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}

      {summary ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="surface rounded-none p-4">
              <p className="page-kicker">Balance</p>
              <p
                className={`page-title mt-2 text-2xl ${
                  summary.balance >= 0 ? "profit-pos" : "profit-neg"
                }`}
              >
                {formatMoney(summary.balance)}
              </p>
              <p className="mt-1 text-xs text-[var(--muted)]">Cash in − cash out</p>
            </div>
            <div className="surface rounded-none p-4">
              <p className="page-kicker">Cash in</p>
              <p className="page-title mt-2 text-2xl">
                {formatMoney(summary.cashIn)}
              </p>
            </div>
            <div className="surface rounded-none p-4">
              <p className="page-kicker">Cash out</p>
              <p className="page-title mt-2 text-2xl">
                {formatMoney(summary.cashOut)}
              </p>
            </div>
            <div className="surface rounded-none p-4">
              <p className="page-kicker">Inventory cost</p>
              <p className="page-title mt-2 text-2xl">
                {formatMoney(summary.inventoryCost)}
              </p>
              <p className="mt-1 text-xs text-[var(--muted)]">
                Deal profit realized {formatMoney(summary.dealProfit)}
              </p>
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
            <form
              onSubmit={(e) => void addEntry(e)}
              className="surface space-y-4 rounded-none p-5"
            >
              <h2 className="text-lg font-semibold">Add entry</h2>
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
                    placeholder="Buy trip, eBay fees, payout…"
                  />
                </div>
              </div>
              <button type="submit" className="btn btn-primary" disabled={busy}>
                {busy ? "Saving…" : "Add entry"}
              </button>
            </form>

            <div className="space-y-5">
              <section className="surface rounded-none p-5">
                <h2 className="text-lg font-semibold">By month</h2>
                {summary.byMonth.length === 0 ? (
                  <p className="mt-3 text-sm text-[var(--muted)]">
                    No entries yet.
                  </p>
                ) : (
                  <ul className="mt-3 divide-y divide-[var(--line)] text-sm">
                    {summary.byMonth.map((row) => (
                      <li
                        key={row.month}
                        className="flex items-center justify-between py-2"
                      >
                        <span>{row.month}</span>
                        <span
                          className={
                            row.net >= 0 ? "profit-pos" : "profit-neg"
                          }
                        >
                          {formatMoney(row.net)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="surface rounded-none p-5">
                <h2 className="text-lg font-semibold">By category</h2>
                {summary.byCategory.length === 0 ? (
                  <p className="mt-3 text-sm text-[var(--muted)]">
                    No entries yet.
                  </p>
                ) : (
                  <ul className="mt-3 divide-y divide-[var(--line)] text-sm">
                    {summary.byCategory.map((row) => (
                      <li
                        key={row.category}
                        className="flex items-center justify-between py-2"
                      >
                        <span>{row.category}</span>
                        <span
                          className={
                            row.net >= 0 ? "profit-pos" : "profit-neg"
                          }
                        >
                          {formatMoney(row.net)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          </div>

          <section className="surface rounded-none p-5">
            <h2 className="text-lg font-semibold">Ledger</h2>
            {summary.entries.length === 0 ? (
              <p className="mt-3 text-sm text-[var(--muted)]">
                Add your first cash in/out entry above.
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
        </>
      ) : null}

      <ConfirmDialog
        open={deleteId !== null}
        title="Delete this entry?"
        message="This removes the cash entry from your ledger."
        confirmLabel="Delete"
        danger
        onCancel={() => setDeleteId(null)}
        onConfirm={async () => {
          if (deleteId === null) return;
          const res = await fetch(`/api/finance?id=${deleteId}`, {
            method: "DELETE",
          });
          if (!res.ok) {
            const data = await res.json();
            throw new Error(data.error || "Could not delete.");
          }
          setDeleteId(null);
          await load();
        }}
      />
    </div>
  );
}
