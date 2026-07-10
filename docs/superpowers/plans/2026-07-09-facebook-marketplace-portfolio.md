# Facebook Marketplace Portfolio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Facebook Marketplace link to the public site and import the seller's ~20 active Marketplace listings into the production catalog as published items.

**Architecture:** Tasks 1–4 are a small code change mirroring the existing `PUBLIC_INSTAGRAM_URL` plumbing (`wrangler.toml` var → `/api/config` → `SiteConfig` → UI). Tasks 5–10 are a one-time operational import: read listings through the seller's logged-in Chrome session, generate photos + SQL with a throwaway scratchpad script, and push to production R2/D1 with the authenticated `wrangler` CLI. No import code ships in the repo.

**Tech Stack:** React 18 + Vite, Hono on Cloudflare Workers, D1, R2, Vitest (workers pool), wrangler 4.x, Claude-in-Chrome browser tools.

**Spec:** `docs/superpowers/specs/2026-07-09-facebook-marketplace-portfolio-design.md`

**Scratchpad:** operational artifacts (JSON, scripts, downloaded photos) go in the session scratchpad directory, NOT the repo. Below it is written as `$SCRATCH`.

---

### Task 1: Worker — `facebookUrl` in `/api/config` (TDD)

**Files:**
- Create: `worker/test/config.test.ts`
- Modify: `worker/vitest.config.ts` (test bindings)
- Modify: `worker/src/index.ts` (Env + handler)
- Modify: `wrangler.toml` (`[vars]`)

- [ ] **Step 1: Write the failing test**

Create `worker/test/config.test.ts`:

```ts
import { env, createExecutionContext, waitOnExecutionContext } from "cloudflare:test";
import { describe, it, expect } from "vitest";
import "./setup-db";
import app from "../src/index";

describe("GET /api/config", () => {
  it("returns the public contact/social config including facebookUrl", async () => {
    const ctx = createExecutionContext();
    const res = await app.fetch(new Request("http://x/api/config"), env, ctx);
    await waitOnExecutionContext(ctx);
    expect(res.status).toBe(200);
    const cfg = await res.json<{
      whatsapp: string;
      sms: string;
      instagramUrl: string;
      facebookUrl: string;
    }>();
    expect(cfg.whatsapp).toBe("+16199448759");
    expect(cfg.instagramUrl).toBe("https://instagram.com/test");
    expect(cfg.facebookUrl).toBe("https://www.facebook.com/marketplace/profile/61558944447221/");
  });
});
```

Add the test binding in `worker/vitest.config.ts` (inside `bindings:`, after `PUBLIC_INSTAGRAM_URL`):

