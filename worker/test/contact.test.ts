import { env, createExecutionContext, waitOnExecutionContext } from "cloudflare:test";
import { describe, it, expect, vi } from "vitest";
import "./setup-db";
import app from "../src/index";

describe("POST /api/items/:id/contact", () => {
  it("emails the owner and returns ok", async () => {
    const now = Date.now();
    await env.DB.prepare(
      `INSERT OR REPLACE INTO items (id,title,description,price_cents,category,ships_usa,local_sdtj,status,created_at,updated_at)
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

describe("GET /api/config", () => {
  it("returns the public contact config", async () => {
    const ctx = createExecutionContext();
    const res = await app.fetch(new Request("http://x/api/config"), env, ctx);
    await waitOnExecutionContext(ctx);
    expect(res.status).toBe(200);
    const body = await res.json<{ whatsapp: string; sms: string; instagramUrl: string }>();
    expect(body.whatsapp).toBe("+16199448759");
    expect(typeof body.instagramUrl).toBe("string");
  });
});
