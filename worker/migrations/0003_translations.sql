-- Bilingual item content. Existing title/description remain the seller's raw input
-- and the display fallback; these hold Claude-generated EN/ES versions (NULL until filled).
ALTER TABLE items ADD COLUMN title_en TEXT;
ALTER TABLE items ADD COLUMN title_es TEXT;
ALTER TABLE items ADD COLUMN description_en TEXT;
ALTER TABLE items ADD COLUMN description_es TEXT;
