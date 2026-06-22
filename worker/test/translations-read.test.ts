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
