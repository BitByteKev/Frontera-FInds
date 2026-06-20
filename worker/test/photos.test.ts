import { env, createExecutionContext, waitOnExecutionContext } from "cloudflare:test";
import { describe, it, expect } from "vitest";
import "./setup-db";
import app from "../src/index";

describe("GET /img/:key", () => {
  it("serves an uploaded object", async () => {
    await env.PHOTOS.put("items/test.jpg", new Uint8Array([1, 2, 3]), {
      httpMetadata: { contentType: "image/jpeg" },
    });
    const ctx = createExecutionContext();
    const res = await app.fetch(new Request("http://x/img/items/test.jpg"), env, ctx);
    await waitOnExecutionContext(ctx);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/jpeg");
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
  });

  it("404s a missing key", async () => {
    const ctx = createExecutionContext();
    const res = await app.fetch(new Request("http://x/img/items/missing.jpg"), env, ctx);
    await waitOnExecutionContext(ctx);
    expect(res.status).toBe(404);
  });
});
