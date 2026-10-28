import { createHash, randomBytes } from 'node:crypto';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { pool } from '../db/connection';
import { hashPassword, verifyPassword, dummyPasswordHash } from './password';
import { productAdminRoutes } from './product-routes';
import { orderAdminRoutes } from './order-routes';
import { mediaRoutes } from './media';
import { reportRoutes } from './reports';
import { trafficRoutes } from './traffic';
import { homeAdminRoutes } from './home-routes';
import { storeRoutes } from './store-routes';
import { roleRoutes } from './role-routes';
import { recordAudit } from './audit';
import type { Identity } from './identity';
import { PERMISSIONS, assignable, effectivePermissions, may, type Permission } from './permissions';

type AdminRow = Identity & { password_hash: string; locked_until: Date | null };
const SESSION_HOURS = 8;
// Per-account throttle on top of the per-address rate limit, against password guessing spread over many IPs.
const LOCK_AFTER_FAILURES = 10;
const LOCK_MINUTES = 15;
const username = z.string().regex(/^[a-z0-9][a-z0-9_.-]{2,63}$/);
const password = z.string().min(12).max(256);
const roleSchema = z.enum(['manager', 'staff']);
const permissions = z.array(z.enum(PERMISSIONS)).max(PERMISSIONS.length).refine(assignable, 'Owner-only permissions cannot be delegated');
const AUDIT_GROUPS = ['auth', 'staff', 'products', 'inventory', 'orders', 'sales', 'media'] as const;
const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');
const tokenFrom = (req: FastifyRequest) => {
  const match = /^Bearer ([a-f0-9]{64})$/i.exec(req.headers.authorization ?? '');
  return match?.[1]?.toLowerCase();
};
const publicUser = (user: Identity & { locked_until?: Date | null }) => ({
  id: user.id, username: user.username, displayName: user.display_name, role: user.role,
  customRoleId: user.custom_role_id ?? null, customRoleName: user.custom_role_name ?? null,
  active: user.active, grants: user.grants, revokes: user.revokes,
  permissions: effectivePermissions(user.role, user.grants, user.revokes, user.custom_permissions),
  lockedUntil: user.locked_until && new Date(user.locked_until) > new Date() ? user.locked_until : null
});
async function currentUser(req: FastifyRequest): Promise<Identity | null> {
  const token = tokenFrom(req);
  if (!token) return null;
  const found = await pool.query(
    'SELECT u.id,u.username,u.display_name,u.role,u.grants,u.revokes,u.active,' +
    'u.custom_role_id,r.name AS custom_role_name,r.permissions AS custom_permissions ' +
    'FROM admin_sessions s JOIN admin_users u ON u.id=s.user_id ' +
    'LEFT JOIN admin_custom_roles r ON r.id=u.custom_role_id ' +
    'WHERE s.token_hash=$1 AND s.expires_at > now() AND u.active=true LIMIT 1',
    [sha256(token)]);
  return (found.rows[0] as Identity | undefined) ?? null;
}
export async function requirePermission(req: FastifyRequest, reply: FastifyReply, needed: Permission): Promise<Identity | null> {
  const user = await currentUser(req);
  if (!user) { await reply.code(401).send({ error: 'unauthorized' }); return null; }
  if (!may(user.role, user.grants, user.revokes, needed, user.custom_permissions)) {
    await reply.code(403).send({ error: 'forbidden' }); return null;
  }
  return user;
}
export async function adminRoutes(app: FastifyInstance, opts: { invalidateCatalog?: () => Promise<void> }) {
  app.post('/v1/admin/auth/login', { config: { rateLimit: { max: 5, timeWindow: '1 minute' } } }, async (req, reply) => {
    const input = z.object({ username, password }).safeParse(req.body);
    if (!input.success) return reply.code(400).send({ error: 'invalid_credentials' });
    const name = input.data.username.toLowerCase();
    const match = await pool.query(
      'SELECT u.*,r.name AS custom_role_name,r.permissions AS custom_permissions ' +
      'FROM admin_users u LEFT JOIN admin_custom_roles r ON r.id=u.custom_role_id WHERE u.username=$1 LIMIT 1', [name]);
    const user = match.rows[0] as AdminRow | undefined;
    const locked = Boolean(user?.locked_until && new Date(user.locked_until) > new Date());
    // scrypt always runs, so timing does not reveal whether the account exists, is disabled or is locked.
    const valid = await verifyPassword(input.data.password, user && !locked ? user.password_hash : dummyPasswordHash);
    if (!user || !user.active || locked || !valid) {
      if (user && !locked && !valid) await pool.query(
        'UPDATE admin_users SET failed_logins=failed_logins+1, locked_until=CASE WHEN failed_logins+1 >= $2 ' +
        'THEN now() + make_interval(mins => $3) ELSE locked_until END WHERE id=$1',
        [user.id, LOCK_AFTER_FAILURES, LOCK_MINUTES]);
      await recordAudit(pool, user?.id ?? null, locked ? 'auth.login_locked' : 'auth.login_failed', name, { ip: req.ip });
      // Same answer for every failure: no hint whether the username exists or is temporarily locked.
      return reply.code(401).send({ error: 'invalid_credentials' });
    }
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + SESSION_HOURS * 60 * 60 * 1000);
    await pool.query('UPDATE admin_users SET failed_logins=0, locked_until=NULL WHERE id=$1', [user.id]);
    await pool.query('DELETE FROM admin_sessions WHERE expires_at <= now()');
    await pool.query('INSERT INTO admin_sessions(token_hash,user_id,expires_at) VALUES($1,$2,$3)',
      [sha256(token), user.id, expiresAt]);
    await recordAudit(pool, user.id, 'auth.login', user.id, { ip: req.ip });
    return reply.header('Cache-Control', 'no-store').send({ token, expiresAt: expiresAt.toISOString(), user: publicUser(user) });
  });

  app.get('/v1/admin/auth/me', async (req, reply) => {
    const user = await currentUser(req);
    if (!user) return reply.code(401).send({ error: 'unauthorized' });
    return reply.header('Cache-Control', 'no-store').send({ user: publicUser(user) });
  });

  app.post('/v1/admin/auth/logout', async (req, reply) => {
    const token = tokenFrom(req);
    if (token) {
      const ended = await pool.query<{ user_id: string }>('DELETE FROM admin_sessions WHERE token_hash=$1 RETURNING user_id', [sha256(token)]);
      if (ended.rows[0]) await recordAudit(pool, ended.rows[0].user_id, 'auth.logout', ended.rows[0].user_id);
    }
    return reply.header('Cache-Control', 'no-store').send({ ok: true });
  });

  // Every account (the owner included) can rotate its own password; other sessions of the account end.
  app.post('/v1/admin/auth/password', { config: { rateLimit: { max: 5, timeWindow: '1 minute' } } }, async (req, reply) => {
    const user = await currentUser(req);
    if (!user) return reply.code(401).send({ error: 'unauthorized' });
    const input = z.object({ currentPassword: z.string().min(1).max(256), newPassword: password }).strict().safeParse(req.body);
    if (!input.success) return reply.code(400).send({ error: 'invalid_payload' });
    if (input.data.currentPassword === input.data.newPassword) return reply.code(400).send({ error: 'password_unchanged' });
    const stored = await pool.query<{ password_hash: string }>('SELECT password_hash FROM admin_users WHERE id=$1', [user.id]);
    if (!await verifyPassword(input.data.currentPassword, stored.rows[0]?.password_hash ?? dummyPasswordHash)) {
      await recordAudit(pool, user.id, 'auth.password_change_failed', user.id);
      return reply.code(400).send({ error: 'invalid_current_password' });
    }
    const hashed = await hashPassword(input.data.newPassword);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('UPDATE admin_users SET password_hash=$1,password_changed_at=now(),updated_at=now() WHERE id=$2', [hashed, user.id]);
      await client.query('DELETE FROM admin_sessions WHERE user_id=$1 AND token_hash<>$2', [user.id, sha256(tokenFrom(req)!)]);
      await recordAudit(client, user.id, 'auth.password_changed', user.id);
      await client.query('COMMIT');
    } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
    return reply.header('Cache-Control', 'no-store').send({ ok: true });
  });

  app.get('/v1/admin/staff', async (req, reply) => {
    if (!await requirePermission(req, reply, 'staff:manage')) return;
    const result = await pool.query(
      'SELECT u.id,u.username,u.display_name,u.role,u.grants,u.revokes,u.active,u.locked_until,u.created_at,' +
      'u.custom_role_id,r.name AS custom_role_name,r.permissions AS custom_permissions ' +
      'FROM admin_users u LEFT JOIN admin_custom_roles r ON r.id=u.custom_role_id ORDER BY u.created_at');
    return reply.header('Cache-Control', 'no-store').send({
      items: (result.rows as Identity[]).map(publicUser)
    });
  });

  app.post('/v1/admin/staff', async (req, reply) => {
    const actor = await requirePermission(req, reply, 'staff:manage');
    if (!actor) return;
    const input = z.object({
      username, displayName: z.string().trim().min(2).max(100), password, role: roleSchema,
      grants: permissions.default([]), revokes: permissions.default([]), customRoleId: z.string().uuid().nullable().optional()
    }).strict().safeParse(req.body);
    if (!input.success || (input.data.customRoleId && input.data.role !== 'staff'))
      return reply.code(400).send({ error: 'invalid_payload' });
    const passHash = await hashPassword(input.data.password);
    let result;
    try {
      result = await pool.query(
        'INSERT INTO admin_users(username,display_name,password_hash,role,grants,revokes,custom_role_id) ' +
        'VALUES($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7) RETURNING id,username,display_name,role,grants,revokes,active,custom_role_id',
        [input.data.username, input.data.displayName, passHash, input.data.role,
          JSON.stringify(input.data.grants), JSON.stringify(input.data.revokes), input.data.customRoleId ?? null]);
    } catch (error) {
      if ((error as { code?: string }).code === '23505') return reply.code(409).send({ error: 'username_taken' });
      if ((error as { code?: string }).code === '23503') return reply.code(404).send({ error: 'role_not_found' });
      throw error;
    }
    const user = result.rows[0] as Identity;
    if (user.custom_role_id) {
      const role = await pool.query('SELECT name,permissions FROM admin_custom_roles WHERE id=$1', [user.custom_role_id]);
      user.custom_role_name = role.rows[0]?.name;
      user.custom_permissions = role.rows[0]?.permissions;
    }
    await recordAudit(pool, actor.id, 'staff.created', user.id, { username: user.username, role: user.role,
      customRoleId: user.custom_role_id, customRoleName: user.custom_role_name,
      grants: input.data.grants, revokes: input.data.revokes });
    return reply.code(201).header('Cache-Control', 'no-store').send({ user: publicUser(user) });
  });

  app.patch('/v1/admin/staff/:id', async (req, reply) => {
    const actor = await requirePermission(req, reply, 'staff:manage');
    if (!actor) return;
    const id = z.string().uuid().safeParse((req.params as { id: string }).id);
    const input = z.object({
      role: roleSchema.optional(), grants: permissions.optional(), revokes: permissions.optional(),
      active: z.boolean().optional(), displayName: z.string().trim().min(2).max(100).optional(),
      customRoleId: z.string().uuid().nullable().optional()
    }).strict().refine(v => Object.keys(v).length > 0).safeParse(req.body);
    if (!id.success || !input.success) return reply.code(400).send({ error: 'invalid_payload' });
    if (input.data.customRoleId && input.data.role && input.data.role !== 'staff')
      return reply.code(400).send({ error: 'invalid_payload' });
    if (actor.id === id.data) return reply.code(403).send({ error: 'cannot_modify_self' });
    const client = await pool.connect();
    let user: Identity | undefined;
    try {
      await client.query('BEGIN');
      const switchRole = input.data.role !== undefined || input.data.customRoleId !== undefined;
      const customRoleId = input.data.customRoleId ?? null;
      if (customRoleId) {
        const role = await client.query('SELECT id FROM admin_custom_roles WHERE id=$1 FOR KEY SHARE', [customRoleId]);
        if (!role.rowCount) { await client.query('ROLLBACK'); return reply.code(404).send({ error: 'role_not_found' }); }
      }
      const existing = await client.query('SELECT id,role FROM admin_users WHERE id=$1 FOR UPDATE', [id.data]);
      if (!existing.rowCount) {
        await client.query('ROLLBACK');
        return reply.code(404).send({ error: 'not_found' });
      }
      if (existing.rows[0].role === 'owner') {
        await client.query('ROLLBACK');
        return reply.code(403).send({ error: 'cannot_modify_owner' });
      }
      const updated = await client.query(
        'UPDATE admin_users SET role=COALESCE($1,role),grants=COALESCE($2::jsonb,grants),' +
        'revokes=COALESCE($3::jsonb,revokes),active=COALESCE($4,active),display_name=COALESCE($6,display_name),' +
        'custom_role_id=CASE WHEN $7 THEN $8::uuid ELSE custom_role_id END,' +
        'updated_at=now() WHERE id=$5 RETURNING id,username,display_name,role,grants,revokes,active,locked_until,custom_role_id',
        [customRoleId ? 'staff' : input.data.role ?? null,
          input.data.grants ? JSON.stringify(input.data.grants) : switchRole ? '[]' : null,
          input.data.revokes ? JSON.stringify(input.data.revokes) : switchRole ? '[]' : null,
          input.data.active ?? null, id.data, input.data.displayName ?? null, switchRole, customRoleId]);
      user = updated.rows[0] as Identity;
      if (user.custom_role_id) {
        const role = await client.query('SELECT name,permissions FROM admin_custom_roles WHERE id=$1', [user.custom_role_id]);
        user.custom_role_name = role.rows[0]?.name;
        user.custom_permissions = role.rows[0]?.permissions;
      }
      // A display-name-only edit should not interrupt the employee's work; access changes still end sessions.
      if (switchRole || input.data.grants !== undefined || input.data.revokes !== undefined || input.data.active !== undefined)
        await client.query('DELETE FROM admin_sessions WHERE user_id=$1', [id.data]);
      await recordAudit(client, actor.id, 'staff.updated', id.data, input.data);
      await client.query('COMMIT');
    } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
    return reply.header('Cache-Control', 'no-store').send({ user: publicUser(user!) });
  });

  // The owner sets a new password for an employee who forgot theirs; it ends their sessions and unlocks them.
  app.put('/v1/admin/staff/:id/password', async (req, reply) => {
    const actor = await requirePermission(req, reply, 'staff:manage');
    if (!actor) return;
    const id = z.string().uuid().safeParse((req.params as { id: string }).id);
    const input = z.object({ password }).strict().safeParse(req.body);
    if (!id.success || !input.success) return reply.code(400).send({ error: 'invalid_payload' });
    if (actor.id === id.data) return reply.code(403).send({ error: 'use_own_password_change' });
    const hashed = await hashPassword(input.data.password);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const existing = await client.query<{ role: string }>('SELECT role FROM admin_users WHERE id=$1 FOR UPDATE', [id.data]);
      if (!existing.rows[0] || existing.rows[0].role === 'owner') {
        await client.query('ROLLBACK');
        return reply.code(existing.rows[0] ? 403 : 404).send({ error: existing.rows[0] ? 'cannot_modify_owner' : 'not_found' });
      }
      await client.query('UPDATE admin_users SET password_hash=$1,password_changed_at=now(),failed_logins=0,' +
        'locked_until=NULL,updated_at=now() WHERE id=$2', [hashed, id.data]);
      await client.query('DELETE FROM admin_sessions WHERE user_id=$1', [id.data]);
      await recordAudit(client, actor.id, 'staff.password_reset', id.data);
      await client.query('COMMIT');
    } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
    return reply.header('Cache-Control', 'no-store').send({ ok: true });
  });

  await productAdminRoutes(app, requirePermission, opts);
  await orderAdminRoutes(app, requirePermission, opts);
  await mediaRoutes(app, requirePermission);
  await reportRoutes(app, requirePermission);
  await trafficRoutes(app, requirePermission);
  await homeAdminRoutes(app, requirePermission, opts);
  await storeRoutes(app, requirePermission, opts);
  await roleRoutes(app, requirePermission);

  // Newest first, 100 per page. `group` is the part of the action before the dot; `actor` is an account id.
  // `targetName` names the account or product an entry is about, so the owner does not have to read ids.
  app.get('/v1/admin/audit', async (req, reply) => {
    if (!await requirePermission(req, reply, 'staff:manage')) return;
    const query = z.object({
      before: z.coerce.number().int().positive().optional(),
      group: z.enum(AUDIT_GROUPS).optional(),
      actor: z.string().uuid().optional()
    }).safeParse(req.query);
    if (!query.success) return reply.code(400).send({ error: 'invalid_query' });
    const result = await pool.query(
      'SELECT l.id,l.action,l.target,l.details,l.created_at,u.username AS actor,u.display_name AS "actorName",' +
      'COALESCE(t.display_name,p.name) AS "targetName" ' +
      'FROM admin_audit_log l LEFT JOIN admin_users u ON u.id=l.actor_id ' +
      'LEFT JOIN admin_users t ON t.id::text=l.target ' +
      "LEFT JOIN products p ON p.id=COALESCE(l.details->>'productId',l.target) " +
      "WHERE ($1::bigint IS NULL OR l.id < $1) AND ($2::text IS NULL OR l.action LIKE $2 || '.%') " +
      'AND ($3::uuid IS NULL OR l.actor_id=$3) ORDER BY l.id DESC LIMIT 100',
      [query.data.before ?? null, query.data.group ?? null, query.data.actor ?? null]);
    return reply.header('Cache-Control', 'no-store').send({ items: result.rows });
  });
}
