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

## Deploy (Vercel frontend + Cloudflare Worker backend)

The React frontend is hosted on **Vercel**; the API/photos run on a **Cloudflare
Worker**. The frontend uses relative `/api` and `/img` paths, and `vercel.json`
proxies those to the Worker — so there's no CORS and no per-environment API URL
in the frontend code. Order matters:

```bash
# 1. Cloudflare backend — create resources, then deploy the Worker
wrangler r2 bucket create frontera-finds-photos        # needs R2 enabled in the dashboard first
wrangler d1 create frontera_finds                      # paste the database_id into wrangler.toml
npm run db:apply                                       # apply migrations to the REMOTE D1
wrangler secret put ANTHROPIC_API_KEY                  # production AI key
wrangler secret put ADMIN_PASSWORD                     # production admin password
wrangler deploy --config wrangler.toml                 # → prints the Worker URL (…workers.dev)

# 2. Wire Vercel to the Worker
#    Edit vercel.json: replace REPLACE-WITH-YOUR-WORKER-URL.workers.dev with the
#    Worker URL printed above (keep the /api/:path* and /img/:path* suffixes).
git commit -am "chore: point vercel proxy at the worker" && git push   # Vercel auto-redeploys
```

Notes:
- The **deployed** admin password is the `ADMIN_PASSWORD` secret you set on the
  Worker — not the local `.dev.vars` value.
- The Worker only serves `/api/*` and `/img/*`; Vercel serves the SPA and proxies
  those two paths to the Worker.

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
