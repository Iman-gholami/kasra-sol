import Fastify from 'fastify';
import rateLimit from '@fastify/rate-limit';
import Redis from 'ioredis';
import { createHash, timingSafeEqual } from 'node:crypto';
import { eq, and, sql } from 'drizzle-orm';
import { z } from 'zod';
import { pool, db } from './db/connection';
import { products, variants } from './db/schema';
import { filters, getProduct, listProducts } from './catalog';
import { orderRoutes } from './orders';
import { DomainError } from './pricing';
import { normalizeSearch } from './search';
import { categories } from '../../src/data/facets';

if (process.env.NODE_ENV === 'production' && (!process.env.ORDER_TOKEN_SECRET || process.env.ORDER_TOKEN_SECRET.length < 32))
  throw new Error('Set ORDER_TOKEN_SECRET to a random secret of at least 32 characters');

const app = Fastify({
  logger: true, bodyLimit: 32768, trustProxy: process.env.TRUST_PROXY === 'true'
});
await app.register(rateLimit, { max: 120, timeWindow: '1 minute', errorResponseBuilder: () => ({
  error: 'rate_limited', message: 'Too many requests'
}) });

const redis = process.env.REDIS_URL ? new Redis(process.env.REDIS_URL, {
  lazyConnect: true, enableOfflineQueue: false, maxRetriesPerRequest: 1, retryStrategy: () => null
}) : null;
if (redis) {
  redis.on('error', error => app.log.warn({ error: error.message }, 'Redis unavailable; serving uncached'));
  redis.connect().catch(() => {});
}
async function cached<T>(key: string, loader: () => Promise<T>): Promise<T> {
  if (redis?.status === 'ready') {
    try {
      const revision = await redis.get('kasra:catalog:revision') ?? '0';
      const fullKey = 'kasra:catalog:' + revision + ':' + key;
      const existing = await redis.get(fullKey);
      if (existing) return JSON.parse(existing) as T;
      const data = await loader();
      await redis.set(fullKey, JSON.stringify(data), 'EX', 20);
      return data;
    } catch (error) {
      app.log.warn({ error }, 'Cache failed; using database');
    }
  }
  return loader();
}

app.setErrorHandler((error, _req, reply) => {
  if (error instanceof DomainError) return reply.code(error.status).send({ error: 'business_rule', message: error.message });
  const known = error as { statusCode?: number; message?: string };
  if (typeof known.statusCode === 'number' && known.statusCode >= 400 && known.statusCode < 500)
    return reply.code(known.statusCode).send({ error: 'bad_request', message: known.message ?? 'Bad request' });
  app.log.error(error);
  return reply.code(500).send({ error: 'internal_server_error' });
});
app.get('/health/live', { config: { rateLimit: false } }, async () => ({ status: 'ok' }));
app.get('/health/ready', { config: { rateLimit: false } }, async (_req, reply) => {
  try {
    await pool.query('SELECT 1');
    return { status: 'ok', db: 'ready', cache: redis?.status ?? 'disabled' };
  } catch {
    return reply.code(503).send({ status: 'unavailable', db: 'down' });
  }
});
app.get('/v1/categories', async () => categories);
app.get('/v1/products', async (req, reply) => {
  const parsed = filters.safeParse(req.query);
  if (!parsed.success) return reply.code(400).send({ error: 'invalid_query', details: parsed.error.flatten() });
  return cached('products:' + JSON.stringify(parsed.data), () => listProducts(parsed.data));
});
app.get('/v1/products/:slug', async (req, reply) => {
  const slug = (req.params as { slug: string }).slug;
  if (slug.length > 100) return reply.code(404).send({ error: 'not_found' });
  const product = await cached('product:' + slug, () => getProduct(slug));
  return product ?? reply.code(404).send({ error: 'not_found' });
});
app.get('/v1/search/suggestions', async (req, reply) => {
  const query = z.object({ q: z.string().max(100).default('') }).safeParse(req.query);
  if (!query.success) return reply.code(400).send({ error: 'invalid_query' });
  const q = normalizeSearch(query.data.q);
  if (!q) return { products: [], categories: [], count: 0 };
  const matches = await listProducts({ q, page: 1, limit: 48, sort: 'featured' });
  const matchingCategories = categories.filter(c => normalizeSearch(c.title).includes(q) || q.includes(normalizeSearch(c.title)));
  return {
    products: matches.items.slice(0, 4).map(p => ({
      id: p.id, name: p.name, category: categories.find(c => c.slug === p.category)?.title ?? '',
      image: p.images[0], price: p.price, href: '/product/' + p.slug
    })),
    categories: matchingCategories.slice(0, 3).map(c => ({ slug: c.slug, title: c.title, href: '/category/' + c.slug })),
    count: matches.total
  };
});

function isAdmin(value: string | undefined) {
  const secret = process.env.ADMIN_API_KEY;
  if (!value || !secret || secret.length < 32) return false;
  const a = createHash('sha256').update(value).digest();
  const b = createHash('sha256').update(secret).digest();
  return timingSafeEqual(a,b);
}
app.put('/v1/admin/stock', { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async (req, reply) => {
  if (!isAdmin(req.headers.authorization?.replace(/^Bearer /i,''))) return reply.code(401).send({ error: 'unauthorized' });
  const input = z.object({ productId: z.string().min(1).max(80), colorId: z.string().min(1).max(80),
    size: z.string().min(1).max(20), stock: z.number().int().min(0).max(1_000_000) }).safeParse(req.body);
  if (!input.success) return reply.code(400).send({ error: 'invalid_payload' });
  const v = input.data;
  const updated = await db.update(variants).set({ stock: v.stock })
    .where(and(eq(variants.productId, v.productId), eq(variants.colorId, v.colorId), eq(variants.size, v.size)))
    .returning({ id: variants.id, stock: variants.stock });
  if (!updated.length) return reply.code(404).send({ error: 'not_found' });
  if (redis?.status === 'ready') await redis.incr('kasra:catalog:revision').catch(() => {});
  return { ok: true, stock: updated[0].stock };
});
await app.register(orderRoutes);
const shutdown = async () => {
  await app.close();
  if (redis) redis.disconnect();
  await pool.end();
};
process.on('SIGTERM', () => { shutdown().finally(() => process.exit(0)); });
process.on('SIGINT', () => { shutdown().finally(() => process.exit(0)); });

const port = Number(process.env.API_PORT ?? '4000');
await app.listen({ port, host: '0.0.0.0' });
