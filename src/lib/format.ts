export function formatMoney(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

export function calcProfit(price: number, cost: number): number {
  return price - cost;
}

export function calcRoi(price: number, cost: number): number | null {
  if (cost === 0) return null;
  return ((price - cost) / cost) * 100;
}

export function formatRoi(price: number, cost: number): string {
  const roi = calcRoi(price, cost);
  if (roi === null) return "—";
  const sign = roi > 0 ? "+" : "";
  return `${sign}${roi.toFixed(1)}%`;
}

export function daysBetween(start: string, end: string = new Date().toISOString()): number {
  const a = new Date(start);
  const b = new Date(end);
  const ms = b.getTime() - a.getTime();
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
}

export function toInputDate(value?: string | null): string {
  if (!value) return new Date().toISOString().slice(0, 10);
  return value.slice(0, 10);
}

export function photoUrl(filename: string): string {
  return `/uploads/${filename}`;
}
