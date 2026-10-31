import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';
import { z } from 'zod';
import { categories } from '../../src/data/facets';

type CatalogVariant = { id: string; colorId: string; size: string; stock: number };
export type CatalogProduct = {
  id: string; slug: string; name: string; category: string; description: string;
  price: number; compareAt: number | null; images: string[];
  colors: { id: string; name: string; hex: string }[];
  material: string; fit: string; care: string; variants: CatalogVariant[];
};
export type CatalogStore = {
  list(page: number, perPage: number): Promise<CatalogProduct[]>;
  get(id: string): Promise<CatalogProduct | null>;
};

type ProductRow = Omit<CatalogProduct, 'variants'>;
type VariantRow = CatalogVariant & { productId: string };
const PRODUCT_COLUMNS = 'id,slug,name,category,description,price,compare_at AS "compareAt",' +
  'images,colors,material,fit,care';

/** Read current stock directly; do not use the storefront's time-limited catalog cache. */
export function postgresShopinoCatalog(pool: Pool): CatalogStore {
  async function withVariants(products: ProductRow[]): Promise<CatalogProduct[]> {
    if (!products.length) return [];
    const found = await pool.query<VariantRow>(
      'SELECT id,product_id AS "productId",color_id AS "colorId",size,stock FROM product_variants ' +
      'WHERE product_id=ANY($1::varchar[]) ORDER BY product_id,color_id,size,id', [products.map(p => p.id)]);
    const grouped = new Map<string, CatalogVariant[]>();
    for (const { productId, ...variant } of found.rows) {
      const bucket = grouped.get(productId) ?? [];
      bucket.push(variant);
      grouped.set(productId, bucket);
    }
    return products.map(product => ({ ...product, variants: grouped.get(product.id) ?? [] }));
  }
  return {
    async list(page, perPage) {
      const result = await pool.query<ProductRow>(
        'SELECT ' + PRODUCT_COLUMNS + ' FROM products WHERE active=true ORDER BY id LIMIT $1 OFFSET $2',
        [perPage, (page - 1) * perPage]);
      return withVariants(result.rows);
    },
    async get(id) {
      const result = await pool.query<ProductRow>(
        'SELECT ' + PRODUCT_COLUMNS + ' FROM products WHERE active=true AND id=$1 LIMIT 1', [id]);
      return (await withVariants(result.rows))[0] ?? null;
    }
  };
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;',
    '"': '&quot;', "'": '&#39;' })[char]!);
}
function siteOrigin(value: string): URL | null {
  try {
    const url = new URL(value);
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password ||
      url.pathname !== '/' || url.search || url.hash) return null;
    return url;
  } catch { return null; }
}
function catalogItem(product: CatalogProduct, site: URL) {
  const specs = [
    { name: 'جنس', value: product.material },
    { name: 'مدل', value: product.fit },
    { name: 'روش نگهداری', value: product.care }
  ].filter(item => item.value);
  const price = Math.max(product.price, product.compareAt ?? product.price);
  return {
    id: product.id, title: product.name,
    categories: [categories.find(category => category.slug === product.category)?.title ?? product.category],
    specs, description: escapeHtml(product.description).replace(/\r?\n/g, '<br>'),
    images: product.images.filter(image => image.startsWith('/') && !image.startsWith('//'))
      .map(image => new URL(image, site).href),
    url: new URL('/product/' + encodeURIComponent(product.slug), site).href,
    variations: product.variants.map(variant => ({
      id: variant.id, price, discounted_price: product.price, stock_quantity: variant.stock, images: [],
      attributes: [
        { key: 'size', name: 'سایز', value: variant.size },
        { key: 'color', name: 'رنگ',
          value: product.colors.find(color => color.id === variant.colorId)?.name ?? variant.colorId }
      ]
    }))
  };
}
const pagination = z.object({ page: z.coerce.number().int().min(1).max(10_000).default(1),
  per_page: z.coerce.number().int().min(1).max(100).default(50) });
const productId = z.string().regex(/^[a-z0-9][a-z0-9-]{1,78}$/);

/** Shopino product export: an array for list and the identical object for one product. */
export async function shopinoCatalogRoutes(app: FastifyInstance, options: { store: CatalogStore; siteUrl: string }) {
  app.get('/v1/shopino/products', async (request, reply) => {
    const query = pagination.safeParse(request.query);
    if (!query.success) return reply.code(400).send({ error: 'invalid_query' });
    const site = siteOrigin(options.siteUrl);
    if (!site) return reply.code(503).send({ error: 'site_url_not_configured' });
    const items = await options.store.list(query.data.page, query.data.per_page);
    return reply.header('Cache-Control', 'no-store').send(items.map(item => catalogItem(item, site)));
  });
  app.get('/v1/shopino/products/:id', async (request, reply) => {
    const id = productId.safeParse((request.params as { id: string }).id);
    if (!id.success) return reply.code(404).send({ error: 'not_found' });
    const site = siteOrigin(options.siteUrl);
    if (!site) return reply.code(503).send({ error: 'site_url_not_configured' });
    const item = await options.store.get(id.data);
    if (!item) return reply.code(404).send({ error: 'not_found' });
    return reply.header('Cache-Control', 'no-store').send(catalogItem(item, site));
  });
}
