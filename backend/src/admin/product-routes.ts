import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { createHash } from 'node:crypto';
import { normalizeSearch } from '../search';
import { pool } from '../db/connection';
import { productIdentity, productInput, type ProductInput } from './product-schema';
import type { Permission } from './permissions';
import { z } from 'zod';

type Actor = { id: string };
type Require = (req: FastifyRequest, reply: FastifyReply, permission: Permission) => Promise<Actor | null>;
function snapshotHash(product: Record<string, unknown>, variants: unknown[]): string {
  // A content-based ETag includes stock, so concurrent order stock changes invalidate stale edits.
  return createHash('sha256').update(JSON.stringify({ product, variants })).digest('hex');
}

async function guardWrite(req: FastifyRequest, reply: FastifyReply, check: Require) {
  const actor = await check(req, reply, 'products:write');
  if (!actor) return null;
  if (!await check(req, reply, 'products:price')) return null;
  if (!await check(req, reply, 'inventory:write')) return null;
  return actor;
}
async function audit(client: { query: (text: string, values: unknown[]) => Promise<unknown> },
                     actorId: string, action: string, target: string, data: object) {
  await client.query('INSERT INTO admin_audit_log(actor_id,action,target,details) VALUES($1,$2,$3,$4::jsonb)',
    [actorId, action, target, JSON.stringify(data)]);
}
async function writeVariants(client: { query: (text: string, values?: unknown[]) => Promise<unknown> },
                             id: string, rows: ProductInput['variants']) {
  // Variant rows are locked before modifications to coordinate with concurrent COD orders.
  await client.query('SELECT id FROM product_variants WHERE product_id=$1 ORDER BY product_id,color_id,size FOR UPDATE', [id]);
  // Existing SKU identity is preserved when possible; removed SKUs disappear only in this transaction.
  // This keeps order_items historical snapshots intact (they do not FK to variant IDs).
  for (const row of rows) await client.query(
    'INSERT INTO product_variants(product_id,color_id,size,stock) VALUES($1,$2,$3,$4) ' +
    'ON CONFLICT(product_id,color_id,size) DO UPDATE SET stock=EXCLUDED.stock',
    [id, row.colorId, row.size, row.stock]);
  const validPairs = rows.map(r => r.colorId + '\x1f' + r.size);
  const found = await client.query('SELECT id,color_id,size FROM product_variants WHERE product_id=$1', [id]);
  for (const row of (found as {rows:{id:string;color_id:string;size:string}[]}).rows) {
    if (!validPairs.includes(row.color_id + '\x1f' + row.size)) {
      await client.query('DELETE FROM product_variants WHERE id=$1', [row.id]);
    }
  }
}
export async function productAdminRoutes(app: FastifyInstance, check: Require,
  opts: { invalidateCatalog?: () => Promise<void> }) {

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
        care: product.care, featured: product.featured, active: product.active
      }
    });
  });

  app.post('/v1/admin/products', async (req, reply) => {
    const actor = await guardWrite(req, reply, check);
    if (!actor) return;
    const parsed = productInput.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_product', details: parsed.error.flatten() });
    const item = parsed.data;
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
      await audit(client, actor.id, 'products.created', item.id, { name: item.name, active: false });
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      if ((error as {code?: string}).code === '23505') return reply.code(409).send({ error: 'product_exists' });
      throw error;
    } finally { client.release(); }
    await opts.invalidateCatalog?.();
    return reply.code(201).header('Cache-Control', 'no-store').send({ ok: true, id: item.id, active: false });
  });

  app.put('/v1/admin/products/:id', async (req, reply) => {
    const actor = await guardWrite(req, reply, check);
    if (!actor) return;
    const id = productIdentity.safeParse((req.params as { id: string }).id);
    const parsed = productInput.safeParse(req.body);
    if (!id.success || !parsed.success || id.data !== parsed.data.id)
      return reply.code(400).send({ error: 'invalid_product' });
    const item = parsed.data;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const found = await client.query('SELECT * FROM products WHERE id=$1 FOR UPDATE', [id.data]);
      if (!found.rowCount) {
        await client.query('ROLLBACK'); return reply.code(404).send({ error: 'not_found' });
      }
      const current = await client.query(
        'SELECT color_id AS "colorId",size,stock FROM product_variants ' +
        'WHERE product_id=$1 ORDER BY color_id,size FOR UPDATE', [id.data]);
      const etag = req.headers['if-match'];
      if (typeof etag !== 'string' || !/^"[a-f0-9]{64}"$/.test(etag)) {
        await client.query('ROLLBACK'); return reply.code(428).send({ error: 'precondition_required' });
      }
      if (etag !== '"' + snapshotHash(found.rows[0], current.rows) + '"') {
        await client.query('ROLLBACK'); return reply.code(412).send({ error: 'product_changed_reload_required' });
      }
      await client.query(
        'UPDATE products SET slug=$2,name=$3,category=$4,description=$5,price=$6,compare_at=$7,' +
        'images=$8::jsonb,colors=$9::jsonb,sizes=$10::jsonb,material=$11,fit=$12,care=$13,featured=$14,' +
        'search_text=$15 WHERE id=$1',
        [id.data,item.slug,item.name,item.category,item.description,item.price,item.compareAt,
          JSON.stringify(item.images),JSON.stringify(item.colors),JSON.stringify(item.sizes),
          item.material,item.fit,item.care,item.featured,normalizeSearch(item.name+' '+item.description)]);
      await writeVariants(client, id.data, item.variants);
      await audit(client, actor.id, 'products.updated', id.data, { name: item.name, variantCount: item.variants.length });
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      if ((error as {code?: string}).code === '23505') return reply.code(409).send({ error: 'product_exists' });
      throw error;
    } finally { client.release(); }
    await opts.invalidateCatalog?.();
    return reply.header('Cache-Control', 'no-store').send({ ok: true, id: id.data });
  });

  app.patch('/v1/admin/products/:id/visibility', async (req, reply) => {
    const actor = await check(req, reply, 'products:write');
    if (!actor) return;
    const id = productIdentity.safeParse((req.params as { id: string }).id);
    const parsed = z.object({ active: z.boolean() }).strict().safeParse(req.body);
    if (!id.success || !parsed.success) return reply.code(400).send({ error: 'invalid_payload' });
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const found = await client.query('SELECT images FROM products WHERE id=$1 FOR UPDATE', [id.data]);
      if (!found.rowCount) { await client.query('ROLLBACK'); return reply.code(404).send({ error: 'not_found' }); }
      if (parsed.data.active && !(found.rows[0].images as unknown[]).length) {
        await client.query('ROLLBACK'); return reply.code(409).send({ error: 'image_required_to_publish' });
      }
      await client.query('UPDATE products SET active=$1 WHERE id=$2', [parsed.data.active, id.data]);
      await audit(client, actor.id, 'products.visibility', id.data, { active: parsed.data.active });
      await client.query('COMMIT');
    } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
    await opts.invalidateCatalog?.();
    return reply.header('Cache-Control', 'no-store').send({ ok: true, active: parsed.data.active });
  });
}
