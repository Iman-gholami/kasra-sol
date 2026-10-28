import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { pool } from '../db/connection';
import { recordAudit } from './audit';
import type { Guard } from './identity';
import { assignable, PERMISSIONS } from './permissions';

const roleInput = z.object({
  name: z.string().trim().min(2).max(80),
  permissions: z.array(z.enum(PERMISSIONS)).max(PERMISSIONS.length)
    .refine(assignable, 'Owner-only permissions cannot be delegated')
    .refine(items => new Set(items).size === items.length, 'Duplicate permissions')
}).strict();

export async function roleRoutes(app: FastifyInstance, check: Guard) {
  app.get('/v1/admin/roles', async (req, reply) => {
    if (!await check(req, reply, 'staff:manage')) return;
    const result = await pool.query(
      'SELECT r.id,r.name,r.permissions,COUNT(u.id)::int AS "memberCount" ' +
      'FROM admin_custom_roles r LEFT JOIN admin_users u ON u.custom_role_id=r.id ' +
      'GROUP BY r.id ORDER BY r.name,r.id');
    return reply.header('Cache-Control', 'no-store').send({ items: result.rows });
  });

  app.post('/v1/admin/roles', async (req, reply) => {
    const actor = await check(req, reply, 'staff:manage');
    if (!actor) return;
    const input = roleInput.safeParse(req.body);
    if (!input.success) return reply.code(400).send({ error: 'invalid_role' });
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query(
        'INSERT INTO admin_custom_roles(name,permissions) VALUES($1,$2::jsonb) RETURNING id,name,permissions',
        [input.data.name, JSON.stringify(input.data.permissions)]);
      const role = result.rows[0];
      await recordAudit(client, actor.id, 'staff.role_created', role.id, { name: role.name, permissions: role.permissions });
      await client.query('COMMIT');
      return reply.code(201).header('Cache-Control', 'no-store').send({ role: { ...role, memberCount: 0 } });
    } catch (error) {
      await client.query('ROLLBACK');
      if ((error as { code?: string }).code === '23505') return reply.code(409).send({ error: 'role_name_taken' });
      throw error;
    } finally { client.release(); }
  });

  app.put('/v1/admin/roles/:id', async (req, reply) => {
    const actor = await check(req, reply, 'staff:manage');
    if (!actor) return;
    const id = z.string().uuid().safeParse((req.params as { id: string }).id);
    const input = roleInput.safeParse(req.body);
    if (!id.success || !input.success) return reply.code(400).send({ error: 'invalid_role' });
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      // Lock the role first: assigning it to a user takes a compatible key-share lock, so a change
      // cannot miss a concurrently assigned account when it expires sessions below.
      const existing = await client.query('SELECT name FROM admin_custom_roles WHERE id=$1 FOR UPDATE', [id.data]);
      if (!existing.rowCount) { await client.query('ROLLBACK'); return reply.code(404).send({ error: 'role_not_found' }); }
      await client.query('UPDATE admin_custom_roles SET name=$1,permissions=$2::jsonb,updated_at=now() WHERE id=$3',
        [input.data.name, JSON.stringify(input.data.permissions), id.data]);
      await client.query('DELETE FROM admin_sessions WHERE user_id IN (SELECT id FROM admin_users WHERE custom_role_id=$1)', [id.data]);
      await recordAudit(client, actor.id, 'staff.role_updated', id.data,
        { from: existing.rows[0].name, name: input.data.name, permissions: input.data.permissions });
      await client.query('COMMIT');
      return reply.header('Cache-Control', 'no-store').send({ ok: true });
    } catch (error) {
      await client.query('ROLLBACK');
      if ((error as { code?: string }).code === '23505') return reply.code(409).send({ error: 'role_name_taken' });
      throw error;
    } finally { client.release(); }
  });

  app.delete('/v1/admin/roles/:id', async (req, reply) => {
    const actor = await check(req, reply, 'staff:manage');
    if (!actor) return;
    const id = z.string().uuid().safeParse((req.params as { id: string }).id);
    if (!id.success) return reply.code(400).send({ error: 'invalid_role' });
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const found = await client.query('SELECT name FROM admin_custom_roles WHERE id=$1 FOR UPDATE', [id.data]);
      if (!found.rowCount) { await client.query('ROLLBACK'); return reply.code(404).send({ error: 'role_not_found' }); }
      const members = await client.query<{ count: number }>(
        'SELECT count(*)::int AS count FROM admin_users WHERE custom_role_id=$1', [id.data]);
      if (members.rows[0].count) {
        await client.query('ROLLBACK');
        return reply.code(409).send({ error: 'role_in_use', memberCount: members.rows[0].count });
      }
      await client.query('DELETE FROM admin_custom_roles WHERE id=$1', [id.data]);
      await recordAudit(client, actor.id, 'staff.role_deleted', id.data, { name: found.rows[0].name });
      await client.query('COMMIT');
      return reply.header('Cache-Control', 'no-store').send({ ok: true });
    } catch (error) {
      await client.query('ROLLBACK');
      if ((error as { code?: string }).code === '23503') return reply.code(409).send({ error: 'role_in_use' });
      throw error;
    } finally { client.release(); }
  });
}
