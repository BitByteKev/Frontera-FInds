# Spanish / English Language Toggle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Spanish version of the public-facing site plus a one-tap EN/ES toggle next to the dark-mode toggle, with the choice persisted and browser-language auto-detected on first visit.

**Architecture:** A dependency-free i18n layer that mirrors the existing `ThemeToggle` pattern. Pure functions (`resolveInitialLang`, `translate`) hold all logic and are unit-tested under vitest; a thin React context (`LanguageProvider` / `useLang`) wires them to `localStorage` and `navigator`. A hand-authored `strings.ts` dictionary (`en` + `es`) is the single source of truth, with TypeScript enforcing that `es` covers every `en` key. Public components call `t('key')` instead of hardcoded text. Item titles/descriptions and the `/admin` area are untouched.

**Tech Stack:** React 18 + TypeScript, Vite, React Router v6, Vitest (node environment for the pure-logic tests).

---

## File Structure

- Create: `src/i18n/translate.ts` — pure logic: `Lang` type, `resolveInitialLang`, `translate` (with `{token}` interpolation). Zero imports.
- Create: `src/i18n/strings.ts` — `en` dictionary (`as const`, source of truth), `TranslationKey` type, `es` dictionary typed `Record<TranslationKey, string>`.
- Create: `src/i18n/translate.test.ts` — unit tests for the pure functions + an `es`-completeness guard.
- Create: `src/i18n/LanguageContext.tsx` — `LanguageProvider`, `useLang()` hook.
- Create: `src/components/LanguageToggle.tsx` — the EN/ES button.
- Modify: `src/main.tsx` — wrap `<App/>` in `<LanguageProvider>`.
- Modify: `src/App.tsx` — render `<LanguageToggle/>`, localize Header + Footer.
- Modify: `src/pages/Home.tsx`, `src/pages/About.tsx`, `src/pages/ItemPage.tsx` — localize copy.
- Modify: `src/components/ItemCard.tsx`, `src/components/Badges.tsx`, `src/components/ContactButtons.tsx`, `src/components/Gallery.tsx`, `src/components/ThemeToggle.tsx` — localize copy/aria.
- Modify: `src/theme.css` — add `.ff-lang-toggle` styles.

---

## Task 1: i18n core (pure logic + full dictionary, TDD)

**Files:**
- Create: `src/i18n/translate.ts`
- Create: `src/i18n/strings.ts`
- Test: `src/i18n/translate.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/i18n/translate.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { resolveInitialLang, translate } from "./translate";
import { en, es } from "./strings";

describe("resolveInitialLang", () => {
  it("prefers a valid stored value", () => {
    expect(resolveInitialLang("es", "en-US")).toBe("es");
    expect(resolveInitialLang("en", "es-MX")).toBe("en");
  });
  it("falls back to navigator language when nothing valid is stored", () => {
    expect(resolveInitialLang(null, "es-MX")).toBe("es");
    expect(resolveInitialLang("garbage", "es")).toBe("es");
    expect(resolveInitialLang(null, "en-US")).toBe("en");
    expect(resolveInitialLang(null, undefined)).toBe("en");
  });
});

describe("translate", () => {
  const dict = {
    en: { greet: "Hello {name}", plain: "Hi" },
    es: { greet: "Hola {name}", plain: "Hola" },
  };
  it("returns the string for the active language", () => {
    expect(translate(dict, "es", "plain")).toBe("Hola");
  });
  it("interpolates {tokens}", () => {
    expect(translate(dict, "en", "greet", { name: "Ana" })).toBe("Hello Ana");
  });
  it("falls back to english when a key is missing in the target language", () => {
    const partial = { en: { only: "English" }, es: {} as Record<string, string> };
    expect(translate(partial, "es", "only")).toBe("English");
  });
  it("returns the key itself when it exists nowhere", () => {
    expect(translate(dict, "en", "missing")).toBe("missing");
  });
});

describe("dictionary completeness", () => {
  it("es defines every key that en does", () => {
    const missing = Object.keys(en).filter((k) => !(k in es));
    expect(missing).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/i18n/translate.test.ts`
