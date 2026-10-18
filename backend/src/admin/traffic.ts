import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { pool } from '../db/connection';
import { sourceOf, type Source } from '../analytics-rules';
import type { Guard } from './identity';

type DayRow = { date: string; views: number; visitors: number; orders: number };
type CountRow = { key: string | null; views: number; visitors: number };
type ProductRow = { slug: string; id: string | null; name: string | null; views: number; visitors: number; units: number };
const query = z.object({ days: z.coerce.number().int().refine(days => [7, 30, 90].includes(days)).default(7) });
// First Tehran day of the range, as an instant, for index-friendly comparisons.
const RANGE_DAYS = "((now() AT TIME ZONE 'Asia/Tehran')::date - ($1::int - 1))";

export async function trafficRoutes(app: FastifyInstance, guard: Guard) {
  app.get('/v1/admin/reports/traffic', async (request, reply) => {
    if (!await guard(request, reply, 'reports:read')) return;
    const parsed = query.safeParse(request.query);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_query' });
    const { days } = parsed.data;
    const range = [days];
    const [daily, live, hours, pages, products, referrers, devices] = await Promise.all([
      pool.query<DayRow>([
        "WITH days AS (SELECT generate_series(", RANGE_DAYS, "::timestamp,",
        "(now() AT TIME ZONE 'Asia/Tehran')::date::timestamp, interval '1 day')::date AS day),",
        'views AS (SELECT day, COUNT(*)::int AS views, COUNT(DISTINCT visitor)::int AS visitors',
        'FROM page_views WHERE day >=', RANGE_DAYS, 'GROUP BY day),',
        "placed AS (SELECT (created_at AT TIME ZONE 'Asia/Tehran')::date AS day, COUNT(*)::int AS orders FROM orders",
        "WHERE status <> 'cancelled' AND created_at >= (", RANGE_DAYS, "::timestamp AT TIME ZONE 'Asia/Tehran') GROUP BY 1)",
        "SELECT to_char(d.day,'YYYY-MM-DD') AS date, COALESCE(v.views,0) AS views, COALESCE(v.visitors,0) AS visitors,",
        'COALESCE(p.orders,0) AS orders FROM days d LEFT JOIN views v ON v.day=d.day LEFT JOIN placed p ON p.day=d.day ORDER BY d.day'
      ].join(' '), range),
      pool.query<{ visitors: number }>(
        "SELECT COUNT(DISTINCT visitor)::int AS visitors FROM page_views WHERE viewed_at > now() - interval '5 minutes'"),
      pool.query<{ hour: number; views: number }>([
        "SELECT EXTRACT(HOUR FROM viewed_at AT TIME ZONE 'Asia/Tehran')::int AS hour, COUNT(*)::int AS views",
        'FROM page_views WHERE day >=', RANGE_DAYS, 'GROUP BY 1'
      ].join(' '), range),
      pool.query<CountRow>([
        'SELECT path AS key, COUNT(*)::int AS views, COUNT(DISTINCT (day, visitor))::int AS visitors',
        'FROM page_views WHERE day >=', RANGE_DAYS, 'GROUP BY path ORDER BY views DESC, path LIMIT 8'
      ].join(' '), range),
      pool.query<ProductRow>([
        'WITH viewed AS (SELECT product_slug AS slug, COUNT(*)::int AS views, COUNT(DISTINCT (day, visitor))::int AS visitors',
        'FROM page_views WHERE day >=', RANGE_DAYS, 'AND product_slug IS NOT NULL',
        'GROUP BY product_slug ORDER BY views DESC, product_slug LIMIT 8)',
        'SELECT v.slug, p.id, p.name, v.views, v.visitors, COALESCE((SELECT SUM(i.quantity) FROM order_items i',
        "JOIN orders o ON o.id=i.order_id WHERE i.product_id=p.id AND o.status <> 'cancelled'",
        "AND o.created_at >= (", RANGE_DAYS, "::timestamp AT TIME ZONE 'Asia/Tehran')),0)::int AS units",
        'FROM viewed v LEFT JOIN products p ON p.slug=v.slug ORDER BY v.views DESC, v.slug'
      ].join(' '), range),
      pool.query<CountRow>([
        'SELECT referrer_host AS key, COUNT(*)::int AS views, COUNT(DISTINCT (day, visitor))::int AS visitors',
        // Source totals must include the long tail; only the displayed referrer list is truncated below.
        'FROM page_views WHERE day >=', RANGE_DAYS, 'GROUP BY referrer_host ORDER BY views DESC, referrer_host'
      ].join(' '), range),
      pool.query<CountRow>([
        'SELECT device AS key, COUNT(*)::int AS views, COUNT(DISTINCT (day, visitor))::int AS visitors',
        'FROM page_views WHERE day >=', RANGE_DAYS, 'GROUP BY device'
      ].join(' '), range)
    ]);
    const series = daily.rows;
    const views = series.reduce((sum, row) => sum + row.views, 0);
    // A visitor is counted once per day (the daily salt makes days unlinkable), so range visitors are a sum.
    const visitors = series.reduce((sum, row) => sum + row.visitors, 0);
    const orders = series.reduce((sum, row) => sum + row.orders, 0);
    const sources = new Map<Source, number>();
    for (const row of referrers.rows) sources.set(sourceOf(row.key), (sources.get(sourceOf(row.key)) ?? 0) + row.views);
    const byHour = new Map(hours.rows.map(row => [row.hour, row.views]));
    return reply.header('Cache-Control', 'no-store').send({
      days, timezone: 'Asia/Tehran',
      today: series.at(-1) ?? { date: '', views: 0, visitors: 0, orders: 0 },
      yesterday: series.at(-2) ?? null,
      live: live.rows[0]?.visitors ?? 0,
      totals: { views, visitors, orders, conversion: visitors ? orders / visitors : 0 },
      daily: series,
      hours: Array.from({ length: 24 }, (_, hour) => ({ hour, views: byHour.get(hour) ?? 0 })),
      pages: pages.rows.map(row => ({ path: row.key, views: row.views, visitors: row.visitors })),
      products: products.rows,
      sources: (['direct', 'search', 'social', 'compare', 'other'] as const).map(source => ({ source, views: sources.get(source) ?? 0 })),
      referrers: referrers.rows.filter(row => row.key).slice(0, 8)
        .map(row => ({ host: row.key, source: sourceOf(row.key), views: row.views })),
      devices: (['mobile', 'desktop', 'tablet'] as const).map(device => ({
        device, views: devices.rows.find(row => row.key === device)?.views ?? 0,
        visitors: devices.rows.find(row => row.key === device)?.visitors ?? 0
      }))
    });
  });
}
