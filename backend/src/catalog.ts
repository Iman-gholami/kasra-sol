import { and, asc, desc, eq, exists, gte, ilike, inArray, lte, count } from 'drizzle-orm';
import { z } from 'zod';
import { db } from './db/connection';
import { products, variants } from './db/schema';
import { normalizeSearch } from './search';

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

async function hydrate(rows: (typeof products.$inferSelect)[]) {
  if (!rows.length) return [];
  const records = await db.select().from(variants).where(inArray(variants.productId, rows.map(r => r.id)));
  return rows.map(row => ({
    id: row.id, slug: row.slug, name: row.name, category: row.category, description: row.description,
    price: row.price, compareAt: row.compareAt ?? undefined, images: row.images, colors: row.colors,
    sizes: row.sizes, material: row.material, fit: row.fit, care: row.care,
    createdAt: row.createdAt.toISOString(), featured: row.featured,
    variants: records.filter(v => v.productId === row.id).map(v => ({ colorId: v.colorId, size: v.size, stock: v.stock }))
  }));
}

export async function listProducts(query: z.infer<typeof filters>) {
  const variantFilter = and(eq(variants.productId, products.id),
    query.size ? eq(variants.size, query.size) : undefined,
    query.color ? eq(variants.colorId, query.color) : undefined,
    query.stock === '1' ? gte(variants.stock, 1) : undefined);
  const where = and(
    query.category ? eq(products.category, query.category) : undefined,
    query.q ? ilike(products.searchText, '%' + normalizeSearch(query.q).replace(/[%_\\]/g, '\\$&') + '%') : undefined,
    query.min !== undefined ? gte(products.price, query.min) : undefined,
    query.max !== undefined ? lte(products.price, query.max) : undefined,
    query.sale === '1' ? gte(products.compareAt, 1) : undefined,
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
export async function getProduct(slug: string) {
  const found = await db.select().from(products).where(eq(products.slug, slug)).limit(1);
  return (await hydrate(found))[0] ?? null;
}