Expected: FAIL — cannot resolve `./translate` / `./strings` (modules don't exist yet).

- [ ] **Step 3: Implement `src/i18n/translate.ts`**

```ts
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
```

- [ ] **Step 4: Implement `src/i18n/strings.ts`**

Brand phrases ("El swapmeet sin fronteras", "Frontera Finds", city names) are intentionally identical in both languages.

```ts
import type { Lang } from "./translate";

// English is the source of truth. `as const` lets TranslationKey be derived
// from these keys, and the `es` Record below is forced to cover every one.
export const en = {
  "common.loading": "Loading…",

  "nav.logoAria": "Frontera Finds — home",
  "header.searchPlaceholder": "Search items…",
  "header.sell": "Sell",

  "footer.tag": "El swapmeet sin fronteras — two cities, one marketplace.",
  "footer.meta": "Shipping across the USA · Local pickup & delivery in San Diego ⟷ Tijuana · ",
  "footer.howItWorks": "How it works",
  "footer.instagramAria": "Frontera Finds on Instagram (@fronterafind.s)",

  "home.heroTitle": "Two cities. One marketplace.",
  "home.heroSub": "El swapmeet sin fronteras",
  "home.shippingUsa": "Shipping across the USA",
  "home.searchPlaceholder": "Search items…",
  "home.sortNewest": "Newest",
  "home.sortPriceAsc": "Price: low to high",
  "home.sortPriceDesc": "Price: high to low",
  "home.minPrice": "Min $",
  "home.maxPrice": "Max $",
  "home.filterShips": "Ships USA",
  "home.filterLocal": "Local pickup / delivery",
  "home.filterHideSold": "Hide sold",
  "home.loadErrorPrefix": "Couldn't load items: ",
  "home.noResults": "No items match your filters.",

  "about.kicker": "El swapmeet sin fronteras",
  "about.title": "Two cities. One marketplace.",
  "about.intro":
    "Frontera Finds is my personal online swapmeet for the San Diego–Tijuana border — a Sunday garage sale that stretches across the line. Everything here is mine, one-of-one, priced to move.",
  "about.shippingHeading": "Shipping across the USA 🇺🇸",
  "about.shippingBody":
    "Most items can ship anywhere in the United States. Message me with your ZIP and I’ll confirm shipping before you pay.",
  "about.localHeading": "Local pickup & delivery — San Diego ⟷ Tijuana 🌵",
  "about.localBody":
    "On either side of the line? Skip shipping — arrange free local pickup, or local delivery on bigger items. Just tap WhatsApp or text on any listing.",
  "about.howToBuyHeading": "How to buy",
  "about.howToBuyLead": "There’s no checkout here. Find something you like, hit",
  "about.orWord": "or",
  "about.howToBuyTail":
    ", and we’ll sort out payment (cash, Venmo, Zelle) and handoff directly.",

  "item.notFound": "Item not found.",
  "item.soldNotice": "This item has been sold.",

  "badge.sold": "SOLD",
  "badge.shipsUsa": "Ships USA",
  "badge.localSdTj": "Local · SD ⟷ TJ",

  "contact.whatsapp": "WhatsApp",
  "contact.sms": "Text / SMS",
  "contact.instagramDm": "Instagram DM",
  "contact.messageSeller": "Message the seller",
  "contact.yourName": "Your name",
  "contact.yourEmail": "Your email (so the seller can reply)",
  "contact.messageLabel": "Message",
  "contact.send": "Send",
  "contact.sendError": "Couldn't send — please try WhatsApp or text instead.",
  "contact.sent": "Sent! The seller will get back to you.",
  "contact.defaultMessage": "Hi! Is \"{title}\" still available?",
  "contact.pitch": "Hi! I'm interested in \"{title}\" ({price}) on Frontera Finds: {url}",

  "gallery.prev": "Previous photo",
  "gallery.next": "Next photo",
  "gallery.showPhoto": "Show photo {n}",
  "gallery.photoAlt": "{title} — photo {n} of {total}",

  "theme.toLight": "Switch to light mode",
  "theme.toDark": "Switch to dark mode",
  "theme.lightTitle": "Light mode",
  "theme.darkTitle": "Dark mode",
} as const;

export type TranslationKey = keyof typeof en;

export const es: Record<TranslationKey, string> = {
  "common.loading": "Cargando…",

  "nav.logoAria": "Frontera Finds — inicio",
  "header.searchPlaceholder": "Buscar artículos…",
  "header.sell": "Vender",

  "footer.tag": "El swapmeet sin fronteras — dos ciudades, un mercado.",
  "footer.meta": "Envíos a todo EE. UU. · Recogida y entrega local en San Diego ⟷ Tijuana · ",
  "footer.howItWorks": "Cómo funciona",
  "footer.instagramAria": "Frontera Finds en Instagram (@fronterafind.s)",

  "home.heroTitle": "Dos ciudades. Un mercado.",
  "home.heroSub": "El swapmeet sin fronteras",
  "home.shippingUsa": "Envíos a todo EE. UU.",
  "home.searchPlaceholder": "Buscar artículos…",
  "home.sortNewest": "Más recientes",
  "home.sortPriceAsc": "Precio: de menor a mayor",
  "home.sortPriceDesc": "Precio: de mayor a menor",
  "home.minPrice": "Mín $",
  "home.maxPrice": "Máx $",
  "home.filterShips": "Envío a EE. UU.",
  "home.filterLocal": "Recogida / entrega local",
  "home.filterHideSold": "Ocultar vendidos",
  "home.loadErrorPrefix": "No se pudieron cargar los artículos: ",
  "home.noResults": "Ningún artículo coincide con tus filtros.",

  "about.kicker": "El swapmeet sin fronteras",
  "about.title": "Dos ciudades. Un mercado.",
  "about.intro":
    "Frontera Finds es mi swapmeet personal en línea para la frontera entre San Diego y Tijuana — una venta de garaje dominguera que cruza la línea. Todo aquí es mío, único, y a precio de remate.",
  "about.shippingHeading": "Envíos a todo EE. UU. 🇺🇸",
  "about.shippingBody":
    "La mayoría de los artículos se pueden enviar a cualquier parte de Estados Unidos. Mándame tu código postal y te confirmo el envío antes de que pagues.",
  "about.localHeading": "Recogida y entrega local — San Diego ⟷ Tijuana 🌵",
  "about.localBody":
    "¿De cualquier lado de la línea? Olvídate del envío — coordina recogida local gratis, o entrega local en artículos más grandes. Solo toca WhatsApp o manda un mensaje en cualquier anuncio.",
  "about.howToBuyHeading": "Cómo comprar",
  "about.howToBuyLead": "Aquí no hay pago en línea. Encuentra algo que te guste y toca",
  "about.orWord": "o",
  "about.howToBuyTail":
    ", y arreglamos el pago (efectivo, Venmo, Zelle) y la entrega directamente.",

  "item.notFound": "Artículo no encontrado.",
  "item.soldNotice": "Este artículo ya se vendió.",

  "badge.sold": "VENDIDO",
  "badge.shipsUsa": "Envío a EE. UU.",
  "badge.localSdTj": "Local · SD ⟷ TJ",

  "contact.whatsapp": "WhatsApp",
  "contact.sms": "Texto / SMS",
  "contact.instagramDm": "Instagram DM",
  "contact.messageSeller": "Mensaje al vendedor",
  "contact.yourName": "Tu nombre",
  "contact.yourEmail": "Tu correo (para que el vendedor pueda responder)",
  "contact.messageLabel": "Mensaje",
  "contact.send": "Enviar",
  "contact.sendError": "No se pudo enviar — intenta por WhatsApp o mensaje de texto.",
  "contact.sent": "¡Enviado! El vendedor se pondrá en contacto contigo.",
  "contact.defaultMessage": "¡Hola! ¿\"{title}\" sigue disponible?",
  "contact.pitch": "¡Hola! Me interesa \"{title}\" ({price}) en Frontera Finds: {url}",

  "gallery.prev": "Foto anterior",
  "gallery.next": "Foto siguiente",
  "gallery.showPhoto": "Mostrar foto {n}",
  "gallery.photoAlt": "{title} — foto {n} de {total}",

  "theme.toLight": "Cambiar a modo claro",
  "theme.toDark": "Cambiar a modo oscuro",
  "theme.lightTitle": "Modo claro",
  "theme.darkTitle": "Modo oscuro",
};
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/i18n/translate.test.ts`
Expected: PASS — all suites green, including "es defines every key that en does".

- [ ] **Step 6: Commit**

```bash
git add src/i18n/translate.ts src/i18n/strings.ts src/i18n/translate.test.ts
git commit -m "feat(i18n): add translation core and EN/ES dictionary"
```

---

## Task 2: Language context + hook

**Files:**
- Create: `src/i18n/LanguageContext.tsx`

- [ ] **Step 1: Implement `src/i18n/LanguageContext.tsx`**

```tsx
import { createContext, useContext, useState } from "react";
import type { ReactNode } from "react";
import { en, es } from "./strings";
import type { TranslationKey } from "./strings";
import { resolveInitialLang, translate } from "./translate";
import type { Lang } from "./translate";

const dict: Record<Lang, Record<string, string>> = { en, es };

type Ctx = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
};

const LanguageContext = createContext<Ctx | null>(null);

function readStored(): string | null {
  try {
    return localStorage.getItem("ff_lang");
  } catch {
    return null; // private mode / storage disabled
  }
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() =>
    resolveInitialLang(
      readStored(),
      typeof navigator !== "undefined" ? navigator.language : undefined,
    ),
  );

  function setLang(l: Lang) {
    setLangState(l);
    try {
      localStorage.setItem("ff_lang", l);
    } catch {
      /* ignore */
    }
  }

  const t = (key: TranslationKey, params?: Record<string, string | number>) =>
    translate(dict, lang, key, params);

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLang(): Ctx {
  const c = useContext(LanguageContext);
  if (!c) throw new Error("useLang must be used within a LanguageProvider");
  return c;
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc -b`
Expected: PASS (no type errors).

- [ ] **Step 3: Commit**

```bash
git add src/i18n/LanguageContext.tsx
git commit -m "feat(i18n): add LanguageProvider and useLang hook"
```

---

## Task 3: LanguageToggle component + styles

**Files:**
- Create: `src/components/LanguageToggle.tsx`
- Modify: `src/theme.css` (after the `.ff-theme-toggle:hover` rule, ~line 172)

- [ ] **Step 1: Implement `src/components/LanguageToggle.tsx`**

The button shows the language you'll switch TO. Its `aria-label`/`title` are written in that target language (not via `t()`), so each label reads natively.

```tsx
import { useLang } from "../i18n/LanguageContext";

export default function LanguageToggle() {
  const { lang, setLang } = useLang();
  const targetIsSpanish = lang === "en";

  return (
    <button
      type="button"
      className="ff-lang-toggle"
      onClick={() => setLang(targetIsSpanish ? "es" : "en")}
      aria-label={targetIsSpanish ? "Cambiar a español" : "Switch to English"}
      title={targetIsSpanish ? "Cambiar a español" : "Switch to English"}
    >
      {targetIsSpanish ? "ES" : "EN"}
    </button>
  );
}
```

- [ ] **Step 2: Add styles to `src/theme.css`**

Insert immediately after the `.ff-theme-toggle:hover { ... }` line (currently line 172):

```css
.ff-lang-toggle {
  flex: none; height: 38px; padding: 0 12px; border-radius: 999px;
  border: 1px solid rgba(143, 230, 163, 0.4); background: transparent;
  color: var(--ff-bone); font: 700 13px var(--font-text); letter-spacing: 0.06em;
  cursor: pointer; display: flex; align-items: center; justify-content: center;
  transition: background 0.15s;
}
.ff-lang-toggle:hover { background: rgba(255, 255, 255, 0.1); }
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc -b`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/LanguageToggle.tsx src/theme.css
git commit -m "feat(i18n): add LanguageToggle button and styles"
```

---

## Task 4: Wire the provider + localize Header & Footer

**Files:**
- Modify: `src/main.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Wrap the app in `src/main.tsx`**

Replace the file contents with:

```tsx
import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { LanguageProvider } from "./i18n/LanguageContext";
import "./theme.css";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <LanguageProvider>
        <App />
      </LanguageProvider>
    </BrowserRouter>
  </React.StrictMode>
);
```

- [ ] **Step 2: Localize the Header in `src/App.tsx`**

Add the import near the other imports (after the `ThemeToggle` import on line 4):

```tsx
import LanguageToggle from "./components/LanguageToggle";
import { useLang } from "./i18n/LanguageContext";
```

In `Header()`, add `const { t } = useLang();` at the top of the function body (alongside the existing `const navigate = ...`). Then replace the logo aria, search placeholder, toggles, and Sell link. The current block (lines 18–32):

```tsx
      <Link to="/" className="ff-logo" aria-label="Frontera Finds — home">
```

becomes:

```tsx
      <Link to="/" className="ff-logo" aria-label={t("nav.logoAria")}>
```

The search input (line 29):

```tsx
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar / Search items…" />
```

becomes:

```tsx
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("header.searchPlaceholder")} />
```

The toggle + Sell lines (31–32):

```tsx
      <ThemeToggle />
      <Link to="/admin" className="ff-sell">Sell</Link>
```

become:

```tsx
      <LanguageToggle />
      <ThemeToggle />
      <Link to="/admin" className="ff-sell">{t("header.sell")}</Link>
```

- [ ] **Step 3: Localize the Footer in `src/App.tsx`**

The `App()` component renders the footer with hardcoded text. Add a `const { t } = useLang();` at the top of `App()`'s body (before `return`). Then replace the footer text block (lines 56–66):

```tsx
        <p className="ff-footer-tag">El swapmeet sin fronteras — two cities, one marketplace.</p>
        <p className="ff-footer-meta">
          Shipping across the USA · Local pickup &amp; delivery in San Diego ⟷ Tijuana ·{" "}
          <Link to="/about">How it works</Link>
        </p>
        <a
          className="ff-social"
          href="https://instagram.com/fronterafind.s"
          target="_blank"
          rel="noreferrer"
          aria-label="Frontera Finds on Instagram (@fronterafind.s)"
        >
```

with:

```tsx
        <p className="ff-footer-tag">{t("footer.tag")}</p>
        <p className="ff-footer-meta">
          {t("footer.meta")}
          <Link to="/about">{t("footer.howItWorks")}</Link>
        </p>
        <a
          className="ff-social"
          href="https://instagram.com/fronterafind.s"
          target="_blank"
          rel="noreferrer"
          aria-label={t("footer.instagramAria")}
        >
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc -b`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/main.tsx src/App.tsx
git commit -m "feat(i18n): wire LanguageProvider and localize header/footer"
```

---

## Task 5: Localize Home.tsx

**Files:**
- Modify: `src/pages/Home.tsx`

- [ ] **Step 1: Add the hook import and call**

Add after the existing imports (after line 5):

```tsx
import { useLang } from "../i18n/LanguageContext";
```

Inside `Home()`, add at the top of the body (after the `useState`/`params` declarations, before `useEffect`):

```tsx
  const { t } = useLang();
```

- [ ] **Step 2: Localize the hero band**

Replace the hero block (lines 57–66):

```tsx
    <div className="ff-hero">
      <div className="ff-hero-tag">
        <b>Two cities. One marketplace.</b>
        <i>El swapmeet sin fronteras</i>
      </div>
      <span className="ff-pill">
        San Diego <span className="ff-arrow">⟷</span> Tijuana
        <span className="ff-dot" /> Shipping across the USA
      </span>
    </div>
```

with:

```tsx
    <div className="ff-hero">
      <div className="ff-hero-tag">
        <b>{t("home.heroTitle")}</b>
        <i>{t("home.heroSub")}</i>
      </div>
      <span className="ff-pill">
        San Diego <span className="ff-arrow">⟷</span> Tijuana
        <span className="ff-dot" /> {t("home.shippingUsa")}
      </span>
    </div>
```

- [ ] **Step 3: Localize the filters block**

Replace the search input + select + price inputs (lines 69–84):

```tsx
        <input
          className="ff-input"
          type="search"
          placeholder="Search items…"
          defaultValue={q}
          onChange={(e) => setParam("q", e.target.value.trim())}
        />
        <select className="ff-input" value={sort} onChange={(e) => setParam("sort", e.target.value === "newest" ? "" : e.target.value)}>
          <option value="newest">Newest</option>
          <option value="price_asc">Price: low to high</option>
          <option value="price_desc">Price: high to low</option>
        </select>
        <input className="ff-input ff-input-price" type="number" min="0" placeholder="Min $" defaultValue={minPrice}
          onChange={(e) => setParam("minPrice", e.target.value)} />
        <input className="ff-input ff-input-price" type="number" min="0" placeholder="Max $" defaultValue={maxPrice}
          onChange={(e) => setParam("maxPrice", e.target.value)} />
```

with:

```tsx
        <input
          className="ff-input"
          type="search"
          placeholder={t("home.searchPlaceholder")}
          defaultValue={q}
          onChange={(e) => setParam("q", e.target.value.trim())}
        />
        <select className="ff-input" value={sort} onChange={(e) => setParam("sort", e.target.value === "newest" ? "" : e.target.value)}>
          <option value="newest">{t("home.sortNewest")}</option>
          <option value="price_asc">{t("home.sortPriceAsc")}</option>
          <option value="price_desc">{t("home.sortPriceDesc")}</option>
        </select>
        <input className="ff-input ff-input-price" type="number" min="0" placeholder={t("home.minPrice")} defaultValue={minPrice}
          onChange={(e) => setParam("minPrice", e.target.value)} />
        <input className="ff-input ff-input-price" type="number" min="0" placeholder={t("home.maxPrice")} defaultValue={maxPrice}
          onChange={(e) => setParam("maxPrice", e.target.value)} />
```

- [ ] **Step 4: Localize the filter buttons + status messages**

Replace the filter buttons block (lines 87–95):

```tsx
        <button className={ships ? "ff-btn ff-btn-green" : "ff-btn ff-btn-outline"} onClick={() => toggle("ships")}>
          Ships USA
        </button>
        <button className={local ? "ff-btn ff-btn-green" : "ff-btn ff-btn-outline"} onClick={() => toggle("local")}>
          Local pickup / delivery
        </button>
        <button className={hideSold ? "ff-btn ff-btn-green" : "ff-btn ff-btn-outline"} onClick={() => toggle("hideSold")}>
          Hide sold
        </button>
```

with:

```tsx
        <button className={ships ? "ff-btn ff-btn-green" : "ff-btn ff-btn-outline"} onClick={() => toggle("ships")}>
          {t("home.filterShips")}
        </button>
        <button className={local ? "ff-btn ff-btn-green" : "ff-btn ff-btn-outline"} onClick={() => toggle("local")}>
          {t("home.filterLocal")}
        </button>
        <button className={hideSold ? "ff-btn ff-btn-green" : "ff-btn ff-btn-outline"} onClick={() => toggle("hideSold")}>
          {t("home.filterHideSold")}
        </button>
```

Replace the status messages (lines 98–100):

```tsx
      {loading && <p>Loading…</p>}
      {error && <p style={{ color: "#a50e0e" }}>Couldn't load items: {error}</p>}
      {!loading && !error && items.length === 0 && <p>No items match your filters.</p>}
```

with:

```tsx
      {loading && <p>{t("common.loading")}</p>}
      {error && <p style={{ color: "#a50e0e" }}>{t("home.loadErrorPrefix")}{error}</p>}
      {!loading && !error && items.length === 0 && <p>{t("home.noResults")}</p>}
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc -b`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/pages/Home.tsx
git commit -m "feat(i18n): localize Home page copy"
```

---

## Task 6: Localize About.tsx

**Files:**
- Modify: `src/pages/About.tsx`

- [ ] **Step 1: Replace the whole component**

The "How to buy" paragraph keeps its bold action words by composing translated segments around `<strong>` elements. Replace the entire file with:

```tsx
import { useLang } from "../i18n/LanguageContext";

export default function About() {
  const { t } = useLang();
  return (
    <main className="ff-wrap" style={{ maxWidth: 720 }}>
      <span style={{ font: "600 12px 'Hanken Grotesk'", letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--ff-agave-600)" }}>
        {t("about.kicker")}
      </span>
      <h1 style={{ margin: "12px 0 0" }}>{t("about.title")}</h1>
      <p style={{ lineHeight: 1.7, fontSize: 18 }}>{t("about.intro")}</p>

      <h3>{t("about.shippingHeading")}</h3>
      <p style={{ lineHeight: 1.7 }}>{t("about.shippingBody")}</p>

      <h3>{t("about.localHeading")}</h3>
      <p style={{ lineHeight: 1.7 }}>{t("about.localBody")}</p>

      <h3>{t("about.howToBuyHeading")}</h3>
      <p style={{ lineHeight: 1.7 }}>
        {t("about.howToBuyLead")}{" "}
        <strong>{t("contact.whatsapp")}</strong>, <strong>{t("contact.sms")}</strong>,{" "}
        <strong>{t("contact.messageSeller")}</strong>, {t("about.orWord")}{" "}
        <strong>Instagram</strong>{t("about.howToBuyTail")}
      </p>
    </main>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc -b`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/pages/About.tsx
git commit -m "feat(i18n): localize About page copy"
```

---

## Task 7: Localize ItemPage, ItemCard, Badges

**Files:**
- Modify: `src/pages/ItemPage.tsx`
- Modify: `src/components/ItemCard.tsx`
- Modify: `src/components/Badges.tsx`

- [ ] **Step 1: Localize `src/pages/ItemPage.tsx`**

Add the import after line 8 (`import Gallery ...`):

```tsx
import { useLang } from "../i18n/LanguageContext";
```

Inside `ItemPage()`, add after the `useState` declarations (before the `useEffect`):

```tsx
  const { t } = useLang();
```

Replace the `catch`/loading/error lines. The current `useEffect` body (line 17):

```tsx
    api.get(id).then((r) => setItem(r.item)).catch(() => setError("Item not found."));
```

becomes:

```tsx
    api.get(id).then((r) => setItem(r.item)).catch(() => setError(t("item.notFound")));
```

The guard lines (20–21):

```tsx
  if (error) return <main className="ff-wrap"><p>{error}</p></main>;
  if (!item) return <main className="ff-wrap"><p>Loading…</p></main>;
```

become:

```tsx
  if (error) return <main className="ff-wrap"><p>{error}</p></main>;
  if (!item) return <main className="ff-wrap"><p>{t("common.loading")}</p></main>;
```

The SOLD badge + sold notice (lines 28 and 33–35):

```tsx
        {item.status === "sold" && <span className="ff-badge-sold">SOLD</span>}
```

becomes:

```tsx
        {item.status === "sold" && <span className="ff-badge-sold">{t("badge.sold")}</span>}
```

and:

```tsx
      {item.status === "sold"
        ? <p style={{ fontWeight: 700 }}>This item has been sold.</p>
        : <ContactButtons item={item} />}
```

becomes:

```tsx
      {item.status === "sold"
        ? <p style={{ fontWeight: 700 }}>{t("item.soldNotice")}</p>
        : <ContactButtons item={item} />}
```

Note: `useLang` must be called before the early `return`s, which is why it is added near the top of the component (React hooks must run unconditionally).

- [ ] **Step 2: Localize `src/components/ItemCard.tsx`**

Add the import after line 4 (`import Badges ...`):

```tsx
import { useLang } from "../i18n/LanguageContext";
```

Inside `ItemCard(...)`, add at the top of the body (before `return`):

```tsx
  const { t } = useLang();
```

Replace the SOLD ribbon (line 16):

```tsx
        {item.status === "sold" && <span className="ff-card-sold">SOLD</span>}
```

with:

```tsx
        {item.status === "sold" && <span className="ff-card-sold">{t("badge.sold")}</span>}
```

(Leave `alt={item.title}` as-is — item titles are seller content and not translated.)

- [ ] **Step 3: Localize `src/components/Badges.tsx`**

Replace the entire file with:

```tsx
import type { Item } from "../lib/types";
import { useLang } from "../i18n/LanguageContext";

export default function Badges({ item }: { item: Item }) {
  const { t } = useLang();
  return (
    <div className="ff-badges">
      {item.shipsUsa && <span className="ff-badge ff-badge-ship">{t("badge.shipsUsa")}</span>}
      {item.localSdtj && <span className="ff-badge ff-badge-local">{t("badge.localSdTj")}</span>}
    </div>
  );
}
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc -b`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/pages/ItemPage.tsx src/components/ItemCard.tsx src/components/Badges.tsx
git commit -m "feat(i18n): localize item page, card, and badges"
```

---

## Task 8: Localize ContactButtons.tsx

**Files:**
- Modify: `src/components/ContactButtons.tsx`

- [ ] **Step 1: Add the hook import**

Add after line 5 (`import { money } ...`):

```tsx
import { useLang } from "../i18n/LanguageContext";
```

- [ ] **Step 2: Use `t` for the default message and pitch**

Inside `ContactButtons(...)`, add `const { t } = useLang();` as the first line of the body (before the `useState` calls). Then change the `message` state initializer and `pitch`. Current line 20:

```tsx
  const [message, setMessage] = useState(`Hi! Is "${item.title}" still available?`);
```

becomes:

```tsx
  const [message, setMessage] = useState(t("contact.defaultMessage", { title: item.title }));
```

Current line 26:

```tsx
  const pitch = `Hi! I'm interested in "${item.title}" (${money(item.priceCents)}) on Frontera Finds: ${location.origin}/item/${item.slug}`;
```

becomes:

```tsx
  const pitch = t("contact.pitch", {
    title: item.title,
    price: money(item.priceCents),
    url: `${location.origin}/item/${item.slug}`,
  });
```

- [ ] **Step 3: Localize the send-error message**

Current line 35 (inside `submit`'s catch):

```tsx
      setErr("Couldn't send — please try WhatsApp or text instead.");
```

becomes:

```tsx
      setErr(t("contact.sendError"));
```

- [ ] **Step 4: Localize the buttons, form labels, and toast**

Replace the JSX button labels and form (lines 43–76). The contact links (43–56):

```tsx
          <a className="ff-btn ff-btn-green" href={waLink(cfg.whatsapp, pitch)} target="_blank" rel="noreferrer">
            WhatsApp
          </a>
          <a className="ff-btn ff-btn-outline" href={smsLink(cfg.sms, pitch)}>Text / SMS</a>
          {cfg.instagramUrl && (
            <a className="ff-btn ff-btn-outline" href={cfg.instagramUrl} target="_blank" rel="noreferrer">
              Instagram DM
            </a>
          )}
        </>
      )}
      <button className="ff-btn ff-btn-outline" onClick={() => setShowForm((s) => !s)}>
        Message the seller
      </button>