```ts
              PUBLIC_INSTAGRAM_URL: "https://instagram.com/test",
              PUBLIC_FACEBOOK_URL: "https://www.facebook.com/marketplace/profile/61558944447221/",
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:worker -- config`
Expected: FAIL — `facebookUrl` is `undefined` (handler doesn't return it yet).

- [ ] **Step 3: Implement**

In `worker/src/index.ts`, add to the `Env` interface after `PUBLIC_INSTAGRAM_URL: string;`:

```ts
  PUBLIC_FACEBOOK_URL: string;
```

Change the `/api/config` handler to:

```ts
app.get("/api/config", (c) =>
  c.json({
    whatsapp: c.env.PUBLIC_WHATSAPP,
    sms: c.env.PUBLIC_SMS,
    instagramUrl: c.env.PUBLIC_INSTAGRAM_URL,
    facebookUrl: c.env.PUBLIC_FACEBOOK_URL,
  })
);
```

In `wrangler.toml` `[vars]`, after the `PUBLIC_INSTAGRAM_URL` line add:

```toml
PUBLIC_FACEBOOK_URL = "https://www.facebook.com/marketplace/profile/61558944447221/"
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:worker`
Expected: all worker tests PASS (config test included).

- [ ] **Step 5: Commit**

```bash
git add worker/test/config.test.ts worker/vitest.config.ts worker/src/index.ts wrangler.toml
git commit -m "feat(config): expose PUBLIC_FACEBOOK_URL as facebookUrl in /api/config"
```

---

### Task 2: Frontend — SiteConfig type, i18n string, ContactButtons button

**Files:**
- Modify: `src/lib/types.ts` (SiteConfig)
- Modify: `src/i18n/strings.ts` (en + es)
- Modify: `src/components/ContactButtons.tsx`

- [ ] **Step 1: Add `facebookUrl` to `SiteConfig`** in `src/lib/types.ts`:

```ts
export interface SiteConfig {
  whatsapp: string;
  sms: string;
  instagramUrl: string;
  facebookUrl: string;
}
```

- [ ] **Step 2: Add the button label string** in `src/i18n/strings.ts`. In the `en` object after `"contact.instagramDm": "Instagram DM",`:

```ts
  "contact.facebook": "Facebook Marketplace",
```

And identically in the `es` object after its `"contact.instagramDm": "Instagram DM",` (proper noun — same text in Spanish):

```ts
  "contact.facebook": "Facebook Marketplace",
```

(The `es` Record is typed to cover every `en` key, so the build fails if either side is missed.)

- [ ] **Step 3: Render the button** in `src/components/ContactButtons.tsx`, directly after the `cfg.instagramUrl` block and inside the same `<>…</>`:

```tsx
          {cfg.facebookUrl && (
            <a className="ff-btn ff-btn-outline" href={cfg.facebookUrl} target="_blank" rel="noreferrer">
              {t("contact.facebook")}
            </a>
          )}
```

- [ ] **Step 4: Type-check and run frontend tests**

Run: `npm run build && npm test`
Expected: build succeeds (tsc + vite), vitest suite PASSES.

- [ ] **Step 5: Commit**

```bash
git add src/lib/types.ts src/i18n/strings.ts src/components/ContactButtons.tsx
git commit -m "feat(contact): add Facebook Marketplace button to contact options"
```

---

### Task 3: About page — mention Facebook Marketplace

**Files:**
- Modify: `src/pages/About.tsx:20-25` (how-to-buy paragraph)

- [ ] **Step 1: Update the how-to-buy sentence.** In `src/pages/About.tsx`, the paragraph currently ends:

```tsx
        <strong>{t("contact.messageSeller")}</strong>, {t("about.orWord")}{" "}
        <strong>Instagram</strong>{t("about.howToBuyTail")}
```

Change it to list Instagram then Facebook Marketplace last:

```tsx
        <strong>{t("contact.messageSeller")}</strong>, <strong>Instagram</strong>,{" "}
        {t("about.orWord")} <strong>Facebook Marketplace</strong>{t("about.howToBuyTail")}
```

(Proper nouns stay untranslated, matching how `Instagram` is already hardcoded; `orWord` keeps EN/ES correct.)

- [ ] **Step 2: Type-check**

Run: `npm run build`
Expected: succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/pages/About.tsx
git commit -m "feat(about): mention Facebook Marketplace in how-to-buy"
```

---

### Task 4: Deploy and verify the link live

**Files:** none (operational)

- [ ] **Step 1: Deploy**

Run: `npm run deploy`
Expected: wrangler uploads the Worker + assets without error.

- [ ] **Step 2: Verify config endpoint**

Run: `curl -s https://fronterafinds.com/api/config`
Expected JSON includes `"facebookUrl":"https://www.facebook.com/marketplace/profile/61558944447221/"`.

- [ ] **Step 3: Verify in browser** (Chrome tools): open any item page on https://fronterafinds.com — the **Facebook Marketplace** outline button appears after Instagram DM and opens the profile in a new tab. Open `/about` — the how-to-buy sentence lists Facebook Marketplace; toggle to Spanish and confirm the sentence still reads correctly.

---

### Task 5: Fetch the existing production catalog (dedup + category baseline)

**Files:** creates `$SCRATCH/existing.json` (outside repo)

- [ ] **Step 1: Dump current items**

```bash
npx wrangler d1 execute frontera_finds --remote --config wrangler.toml --json \
  --command "SELECT id, slug, title, category FROM items" > "$SCRATCH/existing.json"
```

Expected: JSON with a `results` array of `{id, slug, title, category}`.

- [ ] **Step 2: Note the distinct categories** (used when assigning categories in Task 6):

```bash
npx wrangler d1 execute frontera_finds --remote --config wrangler.toml --json \
  --command "SELECT DISTINCT category FROM items"
```

---

### Task 6: Capture the active Marketplace listings (Chrome, logged-in)

**Files:** creates `$SCRATCH/listings.json`

- [ ] **Step 1: Enumerate listings.** Navigate to
`https://www.facebook.com/marketplace/profile/61558944447221/`, scroll the profile modal until no new listings load, and collect every active listing URL (`/marketplace/item/<id>/`).

- [ ] **Step 2: Capture each listing.** For each listing page record: full title, full description (expand "See more"), price in USD, whether it offers shipping ("Shipping available" / "Ships to you"), location, and the full-resolution photo URLs in display order (from the listing's photo viewer, `scontent…fbcdn.net` URLs).

- [ ] **Step 3: Write `$SCRATCH/listings.json`** — one entry per listing:

```json
[
  {
    "title": "KopBeau tower fan",
    "description": "Full description text from the listing…",
    "priceCents": 2500,
    "category": "home",
    "shipsUsa": false,
    "localSdtj": true,
    "photos": ["https://scontent…jpg", "https://scontent…jpg"]
  }
]
```

Rules:
- `priceCents` = FB price × 100 (integers only).
- `shipsUsa` true only if the listing offers shipping; `localSdtj` true for San Diego / Tijuana-located listings (expected: all).
- `category`: best fit from the Task 5 distinct-category list; if nothing fits, `"misc"`.
- Titles/descriptions verbatim (they become the raw EN source for translation).

- [ ] **Step 4: Sanity check.** Confirm entry count matches the profile's active-listing count (20+); every entry has ≥1 photo URL and a price > 0. A listing page that cannot be read after 2–3 attempts is skipped, not retried forever — record its URL in a `skippedUnreadable` list to include in the final report (Task 10).

---

### Task 7: Generate the import artifacts (throwaway script)

**Files:** creates `$SCRATCH/gen-import.mjs`, `$SCRATCH/photos.sh`, `$SCRATCH/import.sql`, `$SCRATCH/report.json`

- [ ] **Step 1: Write `$SCRATCH/gen-import.mjs`** (run with Node from the repo root so wrangler paths resolve; script lives outside the repo):

```js
import { readFileSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";

const SCRATCH = process.argv[2];
if (!SCRATCH) throw new Error("usage: node gen-import.mjs <scratch-dir>");

const listings = JSON.parse(readFileSync(`${SCRATCH}/listings.json`, "utf8"));
const existingRaw = JSON.parse(readFileSync(`${SCRATCH}/existing.json`, "utf8"));
const existing = existingRaw[0]?.results ?? existingRaw.results ?? [];

// Same rules as worker/src/slug.ts
function slugify(title) {
  const base = title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
  return base || "item";
}
const normTitle = (t) => t.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const q = (s) => `'${String(s).replace(/'/g, "''")}'`;

