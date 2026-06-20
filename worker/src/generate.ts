import { Hono } from "hono";
import Anthropic from "@anthropic-ai/sdk";
import type { Env } from "./index";
import { requireAdmin } from "./auth";

const MEDIA_BY_EXT: Record<string, "image/jpeg" | "image/png" | "image/webp" | "image/gif"> = {
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif",
};

const SYSTEM = `You write listings for a personal online yard sale (think eBay/Facebook Marketplace).
Look at the photo(s) and produce a concise, honest listing for a used item.
- title: short and specific (brand/model if visible), <= 80 chars, no emojis.
- description: 2-4 friendly sentences describing what it is, notable features, and visible condition. Do not invent flaws or specs you cannot see.
- price_cents: a fair used resale price in US cents (integer). Estimate from the item type and apparent condition.`;

function toBase64(bytes: Uint8Array): string {
  let s = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    s += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(s);
}

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: { type: "string" },
    description: { type: "string" },
    price_cents: { type: "integer" },
  },
  required: ["title", "description", "price_cents"],
} as const;

export const generate = new Hono<{ Bindings: Env }>();
generate.use("/api/admin/generate", requireAdmin);

generate.post("/api/admin/generate", async (c) => {
  const { keys } = await c.req.json<{ keys: string[] }>();
  if (!keys || keys.length === 0) return c.json({ error: "no_keys" }, 400);

  const images: Anthropic.ImageBlockParam[] = [];
  for (const key of keys.slice(0, 4)) {
    const obj = await c.env.PHOTOS.get(key);
    if (!obj) continue;
    const ext = key.split(".").pop()?.toLowerCase() ?? "jpg";
    const media = MEDIA_BY_EXT[ext] ?? "image/jpeg";
    const bytes = new Uint8Array(await obj.arrayBuffer());
    images.push({ type: "image", source: { type: "base64", media_type: media, data: toBase64(bytes) } });
  }
  if (images.length === 0) return c.json({ error: "photos_not_found" }, 400);

  const client = new Anthropic({ apiKey: c.env.ANTHROPIC_API_KEY });

  // The installed @anthropic-ai/sdk types do not yet model `output_config`
  // (structured outputs) or `thinking: {type:"adaptive"}`. Build the params as
  // `any` so these extra body params pass through to the API without tsc errors.
  const params: any = {
    model: c.env.AI_MODEL || "claude-opus-4-8",
    max_tokens: 1024,
    thinking: { type: "adaptive" },
    system: SYSTEM,
    output_config: { format: { type: "json_schema", schema: SCHEMA } },
    messages: [
      { role: "user", content: [...images, { type: "text", text: "Write the listing for this item." }] },
    ],
  };

  try {
    const res = await client.messages.create(params);
    const textBlock = res.content.find((b): b is Anthropic.TextBlock => b.type === "text");
    if (!textBlock) return c.json({ error: "ai_no_output" }, 502);
    const parsed = JSON.parse(textBlock.text) as { title: string; description: string; price_cents: number };
    return c.json({
      title: parsed.title,
      description: parsed.description,
      priceCents: Math.max(0, Math.round(parsed.price_cents)),
    });
  } catch (err) {
    return c.json({ error: "ai_failed", detail: String(err) }, 502);
  }
});
