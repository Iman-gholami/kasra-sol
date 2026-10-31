import { createHash, timingSafeEqual } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';
import { z } from 'zod';

export type ShopinoTrackingStore = { get(ids: number[]): Promise<Map<number, string | null>> };

export function postgresShopinoTracking(pool: Pool): ShopinoTrackingStore {
  return {
    async get(ids) {
      if (!ids.length) return new Map();
      const result = await pool.query<{ id: string; tracking_code: string | null }>(
        'SELECT id,tracking_code FROM shopino_order_links WHERE id=ANY($1::bigint[])', [ids]);
      return new Map(result.rows.map(row => [Number(row.id), row.tracking_code]));
    }
  };
}

const requestBody = z.object({ order_ids: z.array(z.number().int().min(1).max(Number.MAX_SAFE_INTEGER)).max(1000) }).strict();
const digest = (value: string) => createHash('sha256').update(value).digest();

/** A configured partner secret is required; tracking requests never inspect or modify payment state. */
export async function shopinoTrackingRoutes(app: FastifyInstance,
  options: { store: ShopinoTrackingStore; token: string }) {
  app.post('/v1/shopino/tracking', { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } }, async (req, reply) => {
    if (!/^[a-f0-9]{64}$/.test(options.token))
      return reply.code(503).header('Cache-Control', 'no-store').send({ error: 'shopino_not_configured' });
    const match = /^Bearer ([a-f0-9]{64})$/i.exec(req.headers.authorization ?? '');
    if (!match || !timingSafeEqual(digest(match[1]), digest(options.token)))
      return reply.code(401).header('Cache-Control', 'no-store').send({ error: 'unauthorized' });
    const input = requestBody.safeParse(req.body);
    if (!input.success) return reply.code(400).header('Cache-Control', 'no-store').send({ error: 'invalid_payload' });
    const codes = await options.store.get(input.data.order_ids);
    return reply.header('Cache-Control', 'no-store').send({
      codes: input.data.order_ids.map(id => codes.get(id) ?? null)
    });
  });
}
