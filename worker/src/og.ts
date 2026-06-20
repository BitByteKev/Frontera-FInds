import { Hono } from "hono";
import type { Env } from "./index";
import { rowToItem, type ItemRow } from "./db";
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

export const og = new Hono<{ Bindings: Env }>();

og.get("/item/:idOrSlug", async (c) => {
  const idOrSlug = c.req.param("idOrSlug");
  const row = await c.env.DB
    .prepare(`SELECT * FROM items WHERE slug = ?1 OR id = ?1`)
    .bind(idOrSlug)
    .first<ItemRow>();
  if (!row || row.status === "hidden") return c.notFound();

  // photos for og:image
  const { results } = await c.env.DB
    .prepare(`SELECT r2_key FROM item_photos WHERE item_id = ?1 ORDER BY sort_order ASC`)
    .bind(row.id)
    .all<{ r2_key: string }>();
  const item = rowToItem(row, results.map((r) => r.r2_key));
  const siteUrl = c.env.PUBLIC_SITE_URL;

  // Fetch the built SPA shell from the static origin and inject meta. If the
  // origin is unreachable, fall back to a minimal HTML doc that still carries
  // the OG tags and links to the item.
  let shell: string | null = null;
  try {
    const resp = await fetch(`${siteUrl}/index.html`, { cf: { cacheTtl: 300 } });
    if (resp.ok) shell = await resp.text();
  } catch { /* fall through to minimal */ }

  let html: string;
  if (shell) {
    html = await injectMeta(shell, item, siteUrl);
  } else {
    const m = buildItemMeta(item, siteUrl);
    html =
      `<!doctype html><html lang="en"><head><meta charset="utf-8" />` +
      `<title>${escapeHtml(m.title)}</title>` +
      `<meta property="og:type" content="product" />` +
      `<meta property="og:title" content="${escapeHtml(m.title)}" />` +
      `<meta property="og:description" content="${escapeHtml(m.description)}" />` +
      `<meta property="og:url" content="${escapeHtml(m.url)}" />` +
      `<meta property="og:image" content="${escapeHtml(m.image)}" />` +
      `<meta name="twitter:card" content="summary_large_image" />` +
      `<meta name="twitter:image" content="${escapeHtml(m.image)}" />` +
      `</head><body><a href="${escapeHtml(m.url)}">${escapeHtml(item.title)}</a></body></html>`;
  }
  return c.html(html, 200, { "cache-control": "public, max-age=300" });
});
