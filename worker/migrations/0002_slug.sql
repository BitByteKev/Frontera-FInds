-- Add a URL slug for items so listings live at /item/<title-slug> instead of /item/<uuid>.
-- A UNIQUE index permits multiple NULLs in SQLite, so it is safe to create before
-- backfilling existing rows (the backfill is run separately after this migration).
ALTER TABLE items ADD COLUMN slug TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_items_slug ON items(slug);
