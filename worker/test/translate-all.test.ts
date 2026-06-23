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
