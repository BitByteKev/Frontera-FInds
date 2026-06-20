# Listing Improvements — Design

Date: 2026-06-20
Scope: three improvements to the public storefront — sold badges, browse controls
(search/sort/price filter), and rich link previews. Most of the data layer already
exists; this spec covers the gaps.

## Goals

1. **Sold badge** — sold items stay visible in the grid with a clear "SOLD" marker.
2. **Browse controls** — buyers can search by keyword, sort, and filter by price.
3. **Rich link previews** — pasting an item link into WhatsApp/Facebook/iMessage
   shows a preview card (photo, title, price) instead of a bare URL.

## What already exists (no change needed)

- `items.status` column: `published | sold | hidden`.
- `GET /api/items` supports `q`, `category`, `ships`, `local`, `sold`.
- `GET /api/items/:idOrSlug` (slug or id); returns 404 for `hidden`.
- Admin "Mark sold" / "Relist" buttons (`AdminManage`).
- Item page already shows a "This item has been sold." line when `status === "sold"`.

---

## Feature 1 — Sold badge

**Decision:** sold items remain in **normal date order** (no reordering).

- **Home grid:** request the list with sold included (`sold=1`) and render a `SOLD`
  ribbon over the card thumbnail for any item with `status === "sold"`.
- **Item page:** add a `SOLD` badge near the title (keep the existing sentence).
- **Styling:** one CSS class (e.g. `.ff-badge-sold`) — a small pill/ribbon. No new
  component file required; reuse existing card markup.

No schema or API change.

---

## Feature 2 — Browse controls (search / sort / price)

### API (`GET /api/items`)
Add two capabilities to the existing handler:

- `sort`: `newest` (default, `created_at DESC`) | `price_asc` (`price_cents ASC`) |
  `price_desc` (`price_cents DESC`). Unknown values fall back to `newest`.
- `minPrice` / `maxPrice`: integers in **cents**. Each is optional and added to the
  `WHERE` clause as `price_cents >= ?` / `price_cents <= ?` when present and numeric.

Existing `q`, `category`, `ships`, `local`, `sold` are unchanged. `MAX_LIST` cap stays.

### Home UI
All controls read from and write to the existing URL `searchParams`, so a filtered
view is shareable and survives reload:

- **Search box** bound to `q` (debounced ~300ms before updating the param).
- **Sort dropdown** bound to `sort`.
- **Price range:** two numeric inputs (min / max, in dollars) → converted to cents
  for `minPrice` / `maxPrice`. Blank input omits that bound.
- Empty/no-results state: a short "No items match your filters." message.

Home already passes `params` straight to `api.list(params)`, so the data flow is:
inputs → update `searchParams` → effect re-fetches → grid re-renders.

---

## Feature 3 — Rich link previews (Open Graph)

Crawlers do not run JS, so per-item meta tags must be **server-rendered**. The React
app is an SPA served by Vercel; the Cloudflare Worker owns the dynamic layer.

### Approach (chosen)
Serve `/item/:idOrSlug` HTML **from the Worker**, injecting per-item meta tags into
the existing built HTML shell. Humans still get the full SPA; crawlers get correct tags.

**Worker route:** `GET /item/:idOrSlug`
1. Look up the item via the existing `WHERE slug = ?1 OR id = ?1` query.
2. Fetch the built shell from the site origin: `fetch(`${PUBLIC_SITE_URL}/index.html`)`.
   (`PUBLIC_SITE_URL` added to `wrangler.toml [vars]`, e.g. `https://fronterafinds.com`.)
   This path is not under `/item/*`, so it routes to Vercel — no loop.
3. Use `HTMLRewriter` to:
   - replace `<title>` text and the `<meta name="description">` `content`,
   - append `og:title`, `og:description` (includes formatted price), `og:type`,
     `og:url`, `og:image`, and `twitter:card`/`twitter:title`/`twitter:image`
     to `<head>`.
4. `og:image` = absolute `${PUBLIC_SITE_URL}/img/${firstPhotoKey}`. If the item has no
   photos, fall back to a site-default image (`${PUBLIC_SITE_URL}/og-default.png` if
   present) or omit the image tags.
5. **Escape** all injected attribute/text values (`& < > "`) so titles/descriptions
   can't break the markup.
6. If the item is missing or `hidden`, return the unmodified shell (the SPA renders its
   own not-found view).

**Vercel rewrite:** add, **above** the SPA catch-all:
```json
{ "source": "/item/:path*", "destination": "https://frontera-finds.kevincromley2020.workers.dev/item/:path*" }
```

**Caching:** set a short `cache-control` (e.g. `public, max-age=300`) on the worker
response. Edge caching keyed by URL is sufficient; an item edit becomes visible within
the TTL. (Cache-busting on `updated_at` is a possible later refinement, not in scope.)

### Failure modes
- Origin shell fetch fails → return a minimal valid HTML document containing just the
  meta tags + a `<meta http-equiv="refresh">`/link to the item, so a preview still works
  and humans aren't hard-blocked. (Logged, not fatal.)
- D1 lookup fails → serve the unmodified shell.

---

## Out of scope
- Cache-busting previews on every edit (TTL is acceptable).
- Category filter UI (API already supports `category`; can be added later).
- Pagination / infinite scroll (current `MAX_LIST` cap unchanged).
- Generating/uploading a site-default OG image (use one if it exists, else omit).

## Testing
- **API:** unit-test `sort` ordering and `minPrice`/`maxPrice` bounds (extend
  `worker/test`), including invalid `sort` → `newest` and non-numeric price → ignored.
- **Sold badge:** verify the grid includes sold items and renders the badge; item page
  shows the badge.
- **Previews:** curl `/item/<slug>` with a crawler user-agent and assert the response
  contains the item's `og:title`/`og:image`; validate with a card debugger after deploy.
- Full typecheck (`tsc -b`) and existing worker tests pass.

## Deploys
- Worker changes (API params + `/item` route): `npm run deploy`.
- Frontend changes (Home UI, badges) + `vercel.json` rewrite: via Vercel git deploy.
