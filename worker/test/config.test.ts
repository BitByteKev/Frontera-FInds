import { env, createExecutionContext, waitOnExecutionContext } from "cloudflare:test";
import { describe, it, expect } from "vitest";
import "./setup-db";
import app from "../src/index";

describe("GET /api/config", () => {
  it("returns the public contact/social config including facebookUrl", async () => {
    const ctx = createExecutionContext();
    const res = await app.fetch(new Request("http://x/api/config"), env, ctx);
    await waitOnExecutionContext(ctx);
    expect(res.status).toBe(200);
    const cfg = await res.json<{
      whatsapp: string;
      sms: string;
      instagramUrl: string;
      facebookUrl: string;
    }>();
    expect(cfg.whatsapp).toBe("+16199448759");
    expect(cfg.instagramUrl).toBe("https://instagram.com/test");
    expect(cfg.facebookUrl).toBe("https://www.facebook.com/marketplace/profile/61558944447221/");
  });
});
