# Listing Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add sold badges, browse controls (search/sort/price), and rich per-item link previews to the Frontera Finds storefront.

**Architecture:** Extend the existing Hono Worker `/api/items` handler with `sort` + price bounds; add a Worker `/item/:idOrSlug` route that injects per-item Open Graph tags into the built HTML shell via `HTMLRewriter`; add filter UI to the React Home page; add a "SOLD" badge in CSS + card + item page.

**Tech Stack:** Cloudflare Workers (Hono, D1, `HTMLRewriter`), Vitest (`@cloudflare/vitest-pool-workers`), React + React Router (Vite), Vercel (static host + rewrites).

**Testing note:** The repo has worker-side Vitest tests (`worker/test/`) but no React component test harness. Worker logic is built test-first; frontend tasks are verified with `tsc -b` + a manual run. Don't scaffold a new frontend test framework — out of scope.

---

### Task 1: API — `sort` and price-range filters

**Files:**
- Modify: `worker/src/items.ts:27-49` (the `GET /api/items` handler)
- Test: `worker/test/items.test.ts` (append cases)

- [ ] **Step 1: Write the failing tests** — append inside `worker/test/items.test.ts` (the file already has a `seed()` helper inserting `itm1` price 12000 and `itm2` hidden; add a second published item for ordering):

