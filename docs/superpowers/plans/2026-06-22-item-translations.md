# Bilingual Item Content Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Translate seller-entered item titles/descriptions into EN+ES on save (via the existing Claude integration), store them in D1, backfill existing items, and display the active language instantly on toggle.

**Architecture:** New D1 columns (`title_en/title_es/description_en/description_es`) filled by a `translate.ts` worker module that mirrors `generate.ts`. Create/update handlers translate on save (status-only updates skip it). A batched admin `translate-all` endpoint backfills. The frontend keeps the raw item and picks the active language client-side via a `localizeItem` helper — instant on toggle, with fallback to raw text for un-translated items.

**Tech Stack:** Cloudflare Worker (Hono) + D1, `@anthropic-ai/sdk` (`claude-opus-4-8`), React 18 + TypeScript + Vite, Vitest (`@cloudflare/vitest-pool-workers` for worker tests; node env for frontend helper test).

---

## Task 1: Migration + DB types/mapping

**Files:**
- Create: `worker/migrations/0003_translations.sql`
- Modify: `worker/src/db.ts`
- Test: `worker/test/translations-read.test.ts`

- [ ] **Step 1: Create the migration `worker/migrations/0003_translations.sql`**

```sql
-- Bilingual item content. Existing title/description remain the seller's raw input
-- and the display fallback; these hold Claude-generated EN/ES versions (NULL until filled).
ALTER TABLE items ADD COLUMN title_en TEXT;
ALTER TABLE items ADD COLUMN title_es TEXT;
ALTER TABLE items ADD COLUMN description_en TEXT;
ALTER TABLE items ADD COLUMN description_es TEXT;
```

- [ ] **Step 2: Write the failing read test `worker/test/translations-read.test.ts`**

