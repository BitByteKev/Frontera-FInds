# Spanish / English Language Toggle — Design

**Date:** 2026-06-22
**Status:** Approved (design)

## Goal

Add a Spanish version of the public-facing site and a language-toggle button placed
next to the existing dark-mode toggle. Visitors can switch the entire UI between
English and Spanish with one tap; the choice persists across visits.

## Decisions (locked)

- **Translation source:** Hand-authored static dictionary. No translation API,
  no per-request cost, instant switching, full quality control.
- **Scope:** Public pages only. The `/admin` seller area is left as-is. Item
  titles and descriptions (seller-entered, stored in D1) are shown exactly as
  typed in both languages.
- **No URL locales:** Language is client-side state (no `/es/` routes). Trade-off:
  the two languages are not separately search-indexable. Acceptable for a small
  owner-run marketplace; URL locales can be added later if SEO becomes a priority.

## Architecture

Mirrors the existing `ThemeToggle` pattern (localStorage + a small piece of state).
No new dependencies.

### New files

- `src/i18n/strings.ts`
  - Exports a typed dictionary: `{ en: Record<Key, string>, es: Record<Key, string> }`.
  - Keys are short and namespaced by area, e.g. `header.sell`, `home.heroTitle`,
    `contact.send`, `about.howToBuy`.
  - Exports a `Lang` type (`"en" | "es"`) and the `TranslationKey` union derived
    from the English dictionary, so missing/typo keys are caught at compile time.

- `src/i18n/LanguageContext.tsx`
  - `LanguageProvider` — React context provider.
  - `useLang()` hook returning `{ lang, setLang, t }`.
  - `t(key)` returns the string for the current language; falls back to English if a
    Spanish entry is somehow missing.
  - Persists the active language to `localStorage` under key `ff_lang`.
  - **Initial language resolution order:** (1) stored `ff_lang` value if present and
    valid; (2) otherwise `navigator.language` — `es*` → `"es"`, anything else → `"en"`.
  - An explicit user choice (via the toggle) always wins on subsequent visits.

- `src/components/LanguageToggle.tsx`
  - Button styled to match `ThemeToggle`, placed immediately to the **left** of
    `ThemeToggle` in the `Header`.
  - Displays the **target** language as a compact pill: shows `ES` when the site is
    in English, `EN` when in Spanish.
  - `aria-label`: "Cambiar a español" when target is ES, "Switch to English" when
    target is EN. `title` mirrors the aria-label.
  - One tap flips `lang` via `setLang` and persists.

### Wiring

- `LanguageProvider` wraps the app at the root (around the router, alongside the
  existing top-level structure in `src/App.tsx` / its entry).
- `Header` renders `<LanguageToggle />` then `<ThemeToggle />`.

## Strings to translate (public surface only)

Replace hardcoded JSX text with `t('key')` in:

- `src/App.tsx` — `Header` (search placeholder, "Sell") and `Footer`
  (tagline, "Shipping across the USA…", "How it works" link, Instagram aria-label).
- `src/pages/Home.tsx` — hero title/subtitle, sort options ("Newest",
  "Price: low to high", "Price: high to low"), "Min $"/"Max $", filter buttons
  ("Ships USA", "Local pickup / delivery", "Hide sold"), search placeholder,
  "Loading…", empty-results and error messages.
- `src/pages/About.tsx` — headings ("How to buy") and the body paragraphs.
- `src/pages/ItemPage.tsx` — "This item has been sold.", loading/error states.
- `src/components/ItemCard.tsx` — "SOLD" badge text.
- `src/components/Badges.tsx` — "Ships USA", "Local · SD ⟷ TJ".
- `src/components/ContactButtons.tsx` — button labels ("WhatsApp", "Text / SMS",
  "Instagram DM", "Message the seller"), form labels ("Your name",
  "Your email (so the seller can reply)", "Message"), "Send", success and error toasts.
- `src/components/Gallery.tsx` — aria-labels ("Previous photo", "Next photo",
  "Show photo X"). The "X / N" counter stays numeric.
- `src/components/ThemeToggle.tsx` — aria-label/title ("Switch to light/dark mode",
  "Light mode"/"Dark mode") become language-aware via `t()`.

### Intentionally NOT translated

- Brand phrases that are deliberately Spanish stay verbatim in both languages, e.g.
  "El swapmeet sin fronteras". City names "San Diego" / "Tijuana" unchanged.
- All of `src/pages/admin/*`.
- Seller-entered item titles and descriptions.

## Edge cases & details

- **No flash of wrong language:** unlike theme (resolved in `index.html` before
  paint), language is resolved in React on mount. The first paint may briefly show
  the default before hydration settles; acceptable for a client SPA. If it proves
  noticeable, a tiny inline script in `index.html` can pre-resolve `ff_lang` later —
  out of scope for v1.
- **Missing key:** `t()` falls back to the English string; during development a
  compile error already prevents unknown keys.
- **Storage disabled / private mode:** writes to `localStorage` are wrapped in
  try/catch (same as `ThemeToggle`); language still works for the session.
- **Interpolation:** Gallery "Show photo X" needs a number injected. `t()` supports
  a simple `{n}` placeholder replaced via an optional params argument:
  `t('gallery.showPhoto', { n })`.

## Testing

- Manual: toggle EN↔ES on Home, About, an Item page, and the contact form; verify
  all chrome switches and item content does not. Reload to confirm persistence.
  Clear `ff_lang` and set browser to Spanish to confirm auto-detect default.
- Type safety: `tsc` build catches any missing/misspelled translation keys.

## Out of scope (v1)

- URL-based locales / SEO indexing of both languages.
- Translating admin screens or seller-entered item content.
- Machine translation of any kind.
