import { createHash, randomBytes } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { pool } from './db/connection';
import { tehranDate } from './admin/calendar';
import { deviceOf, isBot, normalizePath, productSlugOf, referrerHost } from './analytics-rules';

const RETENTION_DAYS = 400;
let current: { day: string; salt: string } | null = null;

/** Today's salt (Tehran day). On the first view of a day, older salts are deleted (yesterday's hashes can no
 * longer be linked to anything) and page views past the retention period are removed. */
async function saltFor(day: string): Promise<string> {
  if (current?.day === day) return current.salt;
  await pool.query('INSERT INTO analytics_salts(day,salt) VALUES($1,$2) ON CONFLICT (day) DO NOTHING',
    [day, randomBytes(32).toString('hex')]);
  const found = await pool.query<{ salt: string }>('SELECT salt FROM analytics_salts WHERE day=$1', [day]);
  await pool.query("DELETE FROM analytics_salts WHERE day < $1::date - 1", [day]);
  await pool.query('DELETE FROM page_views WHERE day < $1::date - $2::int', [day, RETENTION_DAYS]);
  current = { day, salt: found.rows[0].salt };
  return current.salt;
}

const view = z.object({ path: z.string().min(1).max(600), referrer: z.string().max(1000).optional() }).strict();

export async function analyticsRoutes(app: FastifyInstance) {
  // Called by the storefront for each page shown in a real browser. Always 204: nothing to read back.
  app.post('/v1/analytics/view', { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } }, async (req, reply) => {
    const input = view.safeParse(req.body);
    const userAgent = req.headers['user-agent'];
    const path = input.success ? normalizePath(input.data.path) : null;
    if (!input.success || !path || isBot(userAgent)) return reply.code(204).send();
    const day = tehranDate(new Date());
    const visitor = createHash('sha256').update(await saltFor(day) + '|' + req.ip + '|' + userAgent)
      .digest('hex').slice(0, 32);
    await pool.query(
      'INSERT INTO page_views(day,path,product_slug,referrer_host,device,visitor) VALUES($1,$2,$3,$4,$5,$6)',
      [day, path, productSlugOf(path), referrerHost(input.data.referrer), deviceOf(userAgent!), visitor]);
    return reply.code(204).send();
  });
}
