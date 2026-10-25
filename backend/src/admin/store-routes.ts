import type { FastifyInstance } from 'fastify';
import type { PoolClient } from 'pg';
import { z } from 'zod';
import { pool } from '../db/connection';
import { recordAudit } from './audit';
import { isStoreBarcode, storeBarcode } from './barcode';
import { tehranDate } from './calendar';
import { can, type Guard } from './identity';
import { productIdentity } from './product-schema';

type Db = Pick<PoolClient, 'query'>;
type Key = { productId: string; colorId: string; size: string };
type ProductRow = { id: string; name: string; price: number; colors: { id: string; name: string }[] };
type VariantRow = { id: string; product_id: string; color_id: string; size: string; stock: number };

export const STORE_PAYMENTS = ['cash', 'card', 'transfer'] as const;
// Sale amounts are stored as integer toman, like orders.
const MAX_AMOUNT = 2_000_000_000;
const ident = z.string().regex(/^[a-z0-9][a-z0-9-]{1,78}$/);
const barcode = z.string().refine(isStoreBarcode);
const keyOf = (k: Key) => k.productId + '\x1f' + k.colorId + '\x1f' + k.size;
const colorName = (product: ProductRow, colorId: string) => product.colors.find(color => color.id === colorId)?.name ?? colorId;
// Color label from the product's current colors, falling back to its id (as the variants endpoint does).
const COLOR_NAME = (product: string, color: string) =>
  "COALESCE((SELECT c->>'name' FROM jsonb_array_elements(" + product + '.colors) c WHERE c->>\'id\'=' + color +
  ' LIMIT 1),' + color + ')';
// Start of a Tehran calendar day ($n is a YYYY-MM-DD date) as an absolute instant.
const DAY_START = (param: string) => '(' + param + "::date::timestamp AT TIME ZONE 'Asia/Tehran')";
const DAY_END = (param: string) => '((' + param + "::date + 1)::timestamp AT TIME ZONE 'Asia/Tehran')";

const receiptInput = z.object({
  clientRef: z.string().uuid(),
  note: z.string().trim().max(300).optional(),
  lines: z.array(z.object({
    productId: productIdentity, colorId: ident, size: z.string().trim().min(1).max(20),
    quantity: z.number().int().min(1).max(10_000)
  }).strict()).min(1).max(200).refine(lines => new Set(lines.map(keyOf)).size === lines.length, 'Repeated color/size')
}).strict();
const saleInput = z.object({
  clientRef: z.string().uuid(),
  payment: z.enum(STORE_PAYMENTS),
  discount: z.number().int().min(0).max(MAX_AMOUNT).default(0),
  note: z.string().trim().max(300).optional(),
  lines: z.array(z.object({ code: barcode, quantity: z.number().int().min(1).max(999) }).strict()).min(1).max(100)
}).strict();
const serial = z.coerce.number().int().positive().max(Number.MAX_SAFE_INTEGER);

/** The barcode of each product/color/size, created on first use. Two concurrent callers may both draw a sequence
 * number; the unique key keeps the first row and the other number is never used. */
async function ensureBarcodes(db: Db, keys: Key[]) {
  const columns = [keys.map(k => k.productId), keys.map(k => k.colorId), keys.map(k => k.size)];
  const read = () => db.query<Key & { code: string }>(
    'SELECT b.code,b.product_id AS "productId",b.color_id AS "colorId",b.size FROM variant_barcodes b ' +
    'JOIN unnest($1::varchar[],$2::varchar[],$3::varchar[]) AS k(product_id,color_id,size) USING (product_id,color_id,size)',
    columns);
  let found = await read();
  const known = new Set(found.rows.map(keyOf));
  const missing = keys.filter(k => !known.has(keyOf(k)));
  if (missing.length) {
    const numbers = await db.query<{ n: string }>(
      "SELECT nextval('variant_barcode_seq')::text AS n FROM generate_series(1,$1)", [missing.length]);
    await db.query('INSERT INTO variant_barcodes(code,product_id,color_id,size) ' +
      'SELECT * FROM unnest($1::char(13)[],$2::varchar[],$3::varchar[],$4::varchar[]) ' +
      'ON CONFLICT (product_id,color_id,size) DO NOTHING',
      [numbers.rows.map(row => storeBarcode(Number(row.n))), missing.map(k => k.productId), missing.map(k => k.colorId),
        missing.map(k => k.size)]);
    found = await read();
  }
  return new Map(found.rows.map(row => [keyOf(row), row.code]));
}

