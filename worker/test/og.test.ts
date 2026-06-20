import { describe, it, expect } from "vitest";
import { buildItemMeta, escapeHtml } from "../src/og";
import type { Item } from "../src/db";

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
