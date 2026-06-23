import { env, createExecutionContext, waitOnExecutionContext } from "cloudflare:test";
import { describe, it, expect, vi, afterEach } from "vitest";
import "./setup-db";
import app from "../src/index";
import { FALLBACK_USD_MXN } from "../src/fx";

afterEach(() => vi.unstubAllGlobals());

describe("GET /api/fx", () => {
  it("returns the live MXN rate from the upstream", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ rates: { MXN: 19.42 } }), { status: 200 })),
    );
    const ctx = createExecutionContext();
    const res = await app.fetch(new Request("http://x/api/fx"), env, ctx);
    await waitOnExecutionContext(ctx);
    expect(res.status).toBe(200);
    const { rate } = await res.json<{ rate: number }>();
    expect(rate).toBe(19.42);
  });

  it("falls back to a default rate when the upstream fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("network down"); }));
    const ctx = createExecutionContext();
    const res = await app.fetch(new Request("http://x/api/fx"), env, ctx);
    await waitOnExecutionContext(ctx);
    const { rate } = await res.json<{ rate: number }>();
    expect(rate).toBe(FALLBACK_USD_MXN);
  });

  it("falls back when the upstream returns a negative rate", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ rates: { MXN: -5 } }), { status: 200 })),
    );
    const ctx = createExecutionContext();
    const res = await app.fetch(new Request("http://x/api/fx"), env, ctx);
    await waitOnExecutionContext(ctx);
    const { rate } = await res.json<{ rate: number }>();
    expect(rate).toBe(FALLBACK_USD_MXN);
  });

  it("falls back when the upstream rate is implausibly high", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ rates: { MXN: 5000 } }), { status: 200 })),
    );
    const ctx = createExecutionContext();
    const res = await app.fetch(new Request("http://x/api/fx"), env, ctx);
    await waitOnExecutionContext(ctx);
    const { rate } = await res.json<{ rate: number }>();
    expect(rate).toBe(FALLBACK_USD_MXN);
  });

  it("falls back when MXN is non-numeric", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ rates: { MXN: "nope" } }), { status: 200 })),
    );
    const ctx = createExecutionContext();
    const res = await app.fetch(new Request("http://x/api/fx"), env, ctx);
    await waitOnExecutionContext(ctx);
    const { rate } = await res.json<{ rate: number }>();
    expect(rate).toBe(FALLBACK_USD_MXN);
  });
});
