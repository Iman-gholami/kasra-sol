import type { FastifyInstance } from 'fastify';
import { pool } from '../db/connection';
import { persianMonthStart } from './calendar';
import type { Guard } from './identity';

type TrendRow = { date: string; orders: number; codOrders: number; onlineOrders: number; deliveredOrders: number; deliveredValue: string };
type SummaryRow = { today_orders: number; month_orders: number; month_cancelled: number; pending_online: number;
  pending_online_value: string; cod_in_progress: number };
type ProductRow = { total: number; active: number; draft: number; archived: number; low_variants: number;
  out_of_stock_variants: number; low_stock_products: number; out_of_stock_products: number };
type TopRow = { id: string; name: string; units: number; orders: number };
type LowRow = { id: string; name: string; colorId: string; colorName: string; size: string; stock: number };
type AmountRow = { amount: string; orders: number };

// Start of a Tehran calendar day as an absolute instant, so the comparison can use the created_at index.
const TODAY = "((now() AT TIME ZONE 'Asia/Tehran')::date::timestamp AT TIME ZONE 'Asia/Tehran')";
const WEEK = "(((now() AT TIME ZONE 'Asia/Tehran')::date - 6)::timestamp AT TIME ZONE 'Asia/Tehran')";
const MONTH = "($1::date::timestamp AT TIME ZONE 'Asia/Tehran')";
const LOCAL_DAY = (column: string) => '(' + column + " AT TIME ZONE 'Asia/Tehran')::date";

