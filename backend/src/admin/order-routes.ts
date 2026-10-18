import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { pool } from '../db/connection';
import { recordAudit } from './audit';
import type { Guard } from './identity';

export const ORDER_STATUSES = ['pending_payment', 'confirmed_cod', 'preparing', 'shipped', 'delivered', 'cancelled'] as const;
type Payment = 'cod' | 'online';
// Manual transitions staff may record. There is no verified payment yet, so an online order can only be
// cancelled: nothing here (or in the database constraints) can make it paid or send it to fulfilment.
const TRANSITIONS: Record<Payment, Partial<Record<string, readonly string[]>>> = {
  cod: { confirmed_cod: ['preparing', 'cancelled'], preparing: ['shipped', 'cancelled'], shipped: ['delivered'] },
  online: { pending_payment: ['cancelled'] }
};
export const nextStatuses = (payment: string, status: string): readonly string[] =>
  (payment === 'cod' || payment === 'online') ? TRANSITIONS[payment][status] ?? [] : [];

const listQuery = z.object({
  status: z.enum(['all', 'open', ...ORDER_STATUSES]).default('all'),
  q: z.string().trim().max(80).optional(),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25)
});
const toLatin = (value: string) => value.replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
  .replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));

export async function orderAdminRoutes(app: FastifyInstance, check: Guard,
  opts: { invalidateCatalog?: () => Promise<void> }) {

  // The list shows only what is needed to pick an order; mobile and full address are in the detail view.
  app.get('/v1/admin/orders', async (req, reply) => {
    if (!await check(req, reply, 'orders:read')) return;
    const query = listQuery.safeParse(req.query);
    if (!query.success) return reply.code(400).send({ error: 'invalid_query' });
    const { status, page, limit } = query.data;
    const q = query.data.q ? toLatin(query.data.q) : '';
    const where: string[] = [];
    const values: unknown[] = [];
    if (status === 'open') where.push("o.status IN ('pending_payment','confirmed_cod','preparing','shipped')");
    else if (status !== 'all') { values.push(status); where.push('o.status=$' + values.length); }
    if (q) {
      values.push(q.replace(/[%_\\]/g, '\\$&') + '%');
      const prefix = '$' + values.length;
      values.push('%' + q.replace(/[%_\\]/g, '\\$&') + '%');
      const anywhere = '$' + values.length;
      where.push('(o.id::text ILIKE ' + prefix + " OR o.address->>'mobile' LIKE " + anywhere +
        " OR o.address->>'name' ILIKE " + anywhere + ')');
    }
    const filter = where.length ? 'WHERE ' + where.join(' AND ') : '';
    const counted = await pool.query<{ total: number }>('SELECT COUNT(*)::int AS total FROM orders o ' + filter, values);
    const total = counted.rows[0]?.total ?? 0;
    const pages = Math.max(1, Math.ceil(total / limit));
    const current = Math.min(page, pages);
    const result = await pool.query(
      'SELECT o.id,o.status,o.payment,o.payment_status AS "paymentStatus",o.shipping,o.total,o.created_at AS "createdAt",' +
      "o.address->>'name' AS customer,o.address->>'province' AS province,o.address->>'city' AS city," +
      '(SELECT COALESCE(SUM(quantity),0)::int FROM order_items i WHERE i.order_id=o.id) AS units ' +
      'FROM orders o ' + filter + ' ORDER BY o.created_at DESC,o.id LIMIT $' + (values.length + 1) +
      ' OFFSET $' + (values.length + 2), [...values, limit, (current - 1) * limit]);
    return reply.header('Cache-Control', 'no-store').send({
      items: result.rows.map(row => ({ ...row, nextStatuses: nextStatuses(row.payment, row.status) })),
      total, page: current, pages, limit
    });
  });

  app.get('/v1/admin/orders/:id', async (req, reply) => {
    if (!await check(req, reply, 'orders:read')) return;
    const id = z.string().uuid().safeParse((req.params as { id: string }).id);
    if (!id.success) return reply.code(404).send({ error: 'not_found' });
    const found = await pool.query(
      'SELECT id,status,payment,payment_status AS "paymentStatus",shipping,code,subtotal,discount,' +
      'shipping_cost AS "shippingCost",total,address,created_at AS "createdAt" FROM orders WHERE id=$1', [id.data]);
    const order = found.rows[0];
    if (!order) return reply.code(404).send({ error: 'not_found' });
    const [items, history] = await Promise.all([
      pool.query(
        'SELECT i.product_id AS "productId",i.name,i.color_id AS "colorId",i.color_name AS "colorName",i.size,' +
        'i.quantity,i.unit_price AS "unitPrice",p.active AS "productActive" ' +
        'FROM order_items i LEFT JOIN products p ON p.id=i.product_id WHERE i.order_id=$1 ORDER BY i.name,i.size', [id.data]),
      pool.query(
        'SELECT h.from_status AS "from",h.to_status AS "to",h.note,h.created_at AS "createdAt",' +
        'u.display_name AS actor FROM order_status_history h LEFT JOIN admin_users u ON u.id=h.actor_id ' +
        'WHERE h.order_id=$1 ORDER BY h.id', [id.data])
    ]);
    return reply.header('Cache-Control', 'no-store').send({
      item: { ...order, items: items.rows, history: history.rows, nextStatuses: nextStatuses(order.payment, order.status) }
    });
  });

  app.patch('/v1/admin/orders/:id/status', async (req, reply) => {
    const actor = await check(req, reply, 'orders:fulfill');
    if (!actor) return;
    const id = z.string().uuid().safeParse((req.params as { id: string }).id);
    const input = z.object({
      status: z.enum(['preparing', 'shipped', 'delivered', 'cancelled']),
      note: z.string().trim().max(300).optional()
    }).strict().safeParse(req.body);
    if (!id.success || !input.success) return reply.code(400).send({ error: 'invalid_payload' });
    const { status, note } = input.data;
    const client = await pool.connect();
    let restocked = 0;
    try {
      await client.query('BEGIN');
      // The row lock serialises concurrent clicks: the second request sees the new status and gets 409.
      const found = await client.query<{ status: string; payment: string }>(
        'SELECT status,payment FROM orders WHERE id=$1 FOR UPDATE', [id.data]);
      const order = found.rows[0];
      if (!order) { await client.query('ROLLBACK'); return reply.code(404).send({ error: 'not_found' }); }
      if (!nextStatuses(order.payment, order.status).includes(status)) {
        await client.query('ROLLBACK');
        return reply.code(409).send({ error: 'invalid_order_transition', status: order.status });
      }
      // Only COD orders decremented stock at checkout, so only they give units back when cancelled.
      // Variants are updated in the checkout's lock order to avoid deadlocks with concurrent orders.
      if (status === 'cancelled' && order.payment === 'cod') {
        const items = await client.query<{ product_id: string; color_id: string; size: string; quantity: number }>(
          'SELECT product_id,color_id,size,quantity FROM order_items WHERE order_id=$1 ORDER BY product_id,color_id,size',
          [id.data]);
        for (const item of items.rows) {
          const back = await client.query(
            'UPDATE product_variants SET stock=stock+$4 WHERE product_id=$1 AND color_id=$2 AND size=$3 RETURNING id',
            [item.product_id, item.color_id, item.size, item.quantity]);
          if (back.rowCount) restocked += item.quantity;
        }
      }
      await client.query('UPDATE orders SET status=$1 WHERE id=$2', [status, id.data]);
      await client.query(
        'INSERT INTO order_status_history(order_id,from_status,to_status,actor_id,note) VALUES($1,$2,$3,$4,$5)',
        [id.data, order.status, status, actor.id, note || null]);
      await recordAudit(client, actor.id, 'orders.status', id.data, {
        from: order.status, to: status, ...(status === 'cancelled' ? { restocked } : {}) });
      await client.query('COMMIT');
      if (restocked) await opts.invalidateCatalog?.();
      return reply.header('Cache-Control', 'no-store').send({
        ok: true, status, restocked, nextStatuses: nextStatuses(order.payment, status) });
    } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  });
}
