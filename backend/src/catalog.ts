import { and, asc, desc, eq, exists, gt, gte, ilike, inArray, lte, count, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from './db/connection';
import { products, variants } from './db/schema';
import { normalizeSearch } from './search';
import { getLastPieceSetting } from './last-piece';
import { withLastPieceOffers } from '../../src/lib/last-piece-discount';

export const filters = z.object({
  category: z.enum(['shomiz','manto','tshirt']).optional(),
  q: z.string().max(100).optional(), size: z.string().max(20).optional(),
  color: z.string().max(80).optional(), min: z.coerce.number().int().min(0).optional(),
  max: z.coerce.number().int().min(0).optional(),
  stock: z.enum(['0','1']).optional(), sale: z.enum(['0','1']).optional(),
  sort: z.enum(['newest','price-asc','price-desc','featured']).default('featured'),
  page: z.coerce.number().int().min(1).max(1000).default(1),
  limit: z.coerce.number().int().min(1).max(48).default(12)
});

/** Public product data. Variants at exactly one unit carry their last-piece price while the owner's setting is on. */
async function hydrate(rows: (typeof products.$inferSelect)[]) {
  if (!rows.length) return [];
  const [records, setting] = await Promise.all([
    db.select().from(variants).where(inArray(variants.productId, rows.map(r => r.id))), getLastPieceSetting(db)]);
  return rows.map(row => withLastPieceOffers({
    id: row.id, slug: row.slug, name: row.name, category: row.category, description: row.description,
    price: row.price, compareAt: row.compareAt ?? undefined, images: row.images, colors: row.colors,
    sizes: row.sizes, material: row.material, fit: row.fit, care: row.care,
    createdAt: row.createdAt.toISOString(), featured: row.featured,
    variants: records.filter(v => v.productId === row.id).map(v => ({ colorId: v.colorId, size: v.size, stock: v.stock }))
  }, setting));
}

export async function listProducts(query: z.infer<typeof filters>) {
  const setting = query.sale === '1' ? await getLastPieceSetting(db) : undefined;
  // On sale: the product's own sale, or (while the setting is on) a variant at exactly one unit whose last-piece price,
  // the same rounding as variantOffer, is below the product's price.
  const lastPieceSale = setting?.enabled ? sql`(EXISTS (SELECT 1 FROM ${variants} WHERE ${variants.productId} = ${products.id}
      AND ${variants.stock} = 1)
    AND round(GREATEST(${products.price}, COALESCE(${products.compareAt}, 0)) * ${100 - setting.percent} / 100000.0) * 1000 < ${products.price})` : undefined;
  const variantFilter = and(eq(variants.productId, products.id),
    query.size ? eq(variants.size, query.size) : undefined,
    query.color ? sql`EXISTS (SELECT 1 FROM jsonb_array_elements(${products.colors}) AS color
      WHERE color->>'id' = ${variants.colorId}
      AND COALESCE(color->>'familyId', color->>'id') = ${query.color})` : undefined,
    query.stock === '1' ? gte(variants.stock, 1) : undefined);
  const where = and(
    eq(products.active, true),
    query.category ? eq(products.category, query.category) : undefined,
    query.q ? ilike(products.searchText, '%' + normalizeSearch(query.q).replace(/[%_\\]/g, '\\$&') + '%') : undefined,
    query.min !== undefined ? gte(products.price, query.min) : undefined,
    query.max !== undefined ? lte(products.price, query.max) : undefined,
    query.sale === '1' ? or(gt(products.compareAt, products.price), lastPieceSale) : undefined,
    query.size || query.color || query.stock === '1' ? exists(db.select({ id: variants.id }).from(variants).where(variantFilter)) : undefined);
  const [{ total }] = await db.select({ total: count() }).from(products).where(where);
  const pages = Math.max(1, Math.ceil(total / query.limit));
  const page = Math.min(query.page, pages);
  const order = query.sort === 'price-asc' ? [asc(products.price)] :
    query.sort === 'price-desc' ? [desc(products.price)] :
    query.sort === 'newest' ? [desc(products.createdAt)] :
    [desc(products.featured), desc(products.createdAt)];
  const rows = await db.select().from(products).where(where).orderBy(...order, asc(products.id))
    .limit(query.limit).offset((page-1)*query.limit);
  return { items: await hydrate(rows), total, page, pages };
}
export async function getProductsByIds(ids: string[]) {
  if (!ids.length) return [];
  const rows = await db.select().from(products).where(and(
    inArray(products.id, ids), eq(products.active, true)));
  const hydrated = await hydrate(rows);
  return ids.flatMap(id => hydrated.filter(product => product.id === id));
}

export async function getProduct(slug: string) {
  const found = await db.select().from(products).where(and(eq(products.slug, slug), eq(products.active, true))).limit(1);
  return (await hydrate(found))[0] ?? null;
}
