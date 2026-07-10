# Facebook Marketplace Portfolio — Design

**Date:** 2026-07-09
**Status:** Approved (pending spec review)

## Goal

Bring the seller's Facebook Marketplace presence onto the site, two parts:

1. **Import** the ~20 active Marketplace listings from
   https://www.facebook.com/marketplace/profile/61558944447221/ into the site's
   own catalog as native, published items.
2. **Link** to the Marketplace profile from the public site, mirroring the
   existing Instagram link.

## Decisions

- **Import mechanism:** one-time, operational — no import code ships in the
  site. Listings are read through the seller's logged-in Chrome session
  (Facebook has no public Marketplace API); photos and rows are pushed straight
  to production R2/D1 with the already-authenticated `wrangler` CLI.
- **Import mode:** items are created with `status = 'published'` (live
  immediately). The seller can hide/edit afterward in the admin.
- **Scope:** all active listings, minus duplicates of items already on the
  site.
- **Rejected alternatives:** an admin bulk-import screen (YAGNI for a one-time
  job); hand-entry via the admin UI (slow, and the assistant cannot handle the
  admin password).

## Part 1 — Facebook Marketplace link (the only code change)

Mirrors the `PUBLIC_INSTAGRAM_URL` → `instagramUrl` plumbing exactly:

- `wrangler.toml` `[vars]`: add
  `PUBLIC_FACEBOOK_URL = "https://www.facebook.com/marketplace/profile/61558944447221/"`.
- `worker/src/index.ts`: add `PUBLIC_FACEBOOK_URL: string` to `Env`; return
  `facebookUrl` from `/api/config`.
- `src/lib/types.ts`: add `facebookUrl: string` to `SiteConfig`.
- `src/components/ContactButtons.tsx`: render a "Facebook Marketplace" outline
  button (`target="_blank"`) after the Instagram button, only when
  `cfg.facebookUrl` is non-empty — same conditional pattern as `instagramUrl`.
- `src/pages/About.tsx` + `src/i18n/strings.ts`: include Facebook Marketplace
  in the "how to buy" sentence; new strings get both EN and ES values (the
  button label itself, e.g. `contact.facebook`, and any About-page copy).

## Part 2 — One-time import (operational)

### Capture (Chrome, logged-in session)

For each active listing on the profile: title, description, price (USD),
photo URLs, location, and whether the listing offers shipping.

### Field mapping

| Site field | Source |
|---|---|
| `title`, `description` | FB listing text, verbatim (raw EN) |
| `price_cents` | FB price × 100 |
| `status` | `'published'` |
| `local_sdtj` | `1` for San Diego / Tijuana-located listings (expected: all) |
| `ships_usa` | `1` only if the FB listing offers shipping |
| `category` | best fit chosen from categories already used in the catalog, else `'misc'` |
| `slug` | site's existing rules: `slugify(title)`, `-2`/`-3`… suffix on collision |
| `created_at` / `updated_at` | import time |
| `title_en/es`, `description_en/es` | left NULL — filled by the existing translation backfill |

### Photos

- Downloaded from Facebook's CDN (the seller's own listing photos; explicit
  permission is requested before downloading).
- Uploaded to the `frontera-finds-photos` R2 bucket under the site's key
  format `items/<uuid>.<ext>` with the correct `content-type` metadata, via
  `wrangler r2 object put`.
- Linked through `item_photos` rows preserving the FB photo order
  (`sort_order`).

### Duplicates

Before inserting, the current production catalog is listed; any FB listing
whose title closely matches an existing item (case-insensitive, ignoring
punctuation) is skipped and reported rather than imported twice.

### Translations

Imported rows leave the EN/ES columns NULL. Afterward the seller presses the
existing **"Translate all items"** button in the admin (admin-authed, so that
click is the seller's) to backfill translations.

## Error handling

- A listing that cannot be read is skipped and reported; the run continues.
- A failed photo download/upload does not abort its item — the item is created
  with the photos that succeeded, and the gap is reported.
- The import ends with a summary: imported, skipped-as-duplicate, and any
  failures.

## Testing / verification

- New worker test asserting `/api/config` returns `facebookUrl` (no config
  test exists today); frontend type-check via `npm run build`; worker suite via
  `npm run test:worker`.
- Live verification after deploy + import: imported items render on Home with
  correct prices and photos; an item page shows the Facebook Marketplace
  button; the About page mentions Marketplace in both languages.

## Out of scope (YAGNI)

- No recurring sync or scraper — Facebook offers no API; this is a one-time
  copy.
- No admin bulk-import UI.
- No social-proof/ratings section (the seller chose link + import only).
- No import of sold/inactive Marketplace listings.
