import { describe, it, expect } from "vitest";
import { buildItemMeta, escapeHtml, injectMeta } from "../src/og";
import type { Item } from "../src/db";
import { env, createExecutionContext, waitOnExecutionContext } from "cloudflare:test";
import "./setup-db";
import app from "../src/index";

const item: Item = {
  id: "abc", slug: "trek-bike", title: 'Trek "920" bike', description: "Great <condition> & ready",
  priceCents: 12000, category: "bikes", shipsUsa: true, localSdtj: true,
  status: "published", createdAt: 1, updatedAt: 1, photoKeys: ["items/abc-a.jpg"],
};

describe("buildItemMeta", () => {
  it("builds title, description (with price), url, and absolute image", () => {
    const m = buildItemMeta(item, "https://fronterafinds.com");
    expect(m.title).toBe('Trek "920" bike · Frontera Finds');
    expect(m.description).toContain("$120");
    expect(m.url).toBe("https://fronterafinds.com/item/trek-bike");
    expect(m.image).toBe("https://fronterafinds.com/img/items/abc-a.jpg");
  });
  it("falls back to the default OG image when there are no photos", () => {
    const m = buildItemMeta({ ...item, photoKeys: [] }, "https://fronterafinds.com");
    expect(m.image).toBe("https://fronterafinds.com/og-default.png");
  });
});

describe("escapeHtml", () => {
  it("escapes the five markup-significant characters", () => {
    expect(escapeHtml('a "b" <c> & \'d\'')).toBe("a &quot;b&quot; &lt;c&gt; &amp; &#39;d&#39;");
  });
});

const SHELL = `<!doctype html><html><head>` +
  `<title>Frontera Finds</title>` +
  `<meta name="description" content="default desc" />` +
  `</head><body><div id="root"></div></body></html>`;

describe("injectMeta", () => {
  it("replaces title/description and appends OG + Twitter tags, escaped", async () => {
    const html = await injectMeta(SHELL, item, "https://fronterafinds.com");
    expect(html).toContain("<title>Trek &quot;920&quot; bike · Frontera Finds</title>");
    expect(html).toContain('property="og:title" content="Trek &quot;920&quot; bike · Frontera Finds"');
    expect(html).toContain('property="og:image" content="https://fronterafinds.com/img/items/abc-a.jpg"');
    expect(html).toContain('name="twitter:card" content="summary_large_image"');
    expect(html).toContain('property="og:description"');
    expect(html).not.toContain('content="default desc"');
  });
});

describe("GET /item/:idOrSlug", () => {
  it("returns HTML with the item's OG title for a real slug", async () => {
    await env.DB.prepare(`DELETE FROM items`).run();
    await env.DB.prepare(
      `INSERT INTO items (id,slug,title,description,price_cents,category,ships_usa,local_sdtj,status,created_at,updated_at)
       VALUES ('og1','my-cool-chair','My cool chair','Comfy',5000,'home',1,1,'published',1,1)`
    ).run();
    const ctx = createExecutionContext();
    const res = await app.fetch(new Request("http://x/item/my-cool-chair"), env, ctx);
    await waitOnExecutionContext(ctx);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    const html = await res.text();
    expect(html).toContain('property="og:title" content="My cool chair · Frontera Finds"');
  });

  it("404s for an unknown slug", async () => {
    const ctx = createExecutionContext();
    const res = await app.fetch(new Request("http://x/item/does-not-exist"), env, ctx);
    await waitOnExecutionContext(ctx);
    expect(res.status).toBe(404);
  });
});
