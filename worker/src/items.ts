import { Hono } from "hono";
import type { Env } from "./index";
import { rowToItem, type ItemRow } from "./db";

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

publicItems.get("/api/items/:id", async (c) => {
  const id = c.req.param("id");
  const row = await c.env.DB.prepare(`SELECT * FROM items WHERE id = ?1`).bind(id).first<ItemRow>();
  if (!row) return c.json({ error: "not_found" }, 404);
  if (row.status === "hidden") return c.json({ error: "not_found" }, 404);
  const keys = await photoKeysFor(c.env.DB, [id]);
  return c.json({ item: rowToItem(row, keys.get(id) ?? []) });
});
