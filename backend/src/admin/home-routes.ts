import type { FastifyInstance } from 'fastify';
import { pool } from '../db/connection';
import { recordAudit } from './audit';
import { MAX_SLIDES, homeSlidesInput } from './product-schema';
import type { Guard } from './identity';

type SlideRow = { id: string; slug: string; name: string; price: number; compareAt: number | null; images: string[];
  active: boolean; archivedAt: Date | null };

/** The home page slider: an ordered pick of published products. An empty pick means the storefront falls back to
 * discounted products, so saving an empty list is allowed. */
export async function homeAdminRoutes(app: FastifyInstance, check: Guard, opts: { invalidateCatalog?: () => Promise<void> }) {
  app.get('/v1/admin/home-slider', async (req, reply) => {
    if (!await check(req, reply, 'products:read')) return;
    const found = await pool.query<SlideRow>(
      'SELECT p.id,p.slug,p.name,p.price,p.compare_at AS "compareAt",p.images,p.active,p.archived_at AS "archivedAt" ' +
      'FROM home_slides s JOIN products p ON p.id=s.product_id ORDER BY s.position');
    return reply.header('Cache-Control', 'no-store').send({
      items: found.rows.map(row => ({ ...row, status: row.active ? 'active' : row.archivedAt ? 'archived' : 'draft' })),
      max: MAX_SLIDES
    });
  });

  app.put('/v1/admin/home-slider', async (req, reply) => {
    const actor = await check(req, reply, 'products:write');
    if (!actor) return;
    const parsed = homeSlidesInput.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_payload' });
    const ids = parsed.data.productIds;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      // One save at a time, so two editors cannot interleave their delete and insert.
      await client.query('SELECT pg_advisory_xact_lock(490202607)');
      const published = await client.query('SELECT id FROM products WHERE id = ANY($1::varchar[]) AND active', [ids]);
      if (published.rowCount !== ids.length) {
        await client.query('ROLLBACK');
        return reply.code(409).send({ error: 'slide_unavailable' });
      }
      const before = await client.query<{ product_id: string }>('SELECT product_id FROM home_slides ORDER BY position');
      await client.query('DELETE FROM home_slides');
      await client.query('INSERT INTO home_slides(position,product_id,updated_by) ' +
        'SELECT ordinality - 1, id, $2 FROM unnest($1::varchar[]) WITH ORDINALITY AS t(id, ordinality)', [ids, actor.id]);
      await recordAudit(client, actor.id, 'products.home_slider', 'home', {
        from: before.rows.map(row => row.product_id), to: ids });
      await client.query('COMMIT');
    } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
    await opts.invalidateCatalog?.();
    return reply.header('Cache-Control', 'no-store').send({ ok: true, productIds: ids });
  });
}
