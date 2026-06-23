# Seller Sales Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an admin "Dashboard" page that counts sold items and charts total sales revenue by month.

**Architecture:** A new nullable `sold_at` column records when an item is marked sold (set/cleared in the PATCH handler, backfilled for existing sold rows). The admin items API surfaces it as `soldAt`. A pure `monthlySales()` helper aggregates the existing admin item list client-side; a new `/admin/dashboard` React page renders summary cards plus a hand-rolled SVG bar chart. No new API endpoint, no charting dependency.

**Tech Stack:** Cloudflare Workers + Hono + D1 (SQLite) backend; React + Vite + react-router frontend; Vitest (`@cloudflare/vitest-pool-workers` for worker tests, jsdom-free unit tests for `src/lib`).

---

## File Structure

**Backend**
- `worker/migrations/0004_add_sold_at.sql` (create) — add + backfill `sold_at`.
- `worker/src/db.ts` (modify) — `sold_at` on `ItemRow`, `soldAt` on `Item`, map in `rowToItem`.
- `worker/src/items.ts` (modify) — set/clear `sold_at` on create + PATCH transitions.
- `worker/test/items.test.ts` (modify) — assert transition behavior + preserved no-Claude guarantee.

**Frontend**
- `src/lib/types.ts` (modify) — add `soldAt?` to `Item`.
- `src/lib/stats.ts` (create) — `monthlySales()` pure aggregation helper.
- `src/lib/stats.test.ts` (create) — unit tests for the helper.
- `src/pages/admin/AdminDashboard.tsx` (create) — the dashboard page + inline SVG chart.
- `src/App.tsx` (modify) — add `/admin/dashboard` route.
- `src/pages/admin/AdminManage.tsx` (modify) — add a "Dashboard" nav link.

---

## Task 1: Add `sold_at` column and surface it as `soldAt`

**Files:**
- Create: `worker/migrations/0004_add_sold_at.sql`
- Modify: `worker/src/db.ts`
- Test: `worker/test/items.test.ts` (add one test in the `admin item CRUD` describe block)

- [ ] **Step 1: Create the migration**

Create `worker/migrations/0004_add_sold_at.sql`:

```sql
-- Dedicated sold timestamp. updated_at is unreliable as a sold date because editing
-- or relisting an item bumps it. Backfill existing sold rows as a best-effort guess.
ALTER TABLE items ADD COLUMN sold_at INTEGER;
UPDATE items SET sold_at = updated_at WHERE status = 'sold';
```

- [ ] **Step 2: Write the failing test**

In `worker/test/items.test.ts`, add this test inside the existing `describe("admin item CRUD", ...)` block (it relies on `adminHeaders()` already defined in that file):

