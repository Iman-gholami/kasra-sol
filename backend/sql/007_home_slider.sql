-- Additive: the owner's ordered pick of products for the home page slider (position 0 shows first).
-- A product that is later archived or unpublished stays listed here; the public endpoint skips it.
CREATE TABLE IF NOT EXISTS home_slides (
  position smallint PRIMARY KEY CHECK (position BETWEEN 0 AND 4),
  product_id varchar(80) NOT NULL UNIQUE REFERENCES products(id) ON DELETE CASCADE,
  updated_by uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
