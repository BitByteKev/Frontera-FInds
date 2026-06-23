import type { Item } from "./types";
import type { Lang } from "../i18n/translate";

// Pick the active-language text for a translatable field, falling back to the raw
// seller-entered value when the translation is missing (legacy / un-backfilled items).
export function pickText(item: Item, field: "title" | "description", lang: Lang): string {
  const translated = lang === "es" ? item[`${field}Es`] : item[`${field}En`];
  return translated ?? item[field];
}

// Return a shallow copy of the item with title/description swapped to the active language.
export function localizeItem(item: Item, lang: Lang): Item {
  return {
    ...item,
    title: pickText(item, "title", lang),
    description: pickText(item, "description", lang),
  };
}
