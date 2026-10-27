-- Archive employees without breaking sales, orders or audit attribution.
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS archived_at timestamptz;
CREATE INDEX IF NOT EXISTS admin_users_archived_at_idx ON admin_users(archived_at);
