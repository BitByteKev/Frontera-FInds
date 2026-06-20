# Frontera Finds Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Frontera Finds — a single-seller, eBay-style "yard sale on the internet" where buyers browse the owner's items and contact him to buy, and the owner manages listings from a private admin with an AI button that turns a photo into a title, description, and suggested price.

**Architecture:** A React + Vite single-page app talks to a Cloudflare Worker (Hono) JSON API. Listings live in Cloudflare D1 (SQL); photos live in R2; the AI button calls the Anthropic API (Claude Opus 4.8 vision, structured outputs); the contact form emails the owner via a Cloudflare Email send binding. Public read endpoints are open; admin write endpoints sit behind a password-derived signed token.

**Tech Stack:** TypeScript, React 18, Vite 5, Hono 4, Cloudflare Workers/D1/R2, `@anthropic-ai/sdk`, `mimetext`, Vitest (`@cloudflare/vitest-pool-workers` for the Worker), react-router-dom 6.

**Conventions used throughout:**
- IDs: `crypto.randomUUID()` in the Worker.
- Timestamps: `Date.now()` (epoch ms, integer).
- Money: integer cents everywhere (`price_cents`); format to dollars only in the UI.
- Brand palette ("Deep Agave"): `--ff-green:#1f6f54`, `--ff-green-dark:#1a5b45`, `--ff-sand:#fbf8f1`, `--ff-gold:#e8b94a`, `--ff-card:#ffffff`, `--ff-ink:#23201a`, `--ff-line:#e8e2d2`.
- Run all commands from the repo root `~/Desktop/frontera-finds`.

---

## File Structure

```
frontera-finds/
  package.json
  tsconfig.json            # app (browser) config
  tsconfig.node.json       # vite config
  vite.config.ts
  index.html
  wrangler.toml
  vitest.config.ts         # frontend tests (happy-dom)
  src/                     # FRONTEND
    main.tsx
    App.tsx                # router + layout shell
    theme.css              # design tokens + base styles
    lib/
      api.ts               # fetch helpers for public + admin
      format.ts            # money/date formatting
      types.ts             # shared TS types (Item, etc.)
    components/
      ItemCard.tsx
      Badges.tsx           # Ships USA / Local SD·TJ badges
      ContactButtons.tsx   # WhatsApp / SMS / form / Instagram
    pages/
      Home.tsx
      ItemPage.tsx
      About.tsx
      admin/
        AdminLogin.tsx
        AdminManage.tsx
        AdminEdit.tsx      # add/edit one item + AI button
  worker/
    wrangler-types.d.ts    # Env interface
    src/
      index.ts             # Hono app, route mounting
      auth.ts              # sign/verify admin token
      items.ts             # public + admin item routes
      photos.ts            # R2 upload + serve
      generate.ts          # AI listing generator
      contact.ts           # contact form -> email
    migrations/
      0001_init.sql
    test/
      items.test.ts
      auth.test.ts
      generate.test.ts
      contact.test.ts
    tsconfig.json
    vitest.config.ts       # workers pool
```

Each file has one responsibility. The Worker is split by feature (items / photos / generate / contact / auth) so each route module stays small and independently testable.

---

## Task 0: Project scaffold

**Files:**
- Create: `package.json`, `tsconfig.json`, `tsconfig.node.json`, `vite.config.ts`, `index.html`, `src/main.tsx`, `src/App.tsx`, `worker/src/index.ts`, `worker/tsconfig.json`, `wrangler.toml`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "frontera-finds",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "dev:worker": "wrangler dev --config wrangler.toml",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:worker": "vitest run --config worker/vitest.config.ts",
    "db:apply": "wrangler d1 migrations apply frontera_finds --config wrangler.toml",
    "db:apply:local": "wrangler d1 migrations apply frontera_finds --local --config wrangler.toml",
    "deploy": "npm run build && wrangler deploy --config wrangler.toml"
  },
  "dependencies": {
    "@anthropic-ai/sdk": "^0.70.0",
    "hono": "^4.12.23",
    "mimetext": "^3.0.27",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.28.0"
  },
  "devDependencies": {
    "@cloudflare/vitest-pool-workers": "^0.8.0",
    "@cloudflare/workers-types": "^4.20260528.1",
    "@types/react": "^18.3.12",
    "@types/react-dom": "^18.3.1",
    "@vitejs/plugin-react": "^4.3.4",
    "happy-dom": "^20.9.0",
    "typescript": "^5.6.3",
    "vite": "^5.4.11",
    "vitest": "^2.1.5",
    "wrangler": "^4.95.0"
  }
}
```

- [ ] **Step 2: Install dependencies**

Run: `npm install`
Expected: `node_modules/` created, no errors.

- [ ] **Step 3: Create `tsconfig.json` (app)**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

- [ ] **Step 4: Create `tsconfig.node.json`**

```json
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true,
    "strict": true
  },
  "include": ["vite.config.ts"]
}
```

- [ ] **Step 5: Create `vite.config.ts`** (proxies API + images to the Worker in dev)

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": "http://localhost:8787",
      "/img": "http://localhost:8787",
    },
  },
});
```

- [ ] **Step 6: Create `index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Frontera Finds — yard sale shipping USA + local SD/TJ</title>
    <meta name="description" content="A personal yard sale online. Shipping across the USA, plus local pickup & delivery in San Diego and Tijuana." />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 7: Create `src/main.tsx`**

```tsx
import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./theme.css";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
```

- [ ] **Step 8: Create a placeholder `src/App.tsx`** (replaced in Task 9)

```tsx
export default function App() {
  return <div>Frontera Finds</div>;
}
```

- [ ] **Step 9: Create a placeholder `src/theme.css`** (replaced in Task 9)

```css
:root { color-scheme: light; }
```

- [ ] **Step 10: Create `worker/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "types": ["@cloudflare/workers-types"],
    "strict": true,
    "skipLibCheck": true,
    "noEmit": true,
    "resolveJsonModule": true
  },
  "include": ["src", "wrangler-types.d.ts", "test"]
}
```

- [ ] **Step 11: Create a minimal `worker/src/index.ts`** (fleshed out in later tasks)

```ts
import { Hono } from "hono";

export interface Env {
  DB: D1Database;
  PHOTOS: R2Bucket;
  SEND_EMAIL: SendEmail;
  ANTHROPIC_API_KEY: string;
  ADMIN_PASSWORD: string;
  AI_MODEL: string;
  PUBLIC_WHATSAPP: string;
  PUBLIC_SMS: string;
  PUBLIC_INSTAGRAM_URL: string;
  OWNER_EMAIL: string;
}

const app = new Hono<{ Bindings: Env }>();

app.get("/api/health", (c) => c.json({ ok: true }));

export default app;
```

- [ ] **Step 12: Create `wrangler.toml`**

```toml
name = "frontera-finds"
main = "worker/src/index.ts"
compatibility_date = "2026-06-19"
compatibility_flags = ["nodejs_compat"]

# Vars (non-secret). Replace the contact values with the owner's real handles.
[vars]
AI_MODEL = "claude-opus-4-8"
PUBLIC_WHATSAPP = "+16199448759"
PUBLIC_SMS = "+16199448759"
PUBLIC_INSTAGRAM_URL = "https://instagram.com/REPLACE_ME"
OWNER_EMAIL = "kevincromley2020@gmail.com"

[[d1_databases]]
binding = "DB"
database_name = "frontera_finds"
database_id = "REPLACE_WITH_REAL_ID"
migrations_dir = "worker/migrations"

[[r2_buckets]]
binding = "PHOTOS"
bucket_name = "frontera-finds-photos"

[[send_email]]
name = "SEND_EMAIL"
destination_address = "kevincromley2020@gmail.com"

# Secrets (set via `wrangler secret put`, NOT here):
#   ANTHROPIC_API_KEY
#   ADMIN_PASSWORD
```

- [ ] **Step 13: Verify the Worker boots**

Run: `npx wrangler dev --config wrangler.toml --local --port 8787` in one terminal, then in another: `curl -s http://localhost:8787/api/health`
Expected: `{"ok":true}`. Stop the dev server (Ctrl-C) when confirmed.

> If `wrangler dev` complains about the missing `database_id`, that's expected before Task 1's `wrangler d1 create`. For this step only, temporarily comment out the `[[d1_databases]]` block, confirm health, then uncomment.

- [ ] **Step 14: Create `.gitignore` and commit**

```
node_modules
dist
.wrangler
.dev.vars
.DS_Store
```

```bash
git add -A
git commit -m "chore: scaffold Frontera Finds (vite + hono worker)"
```

---

## Task 1: D1 schema + provisioning

**Files:**
- Create: `worker/migrations/0001_init.sql`, `worker/src/db.ts`

- [ ] **Step 1: Create the migration `worker/migrations/0001_init.sql`**

```sql
CREATE TABLE items (
  id            TEXT PRIMARY KEY,
  title         TEXT NOT NULL,
  description   TEXT NOT NULL DEFAULT '',
  price_cents   INTEGER NOT NULL DEFAULT 0,
  category      TEXT NOT NULL DEFAULT 'misc',
  ships_usa     INTEGER NOT NULL DEFAULT 1,
  local_sdtj    INTEGER NOT NULL DEFAULT 1,
  status        TEXT NOT NULL DEFAULT 'published',  -- published | sold | hidden
  created_at    INTEGER NOT NULL,
  updated_at    INTEGER NOT NULL
);

CREATE TABLE item_photos (
  id          TEXT PRIMARY KEY,
  item_id     TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  r2_key      TEXT NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_items_status_created ON items(status, created_at DESC);
CREATE INDEX idx_item_photos_item ON item_photos(item_id, sort_order);
```

