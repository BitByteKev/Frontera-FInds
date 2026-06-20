import { Hono } from "hono";
import type { Env } from "./index";
import { rowToItem, type ItemRow } from "./db";
import { requireAdmin } from "./auth";
import { uniqueSlug } from "./slug";

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

  const sql = `SELECT * FROM items WHERE ${where.join(" AND ")} ORDER BY created_at DESC LIMIT ${MAX_LIST}`;
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
  const slug = await uniqueSlug(c.env.DB, b.title.trim());
  const now = Date.now();
  await c.env.DB.prepare(
    `INSERT INTO items (id,slug,title,description,price_cents,category,ships_usa,local_sdtj,status,created_at,updated_at)
     VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11)`
  ).bind(
    id, slug, b.title.trim(), b.description ?? "", b.priceCents ?? 0, b.category ?? "misc",
    b.shipsUsa === false ? 0 : 1, b.localSdtj === false ? 0 : 1, b.status ?? "published", now, now
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
  await c.env.DB.prepare(
    `UPDATE items SET slug=?10, title=?2, description=?3, price_cents=?4, category=?5,
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
    Date.now(),
    slug
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