```

become:

```tsx
          <a className="ff-btn ff-btn-green" href={waLink(cfg.whatsapp, pitch)} target="_blank" rel="noreferrer">
            {t("contact.whatsapp")}
          </a>
          <a className="ff-btn ff-btn-outline" href={smsLink(cfg.sms, pitch)}>{t("contact.sms")}</a>
          {cfg.instagramUrl && (
            <a className="ff-btn ff-btn-outline" href={cfg.instagramUrl} target="_blank" rel="noreferrer">
              {t("contact.instagramDm")}
            </a>
          )}
        </>
      )}
      <button className="ff-btn ff-btn-outline" onClick={() => setShowForm((s) => !s)}>
        {t("contact.messageSeller")}
      </button>
```

The form labels, submit button, and success toast (60–76):

```tsx
          <div className="ff-field">
            <label>Your name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="ff-field">
            <label>Your email (so the seller can reply)</label>
            <input value={replyTo} onChange={(e) => setReplyTo(e.target.value)} type="email" />
          </div>
          <div className="ff-field">
            <label>Message</label>
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3} />
          </div>
          {err && <p style={{ color: "#a50e0e" }}>{err}</p>}
          <button className="ff-btn ff-btn-green" type="submit">Send</button>
        </form>
      )}
      {sent && <p style={{ color: "var(--ff-green-dark)" }}>Sent! The seller will get back to you.</p>}