- [ ] **Step 2: Create the D1 database**

Run: `npx wrangler d1 create frontera_finds`
Expected: prints a `database_id`. Copy it into `wrangler.toml` (`database_id = "..."`).

- [ ] **Step 3: Apply the migration locally**

Run: `npm run db:apply:local`
Expected: "Migrations applied" with `0001_init.sql` listed.

- [ ] **Step 4: Create the row-shape type + mapper `worker/src/db.ts`**

```ts
export interface ItemRow {
  id: string;
  title: string;
  description: string;
  price_cents: number;
  category: string;
  ships_usa: number;
  local_sdtj: number;
  status: string;
  created_at: number;
  updated_at: number;
}

export interface Item {
  id: string;
  title: string;
  description: string;
  priceCents: number;
  category: string;
  shipsUsa: boolean;
  localSdtj: boolean;
  status: "published" | "sold" | "hidden";
  createdAt: number;
  updatedAt: number;
  photoKeys: string[];
}

export function rowToItem(row: ItemRow, photoKeys: string[]): Item {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    priceCents: row.price_cents,
    category: row.category,
    shipsUsa: row.ships_usa === 1,
    localSdtj: row.local_sdtj === 1,
    status: row.status as Item["status"],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    photoKeys,
  };
}
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(db): D1 schema for items + photos"
```

---

## Task 2: Worker test harness + Hono app shell

**Files:**
- Create: `worker/vitest.config.ts`, `worker/test/items.test.ts` (smoke)
- Modify: `worker/src/index.ts`

- [ ] **Step 1: Create `worker/vitest.config.ts`** (workers pool, applies migrations into the test D1)

```ts
import { defineWorkersConfig, readD1Migrations } from "@cloudflare/vitest-pool-workers/config";
import path from "node:path";

export default defineWorkersConfig(async () => {
  const migrations = await readD1Migrations(path.join(__dirname, "migrations"));
  return {
    test: {
      poolOptions: {
        workers: {
          singleWorker: true,
          miniflare: {
            compatibilityDate: "2026-06-19",
            compatibilityFlags: ["nodejs_compat"],
            d1Databases: ["DB"],
            r2Buckets: ["PHOTOS"],
            bindings: {
              TEST_MIGRATIONS: migrations,
              ADMIN_PASSWORD: "test-password",
              AI_MODEL: "claude-opus-4-8",
              ANTHROPIC_API_KEY: "test-key",
              PUBLIC_WHATSAPP: "+16199448759",
              PUBLIC_SMS: "+16199448759",
              PUBLIC_INSTAGRAM_URL: "https://instagram.com/test",
              OWNER_EMAIL: "owner@example.com",
            },
          },
        },
      },
    },
  };
});
```

- [ ] **Step 2: Create `worker/test/setup-db.ts`** (applies migrations before each test file)

```ts
import { env, applyD1Migrations } from "cloudflare:test";
import { beforeAll } from "vitest";

beforeAll(async () => {
  // TEST_MIGRATIONS is injected by vitest.config.ts via readD1Migrations.
  await applyD1Migrations(env.DB, (env as any).TEST_MIGRATIONS);
});
```

- [ ] **Step 3: Write a failing smoke test `worker/test/items.test.ts`**

```ts
import { env, createExecutionContext, waitOnExecutionContext } from "cloudflare:test";
import { describe, it, expect } from "vitest";
import "./setup-db";
import app from "../src/index";

describe("health", () => {
  it("responds ok", async () => {
    const ctx = createExecutionContext();
    const res = await app.fetch(new Request("http://x/api/health"), env, ctx);
    await waitOnExecutionContext(ctx);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });
});
```

- [ ] **Step 4: Run it (expect PASS for health — proves harness works)**

Run: `npm run test:worker`
Expected: PASS. If migrations error, fix `setup-db.ts` before continuing.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "test(worker): vitest workers pool + D1 migration harness"
```

---

## Task 3: Public item endpoints

**Files:**
- Create: `worker/src/items.ts`
- Modify: `worker/src/index.ts`
- Test: `worker/test/items.test.ts`

- [ ] **Step 1: Write failing tests — append to `worker/test/items.test.ts`**

```ts
import { rowToItem } from "../src/db";

async function seed() {
  const now = Date.now();
  await env.DB.prepare(
    `INSERT INTO items (id,title,description,price_cents,category,ships_usa,local_sdtj,status,created_at,updated_at)
     VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10)`
  ).bind("itm1", "Trek bike", "Nice bike", 12000, "bikes", 1, 1, "published", now, now).run();
  await env.DB.prepare(
    `INSERT INTO items (id,title,description,price_cents,category,ships_usa,local_sdtj,status,created_at,updated_at)
     VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10)`
  ).bind("itm2", "Hidden thing", "", 100, "misc", 1, 0, "hidden", now + 1, now + 1).run();
  await env.DB.prepare(
    `INSERT INTO item_photos (id,item_id,r2_key,sort_order) VALUES (?1,?2,?3,?4)`
  ).bind("ph1", "itm1", "items/itm1-a.jpg", 0).run();
}

describe("GET /api/items", () => {
  it("returns only published items with photo keys", async () => {
    await seed();
    const ctx = createExecutionContext();
    const res = await app.fetch(new Request("http://x/api/items"), env, ctx);
    await waitOnExecutionContext(ctx);
    expect(res.status).toBe(200);
    const body = await res.json<{ items: any[] }>();
    expect(body.items.map((i) => i.id)).toEqual(["itm1"]);
    expect(body.items[0].photoKeys).toEqual(["items/itm1-a.jpg"]);
    expect(body.items[0].shipsUsa).toBe(true);
  });

  it("filters by local pickup", async () => {
    await seed();
    const ctx = createExecutionContext();
    const res = await app.fetch(new Request("http://x/api/items?local=1"), env, ctx);
    await waitOnExecutionContext(ctx);
    const body = await res.json<{ items: any[] }>();
    expect(body.items.every((i) => i.localSdtj)).toBe(true);
  });
});

