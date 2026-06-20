import { env, createExecutionContext, waitOnExecutionContext } from "cloudflare:test";
import { describe, it, expect, vi } from "vitest";
import "./setup-db";
import { signToken } from "../src/auth";

// Mock the Anthropic SDK before importing the app.
vi.mock("@anthropic-ai/sdk", () => {
  class FakeAnthropic {
    messages = {
      create: vi.fn(async () => ({
        content: [
          {
            type: "text",
            text: JSON.stringify({
              title: "Vintage Desk Lamp",
              description: "A warm brass desk lamp in great condition.",
              price_cents: 3500,
            }),
          },
        ],
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

describe("POST /api/admin/generate", () => {
  it("returns title, description, price from the photo", async () => {
    await env.PHOTOS.put("items/g.jpg", new Uint8Array([1, 2, 3]), {
      httpMetadata: { contentType: "image/jpeg" },
    });
    const headers = await adminHeaders();
    const ctx = createExecutionContext();
    const res = await app.fetch(new Request("http://x/api/admin/generate", {
      method: "POST", headers, body: JSON.stringify({ keys: ["items/g.jpg"] }),
    }), env, ctx);
    await waitOnExecutionContext(ctx);
    expect(res.status).toBe(200);
    const body = await res.json<{ title: string; description: string; priceCents: number }>();
    expect(body.title).toBe("Vintage Desk Lamp");
    expect(body.priceCents).toBe(3500);
  });

  it("requires auth", async () => {
    const ctx = createExecutionContext();
    const res = await app.fetch(new Request("http://x/api/admin/generate", {
      method: "POST", body: JSON.stringify({ keys: [] }),
    }), env, ctx);
    await waitOnExecutionContext(ctx);
    expect(res.status).toBe(401);
  });
});
