"use client";

import {
  DEAL_CONDITION_LABELS,
  DEAL_CONDITIONS,
  DEAL_OWNER_LABELS,
  DEAL_OWNERS,
  type Category,
} from "@/db/schema";
import type { ReportFilterState } from "@/lib/reportFilters";

type Props = {
  categories: Category[];
  value: ReportFilterState;
  onChange: (next: ReportFilterState) => void;
  /** Hide status when the page is already sale-oriented. */
  showStatus?: boolean;
};

export function ReportFilters({
  categories,
  value,
  onChange,
  showStatus = true,
}: Props) {
  function update<K extends keyof ReportFilterState>(
    key: K,
    next: ReportFilterState[K],
  ) {
    onChange({ ...value, [key]: next });
  }

  function clear() {
    onChange({
      owner: "all",
      categoryId: "all",
      size: "",
      status: "all",
      condition: "all",
      purchasedFrom: "",
      purchasedTo: "",
      soldFrom: "",
      soldTo: "",
    });
  }

  return (
    <section className="card w-full min-w-0 overflow-hidden p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-secondary)]">
          Filters
        </p>
        <button
          type="button"
          className="text-sm font-medium text-[var(--text-secondary)] underline-offset-2 hover:text-[var(--text-primary)] hover:underline"
          onClick={clear}
        >
          Clear
        </button>
      </div>
      <div className="grid min-w-0 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="field">
          <label htmlFor="report-owner">Owner</label>
          <select
            id="report-owner"
            value={value.owner}
            onChange={(e) =>
              update("owner", e.target.value as ReportFilterState["owner"])
            }
          >
            <option value="all">All</option>
            {DEAL_OWNERS.map((owner) => (
              <option key={owner} value={owner}>
                {DEAL_OWNER_LABELS[owner]}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="report-category">Category</label>
          <select
            id="report-category"
            value={value.categoryId}
            onChange={(e) => update("categoryId", e.target.value)}
          >
            <option value="all">All</option>
            {categories.map((c) => (
              <option key={c.id} value={String(c.id)}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="report-size">Size</label>
          <input
            id="report-size"
            value={value.size}
            onChange={(e) => update("size", e.target.value)}
            placeholder="10.5"
          />
        </div>
        {showStatus ? (
          <div className="field">
            <label htmlFor="report-status">Status</label>
            <select
              id="report-status"
              value={value.status}
              onChange={(e) =>
                update("status", e.target.value as ReportFilterState["status"])
              }
            >
              <option value="all">All</option>
              <option value="in_stock">In stock</option>
              <option value="sold">Sold</option>
            </select>
          </div>
        ) : null}
        <div className="field">
          <label htmlFor="report-condition">Condition</label>
          <select
            id="report-condition"
            value={value.condition}
            onChange={(e) =>
              update(
                "condition",
                e.target.value as ReportFilterState["condition"],
              )
            }
          >
            <option value="all">All</option>
            {DEAL_CONDITIONS.map((c) => (
              <option key={c} value={c}>
                {DEAL_CONDITION_LABELS[c]}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="report-purchased-from">Purchased from</label>
          <input
            id="report-purchased-from"
            type="date"
            value={value.purchasedFrom}
            onChange={(e) => update("purchasedFrom", e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="report-purchased-to">Purchased to</label>
          <input
            id="report-purchased-to"
            type="date"
            value={value.purchasedTo}
            onChange={(e) => update("purchasedTo", e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="report-sold-from">Sold from</label>
          <input
            id="report-sold-from"
            type="date"
            value={value.soldFrom}
            onChange={(e) => update("soldFrom", e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="report-sold-to">Sold to</label>
          <input
            id="report-sold-to"
            type="date"
            value={value.soldTo}
            onChange={(e) => update("soldTo", e.target.value)}
          />
        </div>
      </div>
    </section>
  );
}
