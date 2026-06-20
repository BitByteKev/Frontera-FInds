# Frontera Finds — Design

**Date:** 2026-06-19
**Status:** Approved (pending spec review)

## Summary

Frontera Finds is a single-seller, eBay-style online catalog — a personal
"yard sale on the internet." Buyers browse a grid of the owner's items, open an
item, and **contact the owner to buy** (no on-site payment). The owner runs the
store from a private admin where an **AI button turns an uploaded photo into a
title, description, and suggested price**, which the owner confirms before
publishing.

The brand advertises **nationwide USA shipping** plus **local delivery & pickup
in San Diego / Tijuana**, surfaced on every listing via badges.

## Goals

- Let one seller list their own items quickly, photo-first.
- Make "I want this" a one-tap action across the seller's preferred channels.
- Make shipping (USA) vs. local (SD/TJ) obvious at a glance.
- Keep operations dead simple: no payments, no inventory sync, no buyer accounts.

## Non-Goals (v1)

Deliberately excluded to stay lean; candidates for later:

- Cart / on-site card payments (Stripe).
- Buyer accounts / login.
- Live shipping-rate calculation or label generation.
- Automated price scraping of comparable listings.
- Multi-seller / marketplace features.

## Brand & Visual Direction

- **Name:** Frontera Finds.
- **Palette — "Deep Agave":**
  - Cactus green `#1f6f54` (primary / header / brand).
  - Warm sand `#fbf8f1` (page background).
  - Gold `#e8b94a` (accent / "Sell"/CTA highlights).
  - White `#ffffff` item cards on the sand background.
- **Badges:**
  - Green **"Ships USA"** — green bg `#e3efe1`, text `#1f6f54`.
  - Red **"Local · SD/TJ"** — red bg `#f6e4cf`/`#fde9ea`, warm red text.
- **Layout:** eBay-style item grid, 3-across on desktop, 2 on tablet, 1 on
  phone. Light bilingual touches ("Buscar / Search").

## Public Site (buyer-facing)

### Home
- Header: logo, search box, "Sell" affordance is owner-only (links to admin).
- Filters: category, "Ships USA", "Local pickup/delivery".
- Item grid, newest first. Each card: photo, title, price, shipping/pickup
  badge(s).
- Sold items: owner toggles whether they show with a **SOLD** ribbon (social
  proof) or are hidden.

### Item page
- Photo gallery (1+ images).
- Title, price, full description, category, shipping/pickup badges.
- Four **"I want this"** contact buttons, each pre-filling the item name + URL:
  1. **WhatsApp** — deep link to `+16199448759` with pre-filled text.
  2. **Text / SMS** — `sms:` link to `+16199448759` with pre-filled body.
  3. **Message form → email** — buyer enters name + message; Worker sends it to
     the owner's email via Cloudflare Email. Keeps the conversation on-site and
     the owner's inbox as the record.
  4. **Instagram / Messenger** — link out to the owner's DM handle.

### About / Shipping page
Short page advertising nationwide USA shipping and local San Diego / Tijuana
delivery & pickup, plus how buying works (contact → arrange payment/handoff).

## Admin CRM (owner-only, password-protected)

### Add item
1. Drag in one or more photos → upload to R2.
2. Press **✨ Generate with AI** → Worker calls the Anthropic API (Claude
   vision) with the photo(s) and returns **title**, **description**, and a
   **suggested price** (model's own estimate of a fair used price).
3. Owner edits any field, picks category, and toggles shipping options
   (Ships USA / Local SD/TJ).
4. **Publish**.

### Manage
- List of all items with status (Published / Sold / Hidden).
- Quick edit, mark **Sold**, hide/unhide, delete.

### Auth
Single owner login behind a simple password (no multi-user). Admin write
endpoints require the session; public read endpoints are open.

## Architecture

New project at `~/Desktop/frontera-finds`, mirroring the Omni stack the owner
already knows.

- **Frontend:** React + Vite (SPA).
- **API:** Cloudflare Worker using Hono.
- **Data:** Cloudflare **D1** (SQL) for listings; **R2** for photo storage.
- **AI:** Anthropic API (Claude vision) for the listing generator.
- **Email:** Cloudflare Email Sending for the contact-form channel.

### Data model (D1)

`items`
- `id` (text, pk)
- `title` (text)
- `description` (text)
- `price_cents` (integer)
- `category` (text)
- `ships_usa` (integer 0/1)
- `local_sdtj` (integer 0/1)
- `status` (text: `published` | `sold` | `hidden`)
- `created_at` (integer, epoch ms)
- `updated_at` (integer, epoch ms)

`item_photos`
- `id` (text, pk)
- `item_id` (text, fk → items.id)
- `r2_key` (text)
- `sort_order` (integer)

### API surface (sketch)

Public (read):
- `GET /api/items` — list/search/filter published (and optionally sold) items.
- `GET /api/items/:id` — single item with photos.
- `POST /api/items/:id/contact` — contact-form submission → email to owner.
- `GET /img/:key` — serve an R2 photo.

Admin (write, behind password/session):
- `POST /api/admin/login` — exchange password for a session.
- `POST /api/admin/upload` — upload photo(s) to R2.
- `POST /api/admin/generate` — photo(s) → AI title/description/price.
- `POST /api/admin/items` — create item.
- `PATCH /api/admin/items/:id` — edit / mark sold / hide.
- `DELETE /api/admin/items/:id` — delete item.

## Configuration / secrets (provided at build time)

- `ANTHROPIC_API_KEY` — for the AI button.
- `ADMIN_PASSWORD` — owner login.
- Owner contact details: WhatsApp/SMS `+16199448759`, owner email (for contact
  form), Instagram/Messenger handle.
- Cloudflare account with D1, R2, and Email Sending configured.

## Error handling

- AI generation failure → admin form still works; show a non-blocking error and
  let the owner fill fields manually.
- Photo upload failure → surfaced inline; item can be saved without all photos.
- Contact-form email failure → buyer is told to use WhatsApp/SMS instead; error
  logged.
- Public endpoints degrade gracefully if D1/R2 are briefly unavailable.

## Testing

- Worker unit tests (Vitest) for items CRUD, filtering, contact-form handler,
  and the AI-generate endpoint (mocked Anthropic response).
- Auth tests: admin endpoints reject without a valid session.
- Frontend component tests for the grid, item page contact buttons (correct
  pre-filled links), and the admin add-item flow.
