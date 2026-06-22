import Anthropic from "@anthropic-ai/sdk";
import type { Env } from "./index";

export interface Translations {
  title_en: string;
  title_es: string;
  description_en: string;
  description_es: string;
}

const SYSTEM = `You translate listings for a bilingual San Diego–Tijuana online yard sale.
You are given a listing title and description that may be written in English, Spanish, or a mix.
Produce clean, natural versions in BOTH English and Spanish.
- Preserve meaning, brand/model names, sizes, and measurements exactly. Do not invent details.
- Keep titles concise (<= 80 chars), no emojis.
- Match the original tone (friendly, plain).
- If a field is empty, return an empty string for both languages of that field.`;

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    title_en: { type: "string" },
    title_es: { type: "string" },
    description_en: { type: "string" },
    description_es: { type: "string" },
  },
  required: ["title_en", "title_es", "description_en", "description_es"],
} as const;

// Generate bilingual title/description from whatever the seller typed. Throws if the
// model returns no usable JSON (callers fall back to the raw text — see safeTranslate).
export async function translateListing(
  env: Env,
  title: string,
  description: string,
): Promise<Translations> {
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

  // The installed SDK types don't model `output_config`/`thinking:{type:"adaptive"}`;
  // build params as `any` so they pass through (same approach as generate.ts).
  const params: any = {
    model: env.AI_MODEL || "claude-opus-4-8",
    max_tokens: 4000,
    system: SYSTEM,
    output_config: { format: { type: "json_schema", schema: SCHEMA } },
    messages: [
      {
        role: "user",
        content: [{ type: "text", text: `Title: ${title}\n\nDescription: ${description}` }],
      },
    ],
  };

  const res = await client.messages.create(params);
  const textBlock = res.content.find((b: any): b is Anthropic.TextBlock => b.type === "text");
  if (!textBlock) throw new Error("translate_no_output");
  const parsed = JSON.parse(textBlock.text) as Translations;
  return {
    title_en: parsed.title_en ?? "",
    title_es: parsed.title_es ?? "",
    description_en: parsed.description_en ?? "",
    description_es: parsed.description_es ?? "",
  };
}

// Never throws. On any failure, falls back to the raw text in both languages so a
// save/backfill always proceeds.
export async function safeTranslate(
  env: Env,
  title: string,
  description: string,
): Promise<Translations> {
  try {
    return await translateListing(env, title, description);
  } catch {
    return {
      title_en: title,
      title_es: title,
      description_en: description,
      description_es: description,
    };
  }
}