```ts
import { env, createExecutionContext, waitOnExecutionContext } from "cloudflare:test";
import { describe, it, expect } from "vitest";
import "./setup-db";

const { default: app } = await import("../src/index");

describe("translation columns on read", () => {
  it("GET /api/items/:id returns localized fields, falling back to raw when null", async () => {
    const now = Date.now();
    // Row WITH translations
    await env.DB.prepare(
      `INSERT INTO items (id,slug,title,description,price_cents,category,ships_usa,local_sdtj,status,created_at,updated_at,title_en,title_es,description_en,description_es)
       VALUES ('t1','t1','Bike','A red bike',5000,'misc',1,1,'published',?1,?1,'Bike','Bicicleta','A red bike','Una bici roja')`
    ).bind(now).run();
    // Legacy row WITHOUT translations (NULL)
    await env.DB.prepare(
      `INSERT INTO items (id,slug,title,description,price_cents,category,ships_usa,local_sdtj,status,created_at,updated_at)
       VALUES ('t2','t2','Lamp','A lamp',2000,'misc',1,1,'published',?1,?1)`
    ).bind(now).run();

    const ctx = createExecutionContext();
    const res = await app.fetch(new Request("http://x/api/items/t1"), env, ctx);
    await waitOnExecutionContext(ctx);
    expect(res.status).toBe(200);
    const { item } = await res.json<{ item: any }>();
    expect(item.titleEs).toBe("Bicicleta");
    expect(item.descriptionEs).toBe("Una bici roja");
    expect(item.titleEn).toBe("Bike");

    const ctx2 = createExecutionContext();
    const res2 = await app.fetch(new Request("http://x/api/items/t2"), env, ctx2);
    await waitOnExecutionContext(ctx2);
    const { item: legacy } = await res2.json<{ item: any }>();
    expect(legacy.titleEs).toBeNull();
    expect(legacy.title).toBe("Lamp");
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npm run test:worker -- worker/test/translations-read.test.ts`
Expected: FAIL — `item.titleEs` is undefined (rowToItem doesn't map the columns yet).

- [ ] **Step 4: Update `worker/src/db.ts`**

Replace the entire file with:

```ts
export interface ItemRow {
  id: string;
  slug: string | null;
  title: string;
  description: string;
  price_cents: number;
  category: string;
  ships_usa: number;
  local_sdtj: number;
  status: string;
  created_at: number;
  updated_at: number;
  title_en: string | null;
  title_es: string | null;
  description_en: string | null;
  description_es: string | null;
}

export interface Item {
  id: string;
  slug: string;
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
  titleEn: string | null;
  titleEs: string | null;
  descriptionEn: string | null;
  descriptionEs: string | null;
}

export function rowToItem(row: ItemRow, photoKeys: string[]): Item {
  return {
    id: row.id,
    slug: row.slug ?? row.id, // fall back to id for rows created before slugs existed
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
    titleEn: row.title_en ?? null,
    titleEs: row.title_es ?? null,
    descriptionEn: row.description_en ?? null,
    descriptionEs: row.description_es ?? null,
  };
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm run test:worker -- worker/test/translations-read.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add worker/migrations/0003_translations.sql worker/src/db.ts worker/test/translations-read.test.ts
git commit -m "feat(items): add bilingual columns and map them on read"
```

---

## Task 2: Translation module

**Files:**
- Create: `worker/src/translate.ts`
- Test: `worker/test/translate.test.ts`

- [ ] **Step 1: Write the failing test `worker/test/translate.test.ts`**

```ts
import { env } from "cloudflare:test";
import { describe, it, expect, vi } from "vitest";

vi.mock("@anthropic-ai/sdk", () => {
  class FakeAnthropic {
    messages = {
      create: vi.fn(async () => ({
        content: [
          {
            type: "text",
            text: JSON.stringify({
              title_en: "Red Bike",
              title_es: "Bicicleta Roja",
              description_en: "A nice red bike.",
              description_es: "Una linda bici roja.",
            }),
          },
        ],
      })),
    };
    constructor(_opts: unknown) {}
  }
  return { default: FakeAnthropic };
});

const { translateListing } = await import("../src/translate");

describe("translateListing", () => {
  it("returns clean EN and ES title/description", async () => {
    const out = await translateListing(env as any, "bici roja", "una linda bici roja");
    expect(out.title_en).toBe("Red Bike");
    expect(out.title_es).toBe("Bicicleta Roja");
    expect(out.description_en).toBe("A nice red bike.");
    expect(out.description_es).toBe("Una linda bici roja.");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test:worker -- worker/test/translate.test.ts`
Expected: FAIL — cannot resolve `../src/translate`.

- [ ] **Step 3: Implement `worker/src/translate.ts`**

```ts
import Anthropic from "@anthropic-ai/sdk";
import type { Env } from "./index";

export interface Translations {
  title_en: string;
  title_es: string;
  description_en: string;
  description_es: string;
}

const SYSTEM = `You translate listings for a bilingual San Diego–Tijuana online yard sale.
You are given a listing title and description that may be written in English, Spanish, or a mix.
Produce clean, natural versions in BOTH English and Spanish.
- Preserve meaning, brand/model names, sizes, and measurements exactly. Do not invent details.
- Keep titles concise (<= 80 chars), no emojis.
- Match the original tone (friendly, plain).
- If a field is empty, return an empty string for both languages of that field.`;

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    title_en: { type: "string" },
    title_es: { type: "string" },
    description_en: { type: "string" },
    description_es: { type: "string" },
  },
  required: ["title_en", "title_es", "description_en", "description_es"],
} as const;

// Generate bilingual title/description from whatever the seller typed. Throws if the
// model returns no usable JSON (callers fall back to the raw text — see safeTranslate).
export async function translateListing(
  env: Env,
  title: string,
  description: string,
): Promise<Translations> {
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

  // The installed SDK types don't model `output_config`/`thinking:{type:"adaptive"}`;
  // build params as `any` so they pass through (same approach as generate.ts).
  const params: any = {
    model: env.AI_MODEL || "claude-opus-4-8",
    max_tokens: 4000,
    system: SYSTEM,
    output_config: { format: { type: "json_schema", schema: SCHEMA } },
    messages: [
      {
        role: "user",
        content: [{ type: "text", text: `Title: ${title}\n\nDescription: ${description}` }],
      },
    ],
  };

  const res = await client.messages.create(params);
  const textBlock = res.content.find((b: any) => b.type === "text");
  if (!textBlock) throw new Error("translate_no_output");
  const parsed = JSON.parse(textBlock.text) as Translations;
  return {
    title_en: parsed.title_en ?? "",
    title_es: parsed.title_es ?? "",
    description_en: parsed.description_en ?? "",
    description_es: parsed.description_es ?? "",
  };
}

// Never throws. On any failure, falls back to the raw text in both languages so a
// save/backfill always proceeds.
export async function safeTranslate(
  env: Env,
  title: string,
  description: string,
): Promise<Translations> {
  try {
    return await translateListing(env, title, description);
  } catch {
    return {
      title_en: title,
      title_es: title,
      description_en: description,
      description_es: description,
    };
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test:worker -- worker/test/translate.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add worker/src/translate.ts worker/test/translate.test.ts
git commit -m "feat(items): add Claude translation module for listings"
```

---

## Task 3: Translate on create/update

**Files:**
- Modify: `worker/src/items.ts`
- Modify: `worker/test/items.test.ts`

- [ ] **Step 1: Add the Anthropic mock to `worker/test/items.test.ts`**

At the very top of `worker/test/items.test.ts`, BEFORE the `const { default: app } = await import(...)` line (and before any other import of the app), the file currently starts with imports then imports the app. Add the mock immediately after the existing `import` statements and before the app import. The mock returns a superset JSON so it serves both the generate and translate code paths:

```ts
import { vi } from "vitest";

vi.mock("@anthropic-ai/sdk", () => {
  class FakeAnthropic {
    messages = {
      create: vi.fn(async () => ({
        content: [
          {
            type: "text",
            text: JSON.stringify({
              title: "Mock Title",
              description: "Mock description.",
              price_cents: 1000,
              title_en: "Mock EN",
              title_es: "Mock ES",
              description_en: "Mock desc EN",
              description_es: "Mock desc ES",
            }),
          },
        ],
      })),
    };
    constructor(_opts: unknown) {}
  }
  return { default: FakeAnthropic };
});
```

Note: if `items.test.ts` already imports `vi` from "vitest", do not add a duplicate import — just add the `vi.mock(...)` block. `vi.mock` is hoisted, so placement among imports is fine, but keep it before the `await import("../src/index")`.

- [ ] **Step 2: Add create/update translation assertions to `worker/test/items.test.ts`**

Add these tests inside the existing top-level `describe` (or as a new `describe`) in `worker/test/items.test.ts`. Use the file's existing `adminHeaders()` helper and `app`/`env`/`createExecutionContext`/`waitOnExecutionContext` imports (already present):

```ts
describe("item translation on save", () => {
  it("POST stores bilingual columns; GET returns them", async () => {
    const headers = await adminHeaders();
    const ctx = createExecutionContext();
    const res = await app.fetch(new Request("http://x/api/admin/items", {
      method: "POST", headers,
      body: JSON.stringify({ title: "bici roja", description: "una bici" }),
    }), env, ctx);
    await waitOnExecutionContext(ctx);
    expect(res.status).toBe(200);
    const { id } = await res.json<{ id: string }>();

    const ctx2 = createExecutionContext();
    const got = await app.fetch(new Request(`http://x/api/items/${id}`), env, ctx2);
    await waitOnExecutionContext(ctx2);
    const { item } = await got.json<{ item: any }>();
    expect(item.titleEn).toBe("Mock EN");
    expect(item.titleEs).toBe("Mock ES");
    expect(item.descriptionEs).toBe("Mock desc ES");
  });

  it("status-only PATCH succeeds and preserves translations", async () => {
    const headers = await adminHeaders();
    const ctx = createExecutionContext();
    const res = await app.fetch(new Request("http://x/api/admin/items", {
      method: "POST", headers, body: JSON.stringify({ title: "Thing", description: "d" }),
    }), env, ctx);
    await waitOnExecutionContext(ctx);
    const { id } = await res.json<{ id: string }>();

    const ctx2 = createExecutionContext();
    const patch = await app.fetch(new Request(`http://x/api/admin/items/${id}`, {
      method: "PATCH", headers, body: JSON.stringify({ status: "sold" }),
    }), env, ctx2);
    await waitOnExecutionContext(ctx2);
    expect(patch.status).toBe(200);

    const ctx3 = createExecutionContext();
    const got = await app.fetch(new Request(`http://x/api/admin/items`, { headers }), env, ctx3);
    await waitOnExecutionContext(ctx3);
    const { items } = await got.json<{ items: any[] }>();
    const it = items.find((x) => x.id === id);
    expect(it.status).toBe("sold");
    expect(it.titleEs).toBe("Mock ES");
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npm run test:worker -- worker/test/items.test.ts`
Expected: FAIL — `item.titleEn` is undefined (handlers don't write the columns yet).

- [ ] **Step 4: Wire translation into `worker/src/items.ts`**

Add the import after the existing `import { uniqueSlug } from "./slug";` line:

```ts
import { safeTranslate } from "./translate";
```

Replace the create handler (the whole `adminItems.post("/api/admin/items", ...)` block) with:

```ts
adminItems.post("/api/admin/items", async (c) => {
  const b = await c.req.json<ItemInput>();
  if (!b.title || !b.title.trim()) return c.json({ error: "title_required" }, 400);
  const id = crypto.randomUUID();
  const slug = await uniqueSlug(c.env.DB, b.title.trim());
  const now = Date.now();
  const title = b.title.trim();
  const description = b.description ?? "";
  const tr = await safeTranslate(c.env, title, description);
  await c.env.DB.prepare(
    `INSERT INTO items (id,slug,title,description,price_cents,category,ships_usa,local_sdtj,status,created_at,updated_at,title_en,title_es,description_en,description_es)
     VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15)`
  ).bind(
    id, slug, title, description, b.priceCents ?? 0, b.category ?? "misc",
    b.shipsUsa === false ? 0 : 1, b.localSdtj === false ? 0 : 1, b.status ?? "published", now, now,
    tr.title_en, tr.title_es, tr.description_en, tr.description_es
  ).run();
  await replacePhotos(c.env.DB, id, b.photoKeys ?? []);
  return c.json({ id, slug });
});
```

Replace the update handler (the whole `adminItems.patch("/api/admin/items/:id", ...)` block) with:

```ts
adminItems.patch("/api/admin/items/:id", async (c) => {
  const id = c.req.param("id");
  const existing = await c.env.DB.prepare(`SELECT * FROM items WHERE id = ?1`).bind(id).first<ItemRow>();
  if (!existing) return c.json({ error: "not_found" }, 404);
  const b = await c.req.json<ItemInput>();
  // Slug is stable once set; only generate one for legacy rows that never had it.
  const slug = existing.slug ?? (await uniqueSlug(c.env.DB, b.title?.trim() ?? existing.title));
  const title = b.title?.trim() ?? existing.title;
  const description = b.description ?? existing.description;

  // Only call Claude when the text actually changed (or translations were never made).
  // A status-only PATCH (e.g. "Mark sold") must not incur a translation cost.
  const titleChanged = b.title !== undefined && b.title.trim() !== existing.title;
  const descChanged = b.description !== undefined && b.description !== existing.description;
  const needsTranslation = titleChanged || descChanged || existing.title_en == null;
  const tr = needsTranslation
    ? await safeTranslate(c.env, title, description)
    : {
        title_en: existing.title_en ?? title,
        title_es: existing.title_es ?? title,
        description_en: existing.description_en ?? description,
        description_es: existing.description_es ?? description,
      };

  await c.env.DB.prepare(
    `UPDATE items SET slug=?10, title=?2, description=?3, price_cents=?4, category=?5,
       ships_usa=?6, local_sdtj=?7, status=?8, updated_at=?9,
       title_en=?11, title_es=?12, description_en=?13, description_es=?14 WHERE id=?1`
  ).bind(
    id,
    title,
    description,
    b.priceCents ?? existing.price_cents,
    b.category ?? existing.category,
    b.shipsUsa === undefined ? existing.ships_usa : b.shipsUsa ? 1 : 0,
    b.localSdtj === undefined ? existing.local_sdtj : b.localSdtj ? 1 : 0,
    b.status ?? existing.status,
    Date.now(),
    slug,
    tr.title_en, tr.title_es, tr.description_en, tr.description_es
  ).run();
  if (b.photoKeys) await replacePhotos(c.env.DB, id, b.photoKeys);
  return c.json({ ok: true });
});
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm run test:worker -- worker/test/items.test.ts`
Expected: PASS (existing item tests + the two new ones).

- [ ] **Step 6: Commit**

```bash
git add worker/src/items.ts worker/test/items.test.ts
git commit -m "feat(items): translate title/description on create and edit"
```

---

## Task 4: Backfill endpoint

**Files:**
- Modify: `worker/src/items.ts`
- Test: `worker/test/translate-all.test.ts`

- [ ] **Step 1: Write the failing test `worker/test/translate-all.test.ts`**

```ts
import { env, createExecutionContext, waitOnExecutionContext } from "cloudflare:test";
import { describe, it, expect, vi } from "vitest";
import "./setup-db";
import { signToken } from "../src/auth";

vi.mock("@anthropic-ai/sdk", () => {
  class FakeAnthropic {
    messages = {
      create: vi.fn(async () => ({
        content: [{ type: "text", text: JSON.stringify({
          title_en: "EN", title_es: "ES", description_en: "dEN", description_es: "dES",
        }) }],
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

describe("POST /api/admin/translate-all", () => {
  it("fills NULL translation columns and reports progress", async () => {
    const now = Date.now();
    await env.DB.prepare(
      `INSERT INTO items (id,slug,title,description,price_cents,category,ships_usa,local_sdtj,status,created_at,updated_at)
       VALUES ('b1','b1','Old','old desc',1,'misc',1,1,'published',?1,?1)`
    ).bind(now).run();

    const headers = await adminHeaders();
    const ctx = createExecutionContext();
    const res = await app.fetch(new Request("http://x/api/admin/translate-all", { method: "POST", headers }), env, ctx);
    await waitOnExecutionContext(ctx);
    expect(res.status).toBe(200);
    const body = await res.json<{ translated: number; remaining: number; done: boolean }>();
    expect(body.translated).toBeGreaterThanOrEqual(1);

    const row = await env.DB.prepare(`SELECT title_es FROM items WHERE id='b1'`).first<{ title_es: string }>();
    expect(row?.title_es).toBe("ES");
  });

  it("requires auth", async () => {
    const ctx = createExecutionContext();
    const res = await app.fetch(new Request("http://x/api/admin/translate-all", { method: "POST" }), env, ctx);
    await waitOnExecutionContext(ctx);
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test:worker -- worker/test/translate-all.test.ts`
Expected: FAIL — route returns 404 (not implemented).

- [ ] **Step 3: Add the backfill route to `worker/src/items.ts`**

Add this handler immediately AFTER the `adminItems.get("/api/admin/items", ...)` handler (it's covered by the existing `adminItems.use("/api/admin/items/*", requireAdmin)` guard since the path starts with `/api/admin/`... but to be safe, add an explicit guard). First add the guard line right after the existing `adminItems.use("/api/admin/items/*", requireAdmin);` line:

```ts
adminItems.use("/api/admin/translate-all", requireAdmin);
```

Then add the handler (place it after the admin list handler):

```ts
const TRANSLATE_BATCH = 5;

adminItems.post("/api/admin/translate-all", async (c) => {
  const { results } = await c.env.DB
    .prepare(`SELECT * FROM items WHERE title_en IS NULL ORDER BY created_at ASC LIMIT ?1`)
    .bind(TRANSLATE_BATCH)
    .all<ItemRow>();

  let translated = 0;
  for (const row of results) {
    const tr = await safeTranslate(c.env, row.title, row.description);
    await c.env.DB.prepare(
      `UPDATE items SET title_en=?2, title_es=?3, description_en=?4, description_es=?5, updated_at=updated_at WHERE id=?1`
    ).bind(row.id, tr.title_en, tr.title_es, tr.description_en, tr.description_es).run();
    translated++;
  }

  const rest = await c.env.DB
    .prepare(`SELECT COUNT(*) AS n FROM items WHERE title_en IS NULL`)
    .first<{ n: number }>();
  const remaining = rest?.n ?? 0;
  return c.json({ translated, remaining, done: remaining === 0 });
});
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test:worker -- worker/test/translate-all.test.ts`
Expected: PASS (both cases).

- [ ] **Step 5: Commit**

```bash
git add worker/src/items.ts worker/test/translate-all.test.ts
git commit -m "feat(items): add batched translate-all backfill endpoint"
```

---

## Task 5: API client + admin backfill button

**Files:**
- Modify: `src/lib/api.ts`
- Modify: `src/pages/admin/AdminManage.tsx`

- [ ] **Step 1: Add the client method in `src/lib/api.ts`**

Inside the `adminApi` object, add after the `remove: (...)` entry (keep the trailing comma rules valid):

```ts
  translateAll: () =>
    fetch("/api/admin/translate-all", { method: "POST", headers: authHeaders() })
      .then((r) => json<{ translated: number; remaining: number; done: boolean }>(r)),
```

(Place it before the closing `};` of `adminApi`. Ensure the preceding `remove` line ends with a comma.)

- [ ] **Step 2: Add the "Translate all items" button to `src/pages/admin/AdminManage.tsx`**

Add a state hook inside `AdminManage()` after the existing `const [error, setError] = useState<string | null>(null);`:

```tsx
  const [xlating, setXlating] = useState<string | null>(null);
```

Add this handler after the existing `remove` function:

```tsx
  async function translateAll() {
    setXlating("Translating…");
    try {
      // Backfill is batched server-side; loop until the server reports done.
      // Cap iterations as a safety net against an unexpected non-decreasing remaining.
      for (let i = 0; i < 1000; i++) {
        const r = await adminApi.translateAll();
        if (r.done) { setXlating(`Done — all items translated.`); break; }
        setXlating(`Translating… ${r.remaining} left`);
      }
      load();
    } catch (e) {
      setXlating(null);
      setError(String(e));
    }
  }
```

In the header actions `<div style={{ display: "flex", gap: 8 }}>`, add a button before the "Log out" button:

```tsx
          <button className="ff-btn ff-btn-outline" onClick={translateAll} disabled={!!xlating && !xlating.startsWith("Done")}>
            {xlating ?? "Translate all items"}
          </button>
```

- [ ] **Step 3: Typecheck / build**

Run: `npx tsc -b`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/lib/api.ts src/pages/admin/AdminManage.tsx
git commit -m "feat(admin): add Translate all items backfill button"
```

---

## Task 6: Frontend types + localize helper (TDD)

**Files:**
- Modify: `src/lib/types.ts`
- Create: `src/lib/localize.ts`
- Test: `src/lib/localize.test.ts`

- [ ] **Step 1: Extend `src/lib/types.ts`**

Add the four optional fields to the `Item` interface (after `photoKeys: string[];`):

```ts
  titleEn?: string | null;
  titleEs?: string | null;
  descriptionEn?: string | null;
  descriptionEs?: string | null;
```

- [ ] **Step 2: Write the failing test `src/lib/localize.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { pickText, localizeItem } from "./localize";
import type { Item } from "./types";

const base: Item = {
  id: "1", slug: "1", title: "Bike", description: "A bike",
  priceCents: 100, category: "misc", shipsUsa: true, localSdtj: true,
  status: "published", createdAt: 0, updatedAt: 0, photoKeys: [],
  titleEn: "Bike", titleEs: "Bicicleta", descriptionEn: "A bike", descriptionEs: "Una bici",
};

describe("pickText", () => {
  it("picks Spanish in es mode", () => {
    expect(pickText(base, "title", "es")).toBe("Bicicleta");
    expect(pickText(base, "description", "es")).toBe("Una bici");
  });
  it("picks English in en mode", () => {
    expect(pickText(base, "title", "en")).toBe("Bike");
  });
  it("falls back to raw when the translation is missing", () => {
    const legacy = { ...base, titleEs: null, titleEn: undefined };
    expect(pickText(legacy, "title", "es")).toBe("Bike");
    expect(pickText(legacy, "title", "en")).toBe("Bike");
  });
});

describe("localizeItem", () => {
  it("swaps title/description to the active language", () => {
    const es = localizeItem(base, "es");
    expect(es.title).toBe("Bicicleta");
    expect(es.description).toBe("Una bici");
    // Raw fields remain available
    expect(es.titleEn).toBe("Bike");
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run src/lib/localize.test.ts`
Expected: FAIL — cannot resolve `./localize`.

- [ ] **Step 4: Implement `src/lib/localize.ts`**

```ts
import type { Item } from "./types";
import type { Lang } from "../i18n/translate";

// Pick the active-language text for a translatable field, falling back to the raw
// seller-entered value when the translation is missing (legacy / un-backfilled items).
export function pickText(item: Item, field: "title" | "description", lang: Lang): string {
  const translated = lang === "es" ? item[`${field}Es`] : item[`${field}En`];
  return translated ?? item[field];
}

// Return a shallow copy of the item with title/description swapped to the active language.
export function localizeItem(item: Item, lang: Lang): Item {
  return {
    ...item,
    title: pickText(item, "title", lang),
    description: pickText(item, "description", lang),
  };
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/lib/localize.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/types.ts src/lib/localize.ts src/lib/localize.test.ts
git commit -m "feat(items): add client-side localize helper for item text"
```

---

## Task 7: Consume localized text in Home + ItemPage

**Files:**
- Modify: `src/pages/Home.tsx`
- Modify: `src/pages/ItemPage.tsx`

- [ ] **Step 1: Localize the grid in `src/pages/Home.tsx`**

Add the import after the existing `import { useLang } from "../i18n/LanguageContext";` line:

```tsx
import { localizeItem } from "../lib/localize";
```

Change the existing `const { t } = useLang();` line to also pull `lang`:

```tsx
  const { t, lang } = useLang();
```

In the grid render, the current line is:

```tsx
        {items.map((it) => <ItemCard key={it.id} item={it} />)}
```

Replace it with:

```tsx
        {items.map((it) => <ItemCard key={it.id} item={localizeItem(it, lang)} />)}
```

- [ ] **Step 2: Localize the detail view in `src/pages/ItemPage.tsx`**

Add the import after the existing `import { useLang } from "../i18n/LanguageContext";` line:

```tsx
import { localizeItem } from "../lib/localize";
```

Change the existing `const { t } = useLang();` line to:

```tsx
  const { t, lang } = useLang();
```

The component currently keeps the fetched item in `item` state and renders it after two guards:

```tsx
  if (error) return <main className="ff-wrap"><p>{error}</p></main>;
  if (!item) return <main className="ff-wrap"><p>{t("common.loading")}</p></main>;

  return (
    <main className="ff-wrap" style={{ maxWidth: 760 }}>
      <Gallery photoKeys={item.photoKeys} title={item.title} />
```

Introduce a localized view right after the guards and use it everywhere the raw `item` text was rendered. Replace the block from the `if (!item) ...` guard through the end of the `return (...)` with:

```tsx
  if (error) return <main className="ff-wrap"><p>{error}</p></main>;
  if (!item) return <main className="ff-wrap"><p>{t("common.loading")}</p></main>;

  const view = localizeItem(item, lang);

  return (
    <main className="ff-wrap" style={{ maxWidth: 760 }}>
      <Gallery photoKeys={view.photoKeys} title={view.title} />
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4, flexWrap: "wrap" }}>
        <h1 style={{ margin: 0 }}>{view.title}</h1>
        {view.status === "sold" && <span className="ff-badge-sold">{t("badge.sold")}</span>}
      </div>
      <div className="ff-price" style={{ fontSize: 24 }}>{money(view.priceCents)}</div>
      <Badges item={view} />
      <p style={{ whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{view.description}</p>
      {view.status === "sold"
        ? <p style={{ fontWeight: 700 }}>{t("item.soldNotice")}</p>
        : <ContactButtons item={view} />}
    </main>
  );
```

(This preserves the exact structure/styles from Task-7 of the prior i18n work — only the `item` references become `view`, and `ContactButtons`/`Badges`/`Gallery` now receive the localized item so the WhatsApp pitch and default message use the active-language title.)

- [ ] **Step 3: Typecheck / build**

Run: `npx tsc -b`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/pages/Home.tsx src/pages/ItemPage.tsx
git commit -m "feat(items): display item text in the active language"
```

---

## Task 8: Full build, worker tests, verification

**Files:** none (verification only)

- [ ] **Step 1: Frontend helper test**

Run: `npx vitest run src/lib/localize.test.ts src/i18n/translate.test.ts`
Expected: PASS.

- [ ] **Step 2: Full worker test suite**

Run: `npm run test:worker`
Expected: PASS (existing suites + translate, translate-all, translations-read, and the new items tests).

- [ ] **Step 3: Production build**

Run: `npm run build`
Expected: `tsc -b` clean + `vite build` completes.

- [ ] **Step 4: Manual verification notes (report to user; requires deploy + secrets)**

The translation calls require `ANTHROPIC_API_KEY` (already a deployed secret for the
existing "Generate with AI" feature). To verify end to end:
- `npm run deploy` (ships worker + applies migration via `migrations_dir`), and/or
  `npm run db:apply` to apply migration 0003 to remote D1.
- In admin → Manage, click **Translate all items**; watch it count down to "Done".
- Toggle the site to Spanish and confirm item titles/descriptions switch language on the
  home grid and an item page; toggle back to English. New items created via admin should
  be bilingual automatically; a status-only "Mark sold" must not lag (no Claude call).

- [ ] **Step 5: Final commit (if any tweaks)**

```bash
git add -A
git commit -m "chore(items): finalize bilingual item content"
```

---

## Self-Review Notes
- **Spec coverage:** migration + columns (T1), translate module + safeTranslate (T2),
  translate-on-create/update with status-only skip (T3), batched backfill endpoint (T4),
  client + admin button (T5), types + localize helper (T6), Home/ItemPage consumption (T7),
  verification + deploy notes (T8). ✓
- **Cost guard:** status-only PATCH skips Claude (T3 `needsTranslation`). ✓
- **Resilience:** `safeTranslate` falls back to raw text; `pickText` falls back to raw
  `title`/`description` for un-translated rows. ✓
- **Test isolation:** each worker test file defines its own hoisted `vi.mock` for the
  SDK; items.test.ts mock returns a superset JSON serving both generate + translate. ✓
- **Type consistency:** `Translations` ({title_en,title_es,description_en,description_es}),
  `safeTranslate`/`translateListing`, `pickText(item, field, lang)`, `localizeItem(item, lang)`,
  `Lang` from `../i18n/translate`, `adminApi.translateAll()` used consistently across tasks. ✓