```

become:

```tsx
          <div className="ff-field">
            <label>{t("contact.yourName")}</label>
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="ff-field">
            <label>{t("contact.yourEmail")}</label>
            <input value={replyTo} onChange={(e) => setReplyTo(e.target.value)} type="email" />
          </div>
          <div className="ff-field">
            <label>{t("contact.messageLabel")}</label>
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3} />
          </div>
          {err && <p style={{ color: "#a50e0e" }}>{err}</p>}
          <button className="ff-btn ff-btn-green" type="submit">{t("contact.send")}</button>
        </form>
      )}
      {sent && <p style={{ color: "var(--ff-green-dark)" }}>{t("contact.sent")}</p>}
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc -b`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/ContactButtons.tsx
git commit -m "feat(i18n): localize contact buttons and form"
```

---

## Task 9: Localize Gallery.tsx + ThemeToggle.tsx

**Files:**
- Modify: `src/components/Gallery.tsx`
- Modify: `src/components/ThemeToggle.tsx`

- [ ] **Step 1: Localize `src/components/Gallery.tsx`**

Add the import after line 2 (`import { imgUrl } ...`):

```tsx
import { useLang } from "../i18n/LanguageContext";
```

Inside `Gallery(...)`, add `const { t } = useLang();` after the existing `const n = photoKeys.length;` line. The numeric `n === 0` early return stays as-is (it renders no text). Then replace the image `alt`, nav buttons, and thumbnail aria-labels.

