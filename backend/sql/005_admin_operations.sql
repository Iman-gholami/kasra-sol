-- Additive migration: adds columns/tables and backfills them from existing records.
-- It never deletes or rewrites products, stock, orders or order items.

-- Login throttling per account and password rotation.
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS failed_logins integer NOT NULL DEFAULT 0;
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS locked_until timestamptz;
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS password_changed_at timestamptz;

-- Separate never-published drafts from products taken off sale (both stay inactive and keep order history).
ALTER TABLE products ADD COLUMN IF NOT EXISTS archived_at timestamptz;
UPDATE products p SET archived_at = last.created_at
FROM (SELECT DISTINCT ON (target) target, details, created_at FROM admin_audit_log
      WHERE action = 'products.visibility' ORDER BY target, id DESC) last
WHERE last.target = p.id AND NOT p.active AND p.archived_at IS NULL AND last.details->>'active' = 'false';
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'products_archived_inactive_check') THEN
    ALTER TABLE products ADD CONSTRAINT products_archived_inactive_check CHECK (NOT active OR archived_at IS NULL);
  END IF;
END $$;

-- Business history of each order, readable by order staff (the audit log stays owner-only).
CREATE TABLE IF NOT EXISTS order_status_history (
  id bigserial PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  from_status varchar(30),
  to_status varchar(30) NOT NULL,
  actor_id uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  note varchar(300),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS order_status_history_order_idx ON order_status_history(order_id, id);
CREATE INDEX IF NOT EXISTS order_status_history_to_created_idx ON order_status_history(to_status, created_at);
INSERT INTO order_status_history(order_id, from_status, to_status, created_at)
SELECT o.id, NULL, CASE WHEN o.payment = 'cod' THEN 'confirmed_cod' ELSE 'pending_payment' END, o.created_at
FROM orders o WHERE NOT EXISTS (SELECT 1 FROM order_status_history h WHERE h.order_id = o.id);
INSERT INTO order_status_history(order_id, from_status, to_status, actor_id, created_at)
SELECT o.id, a.details->>'from', a.details->>'to', a.actor_id, a.created_at
FROM admin_audit_log a JOIN orders o ON o.id::text = a.target
WHERE a.action = 'orders.status'
  AND NOT EXISTS (SELECT 1 FROM order_status_history h WHERE h.order_id = o.id AND h.from_status IS NOT NULL)
ORDER BY a.id;

-- Snapshot of the color label, so receipts and fulfilment stay correct after a product's colors are edited.
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS color_name text;
UPDATE order_items oi SET color_name = c.color->>'name'
FROM products p, jsonb_array_elements(p.colors) AS c(color)
WHERE oi.color_name IS NULL AND p.id = oi.product_id AND c.color->>'id' = oi.color_id;

CREATE INDEX IF NOT EXISTS admin_audit_target_idx ON admin_audit_log(target);
CREATE INDEX IF NOT EXISTS admin_sessions_user_expiry_idx ON admin_sessions(user_id, expires_at);
