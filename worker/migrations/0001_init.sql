CREATE TABLE items (
  id            TEXT PRIMARY KEY,
  title         TEXT NOT NULL,
  description   TEXT NOT NULL DEFAULT '',
  price_cents   INTEGER NOT NULL DEFAULT 0,
  category      TEXT NOT NULL DEFAULT 'misc',
  ships_usa     INTEGER NOT NULL DEFAULT 1,
  local_sdtj    INTEGER NOT NULL DEFAULT 1,
  status        TEXT NOT NULL DEFAULT 'published',  -- published | sold | hidden
  created_at    INTEGER NOT NULL,
  updated_at    INTEGER NOT NULL
);

CREATE TABLE item_photos (
  id          TEXT PRIMARY KEY,
  item_id     TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  r2_key      TEXT NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_items_status_created ON items(status, created_at DESC);
CREATE INDEX idx_item_photos_item ON item_photos(item_id, sort_order);