export async function reportRoutes(app: FastifyInstance, guard: Guard) {
  app.get('/v1/admin/reports/overview', async (request, reply) => {
    if (!await guard(request, reply, 'reports:read')) return;
    // Days are Tehran local days; "month" is the current Solar Hijri month. Cancelled orders are not counted
    // as orders. COD delivery is an operational status, not proof that money was collected.
    const month = persianMonthStart();
    const [summary, catalog, monthlyDelivered, trend, top, low] = await Promise.all([
      pool.query<SummaryRow>([
        "SELECT COUNT(*) FILTER (WHERE status<>'cancelled' AND created_at >=", TODAY, ')::int AS today_orders,',
        "COUNT(*) FILTER (WHERE status<>'cancelled' AND created_at >=", MONTH, ')::int AS month_orders,',
        "COUNT(*) FILTER (WHERE status='cancelled' AND created_at >=", MONTH, ')::int AS month_cancelled,',
        "COUNT(*) FILTER (WHERE payment='online' AND status='pending_payment')::int AS pending_online,",
        "COALESCE(SUM(total) FILTER (WHERE payment='online' AND status='pending_payment'),0)::text AS pending_online_value,",
        "COUNT(*) FILTER (WHERE payment='cod' AND status IN ('confirmed_cod','preparing','shipped'))::int AS cod_in_progress",
        'FROM orders'
      ].join(' '), [month.start]),
      pool.query<ProductRow>([
        'SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE active)::int AS active,',
        'COUNT(*) FILTER (WHERE NOT active AND archived_at IS NULL)::int AS draft,',
        'COUNT(*) FILTER (WHERE archived_at IS NOT NULL)::int AS archived,',
        'COALESCE(SUM(low_count) FILTER (WHERE active),0)::int AS low_variants,',
        'COALESCE(SUM(empty_count) FILTER (WHERE active),0)::int AS out_of_stock_variants,',
        'COUNT(*) FILTER (WHERE active AND stock_total > 0 AND low_count > 0)::int AS low_stock_products,',
        'COUNT(*) FILTER (WHERE active AND stock_total = 0)::int AS out_of_stock_products',
        'FROM (SELECT p.active, p.archived_at, COALESCE(SUM(v.stock),0) AS stock_total,',
        'COUNT(v.id) FILTER (WHERE v.stock BETWEEN 1 AND 3) AS low_count, COUNT(v.id) FILTER (WHERE v.stock=0) AS empty_count',
        'FROM products p LEFT JOIN product_variants v ON v.product_id=p.id GROUP BY p.id) x'
      ].join(' ')),
      pool.query<AmountRow>([
        'SELECT COALESCE(SUM(o.total),0)::text AS amount, COUNT(*)::int AS orders',
        'FROM order_status_history h JOIN orders o ON o.id=h.order_id',
        "WHERE h.to_status='delivered' AND o.payment='cod' AND o.status='delivered' AND h.created_at >=", MONTH
      ].join(' '), [month.start]),
      pool.query<TrendRow>([
        "WITH days AS (SELECT generate_series(((now() AT TIME ZONE 'Asia/Tehran')::date - 6)::timestamp,",
        "(now() AT TIME ZONE 'Asia/Tehran')::date::timestamp, interval '1 day')::date AS day),",
        'placed AS (SELECT', LOCAL_DAY('created_at'), 'AS day,',
        "COUNT(*) FILTER (WHERE status<>'cancelled')::int AS orders,",
        "COUNT(*) FILTER (WHERE payment='cod' AND status<>'cancelled')::int AS cod,",
        "COUNT(*) FILTER (WHERE payment='online' AND status<>'cancelled')::int AS online",
        'FROM orders WHERE created_at >=', WEEK, 'GROUP BY 1),',
        'delivered AS (SELECT', LOCAL_DAY('h.created_at'), 'AS day, COUNT(*)::int AS n, COALESCE(SUM(o.total),0)::text AS value',
        'FROM order_status_history h JOIN orders o ON o.id=h.order_id',
        "WHERE h.to_status='delivered' AND o.payment='cod' AND o.status='delivered' AND h.created_at >=", WEEK, 'GROUP BY 1)',
        "SELECT to_char(d.day,'YYYY-MM-DD') AS date, COALESCE(p.orders,0)::int AS orders,",
        'COALESCE(p.cod,0)::int AS "codOrders", COALESCE(p.online,0)::int AS "onlineOrders",',
        'COALESCE(x.n,0)::int AS "deliveredOrders", COALESCE(x.value,\'0\')::text AS "deliveredValue"',
        'FROM days d LEFT JOIN placed p ON p.day=d.day LEFT JOIN delivered x ON x.day=d.day ORDER BY d.day'
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
    const today = daily.at(-1) ?? { deliveredOrders: 0, deliveredValue: '0' };
    const s = summary.rows[0];
    return reply.header('Cache-Control', 'no-store').send({
      timezone: 'Asia/Tehran', currency: 'IRT', paymentVerificationAvailable: false,
      note: 'مبالغ، ارزش سفارش‌های پرداخت در محل با وضعیت تحویل‌شده هستند؛ دریافت وجه تأیید نشده و درآمد قطعی محسوب نمی‌شوند.',
      period: { calendar: 'persian', monthStart: month.start, monthLabel: month.label },
      orders: {
        today: s?.today_orders ?? 0,
        month: s?.month_orders ?? 0,
        monthCancelled: s?.month_cancelled ?? 0,
        pendingOnline: s?.pending_online ?? 0,
        pendingOnlineValue: s?.pending_online_value ?? '0',
        codInProgress: s?.cod_in_progress ?? 0
      },
      delivered: {
        todayOrders: today.deliveredOrders,
        todayValue: today.deliveredValue,
        monthOrders: monthlyDelivered.rows[0]?.orders ?? 0,
        monthValue: monthlyDelivered.rows[0]?.amount ?? '0'
      },
      products: catalog.rows[0] ?? {
        total: 0, active: 0, draft: 0, archived: 0, low_variants: 0, out_of_stock_variants: 0,
        low_stock_products: 0, out_of_stock_products: 0
      },
      trend: daily,
      topProducts: top.rows,
      lowStock: low.rows
    });
  });
}
