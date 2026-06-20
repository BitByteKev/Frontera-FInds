# Frontera Finds

A personal "yard sale on the internet" — a single-seller, eBay-style catalog.
Buyers browse the owner's items and **contact to buy** (WhatsApp / SMS /
on-site form → email / Instagram). No on-site payments. The owner manages
listings from a private admin with an **AI button** (Claude Opus 4.8 vision)
that turns an uploaded photo into a title, description, and suggested price.

Every listing advertises **Ships USA** (nationwide) and/or **Local · SD/TJ**
(San Diego / Tijuana pickup & delivery).

## Stack
- **Frontend:** React 18 + Vite (SPA), react-router-dom.
- **API:** Cloudflare Worker (Hono).
- **Data:** D1 (SQL) for listings, R2 for photos.
- **AI:** Anthropic API (`claude-opus-4-8`, vision + structured outputs).
- **Email:** Cloudflare Email send binding (`mimetext`).

## Develop
```bash
npm install
npm run dev:worker   # worker on :8787 (local D1/R2 via miniflare)
npm run dev          # frontend on :5173 (proxies /api and /img to the worker)
npm run test:worker  # worker test suite (Vitest workers pool)
npm run build        # type-check the frontend + bundle to dist/
```
Create `.dev.vars` (gitignored) for local secrets:
```
ADMIN_PASSWORD=choose-a-dev-password
ANTHROPIC_API_KEY=sk-ant-...
```
Apply the DB schema to local miniflare once: `npm run db:apply:local`.

The admin UI is at `/admin` (log in with `ADMIN_PASSWORD`). Public site is `/`.

## One-time Cloudflare setup (for deploy)
```bash
wrangler d1 create frontera_finds          # paste the id into wrangler.toml
wrangler r2 bucket create frontera-finds-photos
npm run db:apply                           # apply migrations to the remote D1
wrangler secret put ANTHROPIC_API_KEY
wrangler secret put ADMIN_PASSWORD
```
Then in `wrangler.toml`:
- Set `PUBLIC_INSTAGRAM_URL` to the real handle (currently a placeholder).
- Confirm `PUBLIC_WHATSAPP` / `PUBLIC_SMS` (the public contact number) and `OWNER_EMAIL`.

**Email:** configure Cloudflare Email Routing so the `[[send_email]]`
`destination_address` (the owner's email) is a **verified** destination, or the
contact form's send will fail (buyers are then told to use WhatsApp/SMS).

## Deploy
```bash
npm run deploy   # builds the frontend, then `wrangler deploy`
```

## Architecture notes
- Public read endpoints (`/api/items`, `/api/items/:id`, `/api/config`,
  `/img/:key`, `POST /api/items/:id/contact`) are open. Admin write endpoints
  (`/api/admin/*`) require a Bearer token from `POST /api/admin/login`.
- The admin token is an HMAC of `{exp}` keyed by `ADMIN_PASSWORD`; rotating the
  password invalidates all outstanding tokens (single-user model).
- The AI generator reads already-uploaded R2 photos (cap 4), base64-encodes
  them, and asks Claude for `{title, description, price_cents}` via structured
  outputs. On failure the admin form still works — the owner fills it in by hand.

See `docs/superpowers/specs/` for the design spec and `docs/superpowers/plans/`
for the implementation plan.
