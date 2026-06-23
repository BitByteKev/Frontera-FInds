import { describe, it, expect } from "vitest";
import { monthlySales } from "./stats";
import type { Item } from "./types";

// Minimal sold-item factory. Only the fields monthlySales reads need to be real.
function soldItem(soldAt: number | null, priceCents: number, extra: Partial<Item> = {}): Item {
  return {
    id: Math.random().toString(36).slice(2),
    slug: "s", title: "t", description: "",
    priceCents, category: "misc", shipsUsa: true, localSdtj: true,
    status: "sold", createdAt: 0, updatedAt: soldAt ?? 0, soldAt,
    photoKeys: [], ...extra,
  };
}

const NOW = Date.UTC(2026, 5, 15); // 2026-06-15 (month index 5 = June)

describe("monthlySales", () => {
  it("returns zeros and no months for empty input", () => {
    expect(monthlySales([], NOW)).toEqual({ soldCount: 0, totalRevenueCents: 0, months: [] });
  });

  it("ignores items that are not sold", () => {
    const items = [soldItem(NOW, 1000, { status: "published" }), soldItem(NOW, 2000, { status: "hidden" })];
    expect(monthlySales(items, NOW)).toEqual({ soldCount: 0, totalRevenueCents: 0, months: [] });
  });

  it("sums count and revenue, building a 12-month zero-filled range", () => {
    const r = monthlySales([soldItem(NOW, 5000)], NOW);
    expect(r.soldCount).toBe(1);
    expect(r.totalRevenueCents).toBe(5000);
    expect(r.months).toHaveLength(12);
    const last = r.months[r.months.length - 1];
    expect(last.month).toBe("2026-06");
    expect(last.label).toBe("Jun 2026");
    expect(last.count).toBe(1);
    expect(last.revenueCents).toBe(5000);
    expect(r.months[0].count).toBe(0);
  });

  it("buckets multiple sales in the same month together", () => {
    const r = monthlySales([soldItem(NOW, 1000), soldItem(Date.UTC(2026, 5, 2), 2500)], NOW);
    const june = r.months.find((m) => m.month === "2026-06")!;
    expect(june.count).toBe(2);
    expect(june.revenueCents).toBe(3500);
  });

  it("extends the range backward when a sale predates the 12-month window", () => {
    const old = Date.UTC(2025, 0, 10); // 2025-01, 17 months before 2026-06
    const r = monthlySales([soldItem(old, 4000)], NOW);
    expect(r.months[0].month).toBe("2025-01");
    expect(r.months[r.months.length - 1].month).toBe("2026-06");
    expect(r.months).toHaveLength(18);
    expect(r.months[0].revenueCents).toBe(4000);
  });

  it("falls back to updatedAt when soldAt is missing", () => {
    const r = monthlySales([soldItem(null, 999, { updatedAt: NOW })], NOW);
    expect(r.soldCount).toBe(1);
    expect(r.months.find((m) => m.month === "2026-06")!.count).toBe(1);
  });
});
