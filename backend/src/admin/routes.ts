import { createHash, randomBytes } from 'node:crypto';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { pool } from '../db/connection';
import { hashPassword, verifyPassword, dummyPasswordHash } from './password';
import { productAdminRoutes } from './product-routes';
import { mediaRoutes } from './media';
import { reportRoutes } from './reports';
import { PERMISSIONS, assignable, effectivePermissions, may, type Role, type Permission } from './permissions';

type AdminRow = {
  id: string; username: string; display_name: string; password_hash: string;
  role: Role; grants: Permission[]; revokes: Permission[]; active: boolean;
};
type Identity = Omit<AdminRow, 'password_hash'>;
const username = z.string().regex(/^[a-z0-9][a-z0-9_.-]{2,63}$/);
const password = z.string().min(12).max(256);
const roleSchema = z.enum(['manager', 'staff']);
const permissions = z.array(z.enum(PERMISSIONS)).max(PERMISSIONS.length).refine(assignable, 'Owner-only permissions cannot be delegated');
const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');
const tokenFrom = (req: FastifyRequest) => {
  const match = /^Bearer ([a-f0-9]{64})$/i.exec(req.headers.authorization ?? '');
  return match?.[1]?.toLowerCase();
};
const publicUser = (user: Identity) => ({
  id: user.id, username: user.username, displayName: user.display_name, role: user.role,
  active: user.active, grants: user.grants, revokes: user.revokes,
  permissions: effectivePermissions(user.role, user.grants, user.revokes)
});
async function currentUser(req: FastifyRequest): Promise<Identity | null> {
  const token = tokenFrom(req);
  if (!token) return null;
  const found = await pool.query(
    'SELECT u.id,u.username,u.display_name,u.role,u.grants,u.revokes,u.active ' +
    'FROM admin_sessions s JOIN admin_users u ON u.id=s.user_id ' +
    'WHERE s.token_hash=$1 AND s.expires_at > now() AND u.active=true LIMIT 1',
    [sha256(token)]);
  return (found.rows[0] as Identity | undefined) ?? null;
}
export async function requirePermission(req: FastifyRequest, reply: FastifyReply, needed: Permission): Promise<Identity | null> {
  const user = await currentUser(req);
  if (!user) { await reply.code(401).send({ error: 'unauthorized' }); return null; }
  if (!may(user.role, user.grants, user.revokes, needed)) {
    await reply.code(403).send({ error: 'forbidden' }); return null;
  }
  return user;
}
async function recordAudit(actor: string, action: string, target: string, details: object = {}) {
  await pool.query('INSERT INTO admin_audit_log(actor_id,action,target,details) VALUES($1,$2,$3,$4::jsonb)',
    [actor, action, target, JSON.stringify(details)]);
}
export async function adminRoutes(app: FastifyInstance, opts: { invalidateCatalog?: () => Promise<void> }) {
  app.post('/v1/admin/auth/login', { config: { rateLimit: { max: 5, timeWindow: '1 minute' } } }, async (req, reply) => {
    const input = z.object({ username, password }).safeParse(req.body);
    if (!input.success) return reply.code(400).send({ error: 'invalid_credentials' });
    const match = await pool.query('SELECT * FROM admin_users WHERE username=$1 LIMIT 1',
      [input.data.username.toLowerCase()]);
    const user = match.rows[0] as AdminRow | undefined;
    const valid = await verifyPassword(input.data.password, user?.password_hash ?? dummyPasswordHash);
    if (!user || !user.active || !valid) return reply.code(401).send({ error: 'invalid_credentials' });
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000);
    await pool.query('INSERT INTO admin_sessions(token_hash,user_id,expires_at) VALUES($1,$2,$3)',
      [sha256(token), user.id, expiresAt]);
    return reply.header('Cache-Control', 'no-store').send({ token, expiresAt: expiresAt.toISOString(), user: publicUser(user) });
  });

  app.get('/v1/admin/auth/me', async (req, reply) => {
    const user = await currentUser(req);
    if (!user) return reply.code(401).send({ error: 'unauthorized' });
    return reply.header('Cache-Control', 'no-store').send({ user: publicUser(user) });
  });

  app.post('/v1/admin/auth/logout', async (req, reply) => {
    const token = tokenFrom(req);
    if (token) await pool.query('DELETE FROM admin_sessions WHERE token_hash=$1', [sha256(token)]);
    return reply.header('Cache-Control', 'no-store').send({ ok: true });
  });

  app.get('/v1/admin/products', async (req, reply) => {
    if (!await requirePermission(req, reply, 'products:read')) return;
    const found = await pool.query(
      'SELECT p.id,p.slug,p.name,p.price,p.compare_at,p.category,p.images,' +
      'p.active,COALESCE(SUM(v.stock),0)::integer AS stock ' +
      'FROM products p LEFT JOIN product_variants v ON v.product_id=p.id ' +
      'GROUP BY p.id ORDER BY p.created_at DESC,p.id LIMIT 100');
    return reply.header('Cache-Control', 'no-store').send({ items: found.rows });
  });

  app.patch('/v1/admin/products/:id/price', async (req, reply) => {
    const actor = await requirePermission(req, reply, 'products:price');
    if (!actor) return;
    const id = z.string().min(1).max(80).safeParse((req.params as { id: string }).id);
    const input = z.object({ price: z.number().int().min(0).max(1_000_000_000) }).strict().safeParse(req.body);
    if (!id.success || !input.success) return reply.code(400).send({ error: 'invalid_payload' });
    const client = await pool.connect();
    let updated: { price: number } | undefined;
    try {
      await client.query('BEGIN');
      const r = await client.query('UPDATE products SET price=$1 WHERE id=$2 RETURNING price',
        [input.data.price, id.data]);
      updated = r.rows[0] as { price: number } | undefined;
      if (updated) await client.query(
        'INSERT INTO admin_audit_log(actor_id,action,target,details) VALUES($1,$2,$3,$4::jsonb)',
        [actor.id, 'products.price', id.data, JSON.stringify({ price: input.data.price })]);
      await client.query('COMMIT');
    } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
    if (!updated) return reply.code(404).send({ error: 'not_found' });
    await opts.invalidateCatalog?.();
    return reply.header('Cache-Control', 'no-store').send({ ok: true, price: updated.price });
  });

  app.patch('/v1/admin/variants/:id/stock', async (req, reply) => {
    const actor = await requirePermission(req, reply, 'inventory:write');
    if (!actor) return;
    const id = z.string().uuid().safeParse((req.params as { id: string }).id);
    const input = z.object({ stock: z.number().int().min(0).max(1_000_000) }).strict().safeParse(req.body);
    if (!id.success || !input.success) return reply.code(400).send({ error: 'invalid_payload' });
    const client = await pool.connect();
    let updated: { stock: number } | undefined;
    try {
      await client.query('BEGIN');
      const r = await client.query('UPDATE product_variants SET stock=$1 WHERE id=$2 RETURNING stock',
        [input.data.stock, id.data]);
      updated = r.rows[0] as { stock: number } | undefined;
      if (updated) await client.query(
        'INSERT INTO admin_audit_log(actor_id,action,target,details) VALUES($1,$2,$3,$4::jsonb)',
        [actor.id, 'inventory.stock', id.data, JSON.stringify({ stock: input.data.stock })]);
      await client.query('COMMIT');
    } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
    if (!updated) return reply.code(404).send({ error: 'not_found' });
    await opts.invalidateCatalog?.();
    return reply.header('Cache-Control', 'no-store').send({ ok: true, stock: updated.stock });
  });

  app.get('/v1/admin/products/:id/variants', async (req, reply) => {
    if (!await requirePermission(req, reply, 'inventory:read')) return;
    const id = z.string().min(1).max(80).safeParse((req.params as { id: string }).id);
    if (!id.success) return reply.code(400).send({ error: 'invalid_id' });
    const rows = await pool.query(
      'SELECT id,product_id,color_id,size,stock FROM product_variants WHERE product_id=$1 ORDER BY color_id,size',
      [id.data]);
    return reply.header('Cache-Control', 'no-store').send({ items: rows.rows });
  });

  app.get('/v1/admin/orders', async (req, reply) => {
    if (!await requirePermission(req, reply, 'orders:read')) return;
    const query = z.object({ limit: z.coerce.number().int().min(1).max(100).default(50) }).safeParse(req.query);
    if (!query.success) return reply.code(400).send({ error: 'invalid_query' });
    const result = await pool.query(
      'SELECT id,status,payment,shipping,total,created_at,address FROM orders ORDER BY created_at DESC LIMIT $1',
      [query.data.limit]);
    return reply.header('Cache-Control', 'no-store').send({ items: result.rows });
  });


  // Fulfillment only for COD orders. Never make a pending online order look paid.
  app.patch('/v1/admin/orders/:id/status', async (req, reply) => {
    const actor = await requirePermission(req, reply, 'orders:fulfill');
    if (!actor) return;
    const id = z.string().uuid().safeParse((req.params as { id: string }).id);
    const input = z.object({ status: z.enum(['preparing', 'shipped', 'delivered']) }).strict().safeParse(req.body);
    if (!id.success || !input.success) return reply.code(400).send({ error: 'invalid_payload' });
    const transitions: Record<string, string> = {
      confirmed_cod: 'preparing', preparing: 'shipped', shipped: 'delivered'
    };
    const client = await pool.connect();
    let status = '';
    try {
      await client.query('BEGIN');
      const found = await client.query('SELECT status FROM orders WHERE id=$1 FOR UPDATE', [id.data]);
      if (!found.rowCount) {
        await client.query('ROLLBACK');
        return reply.code(404).send({ error: 'not_found' });
      }
      const previous = found.rows[0].status as string;
      if (transitions[previous] !== input.data.status) {
        await client.query('ROLLBACK');
        return reply.code(409).send({ error: 'invalid_order_transition' });
      }
      await client.query('UPDATE orders SET status=$1 WHERE id=$2', [input.data.status, id.data]);
      await client.query('INSERT INTO admin_audit_log(actor_id,action,target,details) VALUES($1,$2,$3,$4::jsonb)',
        [actor.id, 'orders.status', id.data, JSON.stringify({ from: previous, to: input.data.status })]);
      await client.query('COMMIT');
      status = input.data.status;
    } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
    return reply.header('Cache-Control', 'no-store').send({ ok: true, status });
  });

  app.get('/v1/admin/staff', async (req, reply) => {
    if (!await requirePermission(req, reply, 'staff:manage')) return;
    const result = await pool.query(
      'SELECT id,username,display_name,role,grants,revokes,active,created_at FROM admin_users ORDER BY created_at');
    return reply.header('Cache-Control', 'no-store').send({
      items: (result.rows as Identity[]).map(publicUser)
    });
  });

  app.post('/v1/admin/staff', async (req, reply) => {
    const actor = await requirePermission(req, reply, 'staff:manage');
    if (!actor) return;
    const input = z.object({
      username, displayName: z.string().trim().min(2).max(100), password, role: roleSchema,
      grants: permissions.default([]), revokes: permissions.default([])
    }).strict().safeParse(req.body);
    if (!input.success) return reply.code(400).send({ error: 'invalid_payload' });
    const passHash = await hashPassword(input.data.password);
    let result;
    try {
      result = await pool.query(
        'INSERT INTO admin_users(username,display_name,password_hash,role,grants,revokes) ' +
        'VALUES($1,$2,$3,$4,$5::jsonb,$6::jsonb) RETURNING id,username,display_name,role,grants,revokes,active',
        [input.data.username, input.data.displayName, passHash, input.data.role,
          JSON.stringify(input.data.grants), JSON.stringify(input.data.revokes)]);
    } catch (error) {
      if ((error as { code?: string }).code === '23505') return reply.code(409).send({ error: 'username_taken' });
      throw error;
    }
    const user = result.rows[0] as Identity;
    await recordAudit(actor.id, 'staff.created', user.id, { role: user.role });
    return reply.code(201).header('Cache-Control', 'no-store').send({ user: publicUser(user) });
  });

  app.patch('/v1/admin/staff/:id', async (req, reply) => {
    const actor = await requirePermission(req, reply, 'staff:manage');
    if (!actor) return;
    const id = z.string().uuid().safeParse((req.params as { id: string }).id);
    const input = z.object({
      role: roleSchema.optional(), grants: permissions.optional(), revokes: permissions.optional(),
      active: z.boolean().optional()
    }).strict().refine(v => Object.keys(v).length > 0).safeParse(req.body);
    if (!id.success || !input.success) return reply.code(400).send({ error: 'invalid_payload' });
    if (actor.id === id.data) return reply.code(403).send({ error: 'cannot_modify_self' });
    const client = await pool.connect();
    let user: Identity | undefined;
    try {
      await client.query('BEGIN');
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
        'revokes=COALESCE($3::jsonb,revokes),active=COALESCE($4,active),updated_at=now() ' +
        'WHERE id=$5 RETURNING id,username,display_name,role,grants,revokes,active',
        [input.data.role ?? null, input.data.grants ? JSON.stringify(input.data.grants) : null,
          input.data.revokes ? JSON.stringify(input.data.revokes) : null, input.data.active ?? null, id.data]);
      user = updated.rows[0] as Identity;
      await client.query('DELETE FROM admin_sessions WHERE user_id=$1', [id.data]);
      await client.query('INSERT INTO admin_audit_log(actor_id,action,target,details) VALUES($1,$2,$3,$4::jsonb)',
        [actor.id, 'staff.updated', id.data, JSON.stringify(input.data)]);
      await client.query('COMMIT');
    } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
    return reply.header('Cache-Control', 'no-store').send({ user: publicUser(user!) });
  });

  await productAdminRoutes(app, requirePermission, opts);
  await mediaRoutes(app, requirePermission);
  await reportRoutes(app, requirePermission);

  app.get('/v1/admin/audit', async (req, reply) => {
    if (!await requirePermission(req, reply, 'staff:manage')) return;
    const result = await pool.query(
      'SELECT l.id,l.action,l.target,l.details,l.created_at,u.username AS actor ' +
      'FROM admin_audit_log l LEFT JOIN admin_users u ON u.id=l.actor_id ORDER BY l.id DESC LIMIT 100');
    return reply.header('Cache-Control', 'no-store').send({ items: result.rows });
  });
}
