export type Lang = "en" | "es";

// Resolve the language to show on load: an explicit, previously-saved choice
// always wins; otherwise guess from the browser (es* → Spanish) and default to
// English. Kept pure (no localStorage/navigator access) so it is unit-testable.
export function resolveInitialLang(
  stored: string | null,
  navigatorLang: string | undefined,
): Lang {
  if (stored === "en" || stored === "es") return stored;
  if (navigatorLang && navigatorLang.toLowerCase().startsWith("es")) return "es";
  return "en";
}

// Look up a key for the active language, falling back to English, then to the
// raw key. Replaces {token} placeholders with the matching param (literal, not
// regex) so callers can inject item titles, prices, counts, etc.
export function translate(
  dict: Record<Lang, Record<string, string>>,
  lang: Lang,
  key: string,
  params?: Record<string, string | number>,
): string {
  const table = dict[lang] ?? dict.en;
  let s = table[key] ?? dict.en[key] ?? key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      s = s.replaceAll(`{${k}}`, String(v));
    }
  }
  return s;
}
