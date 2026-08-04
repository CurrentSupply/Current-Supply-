"use client";

import type { InventoryViewMode } from "@/lib/inventoryView";

type Props = {
  value: InventoryViewMode;
  onChange: (view: InventoryViewMode) => void;
};

const OPTIONS: { value: InventoryViewMode; label: string }[] = [
  { value: "grid", label: "Grid" },
  { value: "list", label: "List" },
];

export function InventoryViewToggle({ value, onChange }: Props) {
  return (
    <div className="segmented-control" role="group" aria-label="Inventory layout">
      {OPTIONS.map((option) => {
        const active = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={`segmented-control-item ${
              active ? "segmented-control-item-active" : ""
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