const takenSlugs = new Set(existing.map((r) => r.slug));
const existingTitles = new Set(existing.map((r) => normTitle(r.title)));
function uniqueSlug(title) {
  const base = slugify(title);
  let candidate = base, n = 2;
  while (takenSlugs.has(candidate)) candidate = `${base}-${n++}`;
  takenSlugs.add(candidate);
  return candidate;
}

const EXT = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp" };
const now = Date.now();
const sql = [], photoCmds = [], imported = [], skipped = [];

for (const l of listings) {
  if (existingTitles.has(normTitle(l.title))) { skipped.push(l.title); continue; }
  const id = randomUUID();
  const slug = uniqueSlug(l.title);
  const keys = l.photos.map((url) => {
    const ext = (new URL(url).pathname.match(/\.(jpe?g|png|webp)/i)?.[1] ?? "jpg").toLowerCase();
    return { url, key: `items/${randomUUID()}.${ext === "jpeg" ? "jpg" : ext}`, type: EXT[ext] ?? "image/jpeg" };
  });
  sql.push(
    `INSERT INTO items (id,slug,title,description,price_cents,category,ships_usa,local_sdtj,status,created_at,updated_at) ` +
    `VALUES (${q(id)},${q(slug)},${q(l.title)},${q(l.description)},${l.priceCents},${q(l.category)},` +
    `${l.shipsUsa ? 1 : 0},${l.localSdtj ? 1 : 0},'published',${now},${now});`
  );
  keys.forEach((k, i) => {
    sql.push(`INSERT INTO item_photos (id,item_id,r2_key,sort_order) VALUES (${q(randomUUID())},${q(id)},${q(k.key)},${i});`);
    const file = `${SCRATCH}/photos/${k.key.split("/")[1]}`;
    photoCmds.push(`curl -fsSL ${JSON.stringify(k.url)} -o ${JSON.stringify(file)}`);
    photoCmds.push(`npx wrangler r2 object put ${JSON.stringify(`frontera-finds-photos/${k.key}`)} --file ${JSON.stringify(file)} --content-type ${k.type} --remote --config wrangler.toml`);
  });
  imported.push({ title: l.title, slug, photos: keys.length });
}

