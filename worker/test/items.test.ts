import { env, createExecutionContext, waitOnExecutionContext } from "cloudflare:test";
import { describe, it, expect } from "vitest";
import "./setup-db";
import app from "../src/index";

async function seed() {
  await env.DB.prepare(`DELETE FROM item_photos`).run();
  await env.DB.prepare(`DELETE FROM items`).run();
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

  it("?q= filters by title/description", async () => {
    await seed();
    const ctx1 = createExecutionContext();
    const res1 = await app.fetch(new Request("http://x/api/items?q=Trek"), env, ctx1);
    await waitOnExecutionContext(ctx1);
    expect(res1.status).toBe(200);
    const body1 = await res1.json<{ items: any[] }>();
    expect(body1.items.map((i) => i.id)).toContain("itm1");

    const ctx2 = createExecutionContext();
    const res2 = await app.fetch(new Request("http://x/api/items?q=zzzznomatch"), env, ctx2);
    await waitOnExecutionContext(ctx2);
    expect(res2.status).toBe(200);
    const body2 = await res2.json<{ items: any[] }>();
    expect(body2.items).toHaveLength(0);
  });

  it("?sold=1 includes sold items; omitting it excludes them", async () => {
    await seed();
    await env.DB.prepare(
      `INSERT OR REPLACE INTO items (id,title,description,price_cents,category,ships_usa,local_sdtj,status,created_at,updated_at)
       VALUES ('itm3','Sold chair','',5000,'home',1,1,'sold',?1,?1)`
    ).bind(Date.now()).run();

    const ctx1 = createExecutionContext();
    const res1 = await app.fetch(new Request("http://x/api/items?sold=1"), env, ctx1);
    await waitOnExecutionContext(ctx1);
    expect(res1.status).toBe(200);
    const body1 = await res1.json<{ items: any[] }>();
    expect(body1.items.map((i) => i.id)).toContain("itm3");

    const ctx2 = createExecutionContext();
    const res2 = await app.fetch(new Request("http://x/api/items"), env, ctx2);
    await waitOnExecutionContext(ctx2);
    expect(res2.status).toBe(200);
    const body2 = await res2.json<{ items: any[] }>();
    expect(body2.items.map((i) => i.id)).not.toContain("itm3");
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

  it("hidden item detail returns 404", async () => {
    await seed();
    const ctx = createExecutionContext();
    const res = await app.fetch(new Request("http://x/api/items/itm2"), env, ctx);
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
