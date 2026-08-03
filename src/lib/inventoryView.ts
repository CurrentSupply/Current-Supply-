export type InventoryViewMode = "grid" | "list";

export const INVENTORY_VIEW_STORAGE_KEY = "current-supply.inventory.view";

export function readStoredInventoryView(): InventoryViewMode {
  if (typeof window === "undefined") return "grid";
  try {
    const raw = window.localStorage.getItem(INVENTORY_VIEW_STORAGE_KEY);
    return raw === "list" ? "list" : "grid";
  } catch {
    return "grid";
  }
}

export function writeStoredInventoryView(view: InventoryViewMode): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(INVENTORY_VIEW_STORAGE_KEY, view);
  } catch {
    // Ignore quota / private mode failures.
  }
}
