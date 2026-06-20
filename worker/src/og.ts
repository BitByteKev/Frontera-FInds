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
