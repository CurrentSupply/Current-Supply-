"use client";

import type { ReactNode } from "react";

export type Column<T> = {
  key: string;
  header: string;
  render?: (row: T, index: number) => ReactNode;
  className?: string;
  headerClassName?: string;
  align?: "left" | "center" | "right";
  width?: string;
  sticky?: boolean;
};

type DataTableProps<T> = {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (row: T, index: number) => string | number;
  onRowClick?: (row: T) => void;
  emptyMessage?: string;
  className?: string;
  compact?: boolean;
};

export function DataTable<T>({
  columns,
  data,
  keyExtractor,
  onRowClick,
  emptyMessage = "No data to display",
  className = "",
  compact = false,
}: DataTableProps<T>) {
  const alignClass = {
    left: "text-left",
    center: "text-center",
    right: "text-right",
  };

  const cellPadding = compact ? "px-3 py-2" : "px-4 py-4";
  const headerPadding = compact ? "px-3 py-2" : "px-4 py-3";

  if (data.length === 0) {
    return (
      <div className={`card ${className}`}>
        <div className="empty-state py-12">
          <p className="text-[var(--text-secondary)]">{emptyMessage}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`table-container ${className}`}>
      <table className="table">
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                className={`${headerPadding} ${alignClass[col.align ?? "left"]} ${col.headerClassName ?? ""}`}
                style={col.width ? { width: col.width } : undefined}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, rowIndex) => (
            <tr
              key={keyExtractor(row, rowIndex)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={onRowClick ? "cursor-pointer" : ""}
            >
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={`${cellPadding} ${alignClass[col.align ?? "left"]} ${col.className ?? ""} ${
                    col.sticky ? "sticky left-0 bg-[var(--bg-elevated)] z-10" : ""
                  }`}
                  style={col.width ? { width: col.width } : undefined}
                >
                  {col.render
                    ? col.render(row, rowIndex)
                    : String((row as Record<string, unknown>)[col.key] ?? "")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
