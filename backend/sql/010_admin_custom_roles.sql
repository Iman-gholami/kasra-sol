-- Custom roles are additive; the original owner, manager and staff accounts retain their existing access.
CREATE TABLE IF NOT EXISTS admin_custom_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(80) NOT NULL,
  permissions jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT admin_custom_roles_permissions_array CHECK (jsonb_typeof(permissions) = 'array')
);
CREATE UNIQUE INDEX IF NOT EXISTS admin_custom_roles_name_idx ON admin_custom_roles (lower(name));
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS custom_role_id uuid REFERENCES admin_custom_roles(id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS admin_users_custom_role_idx ON admin_users(custom_role_id);
