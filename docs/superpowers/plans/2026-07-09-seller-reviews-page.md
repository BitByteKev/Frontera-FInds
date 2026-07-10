# Seller Reviews Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A `/reviews` page on fronterafinds.com showing the 4.9★/51 summary, strengths chips, and all written Facebook Marketplace reviews, linked from the footer and item pages.

**Architecture:** Reviews are grabbed once from the seller's FB profile through the logged-in Chrome session and committed as static `src/data/reviews.json` (tsconfig has `resolveJsonModule`). A new `Reviews.tsx` page renders purely from that JSON — no API, no loading states. Entry points: footer meta link + item-page trust line. Frontend-only; deploys via push to main (Vercel).

**Tech Stack:** React 18 + react-router-dom, existing `useLang()` i18n (`t()` supports `{param}` interpolation), Vitest, Claude-in-Chrome for the one-time grab.

**Spec:** `docs/superpowers/specs/2026-07-09-seller-reviews-page-design.md`

**Branch:** `build/reviews-page`, merged to main at the end.

---

### Task 1: Data validation test (TDD)

**Files:**
- Create: `src/data/reviews.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import data from "./reviews.json";

const TAGS = ["communication", "pricing", "punctuality", "itemDescription"];

describe("reviews.json", () => {
  it("has a numeric summary with all four strengths", () => {
    expect(data.summary.rating).toBeGreaterThan(0);
    expect(data.summary.rating).toBeLessThanOrEqual(5);
    expect(data.summary.count).toBeGreaterThan(0);
    for (const k of TAGS) {
      expect(typeof (data.summary.strengths as Record<string, number>)[k]).toBe("number");
    }
  });

  it("has well-formed written reviews, newest first", () => {
    expect(data.reviews.length).toBeGreaterThan(0);
    let prev = Infinity;
    for (const r of data.reviews) {
      expect(r.name.trim()).not.toBe("");
      expect(r.text.trim()).not.toBe("");
      expect(r.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      const ts = new Date(r.date + "T12:00:00Z").getTime();
      expect(Number.isNaN(ts)).toBe(false);
      expect(ts).toBeLessThanOrEqual(prev);
      prev = ts;
      for (const tag of r.tags) expect(TAGS).toContain(tag);
    }
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- reviews`
Expected: FAIL — cannot resolve `./reviews.json` (file doesn't exist yet).

---

### Task 2: Grab the reviews from Facebook (operational) → `src/data/reviews.json`

**Files:**
- Create: `src/data/reviews.json`

- [ ] **Step 1: Load all reviews.** In Chrome (logged-in session), open
`https://www.facebook.com/marketplace/profile/61558944447221/`. Inside the profile dialog, scroll the scrollable container repeatedly until the "Seller reviews (51)" list stops growing (same loop technique as the listings enumeration).

- [ ] **Step 2: Extract entries.** Parse the dialog's text/DOM from the "Seller reviews (" marker. Each entry follows the pattern: reviewer first name line, a date line matching `/^[A-Z][a-z]+ \d{1,2}, \d{4}$/` (e.g. "March 11, 2026"), an optional "Notable:" segment whose following short lines are tags (Punctuality / Communication / Pricing / Item Description), then the review text lines, terminated by the "Like" control. Collect `{ name, dateText, tags, text }`; drop entries whose text is empty (rating-only).

- [ ] **Step 3: Write the JSON.** Convert `dateText` to ISO (`new Date("March 11, 2026")` → `2026-03-11`), map tag labels to keys (`Item Description` → `itemDescription`, others lowercase), sort newest first, and write:

```json
{
  "summary": {
    "rating": 4.9,
    "count": 51,
    "strengths": { "communication": 30, "pricing": 27, "punctuality": 27, "itemDescription": 24 }
  },
  "reviews": [
    { "name": "Noella", "date": "2026-03-11", "tags": ["punctuality", "communication", "pricing", "itemDescription"], "text": "Great transaction wonderful communication very happy. I highly recommend the seller." }
  ]
}
```

(`summary` values verified against the live profile at grab time.)

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- reviews`
Expected: PASS (both tests).

- [ ] **Step 5: Commit**

```bash
git add src/data/reviews.json src/data/reviews.test.ts
git commit -m "feat(reviews): add seller reviews data grabbed from Facebook Marketplace"
```

---

### Task 3: i18n strings

**Files:**
- Modify: `src/i18n/strings.ts` (both `en` and `es` objects)

- [ ] **Step 1: Add to the `en` object** (after the `footer.*` keys):

```ts
  "footer.reviews": "Reviews",
  "reviews.kicker": "Buyer feedback",
  "reviews.title": "Seller reviews",
  "reviews.summary": "{rating} out of 5 — based on {count} ratings on Facebook Marketplace",
  "reviews.highlyRated": "Highly rated seller on Facebook Marketplace",
  "reviews.strengthsHeading": "What buyers appreciate",
  "reviews.langNote": "Reviews appear as written by buyers.",
  "reviews.seeAllFb": "See all reviews on Facebook Marketplace",
  "reviews.itemTrust": "{count} ratings — read seller reviews",
  "reviews.tag.communication": "Communication",
  "reviews.tag.pricing": "Pricing",
  "reviews.tag.punctuality": "Punctuality",
  "reviews.tag.itemDescription": "Item description",
```

- [ ] **Step 2: Add to the `es` object** (same position):

```ts
  "footer.reviews": "Reseñas",
  "reviews.kicker": "Opiniones de compradores",
  "reviews.title": "Reseñas del vendedor",
  "reviews.summary": "{rating} de 5 — según {count} calificaciones en Facebook Marketplace",
  "reviews.highlyRated": "Vendedor muy bien calificado en Facebook Marketplace",
  "reviews.strengthsHeading": "Lo que aprecian los compradores",
  "reviews.langNote": "Las reseñas se muestran en su idioma original.",
  "reviews.seeAllFb": "Ver todas las reseñas en Facebook Marketplace",
  "reviews.itemTrust": "{count} calificaciones — lee las reseñas del vendedor",
  "reviews.tag.communication": "Comunicación",
  "reviews.tag.pricing": "Precio",
  "reviews.tag.punctuality": "Puntualidad",
  "reviews.tag.itemDescription": "Descripción del artículo",
```

- [ ] **Step 3: Type-check** — Run: `npm run build`. Expected: succeeds (the `es` Record type fails the build if any key is missing).

- [ ] **Step 4: Commit**

```bash
git add src/i18n/strings.ts
git commit -m "feat(i18n): add reviews page strings (EN/ES)"
```

---

### Task 4: Reviews page + route + footer link

**Files:**
- Create: `src/pages/Reviews.tsx`
- Modify: `src/App.tsx` (import, route, footer link)

- [ ] **Step 1: Create `src/pages/Reviews.tsx`**

```tsx
import type { CSSProperties } from "react";
import { useLang } from "../i18n/LanguageContext";
import reviewsData from "../data/reviews.json";

const FB_PROFILE = "https://www.facebook.com/marketplace/profile/61558944447221/";

const TAG_KEYS = {
  communication: "reviews.tag.communication",
  pricing: "reviews.tag.pricing",
  punctuality: "reviews.tag.punctuality",
  itemDescription: "reviews.tag.itemDescription",
} as const;

const chip: CSSProperties = {
  border: "1px solid var(--ff-line)",
  borderRadius: 999,
  padding: "3px 10px",
  fontSize: 13,
};

export default function Reviews() {
  const { t, lang } = useLang();
  const { summary, reviews } = reviewsData;
  const fmt = new Intl.DateTimeFormat(lang === "es" ? "es-MX" : "en-US", { month: "long", year: "numeric" });
  return (
    <main className="ff-wrap" style={{ maxWidth: 720 }}>
      <span style={{ font: "600 12px 'Hanken Grotesk'", letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--ff-agave-600)" }}>
        {t("reviews.kicker")}
      </span>
      <h1 style={{ margin: "12px 0 4px" }}>{t("reviews.title")}</h1>
      <div style={{ fontSize: 22, color: "var(--ff-agave-600)", letterSpacing: 2 }} aria-hidden="true">★★★★★</div>
      <p style={{ fontWeight: 700, margin: "6px 0 2px" }}>
        {t("reviews.summary", { rating: String(summary.rating), count: String(summary.count) })}
      </p>
      <p style={{ margin: "0 0 16px" }}>{t("reviews.highlyRated")}</p>

      <h3 style={{ margin: "0 0 8px" }}>{t("reviews.strengthsHeading")}</h3>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
        {(Object.entries(summary.strengths) as [keyof typeof TAG_KEYS, number][]).map(([k, n]) => (
          <span key={k} style={chip}>{t(TAG_KEYS[k])} · {n}</span>
        ))}
      </div>
      <p style={{ fontSize: 13, margin: "0 0 18px" }}>{t("reviews.langNote")}</p>

      <div style={{ display: "grid", gap: 12 }}>
        {reviews.map((r, i) => (
          <article key={i} style={{ border: "1px solid var(--ff-line)", borderRadius: 10, padding: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 6 }}>
              <strong>{r.name}</strong>
              <span style={{ fontSize: 13 }}>{fmt.format(new Date(r.date + "T12:00:00"))}</span>
            </div>
            {r.tags.length > 0 && (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "8px 0 0" }}>
                {r.tags.map((tag) => (
                  <span key={tag} style={chip}>{t(TAG_KEYS[tag as keyof typeof TAG_KEYS])}</span>
                ))}
              </div>
            )}
            <p style={{ margin: "10px 0 0", lineHeight: 1.6 }}>{r.text}</p>
          </article>
        ))}
      </div>

      <p style={{ marginTop: 22 }}>
        <a href={FB_PROFILE} target="_blank" rel="noreferrer">{t("reviews.seeAllFb")}</a>
      </p>
    </main>
  );
}
```

- [ ] **Step 2: Register the route in `src/App.tsx`.** Add the import after the `About` import:

```tsx
import Reviews from "./pages/Reviews";
```

Add the route after the `/about` route:

```tsx
        <Route path="/reviews" element={<Reviews />} />
