-- Additive integrity guards for orders. Existing rows are validated, never rewritten: if any row
-- violates a rule the whole migration transaction rolls back and the database is left untouched.
-- (002/003 are used by the admin branch; numbering keeps one global order across both branches.)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_status varchar(20) NOT NULL DEFAULT 'unpaid';
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_payment_method_check') THEN
    ALTER TABLE orders ADD CONSTRAINT orders_payment_method_check CHECK (payment IN ('online', 'cod'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_shipping_method_check') THEN
    ALTER TABLE orders ADD CONSTRAINT orders_shipping_method_check CHECK (shipping IN ('post', 'express', 'courier'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_status_check') THEN
    ALTER TABLE orders ADD CONSTRAINT orders_status_check CHECK (status IN
      ('pending_payment', 'confirmed_cod', 'preparing', 'shipped', 'delivered', 'cancelled'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_total_arithmetic_check') THEN
    ALTER TABLE orders ADD CONSTRAINT orders_total_arithmetic_check CHECK (total = subtotal - discount + shipping_cost);
  END IF;
  -- No verified PSP settlement exists yet, so no order may ever be recorded as paid. Widen this only in the
  -- same migration that adds a payments ledger (signed callback, amount match, idempotent settlement).
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_payment_status_check') THEN
    ALTER TABLE orders ADD CONSTRAINT orders_payment_status_check CHECK (payment_status = 'unpaid');
  END IF;
  -- An unpaid online order can only wait for payment or be cancelled; it can never enter fulfilment.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_online_requires_payment_check') THEN
    ALTER TABLE orders ADD CONSTRAINT orders_online_requires_payment_check
      CHECK (payment <> 'online' OR status IN ('pending_payment', 'cancelled'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_cod_status_check') THEN
    ALTER TABLE orders ADD CONSTRAINT orders_cod_status_check CHECK (payment <> 'cod' OR status <> 'pending_payment');
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS orders_status_created_idx ON orders(status, created_at DESC);
