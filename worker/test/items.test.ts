import { env, createExecutionContext, waitOnExecutionContext } from "cloudflare:test";
import { describe, it, expect } from "vitest";
import "./setup-db";
import app from "../src/index";

describe("health", () => {
  it("responds ok", async () => {
    const ctx = createExecutionContext();
    const res = await app.fetch(new Request("http://x/api/health"), env, ctx);
    await waitOnExecutionContext(ctx);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });
});