```ts
  it("admin list surfaces soldAt (null until sold)", async () => {
    const headers = await adminHeaders();

    let ctx = createExecutionContext();
    let res = await app.fetch(new Request("http://x/api/admin/items", {
      method: "POST", headers,
      body: JSON.stringify({ title: "Stool", description: "d", status: "published" }),
    }), env, ctx);
    await waitOnExecutionContext(ctx);
    const { id } = await res.json<{ id: string }>();

    ctx = createExecutionContext();
    res = await app.fetch(new Request("http://x/api/admin/items", { headers }), env, ctx);
    await waitOnExecutionContext(ctx);
    const { items } = await res.json<{ items: any[] }>();
    const it = items.find((x) => x.id === id);
    expect(it).toBeTruthy();
    expect(it.soldAt).toBeNull();
  });
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npm run test:worker -- worker/test/items.test.ts -t "surfaces soldAt"`
Expected: FAIL — `it.soldAt` is `undefined`, not `null` (column/mapping doesn't exist yet).

- [ ] **Step 4: Add `sold_at` to the row type and `soldAt` to the mapping**

In `worker/src/db.ts`, add `sold_at` to `ItemRow` (after `updated_at`):

```ts
  created_at: number;
  updated_at: number;
  sold_at: number | null;
```

Add `soldAt` to the worker `Item` interface (after `updatedAt`):

```ts
  createdAt: number;
  updatedAt: number;
  soldAt: number | null;
```

In `rowToItem`, add the mapping (after `updatedAt: row.updated_at,`):

```ts
    updatedAt: row.updated_at,
    soldAt: row.sold_at ?? null,
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm run test:worker -- worker/test/items.test.ts -t "surfaces soldAt"`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add worker/migrations/0004_add_sold_at.sql worker/src/db.ts worker/test/items.test.ts
git commit -m "feat(items): add sold_at column, surface as soldAt"
```

---

## Task 2: Set/clear `sold_at` on status transitions

**Files:**
- Modify: `worker/src/items.ts:134-153` (POST create), `worker/src/items.ts:155-204` (PATCH)
- Test: `worker/test/items.test.ts` (extend the existing `item translation on save` describe block)

- [ ] **Step 1: Write the failing tests**

In `worker/test/items.test.ts`, replace the existing test `it("status-only PATCH succeeds and preserves translations", ...)` (lines ~290-316) with the following expanded version, and add a second test after it:

```ts
  it("status-only PATCH sets sold_at, preserves translations, and skips Claude", async () => {
    const headers = await adminHeaders();
    const ctx = createExecutionContext();
    const res = await app.fetch(new Request("http://x/api/admin/items", {
      method: "POST", headers, body: JSON.stringify({ title: "Thing", description: "d" }),
    }), env, ctx);
    await waitOnExecutionContext(ctx);
    const { id } = await res.json<{ id: string }>();

    // The create above translated once; a status-only PATCH must not call Claude again.
    anthropicCreate.mockClear();
    const ctx2 = createExecutionContext();
    const patch = await app.fetch(new Request(`http://x/api/admin/items/${id}`, {
      method: "PATCH", headers, body: JSON.stringify({ status: "sold" }),
    }), env, ctx2);
    await waitOnExecutionContext(ctx2);
    expect(patch.status).toBe(200);
    expect(anthropicCreate).not.toHaveBeenCalled();

    const ctx3 = createExecutionContext();
    const got = await app.fetch(new Request(`http://x/api/admin/items`, { headers }), env, ctx3);
    await waitOnExecutionContext(ctx3);
    const { items } = await got.json<{ items: any[] }>();
    const it = items.find((x) => x.id === id);
    expect(it.status).toBe("sold");
    expect(it.titleEs).toBe("Mock ES");
    expect(typeof it.soldAt).toBe("number");
  });

  it("relisting a sold item clears sold_at", async () => {
    const headers = await adminHeaders();
    const ctx = createExecutionContext();
    const res = await app.fetch(new Request("http://x/api/admin/items", {
      method: "POST", headers, body: JSON.stringify({ title: "Relist me", description: "d", status: "sold" }),
    }), env, ctx);
    await waitOnExecutionContext(ctx);
    const { id } = await res.json<{ id: string }>();

    // Created already sold -> sold_at should be set.
    let ctx2 = createExecutionContext();
    let got = await app.fetch(new Request(`http://x/api/admin/items`, { headers }), env, ctx2);
    await waitOnExecutionContext(ctx2);
    let items = (await got.json<{ items: any[] }>()).items;
    expect(typeof items.find((x) => x.id === id).soldAt).toBe("number");

    // Relist -> published -> sold_at cleared.
    const ctx3 = createExecutionContext();
    await app.fetch(new Request(`http://x/api/admin/items/${id}`, {
      method: "PATCH", headers, body: JSON.stringify({ status: "published" }),
    }), env, ctx3);
    await waitOnExecutionContext(ctx3);

    const ctx4 = createExecutionContext();
    got = await app.fetch(new Request(`http://x/api/admin/items`, { headers }), env, ctx4);
    await waitOnExecutionContext(ctx4);
    items = (await got.json<{ items: any[] }>()).items;
    expect(items.find((x) => x.id === id).soldAt).toBeNull();
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test:worker -- worker/test/items.test.ts -t "sold_at"`
Expected: FAIL — `soldAt` stays `null` after marking sold (handler doesn't set it yet); the create-already-sold case also has `null`.

- [ ] **Step 3: Set `sold_at` on create**

In `worker/src/items.ts`, in the `POST /api/admin/items` handler, compute the sold timestamp after `const now = Date.now();` (line ~139) and add the column to the INSERT.

After the existing `const now = Date.now();` line add:

```ts
  const createStatus = b.status ?? "published";
  const createSoldAt = createStatus === "sold" ? now : null;
```

Change the INSERT statement to include `sold_at` (add the column name and a `?16` placeholder):

```ts
  await c.env.DB.prepare(
    `INSERT INTO items (id,slug,title,description,price_cents,category,ships_usa,local_sdtj,status,created_at,updated_at,title_en,title_es,description_en,description_es,sold_at)
     VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16)`
  ).bind(
    id, slug, title, description, b.priceCents ?? 0, b.category ?? "misc",
    b.shipsUsa === false ? 0 : 1, b.localSdtj === false ? 0 : 1, createStatus, now, now,
    tr.title_en, tr.title_es, tr.description_en, tr.description_es, createSoldAt
  ).run();
```

(Note: `status` now uses the hoisted `createStatus` instead of `b.status ?? "published"` — same value.)

- [ ] **Step 4: Set/clear `sold_at` on PATCH transitions**

In `worker/src/items.ts`, in the `PATCH /api/admin/items/:id` handler, just before the `await c.env.DB.prepare(` UPDATE call (line ~185), add the transition logic:

```ts
  // sold_at tracks when the item entered the "sold" state. Set it when transitioning
  // into sold from another status; clear it whenever the item is no longer sold.
  const newStatus = b.status ?? existing.status;
  let soldAt = existing.sold_at;
  if (newStatus === "sold" && existing.status !== "sold") soldAt = Date.now();
  else if (newStatus !== "sold") soldAt = null;
```

Change the UPDATE statement to also write `sold_at=?15` and bind it last:

```ts
  await c.env.DB.prepare(
    `UPDATE items SET slug=?10, title=?2, description=?3, price_cents=?4, category=?5,
       ships_usa=?6, local_sdtj=?7, status=?8, updated_at=?9,
       title_en=?11, title_es=?12, description_en=?13, description_es=?14, sold_at=?15 WHERE id=?1`
  ).bind(
    id,
    title,
    description,
    b.priceCents ?? existing.price_cents,
    b.category ?? existing.category,
    b.shipsUsa === undefined ? existing.ships_usa : b.shipsUsa ? 1 : 0,
    b.localSdtj === undefined ? existing.local_sdtj : b.localSdtj ? 1 : 0,
    newStatus,
    Date.now(),
    slug,
    tr.title_en, tr.title_es, tr.description_en, tr.description_es, soldAt
  ).run();
```

(Note: `status` bind now uses `newStatus` instead of `b.status ?? existing.status` — same value.)

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm run test:worker -- worker/test/items.test.ts`
Expected: PASS — all item tests, including the two new `sold_at` tests and the unchanged no-Claude assertion.

- [ ] **Step 6: Commit**

```bash
git add worker/src/items.ts worker/test/items.test.ts
git commit -m "feat(items): set/clear sold_at on status transitions"
```

---

## Task 3: `monthlySales` aggregation helper

**Files:**
- Modify: `src/lib/types.ts`
- Create: `src/lib/stats.ts`
- Test: `src/lib/stats.test.ts`

- [ ] **Step 1: Add `soldAt` to the frontend `Item` type**

In `src/lib/types.ts`, add `soldAt` after `updatedAt`:

```ts
  createdAt: number;
  updatedAt: number;
  soldAt?: number | null;
```

- [ ] **Step 2: Write the failing tests**

Create `src/lib/stats.test.ts`:

```ts
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
    expect(r.months).toHaveLength(12);            // last 12 months ending at NOW
    const last = r.months[r.months.length - 1];
    expect(last.month).toBe("2026-06");
    expect(last.label).toBe("Jun 2026");
    expect(last.count).toBe(1);
    expect(last.revenueCents).toBe(5000);
    expect(r.months[0].count).toBe(0);            // earlier months zero-filled
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
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run src/lib/stats.test.ts`
Expected: FAIL — `Failed to resolve import "./stats"` (module doesn't exist yet).

- [ ] **Step 4: Implement the helper**

Create `src/lib/stats.ts`:

```ts
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
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/lib/stats.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 6: Commit**

```bash
git add src/lib/types.ts src/lib/stats.ts src/lib/stats.test.ts
git commit -m "feat(stats): add monthlySales aggregation helper"
```

---

## Task 4: Dashboard page, route, and nav link

**Files:**
- Create: `src/pages/admin/AdminDashboard.tsx`
- Modify: `src/App.tsx`
- Modify: `src/pages/admin/AdminManage.tsx`

- [ ] **Step 1: Create the dashboard page**

Create `src/pages/admin/AdminDashboard.tsx`:

```tsx
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { adminApi, clearToken, getToken } from "../../lib/api";
import { monthlySales, type SalesSummary } from "../../lib/stats";
import { money, pesosFromCents } from "../../lib/format";
import { useRate } from "../../lib/currency";

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [summary, setSummary] = useState<SalesSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const rate = useRate();

  useEffect(() => {
    if (!getToken()) { navigate("/admin"); return; }
    adminApi.listAll()
      .then((r) => setSummary(monthlySales(r.items, Date.now())))
      .catch((e) => {
        if (String(e).includes("unauthorized")) { clearToken(); navigate("/admin"); }
        else setError(String(e));
      });
  }, []);

  const maxRevenue = summary ? Math.max(1, ...summary.months.map((m) => m.revenueCents)) : 1;

  return (
    <main className="ff-wrap">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1>Sales dashboard</h1>
        <Link className="ff-btn ff-btn-outline" to="/admin/manage">Your items</Link>
      </div>
      {error && <p style={{ color: "#a50e0e" }}>{error}</p>}

      {summary && summary.soldCount === 0 && <p>No sales yet. Mark an item sold to see it here.</p>}

      {summary && summary.soldCount > 0 && (
        <>
          <div style={{ display: "flex", gap: 12, marginTop: 12, flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 160px", border: "1px solid var(--ff-line)", borderRadius: 10,
              padding: 16, background: "var(--ff-card)" }}>
              <div style={{ color: "var(--ff-muted)", fontSize: 13 }}>Items sold</div>
              <div style={{ fontWeight: 800, fontSize: 28 }}>{summary.soldCount}</div>
            </div>
            <div style={{ flex: "1 1 160px", border: "1px solid var(--ff-line)", borderRadius: 10,
              padding: 16, background: "var(--ff-card)" }}>
              <div style={{ color: "var(--ff-muted)", fontSize: 13 }}>Total revenue</div>
              <div style={{ fontWeight: 800, fontSize: 28 }}>{money(summary.totalRevenueCents)}</div>
              <div style={{ color: "var(--ff-muted)", fontSize: 13 }}>
                ~${pesosFromCents(summary.totalRevenueCents, rate).toLocaleString("en-US")} MXN
              </div>
            </div>
          </div>

          <h2 style={{ marginTop: 20 }}>Revenue by month</h2>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 220,
            border: "1px solid var(--ff-line)", borderRadius: 10, padding: 12,
            background: "var(--ff-card)", overflowX: "auto" }}>
            {summary.months.map((m) => {
              const h = Math.round((m.revenueCents / maxRevenue) * 160);
              return (
                <div key={m.month} style={{ display: "flex", flexDirection: "column", alignItems: "center",
                  justifyContent: "flex-end", minWidth: 44, flex: 1 }}>
                  <div style={{ fontSize: 11, color: "var(--ff-muted)" }}>
                    {m.count > 0 ? m.count : ""}
                  </div>
                  <div
                    title={`${m.label}: ${money(m.revenueCents)} (${m.count} sold)`}
                    style={{ width: "100%", height: Math.max(h, m.revenueCents > 0 ? 4 : 0),
                      background: "var(--ff-green, #5BD074)", borderRadius: "4px 4px 0 0" }}
                  />
                  <div style={{ fontSize: 11, color: "var(--ff-muted)", marginTop: 4,
                    whiteSpace: "nowrap" }}>{m.label.split(" ")[0]}</div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </main>
  );
}
```

- [ ] **Step 2: Add the route**

In `src/App.tsx`, add the import alongside the other admin imports (after the `AdminEdit` import on line ~12):

```tsx
import AdminEdit from "./pages/admin/AdminEdit";
import AdminDashboard from "./pages/admin/AdminDashboard";
```

Add the route inside `<Routes>` (after the `/admin/manage` route, line ~51):

```tsx
        <Route path="/admin/manage" element={<AdminManage />} />
        <Route path="/admin/dashboard" element={<AdminDashboard />} />
```

- [ ] **Step 3: Add the nav link in AdminManage**

In `src/pages/admin/AdminManage.tsx`, add a Dashboard link as the first item in the button row (inside `<div style={{ display: "flex", gap: 8 }}>`, before the `+ New item` link, line ~59):

```tsx
        <div style={{ display: "flex", gap: 8 }}>
          <Link className="ff-btn ff-btn-outline" to="/admin/dashboard">Dashboard</Link>
          <Link className="ff-btn ff-btn-green" to="/admin/new">+ New item</Link>
```

- [ ] **Step 4: Verify the build and types pass**

Run: `npm run build`
Expected: `tsc -b` reports no errors and `vite build` completes (produces `dist/`).

- [ ] **Step 5: Commit**

```bash
git add src/pages/admin/AdminDashboard.tsx src/App.tsx src/pages/admin/AdminManage.tsx
git commit -m "feat(admin): add sales dashboard page with monthly revenue chart"
```

---

## Task 5: Full verification and migration apply

**Files:** none (verification + DB migration)

- [ ] **Step 1: Run the full frontend unit suite**

Run: `npm test`
Expected: PASS — includes `format.test.ts` and the new `stats.test.ts`.

- [ ] **Step 2: Run the full worker suite**

Run: `npm run test:worker`
Expected: PASS — all worker tests including the new `sold_at` transition tests. (The worker vitest config auto-loads migrations from `worker/migrations/`, so `0004` is applied to the test DB automatically.)

- [ ] **Step 3: Apply the migration to the remote D1 database**

This is required before deploying so the live `items` table has the `sold_at` column.

Run: `npm run db:apply`
Expected: wrangler reports migration `0004_add_sold_at.sql` applied successfully.

- [ ] **Step 4: Build to confirm a clean production bundle**

Run: `npm run build`
Expected: success, no type errors.

> Deploy (`npm run deploy`) and push are performed when the user asks, per their workflow — not as an automatic step in this plan.