/** Locks the products (shared) and then the requested variants (for update) in the order checkout uses, so receipts
 * and sales neither deadlock with online orders nor interleave with a full product edit. */
async function lockVariants(client: PoolClient, keys: Key[]) {
  const products = await client.query<ProductRow>(
    'SELECT id,name,price,colors FROM products WHERE id = ANY($1::varchar[]) ORDER BY id FOR SHARE',
    [[...new Set(keys.map(k => k.productId))]]);
  const variants = await client.query<VariantRow>(
    'SELECT v.id,v.product_id,v.color_id,v.size,v.stock FROM product_variants v ' +
    'JOIN unnest($1::varchar[],$2::varchar[],$3::varchar[]) AS k(product_id,color_id,size) USING (product_id,color_id,size) ' +
    'ORDER BY v.product_id,v.color_id,v.size FOR UPDATE OF v',
    [keys.map(k => k.productId), keys.map(k => k.colorId), keys.map(k => k.size)]);
  const product = new Map(products.rows.map(row => [row.id, row]));
  const variant = new Map(variants.rows.map(row => [keyOf({ productId: row.product_id, colorId: row.color_id, size: row.size }), row]));
  return keys.map(key => ({ key, product: product.get(key.productId), variant: variant.get(keyOf(key)) }));
}

async function receiptDetail(db: Db, id: string) {
  const found = await db.query(
    'SELECT r.id,r.note,r.created_at AS "createdAt",u.display_name AS actor FROM stock_receipts r ' +
    'LEFT JOIN admin_users u ON u.id=r.actor_id WHERE r.id=$1', [id]);
  if (!found.rows[0]) return null;
  // Labels show the price at printing time, so a receipt reprinted after a price change carries the new price.
  const items = await db.query(
    'SELECT i.product_id AS "productId",i.name,i.color_id AS "colorId",i.color_name AS "colorName",i.size,i.barcode AS code,' +
    'i.quantity,p.price FROM stock_receipt_items i LEFT JOIN products p ON p.id=i.product_id WHERE i.receipt_id=$1 ORDER BY i.id',
    [id]);
  return { ...found.rows[0], items: items.rows };
}

async function salesWithItems(db: Db, ids: string[]) {
  if (!ids.length) return [];
  const [sales, items] = await Promise.all([
    db.query(
      'SELECT s.id,s.payment,s.subtotal,s.discount,s.total,s.note,s.created_at AS "createdAt",s.voided_at AS "voidedAt",' +
      'u.display_name AS cashier,vu.display_name AS "voidedBy" FROM store_sales s ' +
      'LEFT JOIN admin_users u ON u.id=s.actor_id LEFT JOIN admin_users vu ON vu.id=s.voided_by ' +
      'WHERE s.id = ANY($1::bigint[]) ORDER BY s.id DESC', [ids]),
    db.query<{ saleId: string }>(
      'SELECT sale_id AS "saleId",product_id AS "productId",name,color_id AS "colorId",color_name AS "colorName",size,' +
      'barcode AS code,quantity,unit_price AS "unitPrice" FROM store_sale_items WHERE sale_id = ANY($1::bigint[]) ORDER BY id',
      [ids])
  ]);
  return sales.rows.map(sale => ({ ...sale, items: items.rows.filter(item => item.saleId === sale.id) }));
}

/** One stock for the shop floor and the website: goods received with printed barcodes, and counter sales that scan
 * them. Both change the same `product_variants.stock` that online orders take from. */
