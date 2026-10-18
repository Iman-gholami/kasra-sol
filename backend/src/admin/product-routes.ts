import type { FastifyInstance } from 'fastify';
import { createHash } from 'node:crypto';
import { normalizeSearch } from '../search';
import { pool } from '../db/connection';
import { productIdentity, productInput, type ProductInput } from './product-schema';
import { recordAudit } from './audit';
import { can, type Guard } from './identity';
import { z } from 'zod';

type Client = { query: (text: string, values?: unknown[]) => Promise<unknown> };
type VariantRow = { colorId: string; size: string; stock: number };
function snapshotHash(product: Record<string, unknown>, variants: unknown[]): string {
  // A content-based ETag includes stock, so concurrent order stock changes invalidate stale edits.
  return createHash('sha256').update(JSON.stringify({ product, variants })).digest('hex');
}
const variantKey = (v: { colorId: string; size: string }) => v.colorId + '\x1f' + v.size;
/** JSON with sorted object keys: jsonb returns keys in its own order, so plain stringify would differ. */
const stable = (value: unknown): string => JSON.stringify(value, (_key, inner) =>
  inner && typeof inner === 'object' && !Array.isArray(inner)
    ? Object.fromEntries(Object.entries(inner).sort(([a], [b]) => a.localeCompare(b))) : inner);
const statusOf = (row: { active: boolean; archived_at: Date | null }) =>
  row.active ? 'active' : row.archived_at ? 'archived' : 'draft';
const CONTENT_FIELDS = [
  ['slug', 'slug'], ['name', 'name'], ['category', 'category'], ['description', 'description'],
  ['images', 'images'], ['colors', 'colors'], ['sizes', 'sizes'], ['material', 'material'],
  ['fit', 'fit'], ['care', 'care'], ['featured', 'featured']
] as const;

async function writeVariants(client: Client, id: string, rows: ProductInput['variants']) {
  // Variant rows are locked before modifications to coordinate with concurrent COD orders.
  await client.query('SELECT id FROM product_variants WHERE product_id=$1 ORDER BY product_id,color_id,size FOR UPDATE', [id]);
  // Existing SKU identity is preserved when possible; removed SKUs disappear only in this transaction.
  // This keeps order_items historical snapshots intact (they do not FK to variant IDs).
  for (const row of rows) await client.query(
    'INSERT INTO product_variants(product_id,color_id,size,stock) VALUES($1,$2,$3,$4) ' +
    'ON CONFLICT(product_id,color_id,size) DO UPDATE SET stock=EXCLUDED.stock',
    [id, row.colorId, row.size, row.stock]);
  const validPairs = rows.map(variantKey);
  const found = await client.query('SELECT id,color_id,size FROM product_variants WHERE product_id=$1', [id]);
  for (const row of (found as {rows:{id:string;color_id:string;size:string}[]}).rows) {
    if (!validPairs.includes(variantKey({ colorId: row.color_id, size: row.size }))) {
      await client.query('DELETE FROM product_variants WHERE id=$1', [row.id]);
    }
  }
}
/** Stock differences between the stored variants and an edit; a removed or added SKU counts as a change. */
function stockChanges(before: VariantRow[], after: VariantRow[]) {
  const old = new Map(before.map(v => [variantKey(v), v.stock]));
  const next = new Map(after.map(v => [variantKey(v), v.stock]));
  return [...new Set([...old.keys(), ...next.keys()])].flatMap(key => {
    const from = old.get(key) ?? null, to = next.get(key) ?? null;
    const [colorId, size] = key.split('\x1f');
    return from === to ? [] : [{ colorId, size, from, to }];
  });
}

const listQuery = z.object({
  q: z.string().trim().max(100).optional(),
  status: z.enum(['all', 'active', 'draft', 'archived']).default('all'),
  stock: z.enum(['all', 'low', 'out']).default('all'),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25)
});

