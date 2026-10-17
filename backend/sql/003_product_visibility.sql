-- Safe additive migration. Archived products remain in the DB and all order snapshots survive.
ALTER TABLE products ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;
CREATE INDEX IF NOT EXISTS products_active_created_idx ON products(active, created_at DESC);