Current line 20 (the framed image alt):

```tsx
        <img src={imgUrl(photoKeys[current])} alt={n > 1 ? `${title} — photo ${current + 1} of ${n}` : title} />
```

becomes:

```tsx
        <img src={imgUrl(photoKeys[current])} alt={n > 1 ? t("gallery.photoAlt", { title, n: current + 1, total: n }) : title} />
```

Current lines 23–24 (nav buttons):

```tsx
            <button className="ff-gallery-nav ff-gallery-prev" onClick={() => go(-1)} aria-label="Previous photo">‹</button>
            <button className="ff-gallery-nav ff-gallery-next" onClick={() => go(1)} aria-label="Next photo">›</button>
```

become:

```tsx
            <button className="ff-gallery-nav ff-gallery-prev" onClick={() => go(-1)} aria-label={t("gallery.prev")}>‹</button>
            <button className="ff-gallery-nav ff-gallery-next" onClick={() => go(1)} aria-label={t("gallery.next")}>›</button>
```

Current line 36 (thumbnail aria-label):

```tsx
              aria-label={`Show photo ${idx + 1}`}
```

becomes:

```tsx
              aria-label={t("gallery.showPhoto", { n: idx + 1 })}
```

(The `{current + 1} / {n}` counter on line 25 stays numeric — no change.)