export async function productAdminRoutes(app: FastifyInstance, check: Guard,
  opts: { invalidateCatalog?: () => Promise<void> }) {

  // Server-side search, filters and pagination: the panel must work for any catalog size, not the first 100 rows.
  app.get('/v1/admin/products', async (req, reply) => {
    if (!await check(req, reply, 'products:read')) return;
    const query = listQuery.safeParse(req.query);
    if (!query.success) return reply.code(400).send({ error: 'invalid_query' });
    const { q, status, stock, page, limit } = query.data;
    const where: string[] = [];
    const values: unknown[] = [];
    if (q) {
      values.push('%' + normalizeSearch(q).replace(/[%_\\]/g, '\\$&') + '%');
      where.push('(p.search_text ILIKE $' + values.length + ' OR p.id ILIKE $' + values.length +
        ' OR p.slug ILIKE $' + values.length + ')');
    }
    if (status === 'active') where.push('p.active');
    if (status === 'draft') where.push('NOT p.active AND p.archived_at IS NULL');
    if (status === 'archived') where.push('p.archived_at IS NOT NULL');
    const having = stock === 'out' ? 'HAVING COALESCE(SUM(v.stock),0) = 0' :
      stock === 'low' ? 'HAVING COUNT(v.id) FILTER (WHERE v.stock BETWEEN 1 AND 3) > 0' : '';
    const base = 'FROM products p LEFT JOIN product_variants v ON v.product_id=p.id ' +
      (where.length ? 'WHERE ' + where.join(' AND ') + ' ' : '') + 'GROUP BY p.id ' + having;
    const counted = await pool.query<{ total: number }>('SELECT COUNT(*)::int AS total FROM (SELECT p.id ' + base + ') x', values);
    const total = counted.rows[0]?.total ?? 0;
    const pages = Math.max(1, Math.ceil(total / limit));
    const current = Math.min(page, pages);
    const found = await pool.query(
      'SELECT p.id,p.slug,p.name,p.price,p.compare_at AS "compareAt",p.category,p.images,p.active,' +
      'p.archived_at AS "archivedAt",COALESCE(SUM(v.stock),0)::integer AS stock,COUNT(v.id)::int AS "variantCount",' +
      'COUNT(v.id) FILTER (WHERE v.stock BETWEEN 1 AND 3)::int AS "lowVariants",' +
      'COUNT(v.id) FILTER (WHERE v.stock = 0)::int AS "emptyVariants" ' + base +
      ' ORDER BY p.created_at DESC,p.id LIMIT $' + (values.length + 1) + ' OFFSET $' + (values.length + 2),
      [...values, limit, (current - 1) * limit]);
    return reply.header('Cache-Control', 'no-store').send({
      items: found.rows.map(row => ({ ...row, status: row.active ? 'active' : row.archivedAt ? 'archived' : 'draft' })),
      total, page: current, pages, limit
    });
  });

  app.get('/v1/admin/products/:id', async (req, reply) => {
    if (!await check(req, reply, 'products:read')) return;
    const id = productIdentity.safeParse((req.params as { id: string }).id);
    if (!id.success) return reply.code(404).send({ error: 'not_found' });
    const found = await pool.query('SELECT * FROM products WHERE id=$1 LIMIT 1', [id.data]);
    if (!found.rowCount) return reply.code(404).send({ error: 'not_found' });
    const product = found.rows[0];
    const variantRows = await pool.query(
      'SELECT color_id AS "colorId",size,stock FROM product_variants WHERE product_id=$1 ORDER BY color_id,size', [id.data]);
    return reply.header('Cache-Control', 'no-store').send({
      revision: snapshotHash(product, variantRows.rows),
      item: {
        id: product.id, slug: product.slug, name: product.name, category: product.category,
        description: product.description, price: product.price, compareAt: product.compare_at,
        images: product.images, colors: product.colors, sizes: product.sizes,
        variants: variantRows.rows, material: product.material, fit: product.fit,
        care: product.care, featured: product.featured, active: product.active, status: statusOf(product)
      }
    });
  });

  app.get('/v1/admin/products/:id/variants', async (req, reply) => {
    if (!await check(req, reply, 'inventory:read')) return;
    const id = productIdentity.safeParse((req.params as { id: string }).id);
    if (!id.success) return reply.code(400).send({ error: 'invalid_id' });
    const rows = await pool.query(
      'SELECT v.id,v.product_id,v.color_id,v.size,v.stock,' +
      "COALESCE((SELECT c->>'name' FROM products p, jsonb_array_elements(p.colors) c " +
      "WHERE p.id=v.product_id AND c->>'id'=v.color_id LIMIT 1), v.color_id) AS color_name " +
      'FROM product_variants v WHERE v.product_id=$1 ORDER BY v.color_id,v.size', [id.data]);
    return reply.header('Cache-Control', 'no-store').send({ items: rows.rows });
  });

  app.post('/v1/admin/products', async (req, reply) => {
    const actor = await check(req, reply, 'products:write');
    if (!actor) return;
    const parsed = productInput.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_product', details: parsed.error.flatten() });
    const item = parsed.data;
    // Creating a product sets its price, and any opening stock is an inventory change.
    if (!can(actor, 'products:price') || (item.variants.some(v => v.stock > 0) && !can(actor, 'inventory:write')))
      return reply.code(403).send({ error: 'forbidden' });
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        'INSERT INTO products(id,slug,name,category,description,price,compare_at,images,colors,sizes,' +
        'material,fit,care,featured,active,search_text) ' +
        'VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb,$10::jsonb,$11,$12,$13,$14,false,$15)',
        [item.id,item.slug,item.name,item.category,item.description,item.price,item.compareAt,
          JSON.stringify(item.images),JSON.stringify(item.colors),JSON.stringify(item.sizes),
          item.material,item.fit,item.care,item.featured,normalizeSearch(item.name+' '+item.description)]);
      await writeVariants(client, item.id, item.variants);
      await recordAudit(client, actor.id, 'products.created', item.id, {
        name: item.name, active: false, price: item.price, compareAt: item.compareAt,
        stock: item.variants.map(v => ({ colorId: v.colorId, size: v.size, to: v.stock }))
      });
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      if ((error as {code?: string}).code === '23505') return reply.code(409).send({ error: 'product_exists' });
      throw error;
    } finally { client.release(); }
    await opts.invalidateCatalog?.();
    return reply.code(201).header('Cache-Control', 'no-store').send({ ok: true, id: item.id, active: false });
  });

  // Content edits need products:write; changing price or stock additionally needs the matching permission,
  // so an employee without pricing access cannot change a price through the full editor either.
  app.put('/v1/admin/products/:id', async (req, reply) => {
    const actor = await check(req, reply, 'products:write');
    if (!actor) return;
    const id = productIdentity.safeParse((req.params as { id: string }).id);
    const parsed = productInput.safeParse(req.body);
    if (!id.success || !parsed.success || id.data !== parsed.data.id)
      return reply.code(400).send({ error: 'invalid_product', details: parsed.success ? undefined : parsed.error.flatten() });
    const item = parsed.data;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const found = await client.query('SELECT * FROM products WHERE id=$1 FOR UPDATE', [id.data]);
      if (!found.rowCount) {
        await client.query('ROLLBACK'); return reply.code(404).send({ error: 'not_found' });
      }
      const current = await client.query<VariantRow>(
        'SELECT color_id AS "colorId",size,stock FROM product_variants ' +
        'WHERE product_id=$1 ORDER BY color_id,size FOR UPDATE', [id.data]);
      const etag = req.headers['if-match'];
      if (typeof etag !== 'string' || !/^"[a-f0-9]{64}"$/.test(etag)) {
        await client.query('ROLLBACK'); return reply.code(428).send({ error: 'precondition_required' });
      }
      if (etag !== '"' + snapshotHash(found.rows[0], current.rows) + '"') {
        await client.query('ROLLBACK'); return reply.code(412).send({ error: 'product_changed_reload_required' });
      }
      const stored = found.rows[0];
      const priceChanged = stored.price !== item.price || (stored.compare_at ?? null) !== item.compareAt;
      const stock = stockChanges(current.rows, item.variants);
      const missing = priceChanged && !can(actor, 'products:price') ? 'products:price' :
        stock.length && !can(actor, 'inventory:write') ? 'inventory:write' : null;
      if (missing) {
        await client.query('ROLLBACK'); return reply.code(403).send({ error: 'forbidden', permission: missing });
      }
      await client.query(
        'UPDATE products SET slug=$2,name=$3,category=$4,description=$5,price=$6,compare_at=$7,' +
        'images=$8::jsonb,colors=$9::jsonb,sizes=$10::jsonb,material=$11,fit=$12,care=$13,featured=$14,' +
        'search_text=$15 WHERE id=$1',
        [id.data,item.slug,item.name,item.category,item.description,item.price,item.compareAt,
          JSON.stringify(item.images),JSON.stringify(item.colors),JSON.stringify(item.sizes),
          item.material,item.fit,item.care,item.featured,normalizeSearch(item.name+' '+item.description)]);
      await writeVariants(client, id.data, item.variants);
      await recordAudit(client, actor.id, 'products.updated', id.data, {
        name: item.name,
        fields: CONTENT_FIELDS.filter(([key, column]) => stable(stored[column]) !== stable(item[key]))
          .map(([key]) => key),
        ...(priceChanged ? { price: { from: stored.price, to: item.price },
          compareAt: { from: stored.compare_at, to: item.compareAt } } : {}),
        ...(stock.length ? { stock: stock.slice(0, 120) } : {})
      });
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      if ((error as {code?: string}).code === '23505') return reply.code(409).send({ error: 'product_exists' });
      throw error;
    } finally { client.release(); }
    await opts.invalidateCatalog?.();
    return reply.header('Cache-Control', 'no-store').send({ ok: true, id: id.data });
  });

  app.patch('/v1/admin/products/:id/price', async (req, reply) => {
    const actor = await check(req, reply, 'products:price');
    if (!actor) return;
    const id = productIdentity.safeParse((req.params as { id: string }).id);
    const input = z.object({ price: z.number().int().min(0).max(1_000_000_000) }).strict().safeParse(req.body);
    if (!id.success || !input.success) return reply.code(400).send({ error: 'invalid_payload' });
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const found = await client.query<{ price: number; compare_at: number | null }>(
        'SELECT price,compare_at FROM products WHERE id=$1 FOR UPDATE', [id.data]);
      const previous = found.rows[0];
      if (!previous) { await client.query('ROLLBACK'); return reply.code(404).send({ error: 'not_found' }); }
      // A sale price above the struck-through original would show customers a negative discount.
      if (previous.compare_at !== null && input.data.price > previous.compare_at) {
        await client.query('ROLLBACK'); return reply.code(409).send({ error: 'price_above_original' });
      }
      await client.query('UPDATE products SET price=$1 WHERE id=$2', [input.data.price, id.data]);
      await recordAudit(client, actor.id, 'products.price', id.data, { from: previous.price, to: input.data.price });
      await client.query('COMMIT');
    } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
    await opts.invalidateCatalog?.();
    return reply.header('Cache-Control', 'no-store').send({ ok: true, price: input.data.price });
  });

  // `expectedStock` is the value the employee saw. Orders placed meanwhile changed it, and blindly writing the
  // old absolute number would re-sell units that are already sold, so a mismatch is rejected instead.
  app.patch('/v1/admin/variants/:id/stock', async (req, reply) => {
    const actor = await check(req, reply, 'inventory:write');
    if (!actor) return;
    const id = z.string().uuid().safeParse((req.params as { id: string }).id);
    const amount = z.number().int().min(0).max(1_000_000);
    const input = z.object({ stock: amount, expectedStock: amount }).strict().safeParse(req.body);
    if (!id.success || !input.success) return reply.code(400).send({ error: 'invalid_payload' });
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const found = await client.query<{ stock: number; product_id: string; color_id: string; size: string }>(
        'SELECT stock,product_id,color_id,size FROM product_variants WHERE id=$1 FOR UPDATE', [id.data]);
      const row = found.rows[0];
      if (!row) { await client.query('ROLLBACK'); return reply.code(404).send({ error: 'not_found' }); }
      if (row.stock !== input.data.expectedStock) {
        await client.query('ROLLBACK');
        return reply.code(409).send({ error: 'stock_changed', stock: row.stock });
      }
      await client.query('UPDATE product_variants SET stock=$1 WHERE id=$2', [input.data.stock, id.data]);
      await recordAudit(client, actor.id, 'inventory.stock', id.data, {
        productId: row.product_id, colorId: row.color_id, size: row.size, from: row.stock, to: input.data.stock
      });
      await client.query('COMMIT');
    } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
    await opts.invalidateCatalog?.();
    return reply.header('Cache-Control', 'no-store').send({ ok: true, stock: input.data.stock });
  });

  app.patch('/v1/admin/products/:id/visibility', async (req, reply) => {
    const actor = await check(req, reply, 'products:write');
    if (!actor) return;
    const id = productIdentity.safeParse((req.params as { id: string }).id);
    const parsed = z.object({ active: z.boolean() }).strict().safeParse(req.body);
    if (!id.success || !parsed.success) return reply.code(400).send({ error: 'invalid_payload' });
    const client = await pool.connect();
    let status = '';
    try {
      await client.query('BEGIN');
      const found = await client.query('SELECT images,active FROM products WHERE id=$1 FOR UPDATE', [id.data]);
      if (!found.rowCount) { await client.query('ROLLBACK'); return reply.code(404).send({ error: 'not_found' }); }
      if (parsed.data.active && !(found.rows[0].images as unknown[]).length) {
        await client.query('ROLLBACK'); return reply.code(409).send({ error: 'image_required_to_publish' });
      }
      // Taking a published product off sale archives it; an unpublished draft stays a draft.
      const updated = await client.query<{ active: boolean; archived_at: Date | null }>(
        'UPDATE products SET archived_at=CASE WHEN $1 THEN NULL WHEN active THEN now() ELSE archived_at END,' +
        'active=$1 WHERE id=$2 RETURNING active,archived_at', [parsed.data.active, id.data]);
      status = statusOf(updated.rows[0]);
      await recordAudit(client, actor.id, 'products.visibility', id.data, {
        active: parsed.data.active, from: found.rows[0].active, status });
      await client.query('COMMIT');
    } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
    await opts.invalidateCatalog?.();
    return reply.header('Cache-Control', 'no-store').send({ ok: true, active: parsed.data.active, status });
  });
}
