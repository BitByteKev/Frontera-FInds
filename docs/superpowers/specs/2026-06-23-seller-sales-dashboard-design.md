# Seller Sales Dashboard — Design

**Date:** 2026-06-23
**Status:** Approved (pending spec review)

## Goal

Give the seller a dashboard in the admin panel that counts sold items and shows
total sales revenue, with a chart breaking the totals down by month.

## Decisions

- **Metric:** Count of sold items **and** total revenue.
- **Chart axis:** Over time, bucketed by month.
- **Bar height:** Revenue per month; item count shown as a label on each bar.
- **Chart rendering:** Hand-rolled SVG/CSS bars — no new dependency.
- **Aggregation:** Computed client-side from the existing admin items list (no new
  API endpoint). The catalog is small (≤500 items returned by `listAll()`).

## Schema change: `sold_at`

`updated_at` is not a reliable sold date — editing or relisting an item bumps it.
We add a dedicated nullable timestamp.

- **Migration** `worker/migrations/0002_add_sold_at.sql`:
  ```sql
  ALTER TABLE items ADD COLUMN sold_at INTEGER;
  UPDATE items SET sold_at = updated_at WHERE status = 'sold';
  ```
  The backfill is a best-effort approximation for items already sold before this
  column existed.
- `PATCH /api/admin/items/:id` transition logic:
  - When the update moves status **into** `sold` (and `sold_at` is currently null),
    set `sold_at = Date.now()`.
  - When the update moves status **out of** `sold` (relist → `published`, or
    `hidden`), set `sold_at = NULL`.
  - This requires reading the row's current status before applying the update.
  - **Invariant preserved:** a status-only PATCH must still make **no** Claude /
    translation call. The `sold_at` write is plain SQL and does not change that.
- `worker/src/db.ts`: add `sold_at: number | null` to the DB row type and include
  it in the row→`Item` mapping.
- `src/lib/types.ts`: add `soldAt?: number | null` to the `Item` interface.
- `GET /api/admin/items` returns `soldAt` for every item (via the shared mapping).

## Aggregation helper

`src/lib/stats.ts` — pure, unit-testable:

```ts
export interface MonthlyBucket {
  month: string;        // "YYYY-MM"
  label: string;        // e.g. "Jun 2026"
  count: number;        // sold items in that month
  revenueCents: number; // summed priceCents of those items
}

export interface SalesSummary {
  soldCount: number;
  totalRevenueCents: number;
  months: MonthlyBucket[]; // continuous range, oldest → newest, zero-filled gaps
}

export function monthlySales(items: Item[], now: number): SalesSummary;
```

Behavior:
- Considers only `status === 'sold'` items.
- Buckets each by the month of `soldAt`. If a sold item has a null `soldAt`
  (shouldn't happen post-migration), fall back to `updatedAt` so it is never
  silently dropped.
- `months` spans the last 12 months ending at `now` (zero-filled), extended
  backward if the earliest sale predates that window — so every sale appears and
  the timeline has no gaps.
- Empty input → `soldCount: 0`, `totalRevenueCents: 0`, `months: []`.
- `now` is injected (not read from `Date.now()` inside) so the function is
  deterministic and testable.

## Frontend page

`src/pages/admin/AdminDashboard.tsx`, route `/admin/dashboard` in `src/App.tsx`.

- Auth: same `ff_admin_token` localStorage guard as the other admin pages;
  redirect to `/admin` if absent.
- On mount: `adminApi.listAll()` → `monthlySales(items, Date.now())`; also read the
  live FX rate via `useRate()`.
- **Summary cards:**
  - "N items sold"
  - "Total revenue: $X.XX · ~$Y MXN" using `money(totalRevenueCents)` and
    `pesosFromCents(totalRevenueCents, rate)`.
- **Monthly bar chart:** one bar per `MonthlyBucket`, height proportional to
  `revenueCents` (tallest bar = full height; all-zero range renders flat). Each bar
  labeled with its month and shows the count and dollar amount. Pure SVG/CSS,
  styled with the existing `ff-` class conventions.
- Empty state: if no items are sold, show a friendly "No sales yet" message instead
  of an empty chart.

## Navigation

- Add a "Dashboard" link to the inline admin nav in `AdminManage.tsx`.
- Add a link back to "Your items" (`/admin/manage`) from the dashboard header.

## Testing

- `src/lib/stats.test.ts` (vitest): bucketing by month, zero-fill of gap months,
  revenue summing, null-`soldAt` fallback to `updatedAt`, empty-input case,
  back-extension when a sale predates the 12-month window.
- Worker test (`worker/` vitest config): PATCH into `sold` sets `sold_at`; PATCH to
  `published`/`hidden` clears it; assert a status-only PATCH still triggers no
  translation call (extends the existing hardening test).

## Out of scope (YAGNI)

- No server-side stats endpoint (client aggregation is sufficient at this scale).
- No date-range picker, CSV export, or per-category breakdown.
- No sales-history table (single `sold_at` per item; re-selling overwrites it).
