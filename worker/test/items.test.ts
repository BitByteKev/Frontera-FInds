import { env, createExecutionContext, waitOnExecutionContext } from "cloudflare:test";
import { describe, it, expect, vi } from "vitest";
import "./setup-db";
import app from "../src/index";
import { signToken } from "../src/auth";

// Hoisted so individual tests can assert call counts (e.g. that a status-only PATCH
// does NOT invoke Claude — the cost-avoidance guarantee).
const anthropicCreate = vi.hoisted(() =>
  vi.fn(async () => ({
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
);

vi.mock("@anthropic-ai/sdk", () => {
  class FakeAnthropic {
    messages = { create: anthropicCreate };
    constructor(_opts: unknown) {}
  }
  return { default: FakeAnthropic };
});

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

describe("GET /api/items sort + price", () => {
  async function seedPriced() {
    await env.DB.prepare(`DELETE FROM item_photos`).run();
    await env.DB.prepare(`DELETE FROM items`).run();
    const now = Date.now();
    await env.DB.prepare(
      `INSERT INTO items (id,title,description,price_cents,category,ships_usa,local_sdtj,status,created_at,updated_at)
       VALUES ('cheap','Cheap mug','',500,'misc',1,1,'published',?1,?1)`
    ).bind(now).run();
    await env.DB.prepare(
      `INSERT INTO items (id,title,description,price_cents,category,ships_usa,local_sdtj,status,created_at,updated_at)
       VALUES ('mid','Mid lamp','',5000,'misc',1,1,'published',?1,?1)`
    ).bind(now + 1).run();
    await env.DB.prepare(
      `INSERT INTO items (id,title,description,price_cents,category,ships_usa,local_sdtj,status,created_at,updated_at)
       VALUES ('pricey','Pricey bike','',20000,'misc',1,1,'published',?1,?1)`
    ).bind(now + 2).run();
  }
  async function ids(qs: string) {
    const ctx = createExecutionContext();
    const res = await app.fetch(new Request(`http://x/api/items?${qs}`), env, ctx);
    await waitOnExecutionContext(ctx);
    const body = await res.json<{ items: any[] }>();
    return body.items.map((i) => i.id);
  }

  it("sort=price_asc orders ascending by price", async () => {
    await seedPriced();
    expect(await ids("sort=price_asc")).toEqual(["cheap", "mid", "pricey"]);
  });
  it("sort=price_desc orders descending by price", async () => {
    await seedPriced();
    expect(await ids("sort=price_desc")).toEqual(["pricey", "mid", "cheap"]);
  });
  it("unknown sort falls back to newest (created_at desc)", async () => {
    await seedPriced();
    expect(await ids("sort=bogus")).toEqual(["pricey", "mid", "cheap"]);
  });
  it("minPrice/maxPrice bound the results (cents)", async () => {
    await seedPriced();
    expect(await ids("minPrice=1000&maxPrice=10000")).toEqual(["mid"]);
  });
  it("non-numeric price bounds are ignored", async () => {
    await seedPriced();
    expect((await ids("minPrice=abc")).sort()).toEqual(["cheap", "mid", "pricey"]);
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

  it("admin list surfaces soldAt (null until sold)", async () => {
    const headers = await adminHeaders();

    let ctx = createExecutionContext();
    let res = await app.fetch(new Request("http://x/api/admin/items", {
      method: "POST", headers,
      body: JSON.stringify({ title: "Stool", description: "d", status: "published" }),
    }), env, ctx);
    await waitOnExecutionContext(ctx);
    const { id } = await res.json<{ id: string }>();

    ctx = createExecutionContext();
    res = await app.fetch(new Request("http://x/api/admin/items", { headers }), env, ctx);
    await waitOnExecutionContext(ctx);
    const { items } = await res.json<{ items: any[] }>();
    const it = items.find((x) => x.id === id);
    expect(it).toBeTruthy();
    expect(it.soldAt).toBeNull();
  });

  it("creates, lists, marks sold, and deletes", async () => {
    const headers = await adminHeaders();

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

    ctx = createExecutionContext();
    res = await app.fetch(new Request("http://x/api/items"), env, ctx);
    await waitOnExecutionContext(ctx);
    const list = await res.json<{ items: any[] }>();
    const created = list.items.find((i) => i.id === id);
    expect(created.photoKeys).toEqual(["items/lamp.jpg"]);

    ctx = createExecutionContext();
    res = await app.fetch(new Request(`http://x/api/admin/items/${id}`, {
      method: "PATCH", headers, body: JSON.stringify({ status: "sold" }),
    }), env, ctx);
    await waitOnExecutionContext(ctx);
    expect(res.status).toBe(200);

    ctx = createExecutionContext();
    res = await app.fetch(new Request(`http://x/api/admin/items/${id}`, {
      method: "DELETE", headers,
    }), env, ctx);
    await waitOnExecutionContext(ctx);
    expect(res.status).toBe(200);

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

    // The create above translated once; a status-only PATCH must not call Claude again.
    anthropicCreate.mockClear();
    const ctx2 = createExecutionContext();
    const patch = await app.fetch(new Request(`http://x/api/admin/items/${id}`, {
      method: "PATCH", headers, body: JSON.stringify({ status: "sold" }),
    }), env, ctx2);
    await waitOnExecutionContext(ctx2);
    expect(patch.status).toBe(200);
    expect(anthropicCreate).not.toHaveBeenCalled();

    const ctx3 = createExecutionContext();
    const got = await app.fetch(new Request(`http://x/api/admin/items`, { headers }), env, ctx3);
    await waitOnExecutionContext(ctx3);
    const { items } = await got.json<{ items: any[] }>();
    const it = items.find((x) => x.id === id);
    expect(it.status).toBe("sold");
    expect(it.titleEs).toBe("Mock ES");
  });
});
