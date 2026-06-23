import type { Item } from "./types";

export interface MonthlyBucket {
  month: string;        // "YYYY-MM"
  label: string;        // e.g. "Jun 2026"
  count: number;        // sold items in that month
  revenueCents: number; // summed priceCents of those items
}

export interface SalesSummary {
  soldCount: number;
  totalRevenueCents: number;
  months: MonthlyBucket[]; // continuous, oldest -> newest, zero-filled gaps
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Absolute month index (year*12 + monthIndex), in UTC, so bucketing is timezone-independent.
function monthIndex(ts: number): number {
  const d = new Date(ts);
  return d.getUTCFullYear() * 12 + d.getUTCMonth();
}

function keyFor(idx: number): { month: string; label: string } {
  const year = Math.floor(idx / 12);
  const m = idx % 12;
  return { month: `${year}-${String(m + 1).padStart(2, "0")}`, label: `${MONTHS[m]} ${year}` };
}

// Aggregate sold items into a monthly revenue/count timeline.
// `now` is injected (not read from Date.now()) so callers control the window and tests stay deterministic.
export function monthlySales(items: Item[], now: number): SalesSummary {
  const sold = items.filter((it) => it.status === "sold");
  if (sold.length === 0) return { soldCount: 0, totalRevenueCents: 0, months: [] };

  const byIndex = new Map<number, { count: number; revenueCents: number }>();
  let totalRevenueCents = 0;
  let earliest = Infinity;
  for (const it of sold) {
    const ts = it.soldAt ?? it.updatedAt; // soldAt should exist post-migration; fall back so nothing is dropped
    const idx = monthIndex(ts);
    earliest = Math.min(earliest, idx);
    const cur = byIndex.get(idx) ?? { count: 0, revenueCents: 0 };
    cur.count += 1;
    cur.revenueCents += it.priceCents;
    byIndex.set(idx, cur);
    totalRevenueCents += it.priceCents;
  }

  const nowIdx = monthIndex(now);
  const startIdx = Math.min(nowIdx - 11, earliest); // last 12 months, extended back to the earliest sale
  const months: MonthlyBucket[] = [];
  for (let idx = startIdx; idx <= nowIdx; idx++) {
    const cell = byIndex.get(idx) ?? { count: 0, revenueCents: 0 };
    months.push({ ...keyFor(idx), count: cell.count, revenueCents: cell.revenueCents });
  }

  return { soldCount: sold.length, totalRevenueCents, months };
}
