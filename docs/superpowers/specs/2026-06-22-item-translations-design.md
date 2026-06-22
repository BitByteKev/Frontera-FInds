# Bilingual Item Content — Design

**Date:** 2026-06-22
**Status:** Approved (design)

## Goal

Translate seller-entered item titles and descriptions so they display in the visitor's
active UI language (EN/ES), instantly when the language toggle flips. Reuses the
existing Claude integration; no new dependency or API key.

## Decisions (locked)

- **When:** Translate on save (create/edit), stored in D1. Fast reads, one-time cost per item.
- **Languages:** Generate BOTH a clean English and Spanish version from whatever the
  seller typed (English, Spanish, or mixed) — every item ends up fully bilingual.
- **Backfill:** A one-time admin action translates all existing items.
- **Review:** Fully automatic on save; no per-item translation editing UI.
- **Trigger for backfill:** A "Translate all items" button on the admin Manage page
  (batched, loops until done). Save latency (~ same as "Generate with AI") is acceptable.

## Architecture

### Schema — `worker/migrations/0003_translations.sql`
Four nullable columns on `items`: `title_en`, `title_es`, `description_en`,
`description_es`. The existing `title`/`description` remain the seller's raw input —
the canonical value edited in admin and the ultimate display fallback. New columns hold
Claude's bilingual versions; NULL on legacy rows until backfilled.

### Translation module — `worker/src/translate.ts`
Mirrors `generate.ts`. Exports:
```
translateListing(env, title, description) =>
  Promise<{ title_en, title_es, description_en, description_es }>
```
Calls `claude-opus-4-8` (env `AI_MODEL`) with `ANTHROPIC_API_KEY`, structured-output
JSON schema of the four string fields, system prompt instructing natural EN+ES
translation of a yard-sale listing (preserve meaning, brand/model, measurements;
no invented details; concise titles). Throws if the model returns no usable output.

A `safeTranslate(env, title, description)` wrapper try/catches `translateListing` and,
on any failure, returns the raw `title`/`description` in all four fields — so a save
never fails because translation failed.

### Write path — `worker/src/items.ts`
- **POST (create):** always translate the new title/description, store all four columns.
- **PATCH (update):** only (re)translate when `title` or `description` actually changed,
  OR when existing translations are NULL. A status-only PATCH (e.g. "Mark sold" from the
  Manage page) must NOT trigger a Claude call. When skipping, the existing translation
  columns are preserved.

### Read path — `worker/src/db.ts`
`ItemRow` gains `title_en/title_es/description_en/description_es: string | null`.
`Item` gains the same as `titleEn/titleEs/descriptionEn/descriptionEs: string | null`.
`rowToItem` maps them through. The public list/get and admin list endpoints return the
new fields automatically (they already `SELECT *` and map via `rowToItem`).

### Backfill — `POST /api/admin/translate-all`
Admin-only. Selects up to a small BATCH (5) of items where `title_en IS NULL`, translates
each via `safeTranslate`, updates the four columns, and returns
`{ translated: number, remaining: number, done: boolean }`. Batching avoids Worker
wall-clock limits. The Manage-page button loops calling it until `done`, showing progress.

### Frontend — pick language client-side (instant toggle, no refetch)
- `src/lib/types.ts` `Item` gains optional `titleEn?/titleEs?/descriptionEn?/descriptionEs?: string | null`.
- New `src/lib/localize.ts`:
  - `pickText(item, field, lang)` → for `lang==="es"` returns `item.{field}Es ?? item.{field}`;
    for `"en"` returns `item.{field}En ?? item.{field}`. Always falls back to the raw
    `title`/`description` when a translation is missing (legacy / pre-backfill items).
  - `localizeItem(item, lang)` → shallow copy with `title`/`description` swapped to the
    active language via `pickText`.
- `src/pages/Home.tsx`: read `lang` from `useLang()`, map each item through
  `localizeItem(it, lang)` before rendering `ItemCard`. `ItemCard`, `Badges` unchanged.
- `src/pages/ItemPage.tsx`: keep fetched raw item in state; derive
  `localizeItem(item, lang)` after the loading guard and use it for the heading,
  description, `Gallery` (alt), and `ContactButtons` (pitch/default message). No changes
  to those child components.
- `src/lib/api.ts`: add `adminApi.translateAll()` → `POST /api/admin/translate-all`.
- `src/pages/admin/AdminManage.tsx`: "Translate all items" button that loops
  `translateAll()` until `done`, displaying "Translating… N left" and a final count.

### Admin edit form
Unchanged. It keeps loading/saving the raw `title`/`description`; translation happens
server-side on save.

## Edge cases
- **Translation failure on save:** `safeTranslate` falls back to raw text in both
  languages; the item still saves and displays (untranslated). Re-saving retries.
- **Status-only PATCH:** no Claude call (cost/latency guard).
- **Legacy / un-backfilled items:** `pickText` falls back to raw `title`/`description`,
  so they display correctly in either language until translated.
- **Backfill timeouts:** batched (5/request), client loops; safe for large catalogs.

## Testing
- Worker (vitest, mocked `@anthropic-ai/sdk`):
  - `translate.test.ts`: `translateListing` returns the four fields from a mocked response.
  - `items.test.ts` (extend): add the Anthropic mock (returns a superset JSON with all
    fields so it serves create+translate); assert POST stores translations and GET returns
    `titleEs` etc.; assert a status-only PATCH still succeeds.
  - backfill test: insert a row with NULL translations directly, call `/translate-all`,
    assert columns filled and `done` eventually true.
- Frontend (vitest, node env): `localize.test.ts` for `pickText`/`localizeItem`
  (es picks Es, en picks En, fallback to raw when null/undefined).
- `npm run build` (tsc + vite) and `npm run test:worker` pass.

## Out of scope (v1)
- Searching translated text (search still matches the raw typed `title`/`description`).
- Per-item manual translation editing UI.
- Languages beyond EN/ES.

## Deploy note
Requires `npm run deploy` (applies migration 0003 + ships the new worker) and
`npm run db:apply` for the remote D1 migration, then a one-time click of
"Translate all items" in admin to backfill the existing catalog.
