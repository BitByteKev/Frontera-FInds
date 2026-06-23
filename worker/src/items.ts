import { Hono } from "hono";
import type { Env } from "./index";
import { rowToItem, type ItemRow } from "./db";
import { requireAdmin } from "./auth";
import { uniqueSlug } from "./slug";
import { safeTranslate } from "./translate";

const MAX_LIST = 200;

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

publicItems.get("/api/items/:idOrSlug", async (c) => {
  const idOrSlug = c.req.param("idOrSlug");
  const row = await c.env.DB
    .prepare(`SELECT * FROM items WHERE slug = ?1 OR id = ?1`)
    .bind(idOrSlug)
    .first<ItemRow>();
  if (!row) return c.json({ error: "not_found" }, 404);
  if (row.status === "hidden") return c.json({ error: "not_found" }, 404);
  const keys = await photoKeysFor(c.env.DB, [row.id]);
  return c.json({ item: rowToItem(row, keys.get(row.id) ?? []) });
});

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
adminItems.use("/api/admin/items", requireAdmin);
adminItems.use("/api/admin/items/*", requireAdmin);
adminItems.use("/api/admin/translate-all", requireAdmin);

adminItems.get("/api/admin/items", async (c) => {
  const { results } = await c.env.DB
    .prepare(`SELECT * FROM items ORDER BY created_at DESC LIMIT 500`)
    .all<ItemRow>();
  const keys = await photoKeysFor(c.env.DB, results.map((r) => r.id));
  return c.json({ items: results.map((r) => rowToItem(r, keys.get(r.id) ?? [])) });
});

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
      `UPDATE items SET title_en=?2, title_es=?3, description_en=?4, description_es=?5 WHERE id=?1`
    ).bind(row.id, tr.title_en, tr.title_es, tr.description_en, tr.description_es).run();
    translated++;
  }

  const rest = await c.env.DB
    .prepare(`SELECT COUNT(*) AS n FROM items WHERE title_en IS NULL`)
    .first<{ n: number }>();
  const remaining = rest?.n ?? 0;
  return c.json({ translated, remaining, done: remaining === 0 });
});

adminItems.post("/api/admin/items", async (c) => {
  const b = await c.req.json<ItemInput>();
  if (!b.title || !b.title.trim()) return c.json({ error: "title_required" }, 400);
  const id = crypto.randomUUID();
  const slug = await uniqueSlug(c.env.DB, b.title.trim());
  const now = Date.now();
  const createStatus = b.status ?? "published";
  const createSoldAt = createStatus === "sold" ? now : null;
  const title = b.title.trim();
  const description = b.description ?? "";
  const tr = await safeTranslate(c.env, title, description);
  await c.env.DB.prepare(
    `INSERT INTO items (id,slug,title,description,price_cents,category,ships_usa,local_sdtj,status,created_at,updated_at,title_en,title_es,description_en,description_es,sold_at)
     VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16)`
  ).bind(
    id, slug, title, description, b.priceCents ?? 0, b.category ?? "misc",
    b.shipsUsa === false ? 0 : 1, b.localSdtj === false ? 0 : 1, createStatus, now, now,
    tr.title_en, tr.title_es, tr.description_en, tr.description_es, createSoldAt
  ).run();
  await replacePhotos(c.env.DB, id, b.photoKeys ?? []);
  return c.json({ id, slug });
});

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
  // Re-translate only when the text changed, or when any translation column is missing
  // (legacy/partially-translated rows). A status-only PATCH leaves all four set, so it
  // skips the Claude call entirely.
  const missingTranslation =
    existing.title_en == null || existing.title_es == null ||
    existing.description_en == null || existing.description_es == null;
  const needsTranslation = titleChanged || descChanged || missingTranslation;
  const tr = needsTranslation
    ? await safeTranslate(c.env, title, description)
    : {
        title_en: existing.title_en ?? title,
        title_es: existing.title_es ?? title,
        description_en: existing.description_en ?? description,
        description_es: existing.description_es ?? description,
      };

  // sold_at tracks when the item entered the "sold" state. Set it when transitioning
  // into sold from another status; clear it whenever the item is no longer sold.
  const newStatus = b.status ?? existing.status;
  let soldAt = existing.sold_at;
  if (newStatus === "sold" && existing.status !== "sold") soldAt = Date.now();
  else if (newStatus !== "sold") soldAt = null;

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
