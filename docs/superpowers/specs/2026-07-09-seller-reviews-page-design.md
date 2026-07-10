# Seller Reviews Page — Design

**Date:** 2026-07-09
**Status:** Approved (pending spec review)

## Goal

A public `/reviews` page on fronterafinds.com showing the seller's Facebook
Marketplace track record: the 4.9★ / 51-ratings summary, buyer-strengths
chips, and every written buyer review — grabbed once from
https://www.facebook.com/marketplace/profile/61558944447221/.

## Decisions

- **Storage:** static `src/data/reviews.json` committed to the repo — no D1
  table, no API endpoint. Reviews change rarely; updating = re-running the
  grab and committing.
- **Scope:** all reviews that have written text (rating-only entries are
  skipped), newest first.
- **Review text:** verbatim English. Testimonials are not machine-translated;
  page chrome is fully EN/ES.
- **Names:** first names as shown publicly on the Facebook profile.
- **Rejected:** D1-backed reviews (YAGNI); live Facebook embed (no API,
  login-walled).

## Data file

`src/data/reviews.json`:

```json
{
  "summary": {
    "rating": 4.9,
    "count": 51,
    "strengths": {
      "communication": 30,
      "pricing": 27,
      "punctuality": 27,
      "itemDescription": 24
    }
  },
  "reviews": [
    { "name": "Noella", "date": "2026-03-11",
      "tags": ["punctuality", "communication", "pricing", "itemDescription"],
      "text": "Great transaction wonderful communication very happy. I highly recommend the seller." }
  ]
}
```

- `date` is ISO `YYYY-MM-DD` parsed from Facebook's "March 11, 2026" format.
- `tags` values are one of the four canonical keys above (from the review's
  "Notable:" line); may be empty.
- Capture is operational (Chrome, logged-in session), like the listings
  import: scroll the profile dialog's "Seller reviews (51)" section until all
  load, extract name/date/tags/text per entry, keep entries with non-empty
  text.

## Page

`src/pages/Reviews.tsx`, route `/reviews` registered in `src/App.tsx`.

- **Header:** kicker + title (matching About's style); star row; "4.9 out of
  5 — based on 51 ratings on Facebook Marketplace"; a "Highly rated seller"
  line; strengths chips with counts.
- **Cards:** one per review — first name, date formatted month + year in the
  active language via `Intl.DateTimeFormat(lang, { month: "long", year:
  "numeric" })`, tag chips, review text. Existing `ff-` styling conventions;
  no new CSS framework.
- **Footer of page:** outbound link to the Facebook Marketplace profile
  ("See all reviews on Facebook Marketplace").
- **i18n:** new `reviews.*` strings in `src/i18n/strings.ts` (EN + ES), plus
  the four tag names (ES: Puntualidad, Comunicación, Precio, Descripción del
  artículo). ES note that reviews are shown in their original language.

## Entry points

- Footer meta line: a "Reviews" link next to "How it works".
- Item pages: a trust line under the contact buttons — "★ 4.9 · 51 ratings"
  linking to `/reviews` (new `reviews.itemTrust` string, EN/ES).

## Error handling

- The page renders purely from the committed JSON — no fetch, no loading or
  error states.
- A review with an unknown tag or bad date must fail the data test rather
  than render wrong.

## Testing

- `src/data/reviews.test.ts` (vitest): every review has non-empty `text`, a
  date matching `^\d{4}-\d{2}-\d{2}$` that parses, `tags` ⊆ the four
  canonical keys, non-empty `name`; summary fields present and numeric.
- `npm run build` type-checks; ES string coverage is enforced by the existing
  `Record<TranslationKey>` typing.
- Live verification after deploy: /reviews renders in EN and ES, footer and
  item-page links navigate to it.

## Out of scope (YAGNI)

- No admin UI for reviews; no automatic sync from Facebook.
- No per-review star display (Facebook shows tags + text, not per-review
  star values).
- No pagination (single scrolling page).
