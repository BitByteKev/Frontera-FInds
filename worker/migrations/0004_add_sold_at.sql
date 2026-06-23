-- Dedicated sold timestamp. updated_at is unreliable as a sold date because editing
-- or relisting an item bumps it. Backfill existing sold rows as a best-effort guess.
ALTER TABLE items ADD COLUMN sold_at INTEGER;
UPDATE items SET sold_at = updated_at WHERE status = 'sold';
