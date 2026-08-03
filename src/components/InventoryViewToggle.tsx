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
    <div
      className="flex w-max border border-black"
      role="group"
      aria-label="Inventory layout"
    >
      {OPTIONS.map((option, index) => {
        const active = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={`whitespace-nowrap px-3 py-2 text-[0.65rem] font-bold uppercase tracking-[0.1em] transition sm:px-4 sm:text-[0.72rem] ${
              index > 0 ? "border-l border-black" : ""
            } ${
              active
                ? "bg-black text-white"
                : "bg-white text-black hover:bg-[#f3f3f3]"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
