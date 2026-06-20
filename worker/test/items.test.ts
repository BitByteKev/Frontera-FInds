import { env, createExecutionContext, waitOnExecutionContext } from "cloudflare:test";
import { describe, it, expect } from "vitest";
import "./setup-db";
import app from "../src/index";
import { rowToItem } from "../src/db";

async function seed() {
  const now = Date.now();
  await env.DB.prepare(
    `INSERT OR REPLACE INTO items (id,title,description,price_cents,category,ships_usa,local_sdtj,status,created_at,updated_at)
     VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10)`
  ).bind("itm1", "Trek bike", "Nice bike", 12000, "bikes", 1, 1, "published", now, now).run();
  await env.DB.prepare(
    `INSERT OR REPLACE INTO items (id,title,description,price_cents,category,ships_usa,local_sdtj,status,created_at,updated_at)
     VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10)`
  ).bind("itm2", "Hidden thing", "", 100, "misc", 1, 0, "hidden", now + 1, now + 1).run();
  await env.DB.prepare(
    `INSERT OR REPLACE INTO item_photos (id,item_id,r2_key,sort_order) VALUES (?1,?2,?3,?4)`
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

describe("health", () => {
  it("responds ok", async () => {
    const ctx = createExecutionContext();
    const res = await app.fetch(new Request("http://x/api/health"), env, ctx);
    await waitOnExecutionContext(ctx);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });
});
