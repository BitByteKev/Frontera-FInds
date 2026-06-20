import { env, createExecutionContext, waitOnExecutionContext } from "cloudflare:test";
import { describe, it, expect } from "vitest";
import "./setup-db";
import app from "../src/index";
import { signToken, verifyToken } from "../src/auth";

describe("auth tokens", () => {
  it("round-trips a valid token", async () => {
    const t = await signToken("test-password", Date.now() + 60_000);
    expect(await verifyToken("test-password", t)).toBe(true);
  });

  it("rejects a token signed with the wrong password", async () => {
    const t = await signToken("wrong", Date.now() + 60_000);
    expect(await verifyToken("test-password", t)).toBe(false);
  });

  it("rejects an expired token", async () => {
    const t = await signToken("test-password", Date.now() - 1);
    expect(await verifyToken("test-password", t)).toBe(false);
  });
});

describe("POST /api/admin/login", () => {
  it("returns a token for the right password", async () => {
    const ctx = createExecutionContext();
    const res = await app.fetch(
      new Request("http://x/api/admin/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password: "test-password" }),
      }),
      env,
      ctx
    );
    await waitOnExecutionContext(ctx);
    expect(res.status).toBe(200);
    expect(typeof (await res.json<{ token: string }>()).token).toBe("string");
  });

  it("401s a wrong password", async () => {
    const ctx = createExecutionContext();
    const res = await app.fetch(
      new Request("http://x/api/admin/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password: "nope" }),
      }),
      env,
      ctx
    );
    await waitOnExecutionContext(ctx);
    expect(res.status).toBe(401);
  });
});
