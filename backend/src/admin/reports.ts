import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { pool } from '../db/connection';
import type { Permission } from './permissions';

type Guard = (request: FastifyRequest, reply: FastifyReply, permission: Permission) => Promise<{ id: string } | null>;
type TrendRow = { date: string; deliveredOrders: number; deliveredValue: string };
type SummaryRow = { today_orders: number; month_orders: number; pending_online: number; cod_in_progress: number };
type ProductRow = { total: number; active: number; archived: number; low_variants: number; out_of_stock_variants: number };
type TopRow = { id: string; name: string; units: number; orders: number };
type LowRow = { id: string; name: string; colorId: string; colorName: string; size: string; stock: number };
type AmountRow = { amount: string; orders: number };

export async function reportRoutes(app: FastifyInstance, guard: Guard) {
  app.get('/v1/admin/reports/overview', async (request, reply) => {
    if (!await guard(request, reply, 'reports:read')) return;
    // Every day/month boundary is in Tehran local time, independent of the database server time zone.
    // COD delivery is an operational status, not proof that money was collected.
    const [summary, catalog, monthlyDelivered, trend, top, low] = await Promise.all([
      pool.query<SummaryRow>([
        "SELECT COUNT(*) FILTER (WHERE (created_at AT TIME ZONE 'Asia/Tehran')::date =",
        "(now() AT TIME ZONE 'Asia/Tehran')::date)::int AS today_orders,",
        "COUNT(*) FILTER (WHERE (created_at AT TIME ZONE 'Asia/Tehran')::date >=",
        "date_trunc('month', now() AT TIME ZONE 'Asia/Tehran')::date)::int AS month_orders,",
        "COUNT(*) FILTER (WHERE payment='online' AND status='pending_payment')::int AS pending_online,",
        "COUNT(*) FILTER (WHERE payment='cod' AND status IN",
        "('confirmed_cod','preparing','shipped'))::int AS cod_in_progress FROM orders"
      ].join(' ')),
      pool.query<ProductRow>([
        'SELECT COUNT(DISTINCT p.id)::int AS total,',
        'COUNT(DISTINCT p.id) FILTER (WHERE p.active)::int AS active,',
        'COUNT(DISTINCT p.id) FILTER (WHERE NOT p.active)::int AS archived,',
        'COUNT(v.id) FILTER (WHERE p.active AND v.stock BETWEEN 1 AND 3)::int AS low_variants,',
        'COUNT(v.id) FILTER (WHERE p.active AND v.stock=0)::int AS out_of_stock_variants',
        'FROM products p LEFT JOIN product_variants v ON v.product_id=p.id'
      ].join(' ')),
      pool.query<AmountRow>([
        "SELECT COALESCE(SUM(o.total),0)::text AS amount, COUNT(*)::int AS orders",
        'FROM admin_audit_log a JOIN orders o ON o.id::text=a.target',
        "WHERE a.action='orders.status' AND a.details->>'to'='delivered'",
        "AND o.payment='cod' AND o.status='delivered'",
        "AND (a.created_at AT TIME ZONE 'Asia/Tehran')::date >=",
        "date_trunc('month', now() AT TIME ZONE 'Asia/Tehran')::date"
      ].join(' ')),
      pool.query<TrendRow>([
        'WITH days AS (SELECT generate_series(',
        "(now() AT TIME ZONE 'Asia/Tehran')::date - interval '6 days',",
        "(now() AT TIME ZONE 'Asia/Tehran')::date, interval '1 day')::date AS day",
        '), deliveries AS (',
        "SELECT (a.created_at AT TIME ZONE 'Asia/Tehran')::date AS day,",
        "COUNT(*)::int AS delivered_orders, COALESCE(SUM(o.total),0)::text AS delivered_value",
        'FROM admin_audit_log a JOIN orders o ON o.id::text=a.target',
        "WHERE a.action='orders.status' AND a.details->>'to'='delivered'",
        "AND o.payment='cod' AND o.status='delivered'",
        "AND (a.created_at AT TIME ZONE 'Asia/Tehran')::date >=",
        "(now() AT TIME ZONE 'Asia/Tehran')::date - 6",
        "GROUP BY (a.created_at AT TIME ZONE 'Asia/Tehran')::date",
        ') SELECT to_char(d.day,',
        "'YYYY-MM-DD') AS date, COALESCE(x.delivered_orders,0)::int AS \"deliveredOrders\",",
        "COALESCE(x.delivered_value,'0')::text AS \"deliveredValue\"",
        'FROM days d LEFT JOIN deliveries x ON x.day=d.day ORDER BY d.day'
      ].join(' ')),
      pool.query<TopRow>([
        'SELECT oi.product_id AS id, COALESCE(MAX(p.name),MAX(oi.name)) AS name,',
        'SUM(oi.quantity)::int AS units, COUNT(DISTINCT oi.order_id)::int AS orders',
        'FROM order_items oi JOIN orders o ON o.id=oi.order_id',
        'LEFT JOIN products p ON p.id=oi.product_id',
        "WHERE o.payment='cod' AND o.status IN ('confirmed_cod','preparing','shipped','delivered')",
        'GROUP BY oi.product_id ORDER BY units DESC, orders DESC, name ASC LIMIT 6'
      ].join(' ')),
      pool.query<LowRow>([
        'SELECT p.id,p.name,v.color_id AS "colorId",',
        "COALESCE((SELECT color->>'name' FROM jsonb_array_elements(p.colors) AS color",
        "WHERE color->>'id'=v.color_id LIMIT 1),v.color_id) AS \"colorName\",",
        'v.size,v.stock FROM product_variants v JOIN products p ON p.id=v.product_id',
        'WHERE p.active AND v.stock<=3 ORDER BY v.stock ASC,p.name ASC,v.size ASC LIMIT 8'
      ].join(' '))
    ]);
    const daily = trend.rows;
    const today = daily.at(-1) ?? { date: '', deliveredOrders: 0, deliveredValue: '0' };
    return reply.header('Cache-Control', 'no-store').send({
      timezone: 'Asia/Tehran', currency: 'IRT', paymentVerificationAvailable: false,
      note: 'مبالغ، ارزش سفارش‌های پرداخت در محل با وضعیت تحویل‌شده هستند؛ دریافت وجه تأیید نشده و درآمد قطعی محسوب نمی‌شوند.',
      orders: {
        today: summary.rows[0]?.today_orders ?? 0,
        month: summary.rows[0]?.month_orders ?? 0,
        pendingOnline: summary.rows[0]?.pending_online ?? 0,
        codInProgress: summary.rows[0]?.cod_in_progress ?? 0
      },
      delivered: {
        todayOrders: today.deliveredOrders,
        todayValue: today.deliveredValue,
        monthOrders: monthlyDelivered.rows[0]?.orders ?? 0,
        monthValue: monthlyDelivered.rows[0]?.amount ?? '0'
      },
      products: catalog.rows[0] ?? {
        total: 0, active: 0, archived: 0, low_variants: 0, out_of_stock_variants: 0
      },
      trend: daily,
      topProducts: top.rows,
      lowStock: low.rows
    });
  });
}
