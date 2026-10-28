-- Additive: counter carts put on hold («تعلیق فاکتور») while a customer is still in the fitting room, so the next
-- customer can pay. A held cart is only a list of scanned codes: it reserves no stock, and prices and stock are read
-- again when it is resumed and when it is finally sold. Resuming deletes the row, so only one cashier can take it.
CREATE TABLE IF NOT EXISTS store_held_sales (
  id bigserial PRIMARY KEY,
  lines jsonb NOT NULL CHECK (jsonb_typeof(lines) = 'array'),
  note varchar(300),
  actor_id uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
