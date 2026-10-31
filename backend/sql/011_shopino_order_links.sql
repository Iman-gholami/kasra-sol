-- A numeric reference is required by Shopino; existing Kasra orders use UUIDs.
-- The table is additive: earlier application releases can continue using existing orders.
CREATE TABLE IF NOT EXISTS shopino_order_links (
  id bigserial PRIMARY KEY CHECK (id > 0 AND id <= 9007199254740991),
  shopino_order_id bigint NOT NULL UNIQUE CHECK (shopino_order_id > 0 AND shopino_order_id <= 9007199254740991),
  order_id uuid NOT NULL UNIQUE REFERENCES orders(id) ON DELETE RESTRICT,
  tracking_code varchar(128),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