writeFileSync(`${SCRATCH}/import.sql`, sql.join("\n") + "\n");
writeFileSync(`${SCRATCH}/photos.sh`, ["#!/bin/bash", "set -euo pipefail", `mkdir -p ${JSON.stringify(SCRATCH + "/photos")}`, ...photoCmds].join("\n") + "\n");
writeFileSync(`${SCRATCH}/report.json`, JSON.stringify({ imported, skipped }, null, 2));
console.log(`imported: ${imported.length}, skipped as duplicate: ${skipped.length}`);
```

- [ ] **Step 2: Run it**

```bash
cd "<repo root>" && node "$SCRATCH/gen-import.mjs" "$SCRATCH"
```

Expected: prints imported/skipped counts; creates `import.sql`, `photos.sh`, `report.json`.

- [ ] **Step 3: Review the artifacts.** Read `report.json` (skipped titles look like true duplicates?), spot-check `import.sql` for correct escaping and one `items` + N `item_photos` insert per listing, and `photos.sh` for one curl + one wrangler put per photo.

---

### Task 8: Download photos and upload to R2 — REQUIRES USER PERMISSION

**Files:** none in repo (photos land in `$SCRATCH/photos/`)

- [ ] **Step 1: Ask the user for download permission.** State: source (Facebook CDN — their own listing photos), the exact file count from `report.json`, and estimated total size (~200 KB–1 MB per photo). Do NOT run `photos.sh` until the user says yes.

- [ ] **Step 2: Run the script**

```bash
bash "$SCRATCH/photos.sh"
```

Expected: exits 0. If an individual curl fails (expired CDN URL), re-capture that listing's photo URLs (Task 6 method), regenerate that curl line, and continue — a photo failure must not abort the whole import; if a photo is truly unrecoverable, delete its `item_photos` INSERT from `import.sql` and note it in the final report.

- [ ] **Step 3: Verify one upload round-trips**

```bash
npx wrangler r2 object get "frontera-finds-photos/<first key from import.sql>" --file /dev/null --remote --config wrangler.toml
```

Expected: succeeds (object exists).

---

### Task 9: Insert the items into production D1

**Files:** none in repo

- [ ] **Step 1: Execute the SQL**

```bash
npx wrangler d1 execute frontera_finds --remote --config wrangler.toml --file "$SCRATCH/import.sql" -y
```

Expected: reports all statements executed successfully.

- [ ] **Step 2: Verify row counts**

```bash
npx wrangler d1 execute frontera_finds --remote --config wrangler.toml --json \
  --command "SELECT COUNT(*) AS n FROM items WHERE status='published'"
```

Expected: previous count + imported count from `report.json`.

---

### Task 10: Translations + final live verification

**Files:** none

- [ ] **Step 1: Translation backfill (user action).** Ask the user to open `/admin/manage` on the live site and press **"Translate all items"** (admin-authed — the click must be theirs). Wait for their confirmation.

- [ ] **Step 2: Verify live.** In Chrome: load https://fronterafinds.com — imported items appear on Home with correct prices and photos; open one imported item page — photos render, badges match `shipsUsa`/`localSdtj`, and the Facebook Marketplace button shows; toggle Spanish — imported item shows translated text (post-backfill).

- [ ] **Step 3: Report the outcome** to the user: imported count, skipped duplicates (titles), any photo gaps, and a link to one imported item page.

---

## Out of scope

No recurring sync, no admin bulk-import UI, no ratings/social-proof section, no sold-listing import (per spec).