- [ ] **Step 2: Localize `src/components/ThemeToggle.tsx`**

Add the import after the React import (line 1):

```tsx
import { useLang } from "../i18n/LanguageContext";
```

Inside `ThemeToggle()`, add `const { t } = useLang();` after the existing `const [theme, setTheme] = useState<Theme>(currentTheme);` line. Replace the `aria-label`/`title` lines in the returned button:

```tsx
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      title={theme === "dark" ? "Light mode" : "Dark mode"}
```

with:

```tsx
      aria-label={theme === "dark" ? t("theme.toLight") : t("theme.toDark")}
      title={theme === "dark" ? t("theme.lightTitle") : t("theme.darkTitle")}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc -b`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/Gallery.tsx src/components/ThemeToggle.tsx
git commit -m "feat(i18n): localize gallery and theme-toggle aria labels"
```

---

## Task 10: Full build + manual verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite for the i18n core**

Run: `npx vitest run src/i18n/translate.test.ts`
Expected: PASS (including the es-completeness guard).

- [ ] **Step 2: Production build / full typecheck**

Run: `npm run build`
Expected: `tsc -b` passes and `vite build` completes with no errors.

- [ ] **Step 3: Manual smoke test**

Run: `npm run dev` and open the local URL. Verify:
- A pill button reading **ES** sits to the left of the dark-mode toggle in the header.
- Click it → the entire UI chrome switches to Spanish (header "Vender", hero, filters, footer) and the button now reads **EN**. Item titles/descriptions stay exactly as entered.
- Visit an item page: SOLD badge → "VENDIDO", badges, gallery aria, contact buttons/form all in Spanish; the prefilled "Message the seller" text is in Spanish.
- Visit `/about`: all sections translated; the "How to buy" paragraph keeps its bold action words.
- Reload the page → language persists (stored in `localStorage` under `ff_lang`).
- In devtools, run `localStorage.removeItem("ff_lang")`, set the browser/Chrome language to Spanish, reload → site defaults to Spanish. Reset to English and confirm it defaults to English.
- The `/admin` pages remain in English (intentionally out of scope).

- [ ] **Step 4: Final commit (if the manual pass surfaced any tweaks)**

```bash
git add -A
git commit -m "chore(i18n): finalize Spanish/English toggle"
```

---

## Self-Review Notes

- **Spec coverage:** mechanism (Task 1–2), toggle showing target language with native aria (Task 3), provider wiring + browser default (Task 2/4), all listed public files localized (Tasks 4–9), admin & item content untouched (verified Task 10), `{n}` interpolation for Gallery (Task 1 dict + Task 9). ✓
- **No URL locales / no flash mitigation:** matches spec's accepted v1 trade-offs; not implemented by design. ✓
- **Type consistency:** `t(key, params?)`, `useLang()`, `setLang(l)`, `resolveInitialLang(stored, navLang)`, `translate(dict, lang, key, params?)`, `Lang`, `TranslationKey` used identically across all tasks. ✓
- **Test scoping:** tests target `src/i18n/translate.test.ts` specifically (node env, no DOM) to avoid the separate worker vitest config. ✓