```ts
describe("GET /api/items sort + price", () => {
  async function seedPriced() {
    await env.DB.prepare(`DELETE FROM item_photos`).run();
    await env.DB.prepare(`DELETE FROM items`).run();
    const now = Date.now();
    await env.DB.prepare(
      `INSERT INTO items (id,title,description,price_cents,category,ships_usa,local_sdtj,status,created_at,updated_at)
       VALUES ('cheap','Cheap mug','',500,'misc',1,1,'published',?1,?1)`
    ).bind(now).run();
    await env.DB.prepare(
      `INSERT INTO items (id,title,description,price_cents,category,ships_usa,local_sdtj,status,created_at,updated_at)
       VALUES ('mid','Mid lamp','',5000,'misc',1,1,'published',?1,?1)`
    ).bind(now + 1).run();
    await env.DB.prepare(
      `INSERT INTO items (id,title,description,price_cents,category,ships_usa,local_sdtj,status,created_at,updated_at)
       VALUES ('pricey','Pricey bike','',20000,'misc',1,1,'published',?1,?1)`
    ).bind(now + 2).run();
  }
  async function ids(qs: string) {
    const ctx = createExecutionContext();
    const res = await app.fetch(new Request(`http://x/api/items?${qs}`), env, ctx);
    await waitOnExecutionContext(ctx);
    const body = await res.json<{ items: any[] }>();
    return body.items.map((i) => i.id);
  }

  it("sort=price_asc orders ascending by price", async () => {
    await seedPriced();
    expect(await ids("sort=price_asc")).toEqual(["cheap", "mid", "pricey"]);
  });
  it("sort=price_desc orders descending by price", async () => {
    await seedPriced();
    expect(await ids("sort=price_desc")).toEqual(["pricey", "mid", "cheap"]);
  });
  it("unknown sort falls back to newest (created_at desc)", async () => {
    await seedPriced();
    expect(await ids("sort=bogus")).toEqual(["pricey", "mid", "cheap"]);
  });
  it("minPrice/maxPrice bound the results (cents)", async () => {
    await seedPriced();
    expect(await ids("minPrice=1000&maxPrice=10000")).toEqual(["mid"]);
  });
  it("non-numeric price bounds are ignored", async () => {
    await seedPriced();
    expect((await ids("minPrice=abc")).sort()).toEqual(["cheap", "mid", "pricey"]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test:worker -- items`
Expected: the new "sort + price" cases FAIL (sort ignored / price not filtered).

- [ ] **Step 3: Implement sort + price in the handler** — replace the body of `publicItems.get("/api/items", ...)` in `worker/src/items.ts` (lines 27-49) with:

```ts
publicItems.get("/api/items", async (c) => {
  const q = c.req.query("q")?.trim();
  const category = c.req.query("category")?.trim();
  const shipsUsa = c.req.query("ships") === "1";
  const local = c.req.query("local") === "1";
  const includeSold = c.req.query("sold") === "1";

  const where: string[] = [];
  const binds: unknown[] = [];
  where.push(includeSold ? "status IN ('published','sold')" : "status = 'published'");
  if (q) {
    binds.push(`%${q}%`, `%${q}%`);
    where.push(`(title LIKE ?${binds.length - 1} OR description LIKE ?${binds.length})`);
  }
  if (category) { binds.push(category); where.push(`category = ?${binds.length}`); }
  if (shipsUsa) where.push("ships_usa = 1");
  if (local) where.push("local_sdtj = 1");

  const minPrice = Number(c.req.query("minPrice"));
  if (Number.isFinite(minPrice)) { binds.push(Math.trunc(minPrice)); where.push(`price_cents >= ?${binds.length}`); }
  const maxPrice = Number(c.req.query("maxPrice"));
  if (Number.isFinite(maxPrice)) { binds.push(Math.trunc(maxPrice)); where.push(`price_cents <= ?${binds.length}`); }

  const ORDER: Record<string, string> = {
    newest: "created_at DESC",
    price_asc: "price_cents ASC",
    price_desc: "price_cents DESC",
  };
  const orderBy = ORDER[c.req.query("sort") ?? "newest"] ?? ORDER.newest;

  const sql = `SELECT * FROM items WHERE ${where.join(" AND ")} ORDER BY ${orderBy} LIMIT ${MAX_LIST}`;
  const { results } = await c.env.DB.prepare(sql).bind(...binds).all<ItemRow>();
  const keys = await photoKeysFor(c.env.DB, results.map((r) => r.id));
  return c.json({ items: results.map((r) => rowToItem(r, keys.get(r.id) ?? [])) });
});
```

Note: `Number("")` is `0` (finite), so an empty `minPrice` param would bind `0` — harmless (>= 0 matches all). `Number("abc")` is `NaN` → ignored. The frontend omits empty params anyway (Task 3).

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test:worker -- items`
Expected: all items tests PASS (new + existing).

- [ ] **Step 5: Commit**

```bash
git add worker/src/items.ts worker/test/items.test.ts
git commit -m "feat(api): sort and price-range filters on /api/items"
```

---

### Task 2: Sold badge (CSS + card + item page)

**Files:**
- Modify: `src/theme.css` (after line 121, with the other `.ff-badge-*` rules)
- Modify: `src/components/ItemCard.tsx`
- Modify: `src/pages/ItemPage.tsx:26-27`

- [ ] **Step 1: Add badge styles** — append to `src/theme.css` after the `.ff-badge-local` rule (line 121):

```css
/* Sold marker: ribbon over card thumbnail + inline pill on the item page. */
.ff-card-media { position: relative; }
.ff-badge-sold {
  background: var(--ff-clay); color: #fff;
  font: 700 11px var(--font-text); letter-spacing: 0.04em;
  padding: 4px 10px; border-radius: 999px;
}
.ff-card-sold {
  position: absolute; top: 10px; left: 10px;
  background: var(--ff-clay); color: #fff;
  font: 700 11px var(--font-text); letter-spacing: 0.04em;
  padding: 4px 10px; border-radius: 999px;
  box-shadow: 0 2px 6px rgba(0,0,0,0.25);
}
.ff-card-img-sold { opacity: 0.78; }
```

- [ ] **Step 2: Show the ribbon on the card** — replace the `<img>` block in `src/components/ItemCard.tsx` (lines 9-14) with a media wrapper:

```tsx
      <div className="ff-card-media">
        <img
          className={item.status === "sold" ? "ff-card-img ff-card-img-sold" : "ff-card-img"}
          src={item.photoKeys[0] ? imgUrl(item.photoKeys[0]) : ""}
          alt={item.title}
          loading="lazy"
        />
        {item.status === "sold" && <span className="ff-card-sold">SOLD</span>}
      </div>
```

- [ ] **Step 3: Show the badge on the item page** — in `src/pages/ItemPage.tsx`, replace the `<h1>` line (line 26) with a title row that includes the badge:

```tsx
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4, flexWrap: "wrap" }}>
        <h1 style={{ margin: 0 }}>{item.title}</h1>
        {item.status === "sold" && <span className="ff-badge-sold">SOLD</span>}
      </div>
```

(The existing "This item has been sold." line at the bottom stays.)

- [ ] **Step 4: Typecheck**

Run: `npx tsc -b`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/theme.css src/components/ItemCard.tsx src/pages/ItemPage.tsx
git commit -m "feat(web): SOLD badge on cards and item page"
```

---

### Task 3: Browse controls on Home (include sold, search, sort, price)

**Files:**
- Modify: `src/pages/Home.tsx`

- [ ] **Step 1: Replace `Home.tsx` with the filtered version** — full file:

```tsx
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../lib/api";
import type { Item } from "../lib/types";
import ItemCard from "../components/ItemCard";

export default function Home() {
  const [params, setParams] = useSearchParams();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const ships = params.get("ships") === "1";
  const local = params.get("local") === "1";
  const q = params.get("q") ?? "";
  const sort = params.get("sort") ?? "newest";
  const minPrice = params.get("minPrice") ?? "";
  const maxPrice = params.get("maxPrice") ?? "";

  useEffect(() => {
    setLoading(true);
    // Build the API query from the URL: always include sold (shown with a badge),
    // and convert the dollar price inputs to cents for the API.
    const api1 = new URLSearchParams();
    for (const k of ["q", "category", "ships", "local", "sort"]) {
      const v = params.get(k);
      if (v) api1.set(k, v);
    }
    api1.set("sold", "1");
    const min = Number(params.get("minPrice"));
    if (params.get("minPrice") && Number.isFinite(min)) api1.set("minPrice", String(Math.round(min * 100)));
    const max = Number(params.get("maxPrice"));
    if (params.get("maxPrice") && Number.isFinite(max)) api1.set("maxPrice", String(Math.round(max * 100)));

    api.list(api1)
      .then((r) => { setItems(r.items); setError(null); })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [params]);

  // Update a single URL param (empty value removes it). Shareable + reloadable.
  // replace:true so per-keystroke edits don't flood browser history.
  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  }
  function toggle(key: "ships" | "local") {
    setParam(key, params.get(key) === "1" ? "" : "1");
  }

  return (
    <>
    <div className="ff-hero">
      <div className="ff-hero-tag">
        <b>Two cities. One marketplace.</b>
        <i>El swapmeet sin fronteras</i>
      </div>
      <span className="ff-pill">
        San Diego <span className="ff-arrow">⟷</span> Tijuana
        <span className="ff-dot" /> Shipping across the USA
      </span>
    </div>
    <main className="ff-wrap">
      <div className="ff-filters">
        <input
          className="ff-input"
          type="search"
          placeholder="Search items…"
          defaultValue={q}
          onChange={(e) => setParam("q", e.target.value.trim())}
        />
        <select className="ff-input" value={sort} onChange={(e) => setParam("sort", e.target.value === "newest" ? "" : e.target.value)}>
          <option value="newest">Newest</option>
          <option value="price_asc">Price: low to high</option>
          <option value="price_desc">Price: high to low</option>
        </select>
        <input className="ff-input ff-input-price" type="number" min="0" placeholder="Min $" defaultValue={minPrice}
          onChange={(e) => setParam("minPrice", e.target.value)} />
        <input className="ff-input ff-input-price" type="number" min="0" placeholder="Max $" defaultValue={maxPrice}
          onChange={(e) => setParam("maxPrice", e.target.value)} />
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        <button className={ships ? "ff-btn ff-btn-green" : "ff-btn ff-btn-outline"} onClick={() => toggle("ships")}>
          Ships USA
        </button>
        <button className={local ? "ff-btn ff-btn-green" : "ff-btn ff-btn-outline"} onClick={() => toggle("local")}>
          Local pickup / delivery
        </button>
      </div>

      {loading && <p>Loading…</p>}
      {error && <p style={{ color: "#a50e0e" }}>Couldn't load items: {error}</p>}
      {!loading && !error && items.length === 0 && <p>No items match your filters.</p>}

      <div className="ff-grid">
        {items.map((it) => <ItemCard key={it.id} item={it} />)}
      </div>
    </main>
    </>
  );
}
```

Note: search/price inputs use `defaultValue` (uncommitted typing won't fight the URL re-render); each change writes the URL param immediately. This is simple and correct; a debounce is a later refinement, not required.

- [ ] **Step 2: Add filter-bar styles** — append to `src/theme.css`:

```css
.ff-filters { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 10px; }
.ff-filters .ff-input { flex: 1 1 160px; min-width: 0; }
.ff-input-price { flex: 0 0 110px; }
```

(`.ff-input` already exists at line 153 for form fields.)

- [ ] **Step 3: Typecheck**

Run: `npx tsc -b`
Expected: no errors.

- [ ] **Step 4: Manual verify**

Run: `npm run dev:worker` (terminal A) and `npm run dev` (terminal B). Open the dev URL.
Note: local dev hits the local worker; ensure items exist in the local D1 (`npm run db:apply:local`) or test against the deployed API. Confirm: search narrows results, sort reorders, min/max price filter, sold items appear with the ribbon. URL updates with each filter and survives reload.

- [ ] **Step 5: Commit**

```bash
git add src/pages/Home.tsx src/theme.css
git commit -m "feat(web): search, sort, and price filters on Home; show sold items"
```

---

### Task 4: OG meta builder (pure function)

**Files:**
- Create: `worker/src/og.ts`
- Test: `worker/test/og.test.ts`

- [ ] **Step 1: Write the failing test** — create `worker/test/og.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { buildItemMeta, escapeHtml } from "../src/og";
import type { Item } from "../src/db";

const item: Item = {
  id: "abc", slug: "trek-bike", title: 'Trek "920" bike', description: "Great <condition> & ready",
  priceCents: 12000, category: "bikes", shipsUsa: true, localSdtj: true,
  status: "published", createdAt: 1, updatedAt: 1, photoKeys: ["items/abc-a.jpg"],
};

describe("buildItemMeta", () => {
  it("builds title, description (with price), url, and absolute image", () => {
    const m = buildItemMeta(item, "https://fronterafinds.com");
    expect(m.title).toBe('Trek "920" bike · Frontera Finds');
    expect(m.description).toContain("$120");
    expect(m.url).toBe("https://fronterafinds.com/item/trek-bike");
    expect(m.image).toBe("https://fronterafinds.com/img/items/abc-a.jpg");
  });
  it("falls back to the default OG image when there are no photos", () => {
    const m = buildItemMeta({ ...item, photoKeys: [] }, "https://fronterafinds.com");
    expect(m.image).toBe("https://fronterafinds.com/og-default.png");
  });
});

describe("escapeHtml", () => {
  it("escapes the five markup-significant characters", () => {
    expect(escapeHtml('a "b" <c> & \'d\'')).toBe("a &quot;b&quot; &lt;c&gt; &amp; &#39;d&#39;");
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm run test:worker -- og`
Expected: FAIL — `../src/og` not found.

- [ ] **Step 3: Implement `worker/src/og.ts`** (pure functions only in this task):

```ts
import type { Item } from "./db";

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export interface ItemMeta {
  title: string;
  description: string;
  url: string;
  image: string;
}

function formatPrice(cents: number): string {
  return `$${Math.round(cents / 100).toLocaleString("en-US")}`;
}

export function buildItemMeta(item: Item, siteUrl: string): ItemMeta {
  const base = siteUrl.replace(/\/$/, "");
  const desc = item.description?.trim()
    ? `${formatPrice(item.priceCents)} — ${item.description.trim().slice(0, 180)}`
    : `${formatPrice(item.priceCents)} — secondhand find at Frontera Finds.`;
  return {
    title: `${item.title} · Frontera Finds`,
    description: desc,
    url: `${base}/item/${item.slug || item.id}`,
    image: item.photoKeys[0] ? `${base}/img/${item.photoKeys[0]}` : `${base}/og-default.png`,
  };
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npm run test:worker -- og`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add worker/src/og.ts worker/test/og.test.ts
git commit -m "feat(worker): item Open Graph metadata builder"
```

---

### Task 5: OG meta injection via HTMLRewriter

**Files:**
- Modify: `worker/src/og.ts`
- Test: `worker/test/og.test.ts` (append)

- [ ] **Step 1: Write the failing test** — append to `worker/test/og.test.ts`:

```ts
import { injectMeta } from "../src/og";

const SHELL = `<!doctype html><html><head>` +
  `<title>Frontera Finds</title>` +
  `<meta name="description" content="default desc" />` +
  `</head><body><div id="root"></div></body></html>`;

describe("injectMeta", () => {
  it("replaces title/description and appends OG + Twitter tags, escaped", async () => {
    const html = await injectMeta(SHELL, item, "https://fronterafinds.com");
    expect(html).toContain("<title>Trek &quot;920&quot; bike · Frontera Finds</title>");
    expect(html).toContain('property="og:title" content="Trek &quot;920&quot; bike · Frontera Finds"');
    expect(html).toContain('property="og:image" content="https://fronterafinds.com/img/items/abc-a.jpg"');
    expect(html).toContain('name="twitter:card" content="summary_large_image"');
    expect(html).toContain('property="og:description"');
    // original default description content is replaced
    expect(html).not.toContain('content="default desc"');
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm run test:worker -- og`
Expected: FAIL — `injectMeta` not exported.

- [ ] **Step 3: Add `injectMeta` to `worker/src/og.ts`** (append):

```ts
// Inject per-item meta into the built HTML shell. Uses the Workers-runtime
// HTMLRewriter: rewrites <title>/<meta name=description> and appends OG/Twitter
// tags to <head>. Returns the rewritten HTML as a string.
export async function injectMeta(shellHtml: string, item: Item, siteUrl: string): Promise<string> {
  const m = buildItemMeta(item, siteUrl);
  const tags =
    `<meta property="og:type" content="product" />` +
    `<meta property="og:title" content="${escapeHtml(m.title)}" />` +
    `<meta property="og:description" content="${escapeHtml(m.description)}" />` +
    `<meta property="og:url" content="${escapeHtml(m.url)}" />` +
    `<meta property="og:image" content="${escapeHtml(m.image)}" />` +
    `<meta name="twitter:card" content="summary_large_image" />` +
    `<meta name="twitter:title" content="${escapeHtml(m.title)}" />` +
    `<meta name="twitter:description" content="${escapeHtml(m.description)}" />` +
    `<meta name="twitter:image" content="${escapeHtml(m.image)}" />`;

  const rewritten = new HTMLRewriter()
    .on("title", { element(el) { el.setInnerContent(m.title); } })
    .on('meta[name="description"]', { element(el) { el.setAttribute("content", m.description); } })
    .on("head", { element(el) { el.append(tags, { html: true }); } })
    .transform(new Response(shellHtml, { headers: { "content-type": "text/html" } }));

  return await rewritten.text();
}
```

Note: `HTMLRewriter` escapes text set via `setInnerContent`, so the `<title>` assertion sees `&quot;`. Attribute values in `tags` are pre-escaped by `escapeHtml`.

- [ ] **Step 4: Run it to verify it passes**

Run: `npm run test:worker -- og`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add worker/src/og.ts worker/test/og.test.ts
git commit -m "feat(worker): inject item OG tags into HTML shell via HTMLRewriter"
```

---

### Task 6: `/item/:idOrSlug` route + env wiring

**Files:**
- Modify: `worker/src/og.ts` (add the Hono route)
- Modify: `worker/src/index.ts` (add `PUBLIC_SITE_URL` to `Env`; mount the route)
- Modify: `wrangler.toml` (add `PUBLIC_SITE_URL` var)
- Modify: `worker/vitest.config.ts` (add `PUBLIC_SITE_URL` test binding)
- Test: `worker/test/og.test.ts` (append a route test)

- [ ] **Step 1: Add `PUBLIC_SITE_URL` to the test bindings** — in `worker/vitest.config.ts`, inside the `bindings` object, add:

```ts
              PUBLIC_SITE_URL: "https://fronterafinds.com",
```

- [ ] **Step 2: Write the failing route tests** — append to `worker/test/og.test.ts`:

```ts
import { env, createExecutionContext, waitOnExecutionContext } from "cloudflare:test";
import "./setup-db";
import app from "../src/index";

describe("GET /item/:idOrSlug", () => {
  it("returns HTML with the item's OG title for a real slug", async () => {
    await env.DB.prepare(`DELETE FROM items`).run();
    await env.DB.prepare(
      `INSERT INTO items (id,slug,title,description,price_cents,category,ships_usa,local_sdtj,status,created_at,updated_at)
       VALUES ('og1','my-cool-chair','My cool chair','Comfy',5000,'home',1,1,'published',1,1)`
    ).run();
    const ctx = createExecutionContext();
    const res = await app.fetch(new Request("http://x/item/my-cool-chair"), env, ctx);
    await waitOnExecutionContext(ctx);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    const html = await res.text();
    expect(html).toContain('property="og:title" content="My cool chair · Frontera Finds"');
  });

  it("404s for an unknown slug", async () => {
    const ctx = createExecutionContext();
    const res = await app.fetch(new Request("http://x/item/does-not-exist"), env, ctx);
    await waitOnExecutionContext(ctx);
    expect(res.status).toBe(404);
  });
});
```

Note: in the test runtime the origin shell fetch (`PUBLIC_SITE_URL`) is unreachable, so the route uses its minimal-HTML fallback (Step 3) — which still contains the OG tags. The full origin-fetch path is verified manually after deploy.

- [ ] **Step 3: Add the route to `worker/src/og.ts`** — add imports at the top and the Hono app at the bottom:

```ts
// at top of file:
import { Hono } from "hono";
import type { Env } from "./index";
import { rowToItem, type ItemRow } from "./db";

// at bottom of file:
export const og = new Hono<{ Bindings: Env }>();

og.get("/item/:idOrSlug", async (c) => {
  const idOrSlug = c.req.param("idOrSlug");
  const row = await c.env.DB
    .prepare(`SELECT * FROM items WHERE slug = ?1 OR id = ?1`)
    .bind(idOrSlug)
    .first<ItemRow>();
  if (!row || row.status === "hidden") return c.notFound();

  // photos for og:image
  const { results } = await c.env.DB
    .prepare(`SELECT r2_key FROM item_photos WHERE item_id = ?1 ORDER BY sort_order ASC`)
    .bind(row.id)
    .all<{ r2_key: string }>();
  const item = rowToItem(row, results.map((r) => r.r2_key));
  const siteUrl = c.env.PUBLIC_SITE_URL;

  // Fetch the built SPA shell from the static origin and inject meta. If the
  // origin is unreachable, fall back to a minimal HTML doc that still carries
  // the OG tags and links to the item.
  let shell: string | null = null;
  try {
    const resp = await fetch(`${siteUrl}/index.html`, { cf: { cacheTtl: 300 } });
    if (resp.ok) shell = await resp.text();
  } catch { /* fall through to minimal */ }

  let html: string;
  if (shell) {
    html = await injectMeta(shell, item, siteUrl);
  } else {
    const m = buildItemMeta(item, siteUrl);
    html =
      `<!doctype html><html lang="en"><head><meta charset="utf-8" />` +
      `<title>${escapeHtml(m.title)}</title>` +
      `<meta property="og:type" content="product" />` +
      `<meta property="og:title" content="${escapeHtml(m.title)}" />` +
      `<meta property="og:description" content="${escapeHtml(m.description)}" />` +
      `<meta property="og:url" content="${escapeHtml(m.url)}" />` +
      `<meta property="og:image" content="${escapeHtml(m.image)}" />` +
      `<meta name="twitter:card" content="summary_large_image" />` +
      `<meta name="twitter:image" content="${escapeHtml(m.image)}" />` +
      `</head><body><a href="${escapeHtml(m.url)}">${escapeHtml(item.title)}</a></body></html>`;
  }
  return c.html(html, 200, { "cache-control": "public, max-age=300" });
});
```

- [ ] **Step 4: Add `PUBLIC_SITE_URL` to `Env` and mount the route** — in `worker/src/index.ts`: add to the `Env` interface (after line 18):

```ts
  PUBLIC_SITE_URL: string;
```

add the import (near the other route imports at top):

```ts
import { og } from "./og";
```

and mount it (with the other `app.route` calls, before `export default`):

```ts
app.route("/", og);
```

- [ ] **Step 5: Add the production var** — in `wrangler.toml`, under `[vars]`, add:

```toml
PUBLIC_SITE_URL = "https://fronterafinds.com"
```

- [ ] **Step 6: Run the tests**

Run: `npm run test:worker -- og`
Expected: PASS (real-slug returns HTML with og:title via fallback; unknown slug 404s).

- [ ] **Step 7: Typecheck the worker**

Run: `npx tsc -b`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add worker/src/og.ts worker/src/index.ts wrangler.toml worker/vitest.config.ts worker/test/og.test.ts
git commit -m "feat(worker): /item/:slug route serving OG-enriched HTML"
```

---

### Task 7: Vercel rewrite for `/item/*`

**Files:**
- Modify: `vercel.json`

- [ ] **Step 1: Add the rewrite above the SPA catch-all** — in `vercel.json`, the `rewrites` array must list `/item/:path*` BEFORE the `/:path*` catch-all (Vercel matches in order). New array:

```json
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "https://frontera-finds.kevincromley2020.workers.dev/api/:path*"
    },
    {
      "source": "/img/:path*",
      "destination": "https://frontera-finds.kevincromley2020.workers.dev/img/:path*"
    },
    {
      "source": "/item/:path*",
      "destination": "https://frontera-finds.kevincromley2020.workers.dev/item/:path*"
    },
    {
      "source": "/:path*",
      "destination": "/index.html"
    }
  ]
```

- [ ] **Step 2: Commit**

```bash
git add vercel.json
git commit -m "feat(deploy): route /item/* to the worker for link previews"
```

---

### Task 8: Final verification

- [ ] **Step 1: Full typecheck**

Run: `npx tsc -b`
Expected: no errors.

- [ ] **Step 2: All worker tests**

Run: `npm run test:worker`
Expected: all suites PASS.

- [ ] **Step 3: Production build**

Run: `npm run build`
Expected: builds with no errors.

- [ ] **Step 4: Post-deploy manual checks (after `npm run deploy` + Vercel deploy)**

- Open `https://fronterafinds.com/?q=<word>&sort=price_asc&minPrice=5` — results filter/sort; URL is shareable.
- A sold item shows the ribbon on the grid and the badge on its page, in normal date order.
- `curl -s https://fronterafinds.com/item/<slug> | grep og:` shows the item's OG tags.
- Paste an item link into the [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/) and a WhatsApp/iMessage chat — the preview card shows photo, title, and price.

---

## Deploy summary
- **Worker** (Tasks 1, 4, 5, 6): `npm run deploy`.
- **Frontend** (Tasks 2, 3): Vercel git deploy.
- **`vercel.json`** (Task 7): Vercel git deploy (the rewrite is part of the Vercel config).

## Note: default OG image
`buildItemMeta` points photo-less items at `${siteUrl}/og-default.png`. This is
optional — if no such file exists the preview simply shows no image (harmless). To
give photo-less items a fallback preview image, drop a `public/og-default.png` into
the frontend (Vite serves `public/` at the site root, so it resolves to
`/og-default.png`). Not required for any task to pass.
