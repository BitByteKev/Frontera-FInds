import type { Item } from "./db";

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export interface ItemMeta {
  title: string;
  description: string;
  url: string;
  image: string;
}

function formatPrice(cents: number): string {
  return `$${Math.round(cents / 100).toLocaleString("en-US")}`;
}

export function buildItemMeta(item: Item, siteUrl: string): ItemMeta {
  const base = siteUrl.replace(/\/$/, "");
  const desc = item.description?.trim()
    ? `${formatPrice(item.priceCents)} — ${item.description.trim().slice(0, 180)}`
    : `${formatPrice(item.priceCents)} — secondhand find at Frontera Finds.`;
  return {
    title: `${item.title} · Frontera Finds`,
    description: desc,
    url: `${base}/item/${item.slug || item.id}`,
    image: item.photoKeys[0] ? `${base}/img/${item.photoKeys[0]}` : `${base}/og-default.png`,
  };
}

// Inject per-item meta into the built HTML shell. Uses the Workers-runtime
// HTMLRewriter: rewrites <title>/<meta name=description> and appends OG/Twitter
// tags to <head>. Returns the rewritten HTML as a string.
export async function injectMeta(shellHtml: string, item: Item, siteUrl: string): Promise<string> {
  const m = buildItemMeta(item, siteUrl);
  const tags =
    `<meta property="og:type" content="product" />` +
    `<meta property="og:title" content="${escapeHtml(m.title)}" />` +
    `<meta property="og:description" content="${escapeHtml(m.description)}" />` +
    `<meta property="og:url" content="${escapeHtml(m.url)}" />` +
    `<meta property="og:image" content="${escapeHtml(m.image)}" />` +
    `<meta name="twitter:card" content="summary_large_image" />` +
    `<meta name="twitter:title" content="${escapeHtml(m.title)}" />` +
    `<meta name="twitter:description" content="${escapeHtml(m.description)}" />` +
    `<meta name="twitter:image" content="${escapeHtml(m.image)}" />`;

  const rewritten = new HTMLRewriter()
    .on("title", { element(el) { el.setInnerContent(escapeHtml(m.title), { html: true }); } })
    .on('meta[name="description"]', { element(el) { el.setAttribute("content", m.description); } })
    .on("head", { element(el) { el.append(tags, { html: true }); } })
    .transform(new Response(shellHtml, { headers: { "content-type": "text/html" } }));

  return await rewritten.text();
}