```

- [ ] **Step 3: Footer link.** In the footer's meta paragraph, change:

```tsx
        <p className="ff-footer-meta">
          {t("footer.meta")}
          <Link to="/about">{t("footer.howItWorks")}</Link>
        </p>
```

to:

```tsx
        <p className="ff-footer-meta">
          {t("footer.meta")}
          <Link to="/about">{t("footer.howItWorks")}</Link>
          {" · "}
          <Link to="/reviews">{t("footer.reviews")}</Link>
        </p>
```

- [ ] **Step 4: Build + tests** — Run: `npm run build && npm test -- reviews`. Expected: build succeeds, tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/pages/Reviews.tsx src/App.tsx
git commit -m "feat(reviews): add /reviews page with summary, strengths, and review cards"
```

---

### Task 5: Item-page trust line

**Files:**
- Modify: `src/pages/ItemPage.tsx`

- [ ] **Step 1: Add imports** (top of file, alongside existing imports):

```tsx
import { Link } from "react-router-dom";
import reviewsData from "../data/reviews.json";
```

- [ ] **Step 2: Render the trust line.** After the ContactButtons ternary:

```tsx
      {view.status === "sold"
        ? <p style={{ fontWeight: 700 }}>{t("item.soldNotice")}</p>
        : <ContactButtons item={view} />}
```