describe("GET /api/items/:id", () => {
  it("returns a single item", async () => {
    await seed();
    const ctx = createExecutionContext();
    const res = await app.fetch(new Request("http://x/api/items/itm1"), env, ctx);
    await waitOnExecutionContext(ctx);
    expect(res.status).toBe(200);
    expect((await res.json<{ item: any }>()).item.title).toBe("Trek bike");
  });

  it("404s unknown id", async () => {
    const ctx = createExecutionContext();
    const res = await app.fetch(new Request("http://x/api/items/nope"), env, ctx);
    await waitOnExecutionContext(ctx);
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

Run: `npm run test:worker`
Expected: FAIL (routes not defined → 404 for `/api/items`).

- [ ] **Step 3: Implement `worker/src/items.ts`** (public routes; admin routes added in Task 6)

```ts
import { Hono } from "hono";
import type { Env } from "./index";
import { rowToItem, type ItemRow } from "./db";

async function photoKeysFor(db: D1Database, itemIds: string[]): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  if (itemIds.length === 0) return map;
  const placeholders = itemIds.map((_, i) => `?${i + 1}`).join(",");
  const { results } = await db
    .prepare(`SELECT item_id, r2_key FROM item_photos WHERE item_id IN (${placeholders}) ORDER BY sort_order ASC`)
    .bind(...itemIds)
    .all<{ item_id: string; r2_key: string }>();
  for (const r of results) {
    const arr = map.get(r.item_id) ?? [];
    arr.push(r.r2_key);
    map.set(r.item_id, arr);
  }
  return map;
}

export const publicItems = new Hono<{ Bindings: Env }>();

publicItems.get("/api/items", async (c) => {
  const q = c.req.query("q")?.trim();
  const category = c.req.query("category")?.trim();
  const shipsUsa = c.req.query("ships") === "1";
  const local = c.req.query("local") === "1";
  const includeSold = c.req.query("sold") === "1";

  const where: string[] = [];
  const binds: unknown[] = [];
  where.push(includeSold ? "status IN ('published','sold')" : "status = 'published'");
  if (q) { binds.push(`%${q}%`); where.push(`(title LIKE ?${binds.length} OR description LIKE ?${binds.length})`); }
  if (category) { binds.push(category); where.push(`category = ?${binds.length}`); }
  if (shipsUsa) where.push("ships_usa = 1");
  if (local) where.push("local_sdtj = 1");

  const sql = `SELECT * FROM items WHERE ${where.join(" AND ")} ORDER BY created_at DESC LIMIT 200`;
  const { results } = await c.env.DB.prepare(sql).bind(...binds).all<ItemRow>();
  const keys = await photoKeysFor(c.env.DB, results.map((r) => r.id));
  return c.json({ items: results.map((r) => rowToItem(r, keys.get(r.id) ?? [])) });
});

publicItems.get("/api/items/:id", async (c) => {
  const id = c.req.param("id");
  const row = await c.env.DB.prepare(`SELECT * FROM items WHERE id = ?1`).bind(id).first<ItemRow>();
  if (!row) return c.json({ error: "not_found" }, 404);
  if (row.status === "hidden") return c.json({ error: "not_found" }, 404);
  const keys = await photoKeysFor(c.env.DB, [id]);
  return c.json({ item: rowToItem(row, keys.get(id) ?? []) });
});
```

- [ ] **Step 4: Mount it in `worker/src/index.ts`** (add below the health route)

```ts
import { publicItems } from "./items";
// ...
app.route("/", publicItems);
```

- [ ] **Step 5: Run tests to confirm they pass**

Run: `npm run test:worker`
Expected: PASS (health + all item tests).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(api): public item list + detail with filters"
```

---

## Task 4: Photo upload + serving (R2)

**Files:**
- Create: `worker/src/photos.ts`
- Modify: `worker/src/index.ts`
- Test: `worker/test/photos.test.ts`

> Upload is admin-gated; in this task we add the routes and a serve endpoint, and test the public serve path. The auth guard is applied in Task 6 when `requireAdmin` exists. For now, register upload under `/api/admin/...` but without the guard, and add the guard in Task 6 Step 5.

- [ ] **Step 1: Write failing test `worker/test/photos.test.ts`**

```ts
import { env, createExecutionContext, waitOnExecutionContext } from "cloudflare:test";
import { describe, it, expect } from "vitest";
import "./setup-db";
import app from "../src/index";

describe("GET /img/:key", () => {
  it("serves an uploaded object", async () => {
    await env.PHOTOS.put("items/test.jpg", new Uint8Array([1, 2, 3]), {
      httpMetadata: { contentType: "image/jpeg" },
    });
    const ctx = createExecutionContext();
    const res = await app.fetch(new Request("http://x/img/items/test.jpg"), env, ctx);
    await waitOnExecutionContext(ctx);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/jpeg");
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
  });

  it("404s a missing key", async () => {
    const ctx = createExecutionContext();
    const res = await app.fetch(new Request("http://x/img/items/missing.jpg"), env, ctx);
    await waitOnExecutionContext(ctx);
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `npm run test:worker`
Expected: FAIL (`/img/:key` not defined).

- [ ] **Step 3: Implement `worker/src/photos.ts`**

```ts
import { Hono } from "hono";
import type { Env } from "./index";

const EXT_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export const photos = new Hono<{ Bindings: Env }>();

// Serve an R2 object. ":key{.+}" captures slashes (e.g. items/abc.jpg).
photos.get("/img/:key{.+}", async (c) => {
  const key = c.req.param("key");
  const obj = await c.env.PHOTOS.get(key);
  if (!obj) return c.notFound();
  const headers = new Headers();
  headers.set("content-type", obj.httpMetadata?.contentType ?? "application/octet-stream");
  headers.set("cache-control", "public, max-age=31536000, immutable");
  headers.set("etag", obj.httpEtag);
  return new Response(obj.body, { headers });
});

// Upload one or more photos (multipart field name: "file", repeatable).
// Admin guard is applied where this is mounted (Task 6).
photos.post("/api/admin/upload", async (c) => {
  const form = await c.req.formData();
  const files = form.getAll("file").filter((f): f is File => f instanceof File);
  if (files.length === 0) return c.json({ error: "no_files" }, 400);

  const keys: string[] = [];
  for (const file of files) {
    const ext = EXT_BY_TYPE[file.type] ?? "bin";
    const key = `items/${crypto.randomUUID()}.${ext}`;
    await c.env.PHOTOS.put(key, file.stream(), {
      httpMetadata: { contentType: file.type || "application/octet-stream" },
    });
    keys.push(key);
  }
  return c.json({ keys });
});
```

- [ ] **Step 4: Mount in `worker/src/index.ts`**

```ts
import { photos } from "./photos";
// ...
app.route("/", photos);
```

- [ ] **Step 5: Run tests to confirm they pass**

Run: `npm run test:worker`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(api): R2 photo upload + serving"
```

---

## Task 5: Admin auth (password → signed token)

**Files:**
- Create: `worker/src/auth.ts`
- Test: `worker/test/auth.test.ts`

- [ ] **Step 1: Write failing test `worker/test/auth.test.ts`**

```ts
import { env, createExecutionContext, waitOnExecutionContext } from "cloudflare:test";
import { describe, it, expect } from "vitest";
import "./setup-db";
import app from "../src/index";
import { signToken, verifyToken } from "../src/auth";

describe("auth tokens", () => {
  it("round-trips a valid token", async () => {
    const t = await signToken("test-password", Date.now() + 60_000);
    expect(await verifyToken("test-password", t)).toBe(true);
  });

  it("rejects a token signed with the wrong password", async () => {
    const t = await signToken("wrong", Date.now() + 60_000);
    expect(await verifyToken("test-password", t)).toBe(false);
  });

  it("rejects an expired token", async () => {
    const t = await signToken("test-password", Date.now() - 1);
    expect(await verifyToken("test-password", t)).toBe(false);
  });
});

describe("POST /api/admin/login", () => {
  it("returns a token for the right password", async () => {
    const ctx = createExecutionContext();
    const res = await app.fetch(
      new Request("http://x/api/admin/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password: "test-password" }),
      }),
      env,
      ctx
    );
    await waitOnExecutionContext(ctx);
    expect(res.status).toBe(200);
    expect(typeof (await res.json<{ token: string }>()).token).toBe("string");
  });

  it("401s a wrong password", async () => {
    const ctx = createExecutionContext();
    const res = await app.fetch(
      new Request("http://x/api/admin/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password: "nope" }),
      }),
      env,
      ctx
    );
    await waitOnExecutionContext(ctx);
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `npm run test:worker`
Expected: FAIL (module `../src/auth` not found; login route missing).

- [ ] **Step 3: Implement `worker/src/auth.ts`** (HMAC-SHA256 over `{exp}`; secret = admin password)

```ts
import { Hono } from "hono";
import type { Env } from "./index";

const enc = new TextEncoder();

function b64urlEncode(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64urlDecode(str: string): Uint8Array {
  const s = str.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(s + "=".repeat((4 - (s.length % 4)) % 4));
  return Uint8Array.from(bin, (ch) => ch.charCodeAt(0));
}

async function hmac(password: string, data: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(password), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return new Uint8Array(sig);
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

export async function signToken(password: string, exp: number): Promise<string> {
  const payload = b64urlEncode(enc.encode(JSON.stringify({ exp })));
  const sig = b64urlEncode(await hmac(password, payload));
  return `${payload}.${sig}`;
}

export async function verifyToken(password: string, token: string): Promise<boolean> {
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return false;
  const expected = await hmac(password, payload);
  if (!timingSafeEqual(b64urlDecode(sig), expected)) return false;
  try {
    const { exp } = JSON.parse(new TextDecoder().decode(b64urlDecode(payload)));
    return typeof exp === "number" && exp > Date.now();
  } catch {
    return false;
  }
}

const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;

export const auth = new Hono<{ Bindings: Env }>();

auth.post("/api/admin/login", async (c) => {
  const { password } = await c.req.json<{ password?: string }>();
  if (!password || password !== c.env.ADMIN_PASSWORD) {
    return c.json({ error: "invalid_password" }, 401);
  }
  const token = await signToken(c.env.ADMIN_PASSWORD, Date.now() + SEVEN_DAYS);
  return c.json({ token });
});

// Middleware: require a valid Bearer token on admin write routes.
export async function requireAdmin(
  c: { env: Env; req: { header: (k: string) => string | undefined }; json: (b: unknown, s?: number) => Response },
  next: () => Promise<void>
): Promise<Response | void> {
  const header = c.req.header("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token || !(await verifyToken(c.env.ADMIN_PASSWORD, token))) {
    return c.json({ error: "unauthorized" }, 401);
  }
  await next();
}
```

- [ ] **Step 4: Mount login in `worker/src/index.ts`**

```ts
import { auth } from "./auth";
// ...
app.route("/", auth);
```

- [ ] **Step 5: Run tests to confirm they pass**

Run: `npm run test:worker`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(auth): admin login + HMAC token verify"
```

---

## Task 6: Admin item CRUD (guarded)

**Files:**
- Modify: `worker/src/items.ts`, `worker/src/photos.ts`, `worker/src/index.ts`
- Test: `worker/test/items.test.ts`

- [ ] **Step 1: Write failing tests — append to `worker/test/items.test.ts`**

```ts
import { signToken } from "../src/auth";

async function adminHeaders() {
  const token = await signToken("test-password", Date.now() + 60_000);
  return { authorization: `Bearer ${token}`, "content-type": "application/json" };
}

describe("admin item CRUD", () => {
  it("rejects create without a token", async () => {
    const ctx = createExecutionContext();
    const res = await app.fetch(
      new Request("http://x/api/admin/items", { method: "POST", body: "{}" }),
      env, ctx
    );
    await waitOnExecutionContext(ctx);
    expect(res.status).toBe(401);
  });

  it("creates, lists, marks sold, and deletes", async () => {
    const headers = await adminHeaders();

    // create
    let ctx = createExecutionContext();
    let res = await app.fetch(new Request("http://x/api/admin/items", {
      method: "POST", headers,
      body: JSON.stringify({
        title: "Lamp", description: "A lamp", priceCents: 2500,
        category: "home", shipsUsa: true, localSdtj: true,
        status: "published", photoKeys: ["items/lamp.jpg"],
      }),
    }), env, ctx);
    await waitOnExecutionContext(ctx);
    expect(res.status).toBe(200);
    const { id } = await res.json<{ id: string }>();
    expect(id).toBeTruthy();

    // it appears in the public list
    ctx = createExecutionContext();
    res = await app.fetch(new Request("http://x/api/items"), env, ctx);
    await waitOnExecutionContext(ctx);
    const list = await res.json<{ items: any[] }>();
    const created = list.items.find((i) => i.id === id);
    expect(created.photoKeys).toEqual(["items/lamp.jpg"]);

    // mark sold
    ctx = createExecutionContext();
    res = await app.fetch(new Request(`http://x/api/admin/items/${id}`, {
      method: "PATCH", headers, body: JSON.stringify({ status: "sold" }),
    }), env, ctx);
    await waitOnExecutionContext(ctx);
    expect(res.status).toBe(200);

    // delete
    ctx = createExecutionContext();
    res = await app.fetch(new Request(`http://x/api/admin/items/${id}`, {
      method: "DELETE", headers,
    }), env, ctx);
    await waitOnExecutionContext(ctx);
    expect(res.status).toBe(200);

    // gone from detail
    ctx = createExecutionContext();
    res = await app.fetch(new Request(`http://x/api/items/${id}`), env, ctx);
    await waitOnExecutionContext(ctx);
    expect(res.status).toBe(404);
  });

  it("lists all statuses for admin", async () => {
    const headers = await adminHeaders();
    const ctx = createExecutionContext();
    const res = await app.fetch(new Request("http://x/api/admin/items", { headers }), env, ctx);
    await waitOnExecutionContext(ctx);
    expect(res.status).toBe(200);
    expect(Array.isArray((await res.json<{ items: any[] }>()).items)).toBe(true);
  });
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `npm run test:worker`
Expected: FAIL (admin routes 404).

- [ ] **Step 3: Add admin routes to `worker/src/items.ts`** (append after `publicItems`)

```ts
import { requireAdmin } from "./auth";

interface ItemInput {
  title: string;
  description?: string;
  priceCents?: number;
  category?: string;
  shipsUsa?: boolean;
  localSdtj?: boolean;
  status?: "published" | "sold" | "hidden";
  photoKeys?: string[];
}

async function replacePhotos(db: D1Database, itemId: string, keys: string[]): Promise<void> {
  await db.prepare(`DELETE FROM item_photos WHERE item_id = ?1`).bind(itemId).run();
  for (let i = 0; i < keys.length; i++) {
    await db
      .prepare(`INSERT INTO item_photos (id,item_id,r2_key,sort_order) VALUES (?1,?2,?3,?4)`)
      .bind(crypto.randomUUID(), itemId, keys[i], i)
      .run();
  }
}

export const adminItems = new Hono<{ Bindings: Env }>();
adminItems.use("/api/admin/*", requireAdmin);

adminItems.get("/api/admin/items", async (c) => {
  const { results } = await c.env.DB
    .prepare(`SELECT * FROM items ORDER BY created_at DESC LIMIT 500`)
    .all<ItemRow>();
  const keys = await photoKeysFor(c.env.DB, results.map((r) => r.id));
  return c.json({ items: results.map((r) => rowToItem(r, keys.get(r.id) ?? [])) });
});

adminItems.post("/api/admin/items", async (c) => {
  const b = await c.req.json<ItemInput>();
  if (!b.title || !b.title.trim()) return c.json({ error: "title_required" }, 400);
  const id = crypto.randomUUID();
  const now = Date.now();
  await c.env.DB.prepare(
    `INSERT INTO items (id,title,description,price_cents,category,ships_usa,local_sdtj,status,created_at,updated_at)
     VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10)`
  ).bind(
    id, b.title.trim(), b.description ?? "", b.priceCents ?? 0, b.category ?? "misc",
    b.shipsUsa === false ? 0 : 1, b.localSdtj === false ? 0 : 1, b.status ?? "published", now, now
  ).run();
  await replacePhotos(c.env.DB, id, b.photoKeys ?? []);
  return c.json({ id });
});

adminItems.patch("/api/admin/items/:id", async (c) => {
  const id = c.req.param("id");
  const existing = await c.env.DB.prepare(`SELECT * FROM items WHERE id = ?1`).bind(id).first<ItemRow>();
  if (!existing) return c.json({ error: "not_found" }, 404);
  const b = await c.req.json<ItemInput>();
  await c.env.DB.prepare(
    `UPDATE items SET title=?2, description=?3, price_cents=?4, category=?5,
       ships_usa=?6, local_sdtj=?7, status=?8, updated_at=?9 WHERE id=?1`
  ).bind(
    id,
    b.title?.trim() ?? existing.title,
    b.description ?? existing.description,
    b.priceCents ?? existing.price_cents,
    b.category ?? existing.category,
    b.shipsUsa === undefined ? existing.ships_usa : b.shipsUsa ? 1 : 0,
    b.localSdtj === undefined ? existing.local_sdtj : b.localSdtj ? 1 : 0,
    b.status ?? existing.status,
    Date.now()
  ).run();
  if (b.photoKeys) await replacePhotos(c.env.DB, id, b.photoKeys);
  return c.json({ ok: true });
});

adminItems.delete("/api/admin/items/:id", async (c) => {
  const id = c.req.param("id");
  const { results } = await c.env.DB
    .prepare(`SELECT r2_key FROM item_photos WHERE item_id = ?1`).bind(id).all<{ r2_key: string }>();
  for (const r of results) await c.env.PHOTOS.delete(r.r2_key);
  await c.env.DB.prepare(`DELETE FROM item_photos WHERE item_id = ?1`).bind(id).run();
  await c.env.DB.prepare(`DELETE FROM items WHERE id = ?1`).bind(id).run();
  return c.json({ ok: true });
});
```

- [ ] **Step 4: Mount admin items in `worker/src/index.ts`**

```ts
import { adminItems } from "./items";
// ...
app.route("/", adminItems);
```

- [ ] **Step 5: Guard the upload route** — in `worker/src/photos.ts`, import and apply `requireAdmin`

```ts
import { requireAdmin } from "./auth";
// directly above photos.post("/api/admin/upload", ...):
photos.use("/api/admin/*", requireAdmin);
```

- [ ] **Step 6: Run tests to confirm they pass**

Run: `npm run test:worker`
Expected: PASS (all item + auth + photo tests).

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(api): guarded admin item CRUD + photo guard"
```

---

## Task 7: AI listing generator (Claude vision, structured outputs)

**Files:**
- Create: `worker/src/generate.ts`
- Modify: `worker/src/index.ts`
- Test: `worker/test/generate.test.ts`

> The endpoint takes already-uploaded R2 `keys`, reads the bytes, base64-encodes them, and asks Claude Opus 4.8 to return `{title, description, price_cents}` via `output_config.format` (structured outputs). Tests mock the Anthropic SDK so they don't hit the network.

- [ ] **Step 1: Write failing test `worker/test/generate.test.ts`**

```ts
import { env, createExecutionContext, waitOnExecutionContext } from "cloudflare:test";
import { describe, it, expect, vi } from "vitest";
import "./setup-db";
import { signToken } from "../src/auth";

// Mock the Anthropic SDK before importing the app.
vi.mock("@anthropic-ai/sdk", () => {
  class FakeAnthropic {
    messages = {
      create: vi.fn(async () => ({
        content: [
          {
            type: "text",
            text: JSON.stringify({
              title: "Vintage Desk Lamp",
              description: "A warm brass desk lamp in great condition.",
              price_cents: 3500,
            }),
          },
        ],
      })),
    };
    constructor(_opts: unknown) {}
  }
  return { default: FakeAnthropic };
});

const { default: app } = await import("../src/index");

async function adminHeaders() {
  const token = await signToken("test-password", Date.now() + 60_000);
  return { authorization: `Bearer ${token}`, "content-type": "application/json" };
}

describe("POST /api/admin/generate", () => {
  it("returns title, description, price from the photo", async () => {
    await env.PHOTOS.put("items/g.jpg", new Uint8Array([1, 2, 3]), {
      httpMetadata: { contentType: "image/jpeg" },
    });
    const headers = await adminHeaders();
    const ctx = createExecutionContext();
    const res = await app.fetch(new Request("http://x/api/admin/generate", {
      method: "POST", headers, body: JSON.stringify({ keys: ["items/g.jpg"] }),
    }), env, ctx);
    await waitOnExecutionContext(ctx);
    expect(res.status).toBe(200);
    const body = await res.json<{ title: string; description: string; priceCents: number }>();
    expect(body.title).toBe("Vintage Desk Lamp");
    expect(body.priceCents).toBe(3500);
  });

  it("requires auth", async () => {
    const ctx = createExecutionContext();
    const res = await app.fetch(new Request("http://x/api/admin/generate", {
      method: "POST", body: JSON.stringify({ keys: [] }),
    }), env, ctx);
    await waitOnExecutionContext(ctx);
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `npm run test:worker`
Expected: FAIL (generate route missing).

- [ ] **Step 3: Implement `worker/src/generate.ts`**

```ts
import { Hono } from "hono";
import Anthropic from "@anthropic-ai/sdk";
import type { Env } from "./index";
import { requireAdmin } from "./auth";

const MEDIA_BY_EXT: Record<string, "image/jpeg" | "image/png" | "image/webp" | "image/gif"> = {
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif",
};

const SYSTEM = `You write listings for a personal online yard sale (think eBay/Facebook Marketplace).
Look at the photo(s) and produce a concise, honest listing for a used item.
- title: short and specific (brand/model if visible), <= 80 chars, no emojis.
- description: 2-4 friendly sentences describing what it is, notable features, and visible condition. Do not invent flaws or specs you cannot see.
- price_cents: a fair used resale price in US cents (integer). Estimate from the item type and apparent condition.`;

function toBase64(bytes: Uint8Array): string {
  let s = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    s += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(s);
}

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: { type: "string" },
    description: { type: "string" },
    price_cents: { type: "integer" },
  },
  required: ["title", "description", "price_cents"],
} as const;

export const generate = new Hono<{ Bindings: Env }>();
generate.use("/api/admin/*", requireAdmin);

generate.post("/api/admin/generate", async (c) => {
  const { keys } = await c.req.json<{ keys: string[] }>();
  if (!keys || keys.length === 0) return c.json({ error: "no_keys" }, 400);

  const images: Anthropic.ImageBlockParam[] = [];
  for (const key of keys.slice(0, 4)) {
    const obj = await c.env.PHOTOS.get(key);
    if (!obj) continue;
    const ext = key.split(".").pop()?.toLowerCase() ?? "jpg";
    const media = MEDIA_BY_EXT[ext] ?? "image/jpeg";
    const bytes = new Uint8Array(await obj.arrayBuffer());
    images.push({ type: "image", source: { type: "base64", media_type: media, data: toBase64(bytes) } });
  }
  if (images.length === 0) return c.json({ error: "photos_not_found" }, 400);

  const client = new Anthropic({ apiKey: c.env.ANTHROPIC_API_KEY });
  try {
    const res = await client.messages.create({
      model: c.env.AI_MODEL || "claude-opus-4-8",
      max_tokens: 1024,
      thinking: { type: "adaptive" },
      system: SYSTEM,
      output_config: { format: { type: "json_schema", schema: SCHEMA } },
      messages: [
        { role: "user", content: [...images, { type: "text", text: "Write the listing for this item." }] },
      ],
    } as Anthropic.MessageCreateParamsNonStreaming);

    const textBlock = res.content.find((b): b is Anthropic.TextBlock => b.type === "text");
    if (!textBlock) return c.json({ error: "ai_no_output" }, 502);
    const parsed = JSON.parse(textBlock.text) as { title: string; description: string; price_cents: number };
    return c.json({
      title: parsed.title,
      description: parsed.description,
      priceCents: Math.max(0, Math.round(parsed.price_cents)),
    });
  } catch (err) {
    return c.json({ error: "ai_failed", detail: String(err) }, 502);
  }
});
```

- [ ] **Step 4: Mount in `worker/src/index.ts`**

```ts
import { generate } from "./generate";
// ...
app.route("/", generate);
```

- [ ] **Step 5: Run tests to confirm they pass**

Run: `npm run test:worker`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(api): AI listing generator (Claude vision, structured output)"
```

---

## Task 8: Contact form → email

**Files:**
- Create: `worker/src/contact.ts`
- Modify: `worker/src/index.ts`
- Test: `worker/test/contact.test.ts`

> Uses the Cloudflare `send_email` binding + `mimetext`. Tests inject a fake `SEND_EMAIL` binding via the request's `env` clone so no real mail is sent.

- [ ] **Step 1: Write failing test `worker/test/contact.test.ts`**

```ts
import { env, createExecutionContext, waitOnExecutionContext } from "cloudflare:test";
import { describe, it, expect, vi } from "vitest";
import "./setup-db";
import app from "../src/index";

describe("POST /api/items/:id/contact", () => {
  it("emails the owner and returns ok", async () => {
    const now = Date.now();
    await env.DB.prepare(
      `INSERT INTO items (id,title,description,price_cents,category,ships_usa,local_sdtj,status,created_at,updated_at)
       VALUES ('c1','Chair','',5000,'home',1,1,'published',?1,?1)`
    ).bind(now).run();

    const send = vi.fn(async () => {});
    const testEnv = { ...env, SEND_EMAIL: { send } } as unknown as typeof env;

    const ctx = createExecutionContext();
    const res = await app.fetch(new Request("http://x/api/items/c1/contact", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Buyer", message: "Is this available?" }),
    }), testEnv, ctx);
    await waitOnExecutionContext(ctx);

    expect(res.status).toBe(200);
    expect(send).toHaveBeenCalledOnce();
  });

  it("400s a blank message", async () => {
    const ctx = createExecutionContext();
    const res = await app.fetch(new Request("http://x/api/items/c1/contact", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Buyer", message: "" }),
    }), env, ctx);
    await waitOnExecutionContext(ctx);
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `npm run test:worker`
Expected: FAIL (contact route missing).

- [ ] **Step 3: Implement `worker/src/contact.ts`**

```ts
import { Hono } from "hono";
import { EmailMessage } from "cloudflare:email";
import { createMimeMessage } from "mimetext";
import type { Env } from "./index";
import type { ItemRow } from "./db";

export const contact = new Hono<{ Bindings: Env }>();

contact.post("/api/items/:id/contact", async (c) => {
  const id = c.req.param("id");
  const { name, message, replyTo } = await c.req.json<{ name?: string; message?: string; replyTo?: string }>();
  if (!message || !message.trim()) return c.json({ error: "message_required" }, 400);

  const item = await c.env.DB.prepare(`SELECT * FROM items WHERE id = ?1`).bind(id).first<ItemRow>();
  if (!item) return c.json({ error: "not_found" }, 404);

  const msg = createMimeMessage();
  msg.setSender({ name: "Frontera Finds", addr: c.env.OWNER_EMAIL });
  msg.setRecipient(c.env.OWNER_EMAIL);
  if (replyTo && /.+@.+\..+/.test(replyTo)) msg.setHeader("Reply-To", replyTo);
  msg.setSubject(`Frontera Finds inquiry: ${item.title}`);
  msg.addMessage({
    contentType: "text/plain",
    data:
      `New inquiry on "${item.title}" (id ${item.id})\n\n` +
      `From: ${name?.trim() || "Anonymous"}\n` +
      (replyTo ? `Reply-to: ${replyTo}\n` : "") +
      `\nMessage:\n${message.trim()}\n`,
  });

  try {
    const email = new EmailMessage(c.env.OWNER_EMAIL, c.env.OWNER_EMAIL, msg.asRaw());
    await c.env.SEND_EMAIL.send(email);
    return c.json({ ok: true });
  } catch (err) {
    return c.json({ error: "email_failed", detail: String(err) }, 502);
  }
});
```

- [ ] **Step 4: Add the `SendEmail` type to the Env** — in `worker/src/index.ts`, the `SEND_EMAIL` field already exists; add the ambient type by creating `worker/wrangler-types.d.ts`

```ts
// Minimal ambient declaration for the Cloudflare Email send binding.
interface SendEmail {
  send(message: import("cloudflare:email").EmailMessage): Promise<void>;
}
```

- [ ] **Step 5: Mount in `worker/src/index.ts`**

```ts
import { contact } from "./contact";
// ...
app.route("/", contact);
```

- [ ] **Step 6: Run tests to confirm they pass**

Run: `npm run test:worker`
Expected: PASS.

- [ ] **Step 7: Add a public config route** — buyers need the owner's WhatsApp/SMS/Instagram to build links. Add to `worker/src/index.ts` (below health):

```ts
app.get("/api/config", (c) =>
  c.json({
    whatsapp: c.env.PUBLIC_WHATSAPP,
    sms: c.env.PUBLIC_SMS,
    instagramUrl: c.env.PUBLIC_INSTAGRAM_URL,
  })
);
```

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(api): contact form email + public config route"
```

---

## Task 9: Frontend theme + shell

**Files:**
- Replace: `src/theme.css`, `src/App.tsx`
- Create: `src/lib/types.ts`, `src/lib/format.ts`, `src/lib/api.ts`

- [ ] **Step 1: Replace `src/theme.css`** (Deep Agave tokens + base + grid)

```css
:root {
  --ff-green: #1f6f54;
  --ff-green-dark: #1a5b45;
  --ff-sand: #fbf8f1;
  --ff-gold: #e8b94a;
  --ff-card: #ffffff;
  --ff-ink: #23201a;
  --ff-muted: #6b6452;
  --ff-line: #e8e2d2;
  color-scheme: light;
}
* { box-sizing: border-box; }
body {
  margin: 0;
  font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
  background: var(--ff-sand);
  color: var(--ff-ink);
}
a { color: var(--ff-green); }
.ff-header {
  background: var(--ff-green);
  color: #fff;
  padding: 12px 16px;
  display: flex; align-items: center; gap: 12px;
  position: sticky; top: 0; z-index: 10;
}
.ff-logo { font-weight: 800; letter-spacing: -0.3px; font-size: 20px; color: #fff; text-decoration: none; }
.ff-search { flex: 1; max-width: 560px; }
.ff-search input {
  width: 100%; height: 38px; border: none; border-radius: 19px;
  padding: 0 14px; font-size: 14px;
}
.ff-sell { background: var(--ff-gold); color: #3a2a06; font-weight: 700;
  border-radius: 16px; padding: 7px 14px; text-decoration: none; }
.ff-wrap { max-width: 1100px; margin: 0 auto; padding: 16px; }
.ff-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
@media (max-width: 800px) { .ff-grid { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 520px) { .ff-grid { grid-template-columns: 1fr; } }
.ff-card { background: var(--ff-card); border: 1px solid var(--ff-line);
  border-radius: 12px; overflow: hidden; text-decoration: none; color: inherit;
  display: flex; flex-direction: column; }
.ff-card-img { aspect-ratio: 1 / 1; background: #f0ead9; object-fit: cover; width: 100%; }
.ff-card-body { padding: 10px 12px; }
.ff-card-title { font-size: 14px; line-height: 1.3; }
.ff-price { font-weight: 800; color: var(--ff-green); margin-top: 4px; }
.ff-badges { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 6px; }
.ff-badge { font-size: 11px; padding: 2px 8px; border-radius: 10px; }
.ff-badge-ship { background: #e3efe1; color: var(--ff-green-dark); }
.ff-badge-local { background: #f6e4cf; color: #9c5320; }
.ff-sold-ribbon { background: var(--ff-ink); color: #fff; font-size: 11px;
  padding: 2px 8px; border-radius: 10px; }
.ff-btn { display: inline-flex; align-items: center; justify-content: center;
  gap: 8px; border: none; border-radius: 22px; padding: 11px 16px; font-size: 15px;
  font-weight: 700; cursor: pointer; text-decoration: none; }
.ff-btn-green { background: var(--ff-green); color: #fff; }
.ff-btn-outline { background: #fff; color: var(--ff-green); border: 1px solid var(--ff-green); }
.ff-field { display: block; margin: 10px 0; }
.ff-field label { display: block; font-size: 13px; color: var(--ff-muted); margin-bottom: 4px; }
.ff-field input, .ff-field textarea, .ff-field select {
  width: 100%; padding: 9px 11px; border: 1px solid var(--ff-line); border-radius: 8px; font-size: 15px;
}
.ff-footer { text-align: center; color: var(--ff-muted); font-size: 13px; padding: 28px 16px; }
```

- [ ] **Step 2: Create `src/lib/types.ts`**

```ts
export interface Item {
  id: string;
  title: string;
  description: string;
  priceCents: number;
  category: string;
  shipsUsa: boolean;
  localSdtj: boolean;
  status: "published" | "sold" | "hidden";
  createdAt: number;
  updatedAt: number;
  photoKeys: string[];
}

export interface SiteConfig {
  whatsapp: string;
  sms: string;
  instagramUrl: string;
}
```

- [ ] **Step 3: Create `src/lib/format.ts`**

```ts
export function money(cents: number): string {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}
export function imgUrl(key: string): string {
  return `/img/${key}`;
}
```

- [ ] **Step 4: Create `src/lib/api.ts`** (public + admin fetch helpers; token in localStorage)

```ts
import type { Item, SiteConfig } from "./types";

const TOKEN_KEY = "ff_admin_token";
export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t: string) => localStorage.setItem(TOKEN_KEY, t);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? `http_${res.status}`);
  return res.json() as Promise<T>;
}

export const api = {
  config: () => fetch("/api/config").then((r) => json<SiteConfig>(r)),
  list: (params: URLSearchParams) => fetch(`/api/items?${params}`).then((r) => json<{ items: Item[] }>(r)),
  get: (id: string) => fetch(`/api/items/${id}`).then((r) => json<{ item: Item }>(r)),
  contact: (id: string, body: { name?: string; message: string; replyTo?: string }) =>
    fetch(`/api/items/${id}/contact`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
    }).then((r) => json<{ ok: true }>(r)),
};

function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return { ...extra, authorization: `Bearer ${getToken() ?? ""}` };
}

export const adminApi = {
  login: (password: string) =>
    fetch("/api/admin/login", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password }),
    }).then((r) => json<{ token: string }>(r)),
  listAll: () => fetch("/api/admin/items", { headers: authHeaders() }).then((r) => json<{ items: Item[] }>(r)),
  upload: (files: File[]) => {
    const fd = new FormData();
    for (const f of files) fd.append("file", f);
    return fetch("/api/admin/upload", { method: "POST", headers: authHeaders(), body: fd })
      .then((r) => json<{ keys: string[] }>(r));
  },
  generate: (keys: string[]) =>
    fetch("/api/admin/generate", {
      method: "POST", headers: authHeaders({ "content-type": "application/json" }), body: JSON.stringify({ keys }),
    }).then((r) => json<{ title: string; description: string; priceCents: number }>(r)),
  create: (body: Partial<Item>) =>
    fetch("/api/admin/items", {
      method: "POST", headers: authHeaders({ "content-type": "application/json" }), body: JSON.stringify(body),
    }).then((r) => json<{ id: string }>(r)),
  update: (id: string, body: Partial<Item>) =>
    fetch(`/api/admin/items/${id}`, {
      method: "PATCH", headers: authHeaders({ "content-type": "application/json" }), body: JSON.stringify(body),
    }).then((r) => json<{ ok: true }>(r)),
  remove: (id: string) =>
    fetch(`/api/admin/items/${id}`, { method: "DELETE", headers: authHeaders() }).then((r) => json<{ ok: true }>(r)),
};
```

- [ ] **Step 5: Replace `src/App.tsx`** (router + header/footer shell)

```tsx
import { Link, Route, Routes, useNavigate, useSearchParams } from "react-router-dom";
import { useState } from "react";
import Home from "./pages/Home";
import ItemPage from "./pages/ItemPage";
import About from "./pages/About";
import AdminLogin from "./pages/admin/AdminLogin";
import AdminManage from "./pages/admin/AdminManage";
import AdminEdit from "./pages/admin/AdminEdit";

function Header() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  return (
    <header className="ff-header">
      <Link to="/" className="ff-logo">Frontera Finds</Link>
      <form
        className="ff-search"
        onSubmit={(e) => { e.preventDefault(); navigate(`/?q=${encodeURIComponent(q)}`); }}
      >
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar / Search items…" />
      </form>
      <Link to="/admin" className="ff-sell">Sell</Link>
    </header>
  );
}

export default function App() {
  return (
    <>
      <Header />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/item/:id" element={<ItemPage />} />
        <Route path="/about" element={<About />} />
        <Route path="/admin" element={<AdminLogin />} />
        <Route path="/admin/manage" element={<AdminManage />} />
        <Route path="/admin/new" element={<AdminEdit />} />
        <Route path="/admin/edit/:id" element={<AdminEdit />} />
      </Routes>
      <footer className="ff-footer">
        Frontera Finds · Shipping across the USA · Local pickup &amp; delivery in San Diego / Tijuana ·{" "}
        <Link to="/about">How it works</Link>
      </footer>
    </>
  );
}
```

- [ ] **Step 6: Type-check the frontend**

Run: `npx tsc -b`
Expected: errors only for the not-yet-created page modules (Home, ItemPage, etc.). That's fine — they're built in Tasks 10–13. Do **not** commit yet if you want a clean build; otherwise commit and proceed.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(web): theme tokens, app shell, api client"
```

---

## Task 10: Home grid + filters + shared components

**Files:**
- Create: `src/components/Badges.tsx`, `src/components/ItemCard.tsx`, `src/pages/Home.tsx`

- [ ] **Step 1: Create `src/components/Badges.tsx`**

```tsx
import type { Item } from "../lib/types";

export default function Badges({ item }: { item: Item }) {
  return (
    <div className="ff-badges">
      {item.status === "sold" && <span className="ff-sold-ribbon">SOLD</span>}
      {item.shipsUsa && <span className="ff-badge ff-badge-ship">Ships USA</span>}
      {item.localSdtj && <span className="ff-badge ff-badge-local">Local · SD/TJ</span>}
    </div>
  );
}
```

- [ ] **Step 2: Create `src/components/ItemCard.tsx`**

```tsx
import { Link } from "react-router-dom";
import type { Item } from "../lib/types";
import { money, imgUrl } from "../lib/format";
import Badges from "./Badges";

export default function ItemCard({ item }: { item: Item }) {
  return (
    <Link to={`/item/${item.id}`} className="ff-card">
      <img
        className="ff-card-img"
        src={item.photoKeys[0] ? imgUrl(item.photoKeys[0]) : ""}
        alt={item.title}
        loading="lazy"
      />
      <div className="ff-card-body">
        <div className="ff-card-title">{item.title}</div>
        <div className="ff-price">{money(item.priceCents)}</div>
        <Badges item={item} />
      </div>
    </Link>
  );
}
```

- [ ] **Step 3: Create `src/pages/Home.tsx`**

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

  useEffect(() => {
    setLoading(true);
    api.list(params)
      .then((r) => { setItems(r.items); setError(null); })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [params]);

  function toggle(key: "ships" | "local") {
    const next = new URLSearchParams(params);
    if (next.get(key) === "1") next.delete(key);
    else next.set(key, "1");
    setParams(next);
  }

  return (
    <main className="ff-wrap">
      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        <button className={ships ? "ff-btn ff-btn-green" : "ff-btn ff-btn-outline"} onClick={() => toggle("ships")}>
          Ships USA
        </button>
        <button className={local ? "ff-btn ff-btn-green" : "ff-btn ff-btn-outline"} onClick={() => toggle("local")}>
          Local pickup / delivery
        </button>
      </div>

      {loading && <p>Loading…</p>}
      {error && <p style={{ color: "#a50e0e" }}>Couldn’t load items: {error}</p>}
      {!loading && !error && items.length === 0 && <p>No items yet — check back soon.</p>}

      <div className="ff-grid">
        {items.map((it) => <ItemCard key={it.id} item={it} />)}
      </div>
    </main>
  );
}
```

- [ ] **Step 4: Run the app and verify the grid renders**

Run (two terminals): `npm run dev:worker` and `npm run dev`. Then verify via the preview workflow:
- `preview_start` (or reload), then `preview_console_logs` for errors, then `preview_snapshot` of `http://localhost:5173`.
Expected: header with "Frontera Finds", the two filter buttons, and "No items yet" (empty DB) — no console errors.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(web): home grid, filters, item card, badges"
```

---

## Task 11: Item page + contact buttons

**Files:**
- Create: `src/components/ContactButtons.tsx`, `src/pages/ItemPage.tsx`

- [ ] **Step 1: Create `src/components/ContactButtons.tsx`** (WhatsApp / SMS / form / Instagram)

```tsx
import { useEffect, useState } from "react";
import { api } from "../lib/api";
import type { Item, SiteConfig } from "../lib/types";
import { money } from "../lib/format";

function waLink(phone: string, text: string): string {
  const digits = phone.replace(/[^\d]/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}
function smsLink(phone: string, text: string): string {
  return `sms:${phone}?&body=${encodeURIComponent(text)}`;
}

export default function ContactButtons({ item }: { item: Item }) {
  const [cfg, setCfg] = useState<SiteConfig | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [replyTo, setReplyTo] = useState("");
  const [message, setMessage] = useState(`Hi! Is "${item.title}" still available?`);
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => { api.config().then(setCfg).catch(() => setCfg(null)); }, []);

  const pitch = `Hi! I'm interested in "${item.title}" (${money(item.priceCents)}) on Frontera Finds: ${location.origin}/item/${item.id}`;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    try {
      await api.contact(item.id, { name, message, replyTo });
      setSent(true);
    } catch (e2) {
      setErr("Couldn’t send — please try WhatsApp or text instead.");
    }
  }

  return (
    <div style={{ display: "grid", gap: 10, marginTop: 16 }}>
      {cfg && (
        <>
          <a className="ff-btn ff-btn-green" href={waLink(cfg.whatsapp, pitch)} target="_blank" rel="noreferrer">
            WhatsApp
          </a>
          <a className="ff-btn ff-btn-outline" href={smsLink(cfg.sms, pitch)}>Text / SMS</a>
          {cfg.instagramUrl && (
            <a className="ff-btn ff-btn-outline" href={cfg.instagramUrl} target="_blank" rel="noreferrer">
              Instagram DM
            </a>
          )}
        </>
      )}
      <button className="ff-btn ff-btn-outline" onClick={() => setShowForm((s) => !s)}>
        Message the seller
      </button>

      {showForm && !sent && (
        <form onSubmit={submit} style={{ border: "1px solid var(--ff-line)", borderRadius: 10, padding: 12 }}>
          <div className="ff-field">
            <label>Your name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="ff-field">
            <label>Your email (so the seller can reply)</label>
            <input value={replyTo} onChange={(e) => setReplyTo(e.target.value)} type="email" />
          </div>
          <div className="ff-field">
            <label>Message</label>
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3} />
          </div>
          {err && <p style={{ color: "#a50e0e" }}>{err}</p>}
          <button className="ff-btn ff-btn-green" type="submit">Send</button>
        </form>
      )}
      {sent && <p style={{ color: "var(--ff-green-dark)" }}>Sent! The seller will get back to you.</p>}
    </div>
  );
}
```

- [ ] **Step 2: Create `src/pages/ItemPage.tsx`**

```tsx
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../lib/api";
import type { Item } from "../lib/types";
import { money, imgUrl } from "../lib/format";
import Badges from "../components/Badges";
import ContactButtons from "../components/ContactButtons";

export default function ItemPage() {
  const { id } = useParams();
  const [item, setItem] = useState<Item | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    api.get(id).then((r) => setItem(r.item)).catch(() => setError("Item not found."));
  }, [id]);

  if (error) return <main className="ff-wrap"><p>{error}</p></main>;
  if (!item) return <main className="ff-wrap"><p>Loading…</p></main>;

  return (
    <main className="ff-wrap" style={{ maxWidth: 760 }}>
      <div style={{ display: "grid", gap: 10 }}>
        {item.photoKeys.map((k) => (
          <img key={k} src={imgUrl(k)} alt={item.title} style={{ width: "100%", borderRadius: 12 }} />
        ))}
        {item.photoKeys.length === 0 && <div className="ff-card-img" style={{ borderRadius: 12 }} />}
      </div>
      <h1 style={{ marginBottom: 4 }}>{item.title}</h1>
      <div className="ff-price" style={{ fontSize: 24 }}>{money(item.priceCents)}</div>
      <Badges item={item} />
      <p style={{ whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{item.description}</p>
      {item.status === "sold"
        ? <p style={{ fontWeight: 700 }}>This item has been sold.</p>
        : <ContactButtons item={item} />}
    </main>
  );
}
```

- [ ] **Step 3: Verify in the browser** (create a test item via the admin in Task 13, or temporarily insert one with `wrangler d1 execute`)

Run a one-off seed for visual check:
`npx wrangler d1 execute frontera_finds --local --command "INSERT INTO items (id,title,description,price_cents,category,ships_usa,local_sdtj,status,created_at,updated_at) VALUES ('demo','Demo Bike','A nice demo bike.',12000,'bikes',1,1,'published',1718900000000,1718900000000)"`
Then reload the preview, open `/item/demo`, and `preview_snapshot`.
Expected: photos area, title, price, badges, and the WhatsApp/SMS/Message/Instagram buttons. `preview_click` "Message the seller" → the form appears.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(web): item detail page + contact buttons"
```

---

## Task 12: About / Shipping page

**Files:**
- Create: `src/pages/About.tsx`

- [ ] **Step 1: Create `src/pages/About.tsx`**

```tsx
export default function About() {
  return (
    <main className="ff-wrap" style={{ maxWidth: 720 }}>
      <h1>How Frontera Finds works</h1>
      <p style={{ lineHeight: 1.6 }}>
        This is my personal yard sale — everything here is mine, priced to move.
      </p>
      <h3>Shipping across the USA 🇺🇸</h3>
      <p style={{ lineHeight: 1.6 }}>
        Most items can ship anywhere in the United States. Message me with your ZIP and I’ll
        confirm shipping before you pay.
      </p>
      <h3>Local pickup &amp; delivery — San Diego / Tijuana 🌵</h3>
      <p style={{ lineHeight: 1.6 }}>
        In San Diego or Tijuana? Skip shipping — arrange free local pickup, or local delivery
        on bigger items. Just tap WhatsApp or text on any listing.
      </p>
      <h3>How to buy</h3>
      <p style={{ lineHeight: 1.6 }}>
        There’s no checkout here. Find something you like, hit <strong>WhatsApp</strong>,{" "}
        <strong>Text</strong>, <strong>Message the seller</strong>, or <strong>Instagram</strong>,
        and we’ll sort out payment (cash, Venmo, Zelle) and handoff directly.
      </p>
    </main>
  );
}
```

- [ ] **Step 2: Verify** — reload preview, open `/about`, `preview_snapshot`. Expected: the three sections render.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat(web): about / shipping page"
```

---

## Task 13: Admin — login, manage, add/edit with AI button

**Files:**
- Create: `src/pages/admin/AdminLogin.tsx`, `src/pages/admin/AdminManage.tsx`, `src/pages/admin/AdminEdit.tsx`

- [ ] **Step 1: Create `src/pages/admin/AdminLogin.tsx`**

```tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { adminApi, getToken, setToken } from "../../lib/api";

export default function AdminLogin() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (getToken()) navigate("/admin/manage");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const { token } = await adminApi.login(password);
      setToken(token);
      navigate("/admin/manage");
    } catch {
      setError("Wrong password.");
    }
  }

  return (
    <main className="ff-wrap" style={{ maxWidth: 360 }}>
      <h1>Seller login</h1>
      <form onSubmit={submit}>
        <div className="ff-field">
          <label>Password</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus />
        </div>
        {error && <p style={{ color: "#a50e0e" }}>{error}</p>}
        <button className="ff-btn ff-btn-green" type="submit">Log in</button>
      </form>
    </main>
  );
}
```

- [ ] **Step 2: Create `src/pages/admin/AdminManage.tsx`**

```tsx
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { adminApi, clearToken, getToken } from "../../lib/api";
import type { Item } from "../../lib/types";
import { money, imgUrl } from "../../lib/format";

export default function AdminManage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<Item[]>([]);
  const [error, setError] = useState<string | null>(null);

  function load() {
    adminApi.listAll()
      .then((r) => setItems(r.items))
      .catch((e) => {
        if (String(e).includes("unauthorized")) { clearToken(); navigate("/admin"); }
        else setError(String(e));
      });
  }
  useEffect(() => {
    if (!getToken()) { navigate("/admin"); return; }
    load();
  }, []);

  async function setStatus(it: Item, status: Item["status"]) {
    await adminApi.update(it.id, { status });
    load();
  }
  async function remove(it: Item) {
    if (!confirm(`Delete "${it.title}"?`)) return;
    await adminApi.remove(it.id);
    load();
  }

  return (
    <main className="ff-wrap">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1>Your items</h1>
        <div style={{ display: "flex", gap: 8 }}>
          <Link className="ff-btn ff-btn-green" to="/admin/new">+ New item</Link>
          <button className="ff-btn ff-btn-outline" onClick={() => { clearToken(); navigate("/admin"); }}>
            Log out
          </button>
        </div>
      </div>
      {error && <p style={{ color: "#a50e0e" }}>{error}</p>}
      <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
        {items.map((it) => (
          <div key={it.id} style={{ display: "flex", gap: 12, alignItems: "center",
            border: "1px solid var(--ff-line)", borderRadius: 10, padding: 8, background: "#fff" }}>
            <img src={it.photoKeys[0] ? imgUrl(it.photoKeys[0]) : ""} alt=""
              style={{ width: 56, height: 56, objectFit: "cover", borderRadius: 8, background: "#f0ead9" }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700 }}>{it.title}</div>
              <div style={{ color: "var(--ff-muted)", fontSize: 13 }}>
                {money(it.priceCents)} · {it.status}
              </div>
            </div>
            <Link className="ff-btn ff-btn-outline" to={`/admin/edit/${it.id}`}>Edit</Link>
            {it.status !== "sold"
              ? <button className="ff-btn ff-btn-outline" onClick={() => setStatus(it, "sold")}>Mark sold</button>
              : <button className="ff-btn ff-btn-outline" onClick={() => setStatus(it, "published")}>Relist</button>}
            <button className="ff-btn ff-btn-outline" onClick={() => remove(it)}>Delete</button>
          </div>
        ))}
        {items.length === 0 && <p>No items yet. Tap “New item” to add your first.</p>}
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Create `src/pages/admin/AdminEdit.tsx`** (upload photos → ✨ AI button → edit → save)

```tsx
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { adminApi, getToken } from "../../lib/api";
import type { Item } from "../../lib/types";
import { imgUrl } from "../../lib/format";

export default function AdminEdit() {
  const navigate = useNavigate();
  const { id } = useParams();
  const editing = Boolean(id);

  const [photoKeys, setPhotoKeys] = useState<string[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priceDollars, setPriceDollars] = useState("");
  const [category, setCategory] = useState("misc");
  const [shipsUsa, setShipsUsa] = useState(true);
  const [localSdtj, setLocalSdtj] = useState(true);
  const [status, setStatus] = useState<Item["status"]>("published");

  const [uploading, setUploading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!getToken()) { navigate("/admin"); return; }
    if (editing && id) {
      fetch(`/api/items/${id}`).then((r) => r.json()).then(({ item }: { item: Item }) => {
        setPhotoKeys(item.photoKeys); setTitle(item.title); setDescription(item.description);
        setPriceDollars((item.priceCents / 100).toString()); setCategory(item.category);
        setShipsUsa(item.shipsUsa); setLocalSdtj(item.localSdtj); setStatus(item.status);
      }).catch(() => setError("Couldn’t load item."));
    }
  }, [id]);

  async function onFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    setUploading(true); setError(null);
    try {
      const { keys } = await adminApi.upload(files);
      setPhotoKeys((prev) => [...prev, ...keys]);
    } catch { setError("Upload failed."); }
    finally { setUploading(false); }
  }

  async function runAI() {
    if (photoKeys.length === 0) { setError("Add a photo first."); return; }
    setGenerating(true); setError(null);
    try {
      const g = await adminApi.generate(photoKeys);
      setTitle(g.title); setDescription(g.description); setPriceDollars((g.priceCents / 100).toString());
    } catch { setError("AI couldn’t generate — fill it in manually."); }
    finally { setGenerating(false); }
  }

  async function save() {
    setError(null);
    const body: Partial<Item> = {
      title, description,
      priceCents: Math.round(parseFloat(priceDollars || "0") * 100),
      category, shipsUsa, localSdtj, status, photoKeys,
    };
    try {
      if (editing && id) await adminApi.update(id, body);
      else await adminApi.create(body);
      navigate("/admin/manage");
    } catch (e) { setError(String(e)); }
  }

  return (
    <main className="ff-wrap" style={{ maxWidth: 560 }}>
      <h1>{editing ? "Edit item" : "New item"}</h1>

      <div className="ff-field">
        <label>Photos</label>
        <input type="file" accept="image/*" multiple onChange={onFiles} />
        {uploading && <p>Uploading…</p>}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
          {photoKeys.map((k) => (
            <img key={k} src={imgUrl(k)} alt="" style={{ width: 72, height: 72, objectFit: "cover", borderRadius: 8 }} />
          ))}
        </div>
      </div>

      <button className="ff-btn ff-btn-green" onClick={runAI} disabled={generating || photoKeys.length === 0}>
        {generating ? "✨ Generating…" : "✨ Generate with AI"}
      </button>

      {error && <p style={{ color: "#a50e0e" }}>{error}</p>}

      <div className="ff-field"><label>Title</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
      <div className="ff-field"><label>Description</label>
        <textarea rows={4} value={description} onChange={(e) => setDescription(e.target.value)} /></div>
      <div className="ff-field"><label>Price (USD)</label>
        <input value={priceDollars} onChange={(e) => setPriceDollars(e.target.value)} inputMode="decimal" /></div>
      <div className="ff-field"><label>Category</label>
        <input value={category} onChange={(e) => setCategory(e.target.value)} /></div>

      <label style={{ display: "flex", gap: 8, alignItems: "center", margin: "8px 0" }}>
        <input type="checkbox" checked={shipsUsa} onChange={(e) => setShipsUsa(e.target.checked)} /> Ships USA
      </label>
      <label style={{ display: "flex", gap: 8, alignItems: "center", margin: "8px 0" }}>
        <input type="checkbox" checked={localSdtj} onChange={(e) => setLocalSdtj(e.target.checked)} /> Local pickup / delivery (SD/TJ)
      </label>

      <div className="ff-field"><label>Status</label>
        <select value={status} onChange={(e) => setStatus(e.target.value as Item["status"])}>
          <option value="published">Published</option>
          <option value="hidden">Hidden</option>
          <option value="sold">Sold</option>
        </select>
      </div>

      <button className="ff-btn ff-btn-green" onClick={save}>{editing ? "Save changes" : "Publish"}</button>
    </main>
  );
}
```

- [ ] **Step 4: Full end-to-end browser verification** (the AI button needs a real `ANTHROPIC_API_KEY` in dev)

Create `.dev.vars` in the repo root (gitignored) with:
```
ANTHROPIC_API_KEY=sk-ant-...
ADMIN_PASSWORD=choose-a-dev-password
```
Restart `npm run dev:worker`. Then with both servers running, verify via preview:
1. `preview` to `/admin`, `preview_fill` the password, `preview_click` Log in.
2. On `/admin/new`, `preview` cannot upload a local file — instead confirm the page renders and the **✨ Generate with AI** button is disabled until a photo exists (`preview_snapshot`).
3. Manually upload a photo in a real browser tab, click **✨ Generate with AI**, and confirm title/description/price populate; check `preview_network` shows `POST /api/admin/generate` returning 200.
4. Publish, then confirm the item appears on `/` and `/admin/manage`.

Expected: AI fills the fields; the item publishes and shows on the home grid with correct badges.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(web): admin login, manage, and add/edit with AI button"
```

---

## Task 14: Full worker test pass, build, and deploy notes

**Files:**
- Create: `README.md`

- [ ] **Step 1: Run the full Worker test suite**

Run: `npm run test:worker`
Expected: PASS — all of items/auth/photos/generate/contact.

- [ ] **Step 2: Production type-check + build**

Run: `npm run build`
Expected: `tsc -b` clean, `vite build` emits `dist/`.

- [ ] **Step 3: Write `README.md`** with setup + deploy steps

```markdown
# Frontera Finds

A personal "yard sale on the internet" — single-seller, eBay-style catalog.
Buyers browse and contact to buy (WhatsApp / SMS / form→email / Instagram).
The owner manages listings from a private admin with an AI button (Claude
Opus 4.8 vision) that turns a photo into a title, description, and price.

## Develop
```bash
npm install
npm run dev:worker   # worker on :8787
npm run dev          # frontend on :5173
npm run test:worker  # worker tests
```
Create `.dev.vars` (gitignored): `ANTHROPIC_API_KEY=...` and `ADMIN_PASSWORD=...`.

## One-time Cloudflare setup
```bash
wrangler d1 create frontera_finds          # paste id into wrangler.toml
wrangler r2 bucket create frontera-finds-photos
npm run db:apply                           # apply migrations to remote D1
wrangler secret put ANTHROPIC_API_KEY
wrangler secret put ADMIN_PASSWORD
```
Set up Cloudflare Email Routing so the `SEND_EMAIL` destination (the owner's
email) is verified; edit `[[send_email]] destination_address` and `OWNER_EMAIL`
in `wrangler.toml`. Update `PUBLIC_INSTAGRAM_URL` to the real handle.

## Deploy
```bash
npm run deploy   # builds frontend + deploys worker
```
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "docs: README with setup + deploy; final build pass"
```

---

## Self-Review notes (for the implementer)

- **Email "from" address:** Cloudflare's `send_email` binding can only send to the verified destination; we send *from* and *to* `OWNER_EMAIL` and set `Reply-To` to the buyer. If the owner later wants buyer-facing sending, that needs Cloudflare Email Sending (a separate product) — out of scope for v1.
- **AI cost/latency:** `generate` runs Opus 4.8 with adaptive thinking and `max_tokens: 1024`; one call per "Generate" click. If cost matters later, drop thinking or switch model via the `AI_MODEL` var — no code change.
- **Auth model:** the token is HMAC'd with the admin password, so rotating `ADMIN_PASSWORD` invalidates all existing tokens (acceptable for a single-user admin).
- **`output_config.format` + `thinking`:** structured outputs are supported on Opus 4.8 and compose with adaptive thinking; the response's text block contains the schema-valid JSON we parse.
```
