import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { and, eq, inArray, sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from './db/connection';
import { orders, orderItems, products, variants } from './db/schema';
import { calculate, DomainError } from './pricing';
import { checkout } from './validation';

type Checkout = z.infer<typeof checkout>;
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
const hash = (str: string) => createHash('sha256').update(str).digest('hex');

function accessToken(orderId: string) {
  const secret = process.env.ORDER_TOKEN_SECRET;
  if (!secret || secret.length < 32) throw new Error('ORDER_TOKEN_SECRET must be at least 32 characters');
  return createHmac('sha256', secret).update(orderId).digest('hex');
}
function receipt(order: typeof orders.$inferSelect) {
  return {
    id: order.id, status: order.status, paymentStatus: 'unpaid', accessToken: accessToken(order.id),
    totals: { subtotal: order.subtotal, discount: order.discount, shipping: order.shippingCost, total: order.total },
    shipping: order.shipping, payment: order.payment, code: order.code ?? '', fields: order.address,
    createdAt: order.createdAt.toISOString()
  };
}
async function resolveCart(tx: Tx, items: Checkout['items'], lock: boolean) {
  const ids = [...new Set(items.map(item => item.productId))];
  const productRows = await tx.select().from(products).where(inArray(products.id, ids));
  if (productRows.length !== ids.length) throw new DomainError(422, 'یک یا چند کالا یافت نشد.');
  const variantsQuery = tx.select().from(variants).where(inArray(variants.productId, ids))
    .orderBy(variants.productId, variants.colorId, variants.size);
  const variantRows = lock ? await variantsQuery.for('update') : await variantsQuery;
  const lines = items.map(item => {
    const p = productRows.find(row => row.id === item.productId)!;
    const variant = variantRows.find(v => v.productId === item.productId && v.colorId === item.colorId && v.size === item.size);
    if (!variant || variant.stock < item.quantity) throw new DomainError(409, 'موجودی یکی از اقلام کافی نیست.');
    return { item, product: p, variant };
  });
  return lines;
}
export async function createOrder(data: Checkout, key: string) {
  const requestHash = hash(JSON.stringify(data));
  return db.transaction(async tx => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${key}))`);
    const existing = await tx.select().from(orders).where(eq(orders.idempotencyKey, key)).limit(1);
    if (existing.length) {
      if (existing[0].requestHash !== requestHash) throw new DomainError(409, 'کلید تکراری برای سفارش متفاوت استفاده شده است.');
      return receipt(existing[0]);
    }
    const lock = data.payment === 'cod';
    const lines = await resolveCart(tx, data.items, lock);
    const totals = calculate(lines.map(x => ({ price: x.product.price, quantity: x.item.quantity })),
      data.shipping, data.payment, data.code, data.fields.province, data.fields.city);
    const [order] = await tx.insert(orders).values({
      idempotencyKey: key, requestHash, address: data.fields, shipping: data.shipping, payment: data.payment,
      status: lock ? 'confirmed_cod' : 'pending_payment', code: data.code,
      subtotal: totals.subtotal, discount: totals.discount, shippingCost: totals.shipping, total: totals.total
    }).returning();
    await tx.insert(orderItems).values(lines.map(x => ({
      orderId: order.id, productId: x.product.id, name: x.product.name,
      colorId: x.item.colorId, size: x.item.size, quantity: x.item.quantity, unitPrice: x.product.price
    })));
    if (lock) {
      for (const x of lines) {
        const updated = await tx.update(variants).set({ stock: sql`${variants.stock} - ${x.item.quantity}` })
          .where(and(eq(variants.id, x.variant.id), sql`${variants.stock} >= ${x.item.quantity}`)).returning({ id: variants.id });
        if (!updated.length) throw new DomainError(409, 'موجودی کافی نیست.');
      }
    }
    // Online checkout only creates a pending, UNPAID order. Stock is not reserved.
    // No payment success endpoint exists until PSP signature/webhook verification is implemented.
    return receipt(order);
  });
}

export async function orderRoutes(app: FastifyInstance, opts: { invalidateCatalog?: () => Promise<void> }) {
  app.post('/v1/checkout/quote', async (req, reply) => {
    const parsed = checkout.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_payload', details: parsed.error.flatten() });
    const result = await db.transaction(async tx => {
      const lines = await resolveCart(tx, parsed.data.items, false);
      return calculate(lines.map(x => ({ price: x.product.price, quantity: x.item.quantity })),
        parsed.data.shipping, parsed.data.payment, parsed.data.code, parsed.data.fields.province, parsed.data.fields.city);
    });
    return { ...result, currency: 'IRT', isEstimate: true };
  });
  app.post('/v1/orders', { config: { rateLimit: { max: 12, timeWindow: '1 minute' } } }, async (req, reply) => {
    const parsed = checkout.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_payload', details: parsed.error.flatten() });
    const key = req.headers['idempotency-key'];
    if (typeof key !== 'string' || !/^[a-zA-Z0-9_-]{16,100}$/.test(key))
      return reply.code(400).send({ error: 'idempotency_key_required' });
    const order = await createOrder(parsed.data, key);
    if (parsed.data.payment === 'cod') await opts.invalidateCatalog?.();
    return reply.code(201).header('Cache-Control','no-store').send(order);
  });
  app.get('/v1/orders/:id', async (req, reply) => {
    const parsed = z.string().uuid().safeParse((req.params as { id: string }).id);
    if (!parsed.success) return reply.code(404).send({ error: 'not_found' });
    const found = await db.select().from(orders).where(eq(orders.id, parsed.data)).limit(1);
    const bearer = req.headers.authorization?.replace(/^Bearer /i, '') ?? '';
    if (!found.length || !/^[a-f0-9]{64}$/.test(bearer)) return reply.code(404).send({ error: 'not_found' });
    const expected = Buffer.from(accessToken(found[0].id), 'hex');
    if (!timingSafeEqual(expected, Buffer.from(bearer, 'hex'))) return reply.code(404).send({ error: 'not_found' });
    const items = await db.select().from(orderItems).where(eq(orderItems.orderId, found[0].id));
    return reply.header('Cache-Control','no-store').send({ ...receipt(found[0]), items: items.map(x => ({
      productId: x.productId, name: x.name, colorId: x.colorId, size: x.size, quantity: x.quantity, unitPrice: x.unitPrice
    })) });
  });
}