append:

```tsx
      <p style={{ marginTop: 14, fontSize: 14 }}>
        <Link to="/reviews">
          ★ {reviewsData.summary.rating} · {t("reviews.itemTrust", { count: String(reviewsData.summary.count) })}
        </Link>
      </p>
```

- [ ] **Step 3: Build + full frontend tests** — Run: `npm run build && npm test`. Expected: build succeeds; 25 previous + 2 new tests pass (worker-test collection failures under root vitest are pre-existing).

- [ ] **Step 4: Commit**

```bash
git add src/pages/ItemPage.tsx
git commit -m "feat(item): link to seller reviews under contact buttons"
```

---

### Task 6: Merge, deploy, verify live

**Files:** none (operational)

- [ ] **Step 1: Merge and push**

```bash
git checkout main && git merge --no-ff build/reviews-page -m "Merge branch 'build/reviews-page'"
git push origin main
```

- [ ] **Step 2: Wait for Vercel** — poll `https://fronterafinds.com/` until the served `assets/index-*.js` hash matches the local `dist/index.html` hash (same poll loop as prior deploys). No `npm run deploy` needed (frontend-only change).

- [ ] **Step 3: Verify live in Chrome** — `/reviews` renders summary, chips, and review cards; toggle ES and confirm chrome strings + tag chips are Spanish and dates render like "marzo de 2026"; footer "Reviews/Reseñas" link navigates; an item page shows the "★ 4.9 · …" trust line linking to `/reviews`.
