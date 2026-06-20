// Turn a title into a URL-safe slug: lowercase, ASCII, hyphen-separated.
// e.g. "Tomahawk 36V Backpack Sprayer" -> "tomahawk-36v-backpack-sprayer"
export function slugify(title: string): string {
  const base = title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip accent marks
    .replace(/[^a-z0-9]+/g, "-") // non-alphanumerics -> hyphen
    .replace(/^-+|-+$/g, "") // trim leading/trailing hyphens
    .slice(0, 80)
    .replace(/-+$/g, ""); // re-trim after slice
  return base || "item";
}

// Generate a slug guaranteed unique against the items table. On collision,
// append -2, -3, … so a second "Skil Drill" becomes "skil-drill-2".
export async function uniqueSlug(db: D1Database, title: string): Promise<string> {
  const base = slugify(title);
  let candidate = base;
  let n = 2;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const taken = await db.prepare(`SELECT 1 FROM items WHERE slug = ?1`).bind(candidate).first();
    if (!taken) return candidate;
    candidate = `${base}-${n++}`;
  }
}
