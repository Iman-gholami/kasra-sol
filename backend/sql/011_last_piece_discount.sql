-- Additive: the owner's last-piece discount (back office «تخفیف آخرین دونه‌ها»), one row. A colour-and-size variant
-- whose own stock is exactly 1 sells at `percent` off on the website while `enabled`. Starts off: deploying it changes
-- no price. The previous release ignores this table, so a rollback is safe.
CREATE TABLE IF NOT EXISTS last_piece_discount (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  enabled boolean NOT NULL DEFAULT false,
  percent smallint NOT NULL DEFAULT 20 CHECK (percent BETWEEN 5 AND 70),
  updated_by uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO last_piece_discount(id) VALUES (1) ON CONFLICT DO NOTHING;