export async function storeRoutes(app: FastifyInstance, check: Guard, opts: { invalidateCatalog?: () => Promise<void> }) {
  // A product's barcodes for printing labels, created for colors/sizes that have none yet.
  app.post('/v1/admin/products/:id/barcodes', async (req, reply) => {
    if (!await check(req, reply, 'inventory:read')) return;
    const id = productIdentity.safeParse((req.params as { id: string }).id);
    if (!id.success) return reply.code(404).send({ error: 'not_found' });
    const found = await pool.query<{ id: string; name: string; price: number }>(
      'SELECT id,name,price FROM products WHERE id=$1', [id.data]);
    if (!found.rows[0]) return reply.code(404).send({ error: 'not_found' });
    // In the product's own color and size order (S, M, L…), not alphabetical.
    const variants = await pool.query<{ colorId: string; colorName: string; size: string; stock: number }>(
      'SELECT v.color_id AS "colorId",' + COLOR_NAME('p', 'v.color_id') + ' AS "colorName",v.size,v.stock ' +
      'FROM product_variants v JOIN products p ON p.id=v.product_id WHERE v.product_id=$1 ORDER BY ' +
      "(SELECT o FROM jsonb_array_elements(p.colors) WITH ORDINALITY c(c,o) WHERE c->>'id'=v.color_id LIMIT 1)," +
      '(SELECT o FROM jsonb_array_elements_text(p.sizes) WITH ORDINALITY s(s,o) WHERE s=v.size LIMIT 1),v.color_id,v.size',
      [id.data]);
    const codes = await ensureBarcodes(pool, variants.rows.map(v => ({ productId: id.data, colorId: v.colorId, size: v.size })));
    return reply.header('Cache-Control', 'no-store').send({
      product: found.rows[0],
      items: variants.rows.map(v => ({ ...v, code: codes.get(keyOf({ productId: id.data, ...v })) }))
    });
  });

  // What a scanned label is. Products not (or no longer) on the website can still be received and sold in the shop.
  app.get('/v1/admin/barcodes/:code', { config: { rateLimit: { max: 300, timeWindow: '1 minute' } } }, async (req, reply) => {
    if (!await check(req, reply, 'inventory:read')) return;
    const code = (req.params as { code: string }).code;
    if (!isStoreBarcode(code)) return reply.code(400).send({ error: 'invalid_barcode' });
    const found = await pool.query<{ stock: number | null }>(
      'SELECT b.code,b.product_id AS "productId",p.name,p.price,p.active,b.color_id AS "colorId",' +
      COLOR_NAME('p', 'b.color_id') + ' AS "colorName",b.size,v.stock FROM variant_barcodes b ' +
      'JOIN products p ON p.id=b.product_id ' +
      'LEFT JOIN product_variants v ON v.product_id=b.product_id AND v.color_id=b.color_id AND v.size=b.size ' +
      'WHERE b.code=$1', [code]);
    const item = found.rows[0];
    if (!item) return reply.code(404).send({ error: 'barcode_not_found', code });
    if (item.stock === null) return reply.code(409).send({ error: 'variant_removed', code });
    return reply.header('Cache-Control', 'no-store').send({ item });
  });

  app.get('/v1/admin/stock-receipts', async (req, reply) => {
    if (!await check(req, reply, 'inventory:read')) return;
    const query = z.object({ page: z.coerce.number().int().min(1).max(10_000).default(1) }).safeParse(req.query);
    if (!query.success) return reply.code(400).send({ error: 'invalid_query' });
    const limit = 20;
    const counted = await pool.query<{ total: number }>('SELECT COUNT(*)::int AS total FROM stock_receipts');
    const total = counted.rows[0]?.total ?? 0;
    const pages = Math.max(1, Math.ceil(total / limit));
    const page = Math.min(query.data.page, pages);
    const result = await pool.query(
      'SELECT r.id,r.note,r.created_at AS "createdAt",u.display_name AS actor,' +
      '(SELECT COUNT(*)::int FROM stock_receipt_items i WHERE i.receipt_id=r.id) AS lines,' +
      '(SELECT COALESCE(SUM(i.quantity),0)::int FROM stock_receipt_items i WHERE i.receipt_id=r.id) AS units ' +
      'FROM stock_receipts r LEFT JOIN admin_users u ON u.id=r.actor_id ORDER BY r.id DESC LIMIT $1 OFFSET $2',
      [limit, (page - 1) * limit]);
    return reply.header('Cache-Control', 'no-store').send({ items: result.rows, total, page, pages, limit });
  });

  app.get('/v1/admin/stock-receipts/:id', async (req, reply) => {
    if (!await check(req, reply, 'inventory:read')) return;
    const id = serial.safeParse((req.params as { id: string }).id);
    if (!id.success) return reply.code(404).send({ error: 'not_found' });
    const receipt = await receiptDetail(pool, String(id.data));
    if (!receipt) return reply.code(404).send({ error: 'not_found' });
    return reply.header('Cache-Control', 'no-store').send({ receipt });
  });

  // Goods arriving: adds the units to the shared stock and gives every color/size its barcode for labelling.
  app.post('/v1/admin/stock-receipts', async (req, reply) => {
    const actor = await check(req, reply, 'inventory:write');
    if (!actor) return;
    const parsed = receiptInput.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_payload' });
    const input = parsed.data;
    const client = await pool.connect();
    let receipt;
    try {
      await client.query('BEGIN');
      // A retried or double-clicked submission waits for the first one and then returns its receipt.
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [input.clientRef]);
      const done = await client.query<{ id: string }>('SELECT id FROM stock_receipts WHERE client_ref=$1', [input.clientRef]);
      if (done.rows[0]) {
        receipt = await receiptDetail(client, done.rows[0].id);
        await client.query('COMMIT');
        return reply.header('Cache-Control', 'no-store').send({ receipt, duplicate: true });
      }
      const lines = await lockVariants(client, input.lines);
      const missing = lines.find(line => !line.product || !line.variant);
      if (missing) {
        await client.query('ROLLBACK');
        return reply.code(409).send({ error: 'variant_not_found', ...missing.key });
      }
      const codes = await ensureBarcodes(client, input.lines);
      const created = await client.query<{ id: string }>(
        'INSERT INTO stock_receipts(client_ref,note,actor_id) VALUES($1,$2,$3) RETURNING id',
        [input.clientRef, input.note || null, actor.id]);
      const id = created.rows[0].id;
      for (const [index, line] of lines.entries()) {
        const quantity = input.lines[index].quantity;
        await client.query('UPDATE product_variants SET stock=stock+$2 WHERE id=$1', [line.variant!.id, quantity]);
        await client.query(
          'INSERT INTO stock_receipt_items(receipt_id,product_id,name,color_id,color_name,size,barcode,quantity) ' +
          'VALUES($1,$2,$3,$4,$5,$6,$7,$8)',
          [id, line.key.productId, line.product!.name, line.key.colorId, colorName(line.product!, line.key.colorId),
            line.key.size, codes.get(keyOf(line.key)), quantity]);
      }
      await recordAudit(client, actor.id, 'inventory.received', id, {
        units: input.lines.reduce((sum, line) => sum + line.quantity, 0),
        lines: input.lines.slice(0, 60).map(line => ({ productId: line.productId, colorId: line.colorId, size: line.size,
          quantity: line.quantity }))
      });
      receipt = await receiptDetail(client, id);
      await client.query('COMMIT');
    } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
    await opts.invalidateCatalog?.();
    return reply.code(201).header('Cache-Control', 'no-store').send({ receipt });
  });

  // A sale at the shop counter. The price is the catalog price now; stock is checked and taken in one transaction, so
  // the last unit cannot be sold both here and on the website.
  app.post('/v1/admin/store-sales', async (req, reply) => {
    const actor = await check(req, reply, 'sales:pos');
    if (!actor) return;
    const parsed = saleInput.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_payload' });
    const input = parsed.data;
    // A discount changes the price a customer pays, so it needs the price permission.
    if (input.discount > 0 && !can(actor, 'products:price'))
      return reply.code(403).send({ error: 'forbidden', permission: 'products:price' });
    const quantities = new Map<string, number>();
    for (const line of input.lines) quantities.set(line.code, (quantities.get(line.code) ?? 0) + line.quantity);
    const client = await pool.connect();
    let sale;
    try {
      await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [input.clientRef]);
      const done = await client.query<{ id: string }>('SELECT id FROM store_sales WHERE client_ref=$1', [input.clientRef]);
      if (done.rows[0]) {
        [sale] = await salesWithItems(client, [done.rows[0].id]);
        await client.query('COMMIT');
        return reply.header('Cache-Control', 'no-store').send({ sale, duplicate: true });
      }
      const coded = await client.query<Key & { code: string }>(
        'SELECT code,product_id AS "productId",color_id AS "colorId",size FROM variant_barcodes WHERE code = ANY($1::char(13)[])',
        [[...quantities.keys()]]);
      const unknown = [...quantities.keys()].find(code => !coded.rows.some(row => row.code === code));
      if (unknown) {
        await client.query('ROLLBACK');
        return reply.code(404).send({ error: 'barcode_not_found', code: unknown });
      }
      const lines = (await lockVariants(client, coded.rows)).map((line, index) => ({
        ...line, code: coded.rows[index].code, quantity: quantities.get(coded.rows[index].code)! }));
      const refused = (error: string, extra: object) => client.query('ROLLBACK').then(() => reply.code(409).send({ error, ...extra }));
      const removed = lines.find(line => !line.product || !line.variant);
      if (removed) return await refused('variant_removed', { code: removed.code });
      const free = lines.find(line => line.product!.price <= 0);
      if (free) return await refused('price_missing', { code: free.code });
      // Usually the last units went to an online order that is still waiting to be packed.
      const short = lines.filter(line => line.variant!.stock < line.quantity);
      if (short.length) return await refused('insufficient_stock', { items: short.map(line => ({
        code: line.code, name: line.product!.name, colorName: colorName(line.product!, line.key.colorId), size: line.key.size,
        requested: line.quantity, available: line.variant!.stock })) });
      const subtotal = lines.reduce((sum, line) => sum + line.product!.price * line.quantity, 0);
      if (subtotal > MAX_AMOUNT || input.discount > subtotal) {
        await client.query('ROLLBACK');
        return reply.code(422).send({ error: subtotal > MAX_AMOUNT ? 'sale_too_large' : 'discount_too_large' });
      }
      const created = await client.query<{ id: string }>(
        'INSERT INTO store_sales(client_ref,payment,subtotal,discount,total,note,actor_id) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id',
        [input.clientRef, input.payment, subtotal, input.discount, subtotal - input.discount, input.note || null, actor.id]);
      const id = created.rows[0].id;
      for (const line of lines) {
        await client.query('UPDATE product_variants SET stock=stock-$2 WHERE id=$1', [line.variant!.id, line.quantity]);
        await client.query(
          'INSERT INTO store_sale_items(sale_id,product_id,name,color_id,color_name,size,barcode,quantity,unit_price) ' +
          'VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',
          [id, line.key.productId, line.product!.name, line.key.colorId, colorName(line.product!, line.key.colorId),
            line.key.size, line.code, line.quantity, line.product!.price]);
      }
      await recordAudit(client, actor.id, 'sales.recorded', id, {
        total: subtotal - input.discount, discount: input.discount, payment: input.payment,
        units: lines.reduce((sum, line) => sum + line.quantity, 0) });
      [sale] = await salesWithItems(client, [id]);
      await client.query('COMMIT');
    } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
    await opts.invalidateCatalog?.();
    return reply.code(201).header('Cache-Control', 'no-store').send({ sale });
  });

  // One Tehran day of counter sales (today by default), newest first, with totals that leave voided sales out.
  app.get('/v1/admin/store-sales', async (req, reply) => {
    if (!await check(req, reply, 'sales:pos')) return;
    // A real calendar date: JavaScript would roll 2026-02-30 over to March, PostgreSQL would refuse it.
    const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
      .refine(value => !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().startsWith(value));
    const query = z.object({ date: day.optional() }).safeParse(req.query);
    if (!query.success) return reply.code(400).send({ error: 'invalid_query' });
    const date = query.data.date ?? tehranDate(new Date());
    const range = (alias: string) =>
      alias + '.created_at >= ' + DAY_START('$1') + ' AND ' + alias + '.created_at < ' + DAY_END('$1');
    const [ids, summary] = await Promise.all([
      pool.query<{ id: string }>('SELECT s.id FROM store_sales s WHERE ' + range('s') + ' ORDER BY s.id DESC LIMIT 500', [date]),
      pool.query(
        'SELECT COUNT(*)::int AS sales,COALESCE(SUM(s.total),0)::text AS total,' +
        STORE_PAYMENTS.map(method => "COALESCE(SUM(s.total) FILTER (WHERE s.payment='" + method + "'),0)::text AS " + method)
          .join(',') +
        ',(SELECT COALESCE(SUM(i.quantity),0)::int FROM store_sale_items i JOIN store_sales x ON x.id=i.sale_id ' +
        'WHERE x.voided_at IS NULL AND ' + range('x') + ') AS units ' +
        'FROM store_sales s WHERE s.voided_at IS NULL AND ' + range('s'), [date])
    ]);
    return reply.header('Cache-Control', 'no-store').send({
      date, summary: summary.rows[0], items: await salesWithItems(pool, ids.rows.map(row => row.id)) });
  });

  // Undoes a counter sale (a mistake or a returned purchase): its units go back to stock, once.
  app.post('/v1/admin/store-sales/:id/void', async (req, reply) => {
    const actor = await check(req, reply, 'inventory:write');
    if (!actor) return;
    const id = serial.safeParse((req.params as { id: string }).id);
    const input = z.object({ reason: z.string().trim().max(300).optional() }).strict().safeParse(req.body ?? {});
    if (!id.success || !input.success) return reply.code(400).send({ error: 'invalid_payload' });
    const client = await pool.connect();
    let restocked = 0;
    try {
      await client.query('BEGIN');
      const found = await client.query<{ total: number; voided_at: Date | null }>(
        'SELECT total,voided_at FROM store_sales WHERE id=$1 FOR UPDATE', [id.data]);
      const sale = found.rows[0];
      if (!sale || sale.voided_at) {
        await client.query('ROLLBACK');
        return reply.code(sale ? 409 : 404).send({ error: sale ? 'sale_already_voided' : 'not_found' });
      }
      // In checkout's variant order, like an order cancellation.
      const items = await client.query<{ product_id: string; color_id: string; size: string; quantity: number }>(
        'SELECT product_id,color_id,size,quantity FROM store_sale_items WHERE sale_id=$1 ORDER BY product_id,color_id,size',
        [id.data]);
      for (const item of items.rows) {
        const back = await client.query(
          'UPDATE product_variants SET stock=stock+$4 WHERE product_id=$1 AND color_id=$2 AND size=$3 RETURNING id',
          [item.product_id, item.color_id, item.size, item.quantity]);
        if (!back.rowCount) {
          await client.query('ROLLBACK');
          return reply.code(409).send({ error: 'restock_variant_missing' });
        }
        restocked += item.quantity;
      }
      await client.query('UPDATE store_sales SET voided_at=now(),voided_by=$2 WHERE id=$1', [id.data, actor.id]);
      await recordAudit(client, actor.id, 'sales.voided', String(id.data), {
        total: sale.total, restocked, ...(input.data.reason ? { reason: input.data.reason } : {}) });
      await client.query('COMMIT');
    } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
    await opts.invalidateCatalog?.();
    return reply.header('Cache-Control', 'no-store').send({ ok: true, restocked });
  });
}
